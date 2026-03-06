import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Santri, PembayaranSPP, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { createBackup } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

const ROLE_BISA_KELOLA_STATUS = ['Pimpinan TPQ', 'Sekretaris', 'Bendahara'];
const ROLE_BISA_EDIT_SANTRI   = ['Pimpinan TPQ', 'Sekretaris', 'Bendahara', 'Pengajar'];

// GET - Ambil santri berdasarkan ID (auth required)
export async function GET(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    await sequelize.authenticate();
    
    const { id } = await params;
    
    const santri = await Santri.findByPk(id, {
      include: [{
        model: PembayaranSPP,
        as: 'pembayaran',
        include: [{
          model: Admin,
          as: 'admin',
          attributes: ['nama_lengkap'],
        }],
        order: [['tahun_spp', 'DESC'], ['bulan_spp', 'DESC']],
      }],
    });
    
    if (!santri) {
      return NextResponse.json(
        { success: false, pesan: 'Santri tidak ditemukan' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: santri,
    });
  } catch (error) {
    console.error('Get santri error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}

// PUT - Update santri
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

    // PIN verification
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });
    if (!body.pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(body.pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });
    
    const santri = await Santri.findByPk(id);
    if (!santri) {
      return NextResponse.json(
        { success: false, pesan: 'Santri tidak ditemukan' },
        { status: 404 }
      );
    }
    
    const dataSebelum = santri.toJSON();
    const { pin, ...updateData } = body;

    // Cek role untuk edit data umum
    if (!ROLE_BISA_EDIT_SANTRI.includes(auth.user.jabatan)) {
      return NextResponse.json(
        { success: false, pesan: 'Jabatan Anda tidak memiliki akses untuk mengedit data santri' },
        { status: 403 }
      );
    }

    if (updateData.status_aktif !== undefined) {
      if (!ROLE_BISA_KELOLA_STATUS.includes(auth.user.jabatan)) {
        return NextResponse.json(
          { success: false, pesan: 'Tidak memiliki akses untuk ubah status santri' },
          { status: 403 }
        );
      }

      if (Boolean(updateData.status_aktif) === false) {
        updateData.tgl_nonaktif = new Date().toISOString().split('T')[0];
      } else {
        updateData.tgl_nonaktif = null;
      }
    }

    // Normalisasi no_absen
    if ('no_absen' in updateData) {
      updateData.no_absen = updateData.no_absen ? parseInt(updateData.no_absen) : null;
    }

    await santri.update(updateData);
    
    // Backup
    await createBackup('Update Santri', 'santri', dataSebelum, santri.toJSON(), auth.user.id);
    
    // Kirim salinan ke Pimpinan TPQ & Sekretaris
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Update Data Santri',
        deskripsi: `Data santri ${santri.nama_lengkap} diperbarui`,
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
      pesan: 'Santri berhasil diupdate',
      data: santri,
    });
  } catch (error) {
    console.error('Update santri error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}

// DELETE - Hapus santri (soft delete dengan PIN)
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
    
    const { id } = await params;
    const { pin } = await request.json();
    
    // Verifikasi PIN via bcrypt
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });
    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) {
      return NextResponse.json(
        { success: false, pesan: 'PIN tidak valid' },
        { status: 403 }
      );
    }
    
    const santri = await Santri.findByPk(id);
    if (!santri) {
      return NextResponse.json(
        { success: false, pesan: 'Santri tidak ditemukan' },
        { status: 404 }
      );
    }
    
    if (!ROLE_BISA_KELOLA_STATUS.includes(auth.user.jabatan)) {
      return NextResponse.json(
        { success: false, pesan: 'Tidak memiliki akses untuk menonaktifkan santri' },
        { status: 403 }
      );
    }

    const dataSebelum = santri.toJSON();
    
    // Soft delete - set status_aktif ke false
    await santri.update({ status_aktif: false, tgl_nonaktif: new Date().toISOString().split('T')[0] });
    
    // Backup
    await createBackup('Hapus Santri', 'santri', dataSebelum, null, auth.user.id);
    
    // Kirim salinan ke Pimpinan TPQ & Sekretaris
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Santri Dihapus',
        deskripsi: `Santri ${dataSebelum.nama_lengkap} (${dataSebelum.nik}) telah dinonaktifkan`,
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
      pesan: 'Santri berhasil dihapus',
    });
  } catch (error) {
    console.error('Delete santri error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
