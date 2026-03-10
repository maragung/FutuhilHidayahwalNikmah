import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { PembayaranSPP, Santri, Pengaturan } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';

function getMonthIndex(year, month) {
  return (year * 12) + month;
}

function getElapsedMonthsInclusive(startYear, startMonth, endYear, endMonth) {
  return ((endYear - startYear) * 12) + (endMonth - startMonth) + 1;
}

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
    
    // Ambil semua santri (aktif + nonaktif) kecuali yang sudah lulus
    const santriList = await Santri.findAll({
      where: { status_lulus: false },
      order: [['nama_lengkap', 'ASC']],
      attributes: ['id', 'no_absen', 'nik', 'nama_lengkap', 'jenis_kelamin', 'jilid', 'tgl_mendaftar', 'status_aktif', 'tgl_nonaktif', 'nama_wali', 'no_telp_wali', 'is_subsidi', 'status_lulus', 'tgl_lulus'],
    });

    const nominalNonSubsidi = parseInt(await Pengaturan.getNilai('nominal_spp_non_subsidi', '40000'), 10) || 40000;
    const nominalSubsidi = parseInt(await Pengaturan.getNilai('nominal_spp_subsidi', '30000'), 10) || 30000;
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    const currentMonthIndex = getMonthIndex(currentYear, currentMonth);

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

    const pembayaranTotalList = await PembayaranSPP.findAll({
      where: {
        [Op.or]: [
          { tahun_spp: { [Op.lt]: currentYear } },
          { tahun_spp: currentYear, bulan_spp: { [Op.lte]: currentMonth } },
        ],
      },
      attributes: ['santri_id', 'tahun_spp', 'bulan_spp'],
    });
    
    // Map pembayaran per santri
    const paymentMap = {};
    pembayaranList.forEach(p => {
      if (!paymentMap[p.santri_id]) {
        paymentMap[p.santri_id] = {};
      }
      paymentMap[p.santri_id][p.bulan_spp] = parseFloat(p.nominal);
    });

    const paymentTotalMap = {};
    pembayaranTotalList.forEach((p) => {
      if (!paymentTotalMap[p.santri_id]) paymentTotalMap[p.santri_id] = [];
      paymentTotalMap[p.santri_id].push({
        tahun: p.tahun_spp,
        bulan: p.bulan_spp,
      });
    });
    
    // Gabungkan data santri dengan status pembayaran
    const result = santriList.map(santri => {
      const payments = paymentMap[santri.id] || {};
      const bulanStatus = {};
      let totalBayar = 0;
      let bulanTerbayar = 0;
      let bulanWajib = 0;
      let bulanDibayarTotal = 0;
      let bulanSejakDaftarSampaiKini = 0;

      // Parse tgl_mendaftar secara UTC agar tidak terpengaruh timezone server.
      // new Date('2024-07-15') selalu UTC midnight → getUTCMonth() = 6 (Juli)
      // Jika tgl_mendaftar null/kosong/invalid → bulanAwalWajib = 1 (Jan)
      let tahunDaftar = null;
      let bulanDaftar = null;
      if (santri.tgl_mendaftar) {
        const tglDaftar = new Date(santri.tgl_mendaftar);
        if (!isNaN(tglDaftar.getTime())) {
          tahunDaftar = tglDaftar.getUTCFullYear();
          bulanDaftar  = tglDaftar.getUTCMonth() + 1; // 1-12
        }
      }
      // bulanAwalWajib:
      //   13  → tahun sebelum daftar (semua bulan 'Belum Terdaftar')
      //   N   → bulan pendaftaran (Jan–(N-1) 'Belum Terdaftar')
      //   1   → tahun setelah daftar atau tgl_mendaftar tidak diketahui (semua wajib)
      const bulanAwalWajib = (tahunDaftar === null)
        ? 1
        : tahun < tahunDaftar
          ? 13
          : tahun === tahunDaftar
            ? bulanDaftar
            : 1;
      let bulanAkhirWajib = 12;

      if (santri.tgl_nonaktif) {
        const tglNonaktif = new Date(santri.tgl_nonaktif);
        if (!isNaN(tglNonaktif.getTime())) {
          if (tglNonaktif.getUTCFullYear() < tahun) {
            bulanAkhirWajib = 0;
          } else if (tglNonaktif.getUTCFullYear() === tahun) {
            bulanAkhirWajib = tglNonaktif.getUTCMonth(); // bulan nonaktif tdk wajib
          }
        }
      }

      let startMonthIndex = Number.MIN_SAFE_INTEGER;
      if (tahunDaftar !== null && bulanDaftar !== null) {
        startMonthIndex = getMonthIndex(tahunDaftar, bulanDaftar);
        bulanSejakDaftarSampaiKini = getElapsedMonthsInclusive(
          tahunDaftar,
          bulanDaftar,
          currentYear,
          currentMonth,
        );
      }

      const totalPaidMonths = paymentTotalMap[santri.id] || [];
      bulanDibayarTotal = totalPaidMonths.filter((item) => {
        const monthIndex = getMonthIndex(item.tahun, item.bulan);
        return monthIndex >= startMonthIndex;
      }).length;

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
        jenis_kelamin: santri.jenis_kelamin,
        jilid: santri.jilid,
        status_aktif: santri.status_aktif,
        is_subsidi: !!santri.is_subsidi,
        tgl_mendaftar: santri.tgl_mendaftar,
        tgl_nonaktif: santri.tgl_nonaktif,
        status_lulus: !!santri.status_lulus,
        tgl_lulus: santri.tgl_lulus,
        nama_wali: santri.nama_wali,
        no_telp_wali: santri.no_telp_wali,
        nominal_spp: nominalSpp,
        tahun: tahun,
        bulan_status: bulanStatus,
        total_bayar: totalBayar,
        bulan_dibayar_total: bulanDibayarTotal,
        bulan_sejak_daftar_sampai_kini: bulanSejakDaftarSampaiKini,
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
