import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Kegiatan, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';
import { createBackup } from '@/lib/utils';

// GET - Ambil semua kegiatan
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }
    await sequelize.authenticate();

    const kegiatan = await Kegiatan.findAll({
      include: [{ model: Admin, as: 'admin', attributes: ['nama_lengkap'] }],
      order: [['created_at', 'DESC']],
    });

    return NextResponse.json({ success: true, data: kegiatan });
  } catch (error) {
    console.error('Get kegiatan error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST - Buat kegiatan baru
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
    const { nama_kegiatan, nominal, keterangan, pin, gabung_saldo_utama } = body;

    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    if (!nama_kegiatan || !nominal) {
      return NextResponse.json({ success: false, pesan: 'Nama kegiatan dan nominal wajib diisi' }, { status: 400 });
    }

    const kegiatan = await Kegiatan.create({
      nama_kegiatan,
      nominal,
      keterangan: keterangan || null,
      gabung_saldo_utama: gabung_saldo_utama !== undefined ? Boolean(gabung_saldo_utama) : true,
      admin_id: auth.user.id,
    });

    // Backup & notifikasi
    await createBackup('Tambah Kegiatan', 'kegiatan', null, kegiatan.toJSON(), auth.user.id);
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Kegiatan Baru Dibuat',
        deskripsi: `Kegiatan "${nama_kegiatan}" dengan nominal Rp ${Number(nominal).toLocaleString('id-ID')} telah dibuat.`,
        detail: '',
        adminNama: admin.nama_lengkap,
        adminJabatan: admin.jabatan,
        emailTujuan,
      });
    } catch (e) { console.error('Email error:', e); }

    return NextResponse.json({ success: true, pesan: 'Kegiatan berhasil dibuat', data: kegiatan }, { status: 201 });
  } catch (error) {
    console.error('Create kegiatan error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
