import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Role, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { createBackup } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

// Roles default sistem (level 1-5 tidak bisa dihapus)
export const ROLES_DEFAULT = [
  { id: 1, nama_role: 'Pimpinan TPQ', level: 1, is_system: true, deskripsi: 'Pimpinan / Kepala TPQ – akses penuh', akses_default: null },
  { id: 2, nama_role: 'Sekretaris',   level: 2, is_system: true, deskripsi: 'Sekretaris – kelola santri & laporan', akses_default: ['dashboard','santri','tambah_santri','bayar','pembayaran_lain','laporan','jurnal','saran','export_database'] },
  { id: 3, nama_role: 'Bendahara',    level: 3, is_system: true, deskripsi: 'Bendahara – kelola keuangan',          akses_default: ['dashboard','santri','bayar','pembayaran_lain','infak','pengeluaran','dana','jurnal','laporan','pengaturan','export_database'] },
  { id: 4, nama_role: 'Pengajar',     level: 4, is_system: true, deskripsi: 'Pengajar / Ustadz – akses terbatas',  akses_default: ['dashboard','santri','bayar','saran'] },
  { id: 5, nama_role: 'Lainnya',      level: 5, is_system: true, deskripsi: 'Role lainnya – akses terbatas',       akses_default: ['dashboard'] },
];

// GET - Ambil semua role
export async function GET(request) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    const roles = await Role.findAll({ order: [['level', 'ASC'], ['id', 'ASC']] });

    return NextResponse.json({ success: true, data: roles });
  } catch (error) {
    console.error('Get roles error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST - Tambah role baru (hanya admin id=1 / Pimpinan TPQ)
export async function POST(request) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    if (auth.user.id !== 1 && auth.user.jabatan !== 'Pimpinan TPQ') {
      return NextResponse.json(
        { success: false, pesan: 'Hanya Pimpinan TPQ yang dapat menambah role' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { nama_role, deskripsi, akses_default, pin } = body;

    // PIN verification
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });
    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    if (!nama_role) {
      return NextResponse.json({ success: false, pesan: 'Nama role wajib diisi' }, { status: 400 });
    }

    const existing = await Role.findOne({ where: { nama_role } });
    if (existing) {
      return NextResponse.json({ success: false, pesan: 'Nama role sudah ada' }, { status: 400 });
    }

    const role = await Role.create({
      nama_role,
      deskripsi: deskripsi || null,
      akses_default: akses_default || null,
      is_system: false,
      level: 99,
    });

    // Backup
    await createBackup('Tambah Role', 'roles', null, role.toJSON(), auth.user.id);

    // Kirim salinan email
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Role Baru Ditambahkan',
        deskripsi: `Role baru: ${nama_role}`,
        detail: '',
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
    } catch (emailErr) {
      console.error('Gagal kirim email salinan:', emailErr);
    }

    return NextResponse.json({ success: true, pesan: 'Role berhasil ditambahkan', data: role }, { status: 201 });
  } catch (error) {
    console.error('Create role error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
