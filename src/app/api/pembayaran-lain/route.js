import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { PembayaranLain, Santri, Kegiatan, Admin, JurnalKas } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';
import { createBackup, generateKodeInvoice } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

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
  const t = await sequelize.transaction();
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

    // PIN verification
    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    if (!santri_id || !kegiatan_id) {
      return NextResponse.json({ success: false, pesan: 'Santri dan kegiatan harus dipilih' }, { status: 400 });
    }

    const santri = await Santri.findByPk(santri_id);
    if (!santri) return NextResponse.json({ success: false, pesan: 'Santri tidak ditemukan' }, { status: 404 });

    const kegiatan = await Kegiatan.findByPk(kegiatan_id);
    if (!kegiatan) return NextResponse.json({ success: false, pesan: 'Kegiatan tidak ditemukan' }, { status: 404 });

    const nominalFinal = nominal || parseFloat(kegiatan.nominal);
    const kodeInvoice = generateKodeInvoice('PBL');

    const pembayaran = await PembayaranLain.create({
      kode_invoice: kodeInvoice,
      santri_id,
      kegiatan_id,
      admin_id: auth.user.id,
      nominal: nominalFinal,
      tgl_bayar: new Date(),
      metode_bayar: metode_bayar || 'Tunai',
      keterangan,
    }, { transaction: t });

    // Jurnal kas hanya jika kegiatan digabung ke saldo utama
    if (kegiatan.gabung_saldo_utama) {
      const lastJurnal = await JurnalKas.findOne({ order: [['id', 'DESC']], transaction: t });
      const saldoBerjalan = (lastJurnal ? parseFloat(lastJurnal.saldo_berjalan) : 0) + nominalFinal;

      await JurnalKas.create({
        tgl_transaksi: new Date(),
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
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Metode</strong></td><td style="padding:5px;border:1px solid #ddd;">${metode_bayar || 'Tunai'}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Waktu</strong></td><td style="padding:5px;border:1px solid #ddd;">${waktu}</td></tr>
        </table>`,
        adminNama: admin.nama_lengkap,
        adminJabatan: admin.jabatan,
        emailTujuan,
      });
    } catch (e) { console.error('Email error:', e); }

    return NextResponse.json({ success: true, pesan: 'Pembayaran berhasil dicatat', data: pembayaran }, { status: 201 });
  } catch (error) {
    await t.rollback();
    console.error('Create pembayaran lain error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
