import { NextResponse } from 'next/server';
import Admin from '@/lib/models/Admin';
import sequelize from '@/lib/db';
import { createAuthResponse } from '@/lib/auth';
import { checkRateLimit, resetLimit } from '@/lib/rate-limit';

export async function POST(request) {
  // ── Rate limit: 5 attempts per 15 minutes per IP ──────────────────────────
  const rl = checkRateLimit(request);
  if (!rl.allowed) {
    return NextResponse.json(
      {
        success: false,
        pesan: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil(rl.retryAfterSec / 60)} menit.`,
      },
      {
        status: 429,
        headers: { 'Retry-After': String(rl.retryAfterSec) },
      },
    );
  }

  try {
    await sequelize.authenticate();

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, pesan: 'Username dan password wajib diisi' },
        { status: 400 },
      );
    }

    const admin = await Admin.findOne({
      where: { is_active: true, username },
    });
    if (!admin) {
      return NextResponse.json(
        { success: false, pesan: 'Username atau password salah' },
        { status: 401 },
      );
    }

    const passwordValid = await admin.validPassword(password);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, pesan: 'Username atau password salah' },
        { status: 401 },
      );
    }

    // Reset rate-limit counter after successful login
    resetLimit(request.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
              request.headers.get('x-real-ip') || 'unknown');

    // Derive server URL from request so deep link auto-configures the app
    const host      = request.headers.get('host') || 'localhost:3000';
    const proto     = request.headers.get('x-forwarded-proto') || 'http';
    const serverUrl = `${proto}://${host}`;

    const authData = createAuthResponse(admin, '30d');
    const deepLink = `tpqlink://login?token=${encodeURIComponent(authData.token)}&user=${admin.id}&server=${encodeURIComponent(serverUrl)}`;

    return NextResponse.json({
      success: true,
      pesan: 'Login app berhasil',
      data: {
        ...authData,
        server_url: serverUrl,
        deep_link: deepLink,
        expires_in_days: 30,
      },
    });
  } catch (error) {
    console.error('App login error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 },
    );
  }
}
  } catch (error) {
    console.error('App login error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
