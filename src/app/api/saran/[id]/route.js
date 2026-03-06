import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Saran, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { createBackup } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

// PUT - Update status atau tanggapan saran
export async function PUT(request, { params }) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, pesan: auth.error },
        { status: 401 }
      );
    }

    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });

    const { id } = await params;
    const body = await request.json();
    const { status, tanggapan, pin } = body;

    // PIN wajib saat menulis tanggapan, opsional untuk ubah status saja
    if (tanggapan !== undefined) {
      if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi untuk mengirim tanggapan' }, { status: 400 });
      const pinValid = await admin.validPin(pin);
      if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });
    }

    const saran = await Saran.findByPk(id);
    if (!saran) {
      return NextResponse.json({ success: false, pesan: 'Saran tidak ditemukan' }, { status: 404 });
    }

    const dataSebelum = saran.toJSON();

    const updateData = {};
    if (status) updateData.status = status;
    if (tanggapan !== undefined) {
      updateData.tanggapan = tanggapan;
      updateData.admin_id = auth.user.id;
    }

    await saran.update(updateData);

    const updated = await Saran.findByPk(id, {
      include: [
        {
          model: Admin,
          as: 'admin',
          attributes: ['id', 'nama_lengkap', 'email'],
        },
      ],
    });

    // Backup & notifikasi
    await createBackup('Update Saran', 'saran', dataSebelum, updated.toJSON(), auth.user.id);
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Saran Diperbarui',
        deskripsi: `Status saran dari ${dataSebelum.nama_pengirim} diubah${status ? ` menjadi "${status}"` : ''}${tanggapan ? ' dan ditanggapi' : ''}`,
        detail: '',
        adminNama: admin.nama_lengkap,
        adminJabatan: admin.jabatan,
        emailTujuan,
      });
    } catch (e) { console.error('Email saran error:', e); }

    return NextResponse.json({
      success: true,
      pesan: 'Saran berhasil diupdate',
      data: updated,
    });
  } catch (error) {
    console.error('Error PUT saran:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}

// DELETE - Hapus saran
export async function DELETE(request, { params }) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, pesan: auth.error },
        { status: 401 }
      );
    }

    // Cek apakah admin adalah Pimpinan TPQ
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin || admin.jabatan !== 'Pimpinan TPQ') {
      return NextResponse.json(
        { success: false, pesan: 'Hanya Pimpinan TPQ yang dapat menghapus saran' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Verifikasi PIN
    let body = {};
    try { body = await request.json(); } catch { /* tanpa body */ }
    if (!body.pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(body.pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    const saran = await Saran.findByPk(id);
    if (!saran) {
      return NextResponse.json({ success: false, pesan: 'Saran tidak ditemukan' }, { status: 404 });
    }

    const dataSebelum = saran.toJSON();
    await saran.destroy();

    // Backup & notifikasi
    await createBackup('Hapus Saran', 'saran', dataSebelum, null, auth.user.id);
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Saran Dihapus',
        deskripsi: `Saran dari ${dataSebelum.nama_pengirim} (${dataSebelum.kategori}) telah dihapus`,
        detail: '',
        adminNama: admin.nama_lengkap,
        adminJabatan: admin.jabatan,
        emailTujuan,
      });
    } catch (e) { console.error('Email saran error:', e); }

    return NextResponse.json({
      success: true,
      pesan: 'Saran berhasil dihapus',
    });
  } catch (error) {
    console.error('Error DELETE saran:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
