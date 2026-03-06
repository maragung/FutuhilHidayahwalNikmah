import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import Admin from '@/lib/models/Admin';
import sequelize from '@/lib/db';
import { createBackup } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

// POST - Set atau update PIN sendiri
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }
    await sequelize.authenticate();

    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });

    const body = await request.json();
    const { password, new_pin } = body;

    // Verifikasi password untuk keamanan
    if (!password) return NextResponse.json({ success: false, pesan: 'Password wajib diisi untuk verifikasi' }, { status: 400 });
    const passValid = await admin.validPassword(password);
    if (!passValid) return NextResponse.json({ success: false, pesan: 'Password tidak valid' }, { status: 403 });

    if (!new_pin || !/^\d{6}$/.test(new_pin)) {
      return NextResponse.json({ success: false, pesan: 'PIN harus 6 digit angka' }, { status: 400 });
    }

    admin.pin = new_pin;
    await admin.save();

    // Backup & notifikasi perubahan PIN
    try {
      await createBackup('Ubah PIN', 'admins', { id: admin.id, pin: '(lama)' }, { id: admin.id, pin: '(baru)' }, auth.user.id);
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'PIN Akun Diubah',
        deskripsi: `PIN akun ${admin.nama_lengkap} telah diperbarui melalui halaman Akun.`,
        detail: '',
        adminNama: admin.nama_lengkap,
        adminJabatan: admin.jabatan || 'Admin',
        emailTujuan,
      });
    } catch (e) { console.error('Log/email PIN error:', e); }

    return NextResponse.json({ success: true, pesan: 'PIN berhasil diperbarui' });
  } catch (error) {
    console.error('Set PIN error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// PUT - Verifikasi PIN (cek valid atau tidak)
export async function PUT(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }
    await sequelize.authenticate();

    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });

    const body = await request.json();
    if (!body.pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });

    if (!admin.pin) {
      return NextResponse.json({ success: false, pesan: 'PIN belum diatur. Silakan atur PIN terlebih dahulu.', has_pin: false }, { status: 400 });
    }

    const valid = await admin.validPin(body.pin);
    return NextResponse.json({ success: valid, pesan: valid ? 'PIN valid' : 'PIN tidak valid' });
  } catch (error) {
    console.error('Verify PIN error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// GET - Cek apakah admin sudah punya PIN
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }
    await sequelize.authenticate();

    const admin = await Admin.findByPk(auth.user.id, { attributes: ['id', 'pin'] });
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });

    return NextResponse.json({ success: true, has_pin: !!admin.pin });
  } catch (error) {
    console.error('Check PIN error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
