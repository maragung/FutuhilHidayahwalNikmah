import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import Admin from '@/lib/models/Admin';
import sequelize from '@/lib/db';
import { createBackup } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

// DELETE - Hapus admin (hanya Pimpinan TPQ)
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
    
    // Hanya Pimpinan TPQ yang bisa hapus admin
    if (auth.user.jabatan !== 'Pimpinan TPQ') {
      return NextResponse.json(
        { success: false, pesan: 'Hanya Pimpinan TPQ yang dapat menghapus admin' },
        { status: 403 }
      );
    }
    
    const { id } = await params;
    
    // Tidak bisa hapus diri sendiri
    if (parseInt(id) === auth.user.id) {
      return NextResponse.json(
        { success: false, pesan: 'Tidak dapat menghapus akun sendiri' },
        { status: 400 }
      );
    }

    // Verifikasi PIN
    let body = {};
    try { body = await request.json(); } catch { /* tanpa body */ }
    const currentAdmin = await Admin.findByPk(auth.user.id);
    if (!currentAdmin) return NextResponse.json({ success: false, pesan: 'Admin pelaku tidak ditemukan' }, { status: 404 });
    if (!body.pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await currentAdmin.validPin(body.pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });
    
    const admin = await Admin.findByPk(id);
    if (!admin) {
      return NextResponse.json(
        { success: false, pesan: 'Admin tidak ditemukan' },
        { status: 404 }
      );
    }
    
    const dataSebelum = admin.toJSON();
    
    // Soft delete
    await admin.update({ is_active: false });
    
    // Backup
    await createBackup('Hapus Admin', 'admins', dataSebelum, null, auth.user.id);
    
    // Kirim salinan ke semua admin
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Admin Dinonaktifkan',
        deskripsi: `Admin ${dataSebelum.nama_lengkap} (${dataSebelum.jabatan}) telah dinonaktifkan`,
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
      pesan: 'Admin berhasil dihapus',
    });
  } catch (error) {
    console.error('Delete admin error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}

// PUT - Update admin
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
    
    const { id } = await params;
    const body = await request.json();
    
    // Admin biasa hanya bisa update diri sendiri
    if (auth.user.jabatan !== 'Pimpinan TPQ' && parseInt(id) !== auth.user.id) {
      return NextResponse.json(
        { success: false, pesan: 'Tidak memiliki akses' },
        { status: 403 }
      );
    }
    
    const admin = await Admin.findByPk(id);
    if (!admin) {
      return NextResponse.json(
        { success: false, pesan: 'Admin tidak ditemukan' },
        { status: 404 }
      );
    }
    
    // Pimpinan TPQ tidak boleh mengubah izin / jabatan Pimpinan TPQ lain
    if (
      auth.user.jabatan === 'Pimpinan TPQ' &&
      parseInt(id) !== auth.user.id &&
      admin.jabatan === 'Pimpinan TPQ' &&
      (body.jabatan !== undefined || body.is_active !== undefined || body.akses !== undefined || body.pin !== undefined)
    ) {
      return NextResponse.json(
        { success: false, pesan: 'Tidak dapat mengubah izin/jabatan sesama Pimpinan TPQ' },
        { status: 403 }
      );
    }

    const dataSebelum = admin.toJSON();
    
    // Field yang bisa diupdate
    const allowedFields = ['nama_lengkap', 'email', 'username', 'terima_email_perubahan'];
    if (auth.user.jabatan === 'Pimpinan TPQ') {
      allowedFields.push('jabatan', 'is_active', 'akses', 'pin');
    }
    
    const updateData = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'terima_email_perubahan') {
          updateData[field] = Boolean(body[field]);
        } else if (field === 'username') {
          const normalized = String(body[field] || '').trim().toLowerCase();
          if (!normalized || normalized.length < 3) {
            return NextResponse.json({ success: false, pesan: 'Username minimal 3 karakter' }, { status: 400 });
          }
          const duplicate = await Admin.findOne({ where: { username: normalized } });
          if (duplicate && duplicate.id !== admin.id) {
            return NextResponse.json({ success: false, pesan: 'Username sudah digunakan' }, { status: 400 });
          }
          updateData[field] = normalized;
        } else {
          updateData[field] = body[field];
        }
      }
    }
    
    // Update password jika ada — wajib verify PIN terlebih dahulu
    if (body.password) {
      const actingAdmin = await Admin.findByPk(auth.user.id) || (auth.user.email ? await Admin.findOne({ where: { email: auth.user.email } }) : null);
      if (!actingAdmin) {
        return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });
      }
      const pinCheck = body.verify_pin;
      if (!pinCheck) {
        return NextResponse.json({ success: false, pesan: 'PIN wajib diisi untuk mengubah password' }, { status: 400 });
      }
      const pinValid = await actingAdmin.validPin(pinCheck);
      if (!pinValid) {
        return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });
      }
      if (body.password.length < 6) {
        return NextResponse.json({ success: false, pesan: 'Password minimal 6 karakter' }, { status: 400 });
      }
      updateData.password = body.password;
    }
    
    await admin.update(updateData);
    
    // Backup
    await createBackup('Update Admin', 'admins', dataSebelum, admin.toJSON(), auth.user.id);

    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Update Admin',
        deskripsi: `Data admin ${admin.nama_lengkap} diperbarui`,
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
      pesan: 'Admin berhasil diupdate',
      data: {
        id: admin.id,
        username: admin.username,
        nama_lengkap: admin.nama_lengkap,
        jabatan: admin.jabatan,
        email: admin.email,
        terima_email_perubahan: admin.terima_email_perubahan,
      },
    });
  } catch (error) {
    console.error('Update admin error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
