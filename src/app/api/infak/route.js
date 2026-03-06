import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { InfakSedekah, Admin, JurnalKas } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';
import { createBackup, generateKodeInvoice } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

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
    
    // PIN verification
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });
    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });
    
    if (!nama_donatur || !nominal) {
      return NextResponse.json(
        { success: false, pesan: 'Nama donatur dan nominal harus diisi' },
        { status: 400 }
      );
    }
    
    t = await sequelize.transaction();

    const kodeTransaksi = generateKodeInvoice('INF');
    
    const infak = await InfakSedekah.create({
      kode_transaksi: kodeTransaksi,
      nama_donatur,
      nominal,
      catatan,
      tgl_terima: tgl_terima || new Date(),
      admin_id: auth.user.id,
    }, { transaction: t });
    
    // Ambil saldo terakhir
    const lastJurnal = await JurnalKas.findOne({
      order: [['id', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const saldoBerjalan = (lastJurnal ? parseFloat(lastJurnal.saldo_berjalan) : 0) + parseFloat(nominal);
    
    // Catat ke jurnal kas
    await JurnalKas.create({
      tgl_transaksi: tgl_terima || new Date(),
      jenis: 'Masuk',
      nominal,
      referensi_kode: kodeTransaksi,
      keterangan: `Infak/Sedekah dari ${nama_donatur}`,
      saldo_berjalan: saldoBerjalan,
      admin_id: auth.user.id,
    }, { transaction: t });
    
    await t.commit();
    
    // Backup
    await createBackup('Tambah Infak/Sedekah', 'infak_sedekah', null, infak.toJSON(), auth.user.id);
    
    // Kirim salinan email ke Pimpinan TPQ & Bendahara
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Infak/Sedekah Baru',
        deskripsi: `Infak dari ${nama_donatur}`,
        detail: `<table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Donatur</strong></td><td style="padding:5px;border:1px solid #ddd;">${nama_donatur}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Nominal</strong></td><td style="padding:5px;border:1px solid #ddd;">Rp ${parseFloat(nominal).toLocaleString('id-ID')}</td></tr>
          ${catatan ? `<tr><td style="padding:5px;border:1px solid #ddd;"><strong>Catatan</strong></td><td style="padding:5px;border:1px solid #ddd;">${catatan}</td></tr>` : ''}
        </table>`,
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
    } catch (emailErr) {
      console.error('Gagal kirim email salinan:', emailErr);
    }
    
    return NextResponse.json({
      success: true,
      pesan: 'Infak/sedekah berhasil dicatat',
      data: infak,
    }, { status: 201 });
  } catch (error) {
    if (t) await t.rollback();
    console.error('Create infak error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
