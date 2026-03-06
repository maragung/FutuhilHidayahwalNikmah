import { NextResponse } from 'next/server';
import { verifyAuth, createAuthResponse } from '@/lib/auth';
import Admin from '@/lib/models/Admin';
import sequelize from '@/lib/db';

export async function POST(request) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    const admin = await Admin.findByPk(auth.user.id);
    if (!admin || !admin.is_active) {
      return NextResponse.json({ success: false, pesan: 'Akun tidak aktif' }, { status: 403 });
    }

    const authData = createAuthResponse(admin, '30d');

    return NextResponse.json({
      success: true,
      pesan: 'Token app diperbarui',
      data: {
        ...authData,
        expires_in_days: 30,
      },
    });
  } catch (error) {
    console.error('App refresh error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
