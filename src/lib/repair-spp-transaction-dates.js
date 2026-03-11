const fs = require('fs');
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../../.env.local');
const dotenvFallback = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: fs.existsSync(dotenvPath) ? dotenvPath : dotenvFallback });

const { Op } = require('sequelize');
const { sequelize, PembayaranSPP, JurnalKas } = require('./models');

function resolveSppTransactionDate(tahunSpp, bulanSpp, fallbackDate = new Date()) {
  const tahun = Number(tahunSpp);
  const bulan = Number(bulanSpp);

  if (!Number.isInteger(tahun) || !Number.isInteger(bulan) || bulan < 1 || bulan > 12) {
    return new Date(fallbackDate);
  }

  const fallback = new Date(fallbackDate);
  const isPeriodeBerjalan =
    tahun === fallback.getFullYear() &&
    bulan === fallback.getMonth() + 1;

  if (isPeriodeBerjalan) {
    return fallback;
  }

  return new Date(tahun, bulan - 1, 1, 12, 0, 0, 0);
}

async function run() {
  let transaction;

  try {
    console.log('Menyelaraskan tanggal pembayaran SPP dan jurnal ke periode SPP...');
    await sequelize.authenticate();
    transaction = await sequelize.transaction();

    const pembayaranList = await PembayaranSPP.findAll({
      attributes: ['id', 'kode_invoice', 'tgl_bayar', 'bulan_spp', 'tahun_spp'],
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    let pembayaranUpdated = 0;
    let jurnalUpdated = 0;

    for (const pembayaran of pembayaranList) {
      const targetDate = resolveSppTransactionDate(pembayaran.tahun_spp, pembayaran.bulan_spp, pembayaran.tgl_bayar);
      const currentDate = new Date(pembayaran.tgl_bayar);

      const isPembayaranMismatch =
        currentDate.getFullYear() !== targetDate.getFullYear() ||
        currentDate.getMonth() !== targetDate.getMonth() ||
        currentDate.getDate() !== targetDate.getDate();

      if (isPembayaranMismatch) {
        await pembayaran.update({ tgl_bayar: targetDate }, { transaction });
        pembayaranUpdated += 1;
      }

      const [affectedRows] = await JurnalKas.update(
        { tgl_transaksi: targetDate },
        {
          where: {
            referensi_kode: {
              [Op.in]: [
                pembayaran.kode_invoice,
                `ADJ-${pembayaran.kode_invoice}`,
                `REV-${pembayaran.kode_invoice}`,
              ],
            },
          },
          transaction,
        }
      );

      jurnalUpdated += Number(affectedRows || 0);
    }

    await transaction.commit();
    console.log(`Selesai. Pembayaran diperbarui: ${pembayaranUpdated}. Jurnal diperbarui: ${jurnalUpdated}.`);
    process.exit(0);
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('Gagal memperbaiki tanggal transaksi SPP:', error);
    process.exit(1);
  }
}

run();