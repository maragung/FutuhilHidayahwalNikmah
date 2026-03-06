import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import Admin from '@/lib/models/Admin';
import sequelize from '@/lib/db';

export async function GET(request) {
  try {
    await sequelize.authenticate();
    
    const auth = await verifyAuth(request);
    
    if (!auth.success) {
      return NextResponse.json(
        { success: false, pesan: auth.error },
        { status: 401 }
      );
    }
    
    const admin = await Admin.findByPk(auth.user.id, {
      attributes: ['id', 'username', 'nama_lengkap', 'jabatan', 'email', 'is_active', 'terima_email_perubahan'],
    });
    
    if (!admin) {
      return NextResponse.json(
        { success: false, pesan: 'Admin tidak ditemukan' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      user: admin,
      data: admin,
    });
  } catch (error) {
    console.error('Me error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
