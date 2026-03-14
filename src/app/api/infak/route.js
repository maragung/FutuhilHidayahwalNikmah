import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { InfakSedekah, Admin, JurnalKas, Log } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';
import { createBackup, generateKodeInvoice, getClientTimeConfig } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';
import { claimIdempotency, logDuplicateAttempt, releaseGuard, respondWithGuard } from '@/lib/request-guard';
import { ValidationError, readDateValue, readOptionalText, readPositiveAmount, readRequiredText } from '@/lib/request-validation';

// GET - Ambil semua infak/sedekah
export async function GET(request) {
  try {
    await sequelize.authenticate();
    
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, pesan: auth.error },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;
    
    const where = {};
    
    if (tahun) {
      const startDate = new Date(tahun, 0, 1);
      const endDate = new Date(tahun, 11, 31, 23, 59, 59);
      where.tgl_terima = { [Op.between]: [startDate, endDate] };
    }
    
    const { count, rows } = await InfakSedekah.findAndCountAll({
      where,
      include: [
        { model: Admin, as: 'admin', attributes: ['nama_lengkap'] },
      ],
      order: [['tgl_terima', 'DESC']],
      limit,
      offset,
    });
    
    // Hitung total
    const total = await InfakSedekah.sum('nominal', { where });
    
    return NextResponse.json({
      success: true,
      data: rows,
      total_infak: total || 0,
      pagination: {
        total: count,
        halaman: page,
        limit,
        totalHalaman: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get infak error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}

// POST - Tambah infak/sedekah
export async function POST(request) {
  let t;
  let guard;
  
  try {
    await sequelize.authenticate();
    
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, pesan: auth.error },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { nama_donatur, nominal, catatan, tgl_terima, pin } = body;
    const namaDonatur = readRequiredText(nama_donatur, 'Nama donatur', { max: 100 });
    const nominalValue = readPositiveAmount(nominal, 'Nominal');
    const catatanText = readOptionalText(catatan, { max: 500 });
    const tanggalTerima = readDateValue(tgl_terima, 'Tanggal terima', new Date());

    const guardResult = await claimIdempotency({
      request,
      route: '/api/infak',
      actorScope: 'admin',
      actorId: auth.user.id,
      ttlMs: 15 * 60 * 1000,
      payload: {
        nama_donatur: namaDonatur,
        nominal: nominalValue,
        catatan: catatanText,
        tgl_terima: tanggalTerima.toISOString(),
      },
    });
    if (!guardResult.success) {
      return guardResult.response;
    }
    guard = guardResult.guard;
    
    // PIN verification
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });
    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });
    
    const recentDuplicate = await InfakSedekah.findOne({
      where: {
        nama_donatur: namaDonatur,
        nominal: nominalValue,
        createdAt: { [Op.gte]: new Date(Date.now() - 10 * 60 * 1000) },
      },
      order: [['id', 'DESC']],
    });
    if (recentDuplicate) {
      await logDuplicateAttempt('Infak duplikat ditolak', {
        admin_id: auth.user.id,
        recent_code: recentDuplicate.kode_transaksi,
        nama_donatur: namaDonatur,
        nominal: nominalValue,
      });
      return respondWithGuard(guard, { success: false, pesan: 'Infak serupa baru saja dicatat. Periksa riwayat sebelum mencoba lagi.' }, 409);
    }
    
    t = await sequelize.transaction();

    const kodeTransaksi = generateKodeInvoice('INF', getClientTimeConfig(request));
    
    const infak = await InfakSedekah.create({
      kode_transaksi: kodeTransaksi,
      nama_donatur: namaDonatur,
      nominal: nominalValue,
      catatan: catatanText,
      tgl_terima: tanggalTerima,
      admin_id: auth.user.id,
    }, { transaction: t });
    
    // Ambil saldo terakhir
    const lastJurnal = await JurnalKas.findOne({
      order: [['id', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const saldoBerjalan = (lastJurnal ? parseFloat(lastJurnal.saldo_berjalan) : 0) + nominalValue;
    
    // Catat ke jurnal kas
    await JurnalKas.create({
      tgl_transaksi: tanggalTerima,
      tanggal_aksi: tanggalTerima,
      jenis: 'Masuk',
      nominal: nominalValue,
      referensi_kode: kodeTransaksi,
      keterangan: `Infak/Sedekah dari ${namaDonatur}`,
      saldo_berjalan: saldoBerjalan,
      admin_id: auth.user.id,
    }, { transaction: t });
    
    await t.commit();
    
    // Backup
    await createBackup('Tambah Infak/Sedekah', 'infak_sedekah', null, infak.toJSON(), auth.user.id);

    // Audit log
    try {
      await Log.create({
        level: 'INFO',
        context: 'INFAK_SEDEKAH',
        message: `[${auth.user.username}] Catat infak/sedekah dari ${namaDonatur}`,
        detail: JSON.stringify({ nama_donatur: namaDonatur, nominal: nominalValue, catatan: catatanText }),
      });
    } catch (_) {}
    
    // Kirim salinan email ke Pimpinan TPQ & Bendahara
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Infak/Sedekah Baru',
        deskripsi: `Infak dari ${namaDonatur}`,
        detail: `<table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Donatur</strong></td><td style="padding:5px;border:1px solid #ddd;">${namaDonatur}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Nominal</strong></td><td style="padding:5px;border:1px solid #ddd;">Rp ${nominalValue.toLocaleString('id-ID')}</td></tr>
          ${catatanText ? `<tr><td style="padding:5px;border:1px solid #ddd;"><strong>Catatan</strong></td><td style="padding:5px;border:1px solid #ddd;">${catatanText}</td></tr>` : ''}
        </table>`,
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
    } catch (emailErr) {
      console.error('Gagal kirim email salinan:', emailErr);
    }
    
    return respondWithGuard(guard, {
      success: true,
      pesan: 'Infak/sedekah berhasil dicatat',
      data: infak,
    }, 201);
  } catch (error) {
    if (t) await t.rollback();
    if (error instanceof ValidationError) {
      return guard
        ? respondWithGuard(guard, { success: false, pesan: error.message }, 400)
        : NextResponse.json({ success: false, pesan: error.message }, { status: 400 });
    }
    await releaseGuard(guard);
    console.error('Create infak error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
