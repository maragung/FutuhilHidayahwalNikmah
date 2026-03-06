import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { PembayaranSPP, Santri, Pengaturan } from '@/lib/models';
import sequelize from '@/lib/db';

// GET - Status pembayaran santri per tahun
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
    const tahun = parseInt(searchParams.get('tahun')) || new Date().getFullYear();
    
    // Ambil semua santri (aktif + nonaktif) untuk manajemen status
    const santriList = await Santri.findAll({
      order: [['nama_lengkap', 'ASC']],
      attributes: ['id', 'no_absen', 'nik', 'nama_lengkap', 'jilid', 'tgl_mendaftar', 'status_aktif', 'tgl_nonaktif', 'nama_wali', 'no_telp_wali', 'is_subsidi'],
    });

    const nominalNonSubsidi = parseInt(await Pengaturan.getNilai('nominal_spp_non_subsidi', '40000'), 10) || 40000;
    const nominalSubsidi = parseInt(await Pengaturan.getNilai('nominal_spp_subsidi', '30000'), 10) || 30000;

    const keluargaAktifMap = {};
    santriList.forEach((s) => {
      if (!s.status_aktif) return;
      const key = `${s.nama_wali || ''}::${s.no_telp_wali || ''}`;
      if (!s.nama_wali || !s.no_telp_wali) return;
      keluargaAktifMap[key] = (keluargaAktifMap[key] || 0) + 1;
    });
    
    // Ambil semua pembayaran tahun ini
    const pembayaranList = await PembayaranSPP.findAll({
      where: { tahun_spp: tahun },
      attributes: ['santri_id', 'bulan_spp', 'nominal'],
    });
    
    // Map pembayaran per santri
    const paymentMap = {};
    pembayaranList.forEach(p => {
      if (!paymentMap[p.santri_id]) {
        paymentMap[p.santri_id] = {};
      }
      paymentMap[p.santri_id][p.bulan_spp] = parseFloat(p.nominal);
    });
    
    // Gabungkan data santri dengan status pembayaran
    const result = santriList.map(santri => {
      const payments = paymentMap[santri.id] || {};
      const bulanStatus = {};
      let totalBayar = 0;
      let bulanTerbayar = 0;
      let bulanWajib = 0;

      const tglDaftar = new Date(santri.tgl_mendaftar);
      const tahunDaftar = tglDaftar.getFullYear();
      const bulanDaftar = tglDaftar.getMonth() + 1;

      const bulanAwalWajib = tahun < tahunDaftar ? 13 : (tahun === tahunDaftar ? bulanDaftar : 1);
      let bulanAkhirWajib = 12;

      if (santri.tgl_nonaktif) {
        const tglNonaktif = new Date(santri.tgl_nonaktif);
        if (tglNonaktif.getFullYear() < tahun) {
          bulanAkhirWajib = 0;
        } else if (tglNonaktif.getFullYear() === tahun) {
          bulanAkhirWajib = tglNonaktif.getMonth();
        }
      }

      const keluargaKey = `${santri.nama_wali || ''}::${santri.no_telp_wali || ''}`;
      const jumlahAnak = keluargaAktifMap[keluargaKey] || 1;
      const nominalSpp = (santri.is_subsidi || jumlahAnak >= 2) ? nominalSubsidi : nominalNonSubsidi;
      
      for (let bulan = 1; bulan <= 12; bulan++) {
        const wajib = bulan >= bulanAwalWajib && bulan <= bulanAkhirWajib;
        if (payments[bulan]) {
          bulanStatus[bulan] = { dibayar: true, nominal: payments[bulan], wajib };
          totalBayar += payments[bulan];
          if (wajib) bulanTerbayar++;
        } else {
          bulanStatus[bulan] = {
            dibayar: false,
            nominal: 0,
            wajib,
            alasan: !wajib ? (bulan < bulanAwalWajib ? 'Belum Terdaftar' : 'Nonaktif') : null,
          };
        }
        if (wajib) bulanWajib++;
      }
      
      return {
        id: santri.id,
        no_absen: santri.no_absen,
        nik: santri.nik,
        nama_lengkap: santri.nama_lengkap,
        jilid: santri.jilid,
        status_aktif: santri.status_aktif,
        is_subsidi: !!santri.is_subsidi,
        tgl_mendaftar: santri.tgl_mendaftar,
        tgl_nonaktif: santri.tgl_nonaktif,
        nama_wali: santri.nama_wali,
        no_telp_wali: santri.no_telp_wali,
        nominal_spp: nominalSpp,
        tahun: tahun,
        bulan_status: bulanStatus,
        total_bayar: totalBayar,
        bulan_terbayar: bulanTerbayar,
        bulan_wajib: bulanWajib,
        bulan_belum_bayar: Math.max(bulanWajib - bulanTerbayar, 0),
      };
    });
    
    return NextResponse.json({
      success: true,
      data: result,
      tahun: tahun,
    });
  } catch (error) {
    console.error('Get status pembayaran error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
