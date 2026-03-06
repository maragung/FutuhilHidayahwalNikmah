import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { JurnalKas, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';

// GET - Ambil jurnal kas
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
    
    const { searchParams } = new URL(request.url);
    const tahun = searchParams.get('tahun');
    const bulan = searchParams.get('bulan');
    const jenis = searchParams.get('jenis');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 100;
    const offset = (page - 1) * limit;
    
    const where = {};
    
    if (tahun && bulan) {
      const startDate = new Date(tahun, bulan - 1, 1);
      const endDate = new Date(tahun, bulan, 0, 23, 59, 59);
      where.tgl_transaksi = { [Op.between]: [startDate, endDate] };
    } else if (tahun) {
      const startDate = new Date(tahun, 0, 1);
      const endDate = new Date(tahun, 11, 31, 23, 59, 59);
      where.tgl_transaksi = { [Op.between]: [startDate, endDate] };
    }
    
    if (jenis) {
      where.jenis = jenis;
    }
    
    const { count, rows } = await JurnalKas.findAndCountAll({
      where,
      include: [
        { model: Admin, as: 'admin', attributes: ['nama_lengkap'] },
      ],
      order: [['tgl_transaksi', 'DESC'], ['id', 'DESC']],
      limit,
      offset,
    });
    
    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        halaman: page,
        limit,
        totalHalaman: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get jurnal error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
