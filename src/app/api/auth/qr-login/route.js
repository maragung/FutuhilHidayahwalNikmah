import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import Admin from '@/lib/models/Admin';
import sequelize from '@/lib/db';
import QRCode from 'qrcode';
import { createNonce } from '@/lib/qr-nonce';

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

    // Build server URL from request headers
    const host      = request.headers.get('host') || 'localhost:3000';
    const proto     = request.headers.get('x-forwarded-proto') || 'http';
    const serverUrl = `${proto}://${host}`;

    // ── One-time nonce: valid 2 minutes, single-use ───────────────────────────
    // The QR code does NOT contain the JWT token — only a short-lived nonce.
    // The Flutter app exchanges this nonce for a real 30-day token via
    // POST /api/auth/qr-exchange. A screenshot of the QR is useless after
    // 2 minutes or after the first successful scan.
    const nonce    = createNonce(admin.id, serverUrl);
    const deepLink = `tpqlink://qr-exchange?nonce=${nonce}&server=${encodeURIComponent(serverUrl)}`;

    // Build QR image
    const qrDataUrl = await QRCode.toDataURL(deepLink, {
      errorCorrectionLevel: 'M',
      width: 300,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });

    return NextResponse.json({
      success: true,
      pesan: 'QR login berhasil dibuat (berlaku 2 menit)',
      data: {
        qr_data_url: qrDataUrl,
        server_url:  serverUrl,
        expires_in_seconds: 120,
        // deep_link intentionally omitted from response to prevent leakage
      },
    });
  } catch (error) {
    console.error('QR login error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

