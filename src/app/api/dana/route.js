import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { JurnalKas, PembayaranSPP, InfakSedekah, Pengeluaran } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';

// GET - Ringkasan dana
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
    
    const startDate = new Date(tahun, 0, 1);
    const endDate = new Date(tahun, 11, 31, 23, 59, 59);
    
    // Total SPP tahun ini
    const totalSPP = await PembayaranSPP.sum('nominal', {
      where: { tahun_spp: tahun },
    }) || 0;
    
    // Total Infak tahun ini
    const totalInfak = await InfakSedekah.sum('nominal', {
      where: { tgl_terima: { [Op.between]: [startDate, endDate] } },
    }) || 0;
    
    // Total Pengeluaran tahun ini
    const totalPengeluaran = await Pengeluaran.sum('nominal', {
      where: { tgl_keluar: { [Op.between]: [startDate, endDate] } },
    }) || 0;

    // Total pemasukan & pengeluaran tahun ini berdasarkan JurnalKas (sumber saldo utama)
    const totalPemasukanJurnalTahun = await JurnalKas.sum('nominal', {
      where: {
        jenis: 'Masuk',
        tgl_transaksi: { [Op.between]: [startDate, endDate] },
      },
    }) || 0;

    const totalPengeluaranJurnalTahun = await JurnalKas.sum('nominal', {
      where: {
        jenis: 'Keluar',
        tgl_transaksi: { [Op.between]: [startDate, endDate] },
      },
    }) || 0;
    
    // Saldo terakhir (saldo real)
    const lastJurnal = await JurnalKas.findOne({
      order: [['id', 'DESC']],
    });
    const saldoAkhir = lastJurnal ? parseFloat(lastJurnal.saldo_berjalan) : 0;
    
    // Hitung pemasukan dan pengeluaran total (semua waktu)
    const totalPemasukanAll = await JurnalKas.sum('nominal', {
      where: { jenis: 'Masuk' },
    }) || 0;
    
    const totalPengeluaranAll = await JurnalKas.sum('nominal', {
      where: { jenis: 'Keluar' },
    }) || 0;
    
    // Verifikasi saldo (audit)
    const saldoVerifikasi = totalPemasukanAll - totalPengeluaranAll;
    const isConsistent = Math.abs(saldoAkhir - saldoVerifikasi) < 1; // toleransi 1 rupiah
    
    // Pengeluaran per kategori tahun ini
    const pengeluaranPerKategori = await Pengeluaran.findAll({
      where: { tgl_keluar: { [Op.between]: [startDate, endDate] } },
      attributes: [
        'kategori',
        [sequelize.fn('SUM', sequelize.col('nominal')), 'total'],
        [sequelize.fn('COUNT', sequelize.col('id')), 'jumlah'],
      ],
      group: ['kategori'],
      raw: true,
    });
    
    // Ringkasan bulanan tahun ini
    const ringkasanBulanan = [];
    for (let bulan = 1; bulan <= 12; bulan++) {
      const bulanStart = new Date(tahun, bulan - 1, 1);
      const bulanEnd = new Date(tahun, bulan, 0, 23, 59, 59);

      const pemasukanJurnalBulan = await JurnalKas.sum('nominal', {
        where: {
          jenis: 'Masuk',
          tgl_transaksi: { [Op.between]: [bulanStart, bulanEnd] },
        },
      }) || 0;

      const pengeluaranJurnalBulan = await JurnalKas.sum('nominal', {
        where: {
          jenis: 'Keluar',
          tgl_transaksi: { [Op.between]: [bulanStart, bulanEnd] },
        },
      }) || 0;
      
      const sppBulan = await PembayaranSPP.sum('nominal', {
        where: {
          tahun_spp: tahun,
          bulan_spp: bulan,
        },
      }) || 0;
      
      const infakBulan = await InfakSedekah.sum('nominal', {
        where: { tgl_terima: { [Op.between]: [bulanStart, bulanEnd] } },
      }) || 0;
      
      const pengeluaranBulan = await Pengeluaran.sum('nominal', {
        where: { tgl_keluar: { [Op.between]: [bulanStart, bulanEnd] } },
      }) || 0;
      
      ringkasanBulanan.push({
        bulan,
        spp: sppBulan,
        infak: infakBulan,
        pengeluaran: pengeluaranBulan,
        pemasukan_jurnal: pemasukanJurnalBulan,
        pengeluaran_jurnal: pengeluaranJurnalBulan,
        netto: pemasukanJurnalBulan - pengeluaranJurnalBulan,
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        tahun,
        saldo_akhir: saldoAkhir,
        saldo_verifikasi: saldoVerifikasi,
        is_consistent: isConsistent,
        total_pemasukan_tahun: totalPemasukanJurnalTahun,
        total_spp_tahun: totalSPP,
        total_infak_tahun: totalInfak,
        total_pengeluaran_tahun: totalPengeluaranJurnalTahun,
        total_pengeluaran_manual_tahun: totalPengeluaran,
        netto_tahun: totalPemasukanJurnalTahun - totalPengeluaranJurnalTahun,
        pengeluaran_per_kategori: pengeluaranPerKategori,
        ringkasan_bulanan: ringkasanBulanan,
      },
    });
  } catch (error) {
    console.error('Get dana error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
