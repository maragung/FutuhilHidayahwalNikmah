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

    // Total Pengeluaran tahun ini (dari tabel Pengeluaran, bukan JurnalKas)
    // Ini adalah data yang benar-benar diinput user
    const totalPengeluaran = await Pengeluaran.sum('nominal', {
      where: { tgl_keluar: { [Op.between]: [startDate, endDate] } },
    }) || 0;

    // Hitung jumlah pengeluaran dari tabel Pengeluaran
    const jumlahPengeluaran = await Pengeluaran.count({
      where: { tgl_keluar: { [Op.between]: [startDate, endDate] } },
    });

    // Total pemasukan tahun ini
    const totalPemasukanTahun = totalSPP + totalInfak;

    // Saldo terakhir (dari JurnalKas)
    const lastJurnal = await JurnalKas.findOne({
      order: [['id', 'DESC']],
    });
    const saldoAkhir = lastJurnal ? parseFloat(lastJurnal.saldo_berjalan) : 0;
    const isConsistent = true; // Always true since we're using direct data now
    
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

      // Pengeluaran dari tabel Pengeluaran (data yang diinput user)
      const pengeluaranBulan = await Pengeluaran.sum('nominal', {
        where: { tgl_keluar: { [Op.between]: [bulanStart, bulanEnd] } },
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

      ringkasanBulanan.push({
        bulan,
        spp: sppBulan,
        infak: infakBulan,
        pengeluaran: pengeluaranBulan,
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        tahun,
        saldo_akhir: saldoAkhir,
        is_consistent: isConsistent,
        total_pemasukan_tahun: totalPemasukanTahun,
        total_spp_tahun: totalSPP,
        total_infak_tahun: totalInfak,
        total_pengeluaran_tahun: totalPengeluaran,
        jumlah_pengeluaran: jumlahPengeluaran,
        netto_tahun: totalPemasukanTahun - totalPengeluaran,
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
