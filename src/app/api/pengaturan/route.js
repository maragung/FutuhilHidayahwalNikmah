import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Pengaturan, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { safeHexColor } from '@/lib/color';

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
