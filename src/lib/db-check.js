const fs = require('fs');
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../../.env.local');
const dotenvFallback = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: fs.existsSync(dotenvPath) ? dotenvPath : dotenvFallback });

const { QueryTypes } = require('sequelize');
const {
  sequelize,
  PembayaranSPP,
  PembayaranLain,
  InfakSedekah,
  Pengeluaran,
  JurnalKas,
} = require('./models');

function rupiah(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value || 0));
}

async function run() {
  const critical = [];
  const warnings = [];

  try {
    console.log('🔎 Memeriksa integritas database...');
    await sequelize.authenticate();
    console.log('✅ Koneksi database OK');

    const duplicateSpp = await sequelize.query(
      `
      SELECT santri_id, tahun_spp, bulan_spp, COUNT(*) AS total
      FROM pembayaran_spp
      GROUP BY santri_id, tahun_spp, bulan_spp
      HAVING COUNT(*) > 1
      ORDER BY total DESC
      LIMIT 20
      `,
      { type: QueryTypes.SELECT }
    );
    if (duplicateSpp.length > 0) {
      critical.push(`Duplikasi pembayaran SPP terdeteksi (${duplicateSpp.length} grup)`);
    }

    const orphanSpp = await sequelize.query(
      `
      SELECT p.id
      FROM pembayaran_spp p
      LEFT JOIN santri s ON s.id = p.santri_id
      LEFT JOIN admins a ON a.id = p.admin_id
      WHERE s.id IS NULL OR a.id IS NULL
      LIMIT 20
      `,
      { type: QueryTypes.SELECT }
    );
    if (orphanSpp.length > 0) {
      critical.push(`Data pembayaran_spp yatim/orphan terdeteksi (${orphanSpp.length} baris sampel)`);
    }

    const orphanPembayaranLain = await sequelize.query(
      `
      SELECT p.id
      FROM pembayaran_lain p
      LEFT JOIN santri s ON s.id = p.santri_id
      LEFT JOIN admins a ON a.id = p.admin_id
      LEFT JOIN kegiatan k ON k.id = p.kegiatan_id
      WHERE s.id IS NULL OR a.id IS NULL OR k.id IS NULL
      LIMIT 20
      `,
      { type: QueryTypes.SELECT }
    );
    if (orphanPembayaranLain.length > 0) {
      critical.push(`Data pembayaran_lain yatim/orphan terdeteksi (${orphanPembayaranLain.length} baris sampel)`);
    }

    const nominalInvalid = {
      spp: await PembayaranSPP.count({ where: sequelize.where(sequelize.col('nominal'), '<=', 0) }),
      lain: await PembayaranLain.count({ where: sequelize.where(sequelize.col('nominal'), '<=', 0) }),
      infak: await InfakSedekah.count({ where: sequelize.where(sequelize.col('nominal'), '<=', 0) }),
      pengeluaran: await Pengeluaran.count({ where: sequelize.where(sequelize.col('nominal'), '<=', 0) }),
    };

    const totalInvalidNominal = Object.values(nominalInvalid).reduce((sum, v) => sum + Number(v || 0), 0);
    if (totalInvalidNominal > 0) {
      critical.push(`Nominal <= 0 terdeteksi pada transaksi (${totalInvalidNominal} baris)`);
    }

    const totalMasuk = Number(await JurnalKas.sum('nominal', { where: { jenis: 'Masuk' } }) || 0);
    const totalKeluar = Number(await JurnalKas.sum('nominal', { where: { jenis: 'Keluar' } }) || 0);
    const saldoVerifikasi = totalMasuk - totalKeluar;

    const lastJurnal = await JurnalKas.findOne({ order: [['id', 'DESC']] });
    const saldoTercatat = Number(lastJurnal?.saldo_berjalan || 0);
    const selisihSaldo = Math.abs(saldoTercatat - saldoVerifikasi);

    if (selisihSaldo >= 1) {
      critical.push(`Saldo jurnal tidak konsisten (selisih Rp ${rupiah(selisihSaldo)})`);
    }

    if (!lastJurnal) {
      warnings.push('Tabel jurnal_kas belum memiliki data transaksi');
    }

    console.log('');
    console.log('📊 Ringkasan:');
    console.log(`- Total masuk jurnal : Rp ${rupiah(totalMasuk)}`);
    console.log(`- Total keluar jurnal: Rp ${rupiah(totalKeluar)}`);
    console.log(`- Saldo verifikasi   : Rp ${rupiah(saldoVerifikasi)}`);
    console.log(`- Saldo tercatat     : Rp ${rupiah(saldoTercatat)}`);

    if (warnings.length > 0) {
      console.log('');
      console.log('⚠️ Warning:');
      warnings.forEach((item) => console.log(`- ${item}`));
    }

    if (critical.length > 0) {
      console.log('');
      console.log('❌ Temuan kritis:');
      critical.forEach((item) => console.log(`- ${item}`));
      process.exit(1);
    }

    console.log('');
    console.log('✅ Integritas database baik');
    process.exit(0);
  } catch (error) {
    console.error('❌ Gagal cek database:', error.message);
    process.exit(1);
  }
}

run();
