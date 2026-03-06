import { NextResponse } from 'next/server';
import { Pengaturan } from '@/lib/models';
import sequelize from '@/lib/db';

export async function GET() {
  try {
    await sequelize.authenticate();

    const wantedKeys = [
      'nama_tpq',
      'warna_non_subsidi',
      'warna_subsidi',
      'tahun_mulai_pembukuan',
      'nominal_spp_non_subsidi',
      'nominal_spp_subsidi',
    ];

    const rows = await Pengaturan.findAll({ where: { kunci: wantedKeys } });
    const data = {};
    rows.forEach((row) => {
      data[row.kunci] = row.nilai;
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get publik pengaturan error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
