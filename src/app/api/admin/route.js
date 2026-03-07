import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import Admin from '@/lib/models/Admin';
import sequelize from '@/lib/db';
import { createBackup } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

// GET - Ambil semua admin
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
    
    // Hanya Pimpinan TPQ yang bisa lihat daftar admin
    if (auth.user.jabatan !== 'Pimpinan TPQ') {
      return NextResponse.json(
        { success: false, pesan: 'Tidak memiliki akses' },
        { status: 403 }
      );
    }
    
    const admins = await Admin.findAll({
      attributes: ['id', 'username', 'nama_lengkap', 'jabatan', 'email', 'is_active', 'akses', 'created_at'],
      order: [['nama_lengkap', 'ASC']],
    });
    
    return NextResponse.json({
      success: true,
      data: admins,
    });
  } catch (error) {
    console.error('Get admins error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}

// POST - Tambah admin baru (hanya Pimpinan TPQ)
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
    
    // Hanya Pimpinan TPQ yang bisa tambah admin
    if (auth.user.jabatan !== 'Pimpinan TPQ') {
      return NextResponse.json(
        { success: false, pesan: 'Hanya Pimpinan TPQ yang dapat menambah admin' },
        { status: 403 }
      );
    }
    
    const body = await request.json();
    const { nama_lengkap, jabatan, email, username, password, pin: adminPin, akses } = body;
    
    // PIN verification for the action
    const currentAdmin = await Admin.findByPk(auth.user.id);
    if (!currentAdmin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });
    if (!body.verify_pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await currentAdmin.validPin(body.verify_pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });
    
    if (!nama_lengkap || !jabatan || !email || !password || !username) {
      return NextResponse.json(
        { success: false, pesan: 'Nama lengkap, jabatan, username, email, dan password wajib diisi' },
        { status: 400 }
      );
    }

    const normalizedUsername = (username || email.split('@')[0] || '').trim().toLowerCase();
    if (!normalizedUsername || normalizedUsername.length < 3) {
      return NextResponse.json(
        { success: false, pesan: 'Username minimal 3 karakter' },
        { status: 400 }
      );
    }
    
    // Cek email sudah ada
    const existing = await Admin.findOne({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { success: false, pesan: 'Email sudah terdaftar' },
        { status: 400 }
      );
    }

    const existingUsername = await Admin.findOne({ where: { username: normalizedUsername } });
    if (existingUsername) {
      return NextResponse.json(
        { success: false, pesan: 'Username sudah terdaftar' },
        { status: 400 }
      );
    }
    
    const admin = await Admin.create({
      nama_lengkap,
      jabatan,
      username: normalizedUsername,
      email,
      password,
      pin: adminPin || '123456', // PIN default 123456, admin perlu ubah sendiri via halaman Akun
      akses: akses || null,
      is_active: true,
    });
    
    // Backup
    await createBackup('Tambah Admin', 'admins', null, {
      id: admin.id,
      nama_lengkap: admin.nama_lengkap,
      jabatan: admin.jabatan,
      email: admin.email,
    }, auth.user.id);
    
    // Kirim salinan ke semua admin
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Admin Baru Ditambahkan',
        deskripsi: `Admin baru: ${admin.nama_lengkap} (${admin.jabatan})`,
        detail: '',
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
    } catch (emailErr) {
      console.error('Gagal kirim email salinan:', emailErr);
    }
    
    return NextResponse.json({
      success: true,
      pesan: 'Admin berhasil ditambahkan. Minta admin mengatur PIN via halaman Akun.',
      data: {
        id: admin.id,
        username: admin.username,
        nama_lengkap: admin.nama_lengkap,
        jabatan: admin.jabatan,
        email: admin.email,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create admin error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
