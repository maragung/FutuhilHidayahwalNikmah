import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { PembayaranLain, Santri, Kegiatan, Admin, JurnalKas } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';
import { createBackup, generateKodeInvoice, getClientTimeConfig } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';
import { claimIdempotency, logDuplicateAttempt, releaseGuard, respondWithGuard } from '@/lib/request-guard';
import { ValidationError, readEnumValue, readOptionalText, readPositiveAmount, readPositiveInteger } from '@/lib/request-validation';

// GET - Ambil semua pembayaran lain
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }
    await sequelize.authenticate();

    const { searchParams } = new URL(request.url);
    const kegiatan_id = searchParams.get('kegiatan_id');
    const santri_id = searchParams.get('santri_id');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;

    const where = {};
    if (kegiatan_id) where.kegiatan_id = kegiatan_id;
    if (santri_id) where.santri_id = santri_id;

    const { count, rows } = await PembayaranLain.findAndCountAll({
      where,
      include: [
        { model: Santri, as: 'santri', attributes: ['nik', 'nama_lengkap', 'jilid', 'is_subsidi'] },
        { model: Kegiatan, as: 'kegiatan', attributes: ['nama_kegiatan', 'nominal', 'gabung_saldo_utama'] },
        { model: Admin, as: 'admin', attributes: ['nama_lengkap'] },
      ],
      order: [['tgl_bayar', 'DESC']],
      limit,
      offset,
    });

    const total = await PembayaranLain.sum('nominal', { where }) || 0;

    return NextResponse.json({
      success: true,
      data: rows,
      total_pembayaran: total,
      pagination: {
        total: count,
        halaman: page,
        limit,
        totalHalaman: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get pembayaran lain error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST - Tambah pembayaran lain
export async function POST(request) {
  let t;
  let guard;
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }
    await sequelize.authenticate();

    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });

    const body = await request.json();
    const { santri_id, kegiatan_id, nominal, metode_bayar, keterangan, pin } = body;
    const santriId = readPositiveInteger(santri_id, 'Santri');
    const kegiatanId = readPositiveInteger(kegiatan_id, 'Kegiatan');
    const metodeBayar = readEnumValue(metode_bayar, 'Metode bayar', ['Tunai', 'Transfer'], 'Tunai');
    const keteranganText = readOptionalText(keterangan, { max: 500 });

    // PIN verification
    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    const kegiatan = await Kegiatan.findByPk(kegiatanId);
    if (!kegiatan) return NextResponse.json({ success: false, pesan: 'Kegiatan tidak ditemukan' }, { status: 404 });

    const nominalFinal = nominal ? readPositiveAmount(nominal, 'Nominal') : parseFloat(kegiatan.nominal);

    const guardResult = await claimIdempotency({
      request,
      route: '/api/pembayaran-lain',
      actorScope: 'admin',
      actorId: auth.user.id,
      ttlMs: 15 * 60 * 1000,
      payload: {
        santri_id: santriId,
        kegiatan_id: kegiatanId,
        nominal: nominalFinal,
        metode_bayar: metodeBayar,
        keterangan: keteranganText,
      },
    });
    if (!guardResult.success) {
      return guardResult.response;
    }
    guard = guardResult.guard;

    const santri = await Santri.findByPk(santriId);
    if (!santri) return respondWithGuard(guard, { success: false, pesan: 'Santri tidak ditemukan' }, 404);

    const recentDuplicate = await PembayaranLain.findOne({
      where: {
        santri_id: santriId,
        kegiatan_id: kegiatanId,
        nominal: nominalFinal,
        metode_bayar: metodeBayar,
        createdAt: { [Op.gte]: new Date(Date.now() - 10 * 60 * 1000) },
      },
      order: [['id', 'DESC']],
    });
    if (recentDuplicate) {
      await logDuplicateAttempt('Pembayaran lain duplikat ditolak', {
        admin_id: auth.user.id,
        santri_id: santriId,
        kegiatan_id: kegiatanId,
        recent_invoice: recentDuplicate.kode_invoice,
      });
      return respondWithGuard(guard, { success: false, pesan: 'Pembayaran serupa baru saja dicatat. Periksa riwayat sebelum mencoba lagi.' }, 409);
    }

    t = await sequelize.transaction();
    const kodeInvoice = generateKodeInvoice('PBL', getClientTimeConfig(request));

    const pembayaran = await PembayaranLain.create({
      kode_invoice: kodeInvoice,
      santri_id: santriId,
      kegiatan_id: kegiatanId,
      admin_id: auth.user.id,
      nominal: nominalFinal,
      tgl_bayar: new Date(),
      metode_bayar: metodeBayar,
      keterangan: keteranganText,
    }, { transaction: t });

    // Jurnal kas hanya jika kegiatan digabung ke saldo utama
    if (kegiatan.gabung_saldo_utama) {
      const lastJurnal = await JurnalKas.findOne({ order: [['id', 'DESC']], transaction: t, lock: t.LOCK.UPDATE });
      const saldoBerjalan = (lastJurnal ? parseFloat(lastJurnal.saldo_berjalan) : 0) + nominalFinal;

      await JurnalKas.create({
        tgl_transaksi: new Date(),
        tanggal_aksi: new Date(),
        jenis: 'Masuk',
        nominal: nominalFinal,
        referensi_kode: kodeInvoice,
        keterangan: `Pembayaran ${kegiatan.nama_kegiatan} - ${santri.nama_lengkap}`,
        saldo_berjalan: saldoBerjalan,
        admin_id: auth.user.id,
      }, { transaction: t });
    }

    await t.commit();

    await createBackup('Tambah Pembayaran Lain', 'pembayaran_lain', null, pembayaran.toJSON(), auth.user.id);

    // Email notifikasi
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      const waktu = new Date().toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
      await kirimEmailAksiAdmin({
        aksi: 'Pembayaran Lain',
        deskripsi: `Pembayaran ${kegiatan.nama_kegiatan} untuk ${santri.nama_lengkap}`,
        detail: `<table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Santri</strong></td><td style="padding:5px;border:1px solid #ddd;">${santri.nama_lengkap} (${santri.nik})</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Kegiatan</strong></td><td style="padding:5px;border:1px solid #ddd;">${kegiatan.nama_kegiatan}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Nominal</strong></td><td style="padding:5px;border:1px solid #ddd;">Rp ${nominalFinal.toLocaleString('id-ID')}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Metode</strong></td><td style="padding:5px;border:1px solid #ddd;">${metodeBayar}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Waktu</strong></td><td style="padding:5px;border:1px solid #ddd;">${waktu}</td></tr>
        </table>`,
        adminNama: admin.nama_lengkap,
        adminJabatan: admin.jabatan,
        emailTujuan,
      });
    } catch (e) { console.error('Email error:', e); }

    return respondWithGuard(guard, { success: true, pesan: 'Pembayaran berhasil dicatat', data: pembayaran }, 201);
  } catch (error) {
    if (t) await t.rollback();
    if (error instanceof ValidationError) {
      return guard
        ? respondWithGuard(guard, { success: false, pesan: error.message }, 400)
        : NextResponse.json({ success: false, pesan: error.message }, { status: 400 });
    }
    await releaseGuard(guard);
    console.error('Create pembayaran lain error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
