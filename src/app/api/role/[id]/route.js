import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Role, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { createBackup } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

// PUT - Update role (hanya admin id=1 / Pimpinan TPQ)
export async function PUT(request, { params }) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    if (auth.user.id !== 1 && auth.user.jabatan !== 'Pimpinan TPQ') {
      return NextResponse.json(
        { success: false, pesan: 'Hanya Pimpinan TPQ yang dapat mengubah role' },
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

    const { id } = await params;
    const role = await Role.findByPk(id);
    if (!role) {
      return NextResponse.json({ success: false, pesan: 'Role tidak ditemukan' }, { status: 404 });
    }

    const dataSebelum = role.toJSON();

    // Role sistem (is_system=true) hanya boleh diupdate akses_default-nya, bukan nama
    const updateData = { akses_default: akses_default ?? role.akses_default };
    if (!role.is_system) {
      if (nama_role) updateData.nama_role = nama_role;
      if (deskripsi !== undefined) updateData.deskripsi = deskripsi;
    }

    await role.update(updateData);

    // Backup
    await createBackup('Update Role', 'roles', dataSebelum, role.toJSON(), auth.user.id);

    // Kirim salinan email
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Update Role',
        deskripsi: `Role ${role.nama_role} diperbarui`,
        detail: '',
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
    } catch (emailErr) {
      console.error('Gagal kirim email salinan:', emailErr);
    }

    return NextResponse.json({ success: true, pesan: 'Role berhasil diperbarui', data: role });
  } catch (error) {
    console.error('Update role error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// DELETE - Hapus role (hanya admin id=1, tidak bisa hapus role sistem)
export async function DELETE(request, { params }) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    if (auth.user.id !== 1 && auth.user.jabatan !== 'Pimpinan TPQ') {
      return NextResponse.json(
        { success: false, pesan: 'Hanya Pimpinan TPQ yang dapat menghapus role' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // PIN verification
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });
    if (!body.pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValidDel = await admin.validPin(body.pin);
    if (!pinValidDel) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    const { id } = await params;
    const role = await Role.findByPk(id);
    if (!role) {
      return NextResponse.json({ success: false, pesan: 'Role tidak ditemukan' }, { status: 404 });
    }

    if (role.is_system) {
      return NextResponse.json(
        { success: false, pesan: 'Role sistem tidak dapat dihapus' },
        { status: 400 }
      );
    }

    const dataSebelum = role.toJSON();
    await role.destroy();

    // Backup
    await createBackup('Hapus Role', 'roles', dataSebelum, null, auth.user.id);

    // Kirim salinan email
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Hapus Role',
        deskripsi: `Role ${dataSebelum.nama_role} dihapus`,
        detail: '',
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
    } catch (emailErr) {
      console.error('Gagal kirim email salinan:', emailErr);
    }

    return NextResponse.json({ success: true, pesan: 'Role berhasil dihapus' });
  } catch (error) {
    console.error('Delete role error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
