import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Kegiatan, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { createBackup } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

// DELETE - Hapus kegiatan
export async function DELETE(request, { params }) {
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
    const pinValid = await admin.validPin(body.pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    const { id } = await params;
    const kegiatan = await Kegiatan.findByPk(id);
    if (!kegiatan) return NextResponse.json({ success: false, pesan: 'Kegiatan tidak ditemukan' }, { status: 404 });

    const dataSebelum = kegiatan.toJSON();
    await kegiatan.update({ is_active: false });

    // Backup & notifikasi
    await createBackup('Nonaktifkan Kegiatan', 'kegiatan', dataSebelum, kegiatan.toJSON(), auth.user.id);
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Kegiatan Dinonaktifkan',
        deskripsi: `Kegiatan "${dataSebelum.nama_kegiatan}" telah dinonaktifkan`,
        detail: '',
        adminNama: admin.nama_lengkap,
        adminJabatan: admin.jabatan,
        emailTujuan,
      });
    } catch (e) { console.error('Email kegiatan error:', e); }

    return NextResponse.json({ success: true, pesan: 'Kegiatan berhasil dinonaktifkan' });
  } catch (error) {
    console.error('Delete kegiatan error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// PUT - Update kegiatan
export async function PUT(request, { params }) {
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
    const pinValid = await admin.validPin(body.pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    const { id } = await params;
    const kegiatan = await Kegiatan.findByPk(id);
    if (!kegiatan) return NextResponse.json({ success: false, pesan: 'Kegiatan tidak ditemukan' }, { status: 404 });

    const dataSebelum = kegiatan.toJSON();
    await kegiatan.update({
      nama_kegiatan: body.nama_kegiatan || kegiatan.nama_kegiatan,
      nominal: body.nominal || kegiatan.nominal,
      keterangan: body.keterangan !== undefined ? body.keterangan : kegiatan.keterangan,
      is_active: body.is_active !== undefined ? body.is_active : kegiatan.is_active,
      gabung_saldo_utama: body.gabung_saldo_utama !== undefined ? Boolean(body.gabung_saldo_utama) : kegiatan.gabung_saldo_utama,
    });

    // Backup & notifikasi
    await createBackup('Update Kegiatan', 'kegiatan', dataSebelum, kegiatan.toJSON(), auth.user.id);
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Kegiatan Diperbarui',
        deskripsi: `Kegiatan "${kegiatan.nama_kegiatan}" telah diperbarui`,
        detail: '',
        adminNama: admin.nama_lengkap,
        adminJabatan: admin.jabatan,
        emailTujuan,
      });
    } catch (e) { console.error('Email kegiatan error:', e); }

    return NextResponse.json({ success: true, pesan: 'Kegiatan berhasil diperbarui', data: kegiatan });
  } catch (error) {
    console.error('Update kegiatan error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
