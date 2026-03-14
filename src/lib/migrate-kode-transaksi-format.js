const fs = require('fs');
const path = require('path');
const dotenvPath = path.resolve(__dirname, '../../.env.local');
const dotenvFallback = path.resolve(__dirname, '../../.env');
require('dotenv').config({ path: fs.existsSync(dotenvPath) ? dotenvPath : dotenvFallback });

const { Op } = require('sequelize');
const {
  sequelize,
  PembayaranSPP,
  PembayaranLain,
  InfakSedekah,
  Pengeluaran,
  JurnalKas,
} = require('./models');

const APPLY = process.argv.includes('--apply');

const TABLES = [
  {
    key: 'spp',
    label: 'PembayaranSPP',
    model: PembayaranSPP,
    prefix: 'SPP',
    codeField: 'kode_invoice',
    dateField: 'tgl_bayar',
    maxLength: 20,
  },
  {
    key: 'pbl',
    label: 'PembayaranLain',
    model: PembayaranLain,
    prefix: 'PBL',
    codeField: 'kode_invoice',
    dateField: 'tgl_bayar',
    maxLength: 30,
  },
  {
    key: 'inf',
    label: 'InfakSedekah',
    model: InfakSedekah,
    prefix: 'INF',
    codeField: 'kode_transaksi',
    dateField: 'tgl_terima',
    maxLength: 20,
  },
  {
    key: 'out',
    label: 'Pengeluaran',
    model: Pengeluaran,
    prefix: 'OUT',
    codeField: 'kode_pengeluaran',
    dateField: 'tgl_keluar',
    maxLength: 20,
  },
];

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatTimeKey(dateInput) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const year = d.getFullYear();
  const month = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hour = pad2(d.getHours());
  const minute = pad2(d.getMinutes());
  return `${year}${month}${day}-${hour}${minute}`;
}

function isAlreadyNewFormat(prefix, code) {
  const regex = new RegExp(`^${prefix}-\\d{8}-\\d{4}(?:-\\d{2})?$`);
  return regex.test(String(code || ''));
}

function nextCandidate(prefix, timeKey, count) {
  if (count <= 1) return `${prefix}-${timeKey}`;
  return `${prefix}-${timeKey}-${pad2(count)}`;
}

function pickUniqueCode({ prefix, timeKey, maxLength, occupied }) {
  let count = 1;
  while (count <= 9999) {
    const candidate = nextCandidate(prefix, timeKey, count);
    if (candidate.length <= maxLength && !occupied.has(candidate)) {
      return candidate;
    }
    count += 1;
  }
  throw new Error(`Tidak bisa membuat kode unik untuk ${prefix}-${timeKey}`);
}

function buildRef(marker, baseCode) {
  const raw = `${marker}-${baseCode}`;
  if (raw.length <= 20) return raw;
  return null;
}

async function processTable(def, transaction) {
  const rows = await def.model.findAll({
    attributes: ['id', def.codeField, def.dateField],
    order: [[def.dateField, 'ASC'], ['id', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });

  const occupied = new Set(rows.map((row) => String(row[def.codeField] || '').trim()).filter(Boolean));
  const mappings = [];
  let unchanged = 0;

  for (const row of rows) {
    const oldCode = String(row[def.codeField] || '').trim();
    if (!oldCode) {
      unchanged += 1;
      continue;
    }

    if (isAlreadyNewFormat(def.prefix, oldCode)) {
      unchanged += 1;
      continue;
    }

    occupied.delete(oldCode);
    const timeKey = formatTimeKey(row[def.dateField]);
    const newCode = pickUniqueCode({
      prefix: def.prefix,
      timeKey,
      maxLength: def.maxLength,
      occupied,
    });

    occupied.add(newCode);

    if (newCode === oldCode) {
      unchanged += 1;
      continue;
    }

    mappings.push({
      id: row.id,
      oldCode,
      newCode,
      codeField: def.codeField,
    });
  }

  if (APPLY && mappings.length > 0) {
    for (const item of mappings) {
      await def.model.update(
        { [def.codeField]: item.newCode },
        { where: { id: item.id }, transaction }
      );

      await JurnalKas.update(
        { referensi_kode: item.newCode },
        {
          where: { referensi_kode: item.oldCode },
          transaction,
        }
      );

      const oldAdj = buildRef('ADJ', item.oldCode);
      const newAdj = buildRef('ADJ', item.newCode);
      if (oldAdj && newAdj) {
        await JurnalKas.update(
          { referensi_kode: newAdj },
          {
            where: { referensi_kode: oldAdj },
            transaction,
          }
        );
      }

      const oldRev = buildRef('REV', item.oldCode);
      const newRev = buildRef('REV', item.newCode);
      if (oldRev && newRev) {
        await JurnalKas.update(
          { referensi_kode: newRev },
          {
            where: { referensi_kode: oldRev },
            transaction,
          }
        );
      }
    }
  }

  return {
    label: def.label,
    total: rows.length,
    unchanged,
    updates: mappings,
  };
}

async function run() {
  let transaction;
  try {
    console.log('Memulai migrasi format kode transaksi...');
    console.log(`Mode: ${APPLY ? 'APPLY (perubahan disimpan)' : 'DRY-RUN (tanpa perubahan)'}`);

    await sequelize.authenticate();
    transaction = await sequelize.transaction();

    const summary = [];
    for (const tableDef of TABLES) {
      const result = await processTable(tableDef, transaction);
      summary.push(result);
    }

    const totalUpdates = summary.reduce((acc, item) => acc + item.updates.length, 0);

    for (const item of summary) {
      console.log(`- ${item.label}: total=${item.total}, update=${item.updates.length}, tetap=${item.unchanged}`);
      for (const sample of item.updates.slice(0, 5)) {
        console.log(`  • ${sample.oldCode} -> ${sample.newCode}`);
      }
      if (item.updates.length > 5) {
        console.log(`  • ... ${item.updates.length - 5} perubahan lainnya`);
      }
    }

    if (APPLY) {
      await transaction.commit();
      console.log(`Migrasi selesai. Total kode diperbarui: ${totalUpdates}.`);
    } else {
      await transaction.rollback();
      console.log(`Dry-run selesai. Total kandidat perubahan: ${totalUpdates}.`);
      console.log('Jalankan ulang dengan --apply untuk menyimpan.');
    }

    process.exit(0);
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('Migrasi format kode gagal:', error);
    process.exit(1);
  }
}

run();