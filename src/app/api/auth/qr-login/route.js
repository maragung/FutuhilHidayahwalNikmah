import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import Admin from '@/lib/models/Admin';
import { createAuthResponse } from '@/lib/auth';
import sequelize from '@/lib/db';
import QRCode from 'qrcode';

export async function POST(request) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ success: false, pesan: 'Password wajib diisi' }, { status: 400 });
    }

    const admin = await Admin.findByPk(auth.user.id);
    if (!admin || !admin.is_active) {
      return NextResponse.json({ success: false, pesan: 'Akun tidak ditemukan atau nonaktif' }, { status: 404 });
    }

    const passwordValid = await admin.validPassword(password);
    if (!passwordValid) {
      return NextResponse.json({ success: false, pesan: 'Password tidak valid' }, { status: 403 });
    }

    // Bangun server URL dari header request
    const host = request.headers.get('host') || 'localhost:3000';
    const proto = request.headers.get('x-forwarded-proto') || 'http';
    const serverUrl = `${proto}://${host}`;

    const authData = createAuthResponse(admin, '30d');
    const deepLink = `tpqlink://login?token=${encodeURIComponent(authData.token)}&user=${admin.id}&server=${encodeURIComponent(serverUrl)}`;

    // Buat QR code sebagai base64 data URL
    const qrDataUrl = await QRCode.toDataURL(deepLink, {
      errorCorrectionLevel: 'M',
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    return NextResponse.json({
      success: true,
      pesan: 'QR login berhasil dibuat',
      data: {
        qr_data_url: qrDataUrl,
        deep_link: deepLink,
        server_url: serverUrl,
        token: authData.token,
        expires_in_days: 30,
      },
    });
  } catch (error) {
    console.error('QR login error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
