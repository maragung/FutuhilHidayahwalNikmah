import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { EmailLog, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';

// GET — Ambil email logs (dengan pagination) atau export JSON
// Query params: ?page=1&limit=30&status=success|failed&export=json
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });

    await sequelize.authenticate();
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin || admin.jabatan !== 'Developer') {
      return NextResponse.json({ success: false, pesan: 'Hanya Developer yang dapat mengakses log email' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const exportFormat = searchParams.get('export');
    const status = searchParams.get('status');
    const konteks = searchParams.get('konteks');

    const where = {};
    if (status) where.status = status;
    if (konteks) where.konteks = konteks;

    // Export JSON — tanpa pagination
    if (exportFormat === 'json') {
      const logs = await EmailLog.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit: 10000, // safety limit
      });

      const jsonData = JSON.stringify(logs.map(l => l.toJSON()), null, 2);
      const filename = `email-logs-${new Date().toISOString().slice(0, 10)}.json`;

      return new NextResponse(jsonData, {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Paginated list
    const page  = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, parseInt(searchParams.get('limit') || '30'));
    const offset = (page - 1) * limit;

    const { count, rows } = await EmailLog.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    // Summary stats
    const [stats] = await sequelize.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as sukses,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as gagal
      FROM email_logs
    `, { type: sequelize.QueryTypes.SELECT });

    return NextResponse.json({
      success: true,
      data: rows,
      stats: {
        total: parseInt(stats?.total || 0),
        sukses: parseInt(stats?.sukses || 0),
        gagal: parseInt(stats?.gagal || 0),
      },
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get email logs error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
