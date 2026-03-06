import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Pengaturan, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { safeHexColor } from '@/lib/color';
import { createBackup } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

// GET - Ambil semua pengaturan
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    await sequelize.authenticate();
    const pengaturan = await Pengaturan.findAll({ order: [['kunci', 'ASC']] });

    // Convert ke object key-value
    const data = {};
    pengaturan.forEach(p => {
      data[p.kunci] = p.nilai;
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get pengaturan error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// PUT - Update pengaturan (hanya Pimpinan TPQ & Bendahara)
export async function PUT(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    await sequelize.authenticate();
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin || !['Pimpinan TPQ', 'Bendahara'].includes(admin.jabatan)) {
      return NextResponse.json({ success: false, pesan: 'Anda tidak memiliki akses untuk mengubah pengaturan' }, { status: 403 });
    }

    const body = await request.json();
    const { pin, settings } = body;

    // Verifikasi PIN
    if (!pin) {
      return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    }
    const pinValid = await admin.validPin(pin);
    if (!pinValid) {
      return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });
    }

    // Ambil data sebelum untuk backup
    const sebelum = {};
    const allSettings = await Pengaturan.findAll();
    allSettings.forEach(p => { sebelum[p.kunci] = p.nilai; });

    // Update setiap setting
    const updated = [];
    for (const [kunci, nilai] of Object.entries(settings)) {
      let normalizedValue = nilai;
      // Kredensial SMTP (user/pass/from/secure) tidak disimpan via UI - hanya dari env/Vercel
      if (['smtp_user', 'smtp_pass', 'smtp_from', 'smtp_secure'].includes(kunci)) continue;
      if (kunci === 'warna_non_subsidi') {
        normalizedValue = safeHexColor(nilai, '#04B816');
      } else if (kunci === 'warna_subsidi') {
        normalizedValue = safeHexColor(nilai, '#045EB8');
      }
      await Pengaturan.setNilai(kunci, normalizedValue ?? '');
      updated.push(kunci);
    }

    // Backup
    const sesudah = {};
    updated.forEach(k => { sesudah[k] = settings[k]; });
    await createBackup('Update Pengaturan', 'pengaturan', sebelum, sesudah, auth.user.id);

    // Kirim salinan email
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Update Pengaturan',
        deskripsi: `${updated.length} pengaturan diperbarui: ${updated.join(', ')}`,
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
      pesan: `${updated.length} pengaturan berhasil diperbarui`,
      data: updated,
    });
  } catch (error) {
    console.error('Update pengaturan error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
