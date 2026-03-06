import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Santri, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';
import { createBackup } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

const ROLE_BISA_KELOLA_SANTRI = ['Pimpinan TPQ', 'Sekretaris', 'Bendahara', 'Pengajar'];
// GET - Ambil semua santri (auth required)
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    await sequelize.authenticate();
    
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || 'all';
    const bulanDaftarIni = searchParams.get('bulan_daftar_ini') === 'true';
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;
    
    const where = {};
    
    if (search) {
      where[Op.or] = [
        { nama_lengkap: { [Op.like]: `%${search}%` } },
        { nik: { [Op.like]: `%${search}%` } },
      ];
    }
    
    if (status === 'aktif') {
      where.status_aktif = true;
    } else if (status === 'nonaktif') {
      where.status_aktif = false;
    }

    if (bulanDaftarIni) {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      where.tgl_mendaftar = { [Op.between]: [start, end] };
    }
    
    const { count, rows } = await Santri.findAndCountAll({
      where,
      order: [['nama_lengkap', 'ASC']],
      limit,
      offset,
    });
    
    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        halaman: page,
        limit,
        totalHalaman: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get santri error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}

// POST - Tambah santri baru
export async function POST(request) {
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
    const { nik, nama_lengkap, jilid, alamat, nama_wali, no_telp_wali, email_wali, tgl_mendaftar, pin, is_subsidi, no_absen } = body;
    
    // PIN verification
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });
    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    // Cek role
    if (!ROLE_BISA_KELOLA_SANTRI.includes(admin.jabatan)) {
      return NextResponse.json({ success: false, pesan: 'Jabatan Anda tidak memiliki akses untuk menambah santri' }, { status: 403 });
    }
    
    if (!nik || !nama_lengkap) {
      return NextResponse.json(
        { success: false, pesan: 'NIK dan nama lengkap harus diisi' },
        { status: 400 }
      );
    }
    
    // Cek NIK sudah ada
    const existing = await Santri.findOne({ where: { nik } });
    if (existing) {
      return NextResponse.json(
        { success: false, pesan: 'NIK sudah terdaftar' },
        { status: 400 }
      );
    }
    
    const santri = await Santri.create({
      no_absen: no_absen ? parseInt(no_absen) : null,
      nik,
      nama_lengkap,
      jilid: jilid || 'Jilid 1',
      alamat,
      nama_wali,
      no_telp_wali,
      email_wali,
      tgl_mendaftar: tgl_mendaftar || new Date(),
      status_aktif: true,
      is_subsidi: Boolean(is_subsidi),
    });
    
    // Backup
    await createBackup('Tambah Santri', 'santri', null, santri.toJSON(), auth.user.id);
    
    // Kirim salinan email ke Pimpinan TPQ & Sekretaris
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Santri Baru Terdaftar',
        deskripsi: `Pendaftaran santri baru: ${nama_lengkap}`,
        detail: `<table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>NIK</strong></td><td style="padding:5px;border:1px solid #ddd;">${nik}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Nama</strong></td><td style="padding:5px;border:1px solid #ddd;">${nama_lengkap}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Jilid</strong></td><td style="padding:5px;border:1px solid #ddd;">${jilid || 'Jilid 1'}</td></tr>
          ${no_absen ? `<tr><td style="padding:5px;border:1px solid #ddd;"><strong>No. Absen</strong></td><td style="padding:5px;border:1px solid #ddd;">${no_absen}</td></tr>` : ''}
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
      pesan: 'Santri berhasil ditambahkan',
      data: santri,
    }, { status: 201 });
  } catch (error) {
    console.error('Create santri error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
