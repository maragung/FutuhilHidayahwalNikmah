import { NextResponse } from 'next/server';
import { Santri, PembayaranSPP } from '@/lib/models';
import sequelize from '@/lib/db';
import { verifyCaptchaPayload } from '@/lib/captcha';

// GET - Cari santri berdasarkan NIK (untuk publik)
export async function GET(request, { params }) {
  try {
    await sequelize.authenticate();
    
    const url = new URL(request.url);
    const captchaToken = url.searchParams.get('captcha_token');
    const captchaValue = url.searchParams.get('captcha_value');

    const captchaCheck = verifyCaptchaPayload(captchaToken, captchaValue);
    if (!captchaCheck.valid) {
      return NextResponse.json(
        { success: false, pesan: captchaCheck.message },
        { status: 400 }
      );
    }

    const { nik } = await params;
    const tahun = parseInt(url.searchParams.get('tahun')) || null;
    
    const santri = await Santri.findOne({
      where: { nik, status_aktif: true },
      attributes: ['id', 'nik', 'nama_lengkap', 'jilid', 'tgl_mendaftar', 'status_aktif', 'is_subsidi'],
      include: [{
        model: PembayaranSPP,
        as: 'pembayaran',
        where: tahun ? { tahun_spp: tahun } : undefined,
        required: false,
        attributes: ['bulan_spp', 'tahun_spp', 'nominal', 'tgl_bayar'],
        order: [['tahun_spp', 'DESC'], ['bulan_spp', 'DESC']],
      }],
    });
    
    if (!santri) {
      return NextResponse.json(
        { success: false, pesan: 'Data santri tidak ditemukan' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      data: santri,
    });
  } catch (error) {
    console.error('Get santri by NIK error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
