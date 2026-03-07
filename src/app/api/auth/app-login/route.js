import { NextResponse } from 'next/server';
import Admin from '@/lib/models/Admin';
import sequelize from '@/lib/db';
import { createAuthResponse } from '@/lib/auth';
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function POST(request) {
  try {
    await sequelize.authenticate();

    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { success: false, pesan: 'Username dan password wajib diisi' },
        { status: 400 }
      );
    }

    await wait(3000);

    const admin = await Admin.findOne({
      where: {
        is_active: true,
        username,
      },
    });
    if (!admin) {
      return NextResponse.json(
        { success: false, pesan: 'Username atau password salah' },
        { status: 401 }
      );
    }

    const passwordValid = await admin.validPassword(password);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, pesan: 'Username atau password salah' },
        { status: 401 }
      );
    }

    const authData = createAuthResponse(admin, '30d');
    const deepLink = `tpqlink://login?token=${encodeURIComponent(authData.token)}&user=${admin.id}`;

    return NextResponse.json({
      success: true,
      pesan: 'Login app berhasil',
      data: {
        ...authData,
        deep_link: deepLink,
        expires_in_days: 30,
      },
    });
  } catch (error) {
    console.error('App login error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
