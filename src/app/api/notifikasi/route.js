import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Backup } from '@/lib/models';
import sequelize from '@/lib/db';

// GET - Ambil riwayat aktivitas (backup log) untuk admin yang login
export async function GET(request) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '30'));
    const offset = (page - 1) * limit;

    const { count, rows } = await Backup.findAndCountAll({
      where: { admin_id: auth.user.id },
      order: [['tgl_backup', 'DESC']],
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get notifikasi error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
