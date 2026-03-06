import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Pengeluaran, Admin, JurnalKas } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';
import { createBackup, generateKodeInvoice } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

// GET - Ambil semua pengeluaran
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
    const kategori = searchParams.get('kategori');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;
    
    const where = {};
    
    if (tahun) {
      const startDate = new Date(tahun, 0, 1);
      const endDate = new Date(tahun, 11, 31);
      where.tgl_keluar = { [Op.between]: [startDate, endDate] };
    }
    
    if (kategori) {
      where.kategori = kategori;
    }
    
    const { count, rows } = await Pengeluaran.findAndCountAll({
      where,
      include: [
        { model: Admin, as: 'admin', attributes: ['nama_lengkap'] },
      ],
      order: [['tgl_keluar', 'DESC']],
      limit,
      offset,
    });
    
    // Hitung total pengeluaran
    const total = await Pengeluaran.sum('nominal', { where });
    
    return NextResponse.json({
      success: true,
      data: rows,
      total_pengeluaran: total || 0,
      pagination: {
        total: count,
        halaman: page,
        limit,
        totalHalaman: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get pengeluaran error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}

// POST - Tambah pengeluaran
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
    const { judul, nominal, catatan, tgl_keluar, kategori, pin } = body;
    
    // PIN verification
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });
    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });
    
    if (!judul || !nominal) {
      return NextResponse.json(
        { success: false, pesan: 'Judul dan nominal harus diisi' },
        { status: 400 }
      );
    }
    
    t = await sequelize.transaction();

    const kodePengeluaran = generateKodeInvoice('OUT');
    
    const pengeluaran = await Pengeluaran.create({
      kode_pengeluaran: kodePengeluaran,
      judul,
      nominal,
      catatan,
      tgl_keluar: tgl_keluar || new Date(),
      admin_id: auth.user.id,
      kategori: kategori || 'Lainnya',
    }, { transaction: t });
    
    // Ambil saldo terakhir
    const lastJurnal = await JurnalKas.findOne({
      order: [['id', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const saldoBerjalan = (lastJurnal ? parseFloat(lastJurnal.saldo_berjalan) : 0) - parseFloat(nominal);
    
    // Catat ke jurnal kas
    await JurnalKas.create({
      tgl_transaksi: tgl_keluar || new Date(),
      jenis: 'Keluar',
      nominal,
      referensi_kode: kodePengeluaran,
      keterangan: judul,
      saldo_berjalan: saldoBerjalan,
      admin_id: auth.user.id,
    }, { transaction: t });
    
    await t.commit();
    
    // Backup
    await createBackup('Tambah Pengeluaran', 'pengeluaran', null, pengeluaran.toJSON(), auth.user.id);
    
    // Kirim salinan email ke Pimpinan TPQ & Bendahara
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Pengeluaran Baru',
        deskripsi: `Pengeluaran: ${judul}`,
        detail: `<table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Judul</strong></td><td style="padding:5px;border:1px solid #ddd;">${judul}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Kategori</strong></td><td style="padding:5px;border:1px solid #ddd;">${kategori || 'Lainnya'}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Nominal</strong></td><td style="padding:5px;border:1px solid #ddd;">Rp ${parseFloat(nominal).toLocaleString('id-ID')}</td></tr>
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
      pesan: 'Pengeluaran berhasil dicatat',
      data: pengeluaran,
    }, { status: 201 });
  } catch (error) {
    if (t) await t.rollback();
    console.error('Create pengeluaran error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
