import Backup from './models/Backup';

// ── Role helpers ──────────────────────────────────────────────────────────────
/** Roles that enjoy full TPQ management access (Developer + Pimpinan TPQ). */
export const FULL_ACCESS_ROLES = ['Developer', 'Pimpinan TPQ'];

/**
 * Returns true for roles with full TPQ management access.
 * Both 'Developer' and 'Pimpinan TPQ' qualify.
 */
export function isFullAccessRole(jabatan) {
  return FULL_ACCESS_ROLES.includes(jabatan);
}

/**
 * Returns true only for the Developer super-admin role.
 * Developer can also manage Pimpinan TPQ accounts (unlike Pimpinan TPQ).
 */
export function isSuperAdmin(jabatan) {
  return jabatan === 'Developer';
}

export async function createBackup(aksi, tabel, dataSebelum, dataSesudah, adminId) {
  try {
    await Backup.create({
      aksi,
      tabel,
      data_sebelum: dataSebelum ? JSON.stringify(dataSebelum) : null,
      data_sesudah: dataSesudah ? JSON.stringify(dataSesudah) : null,
      admin_id: adminId,
    });
    return true;
  } catch (error) {
    console.error('Error creating backup:', error);
    return false;
  }
}

const kodeMinuteCounter = new Map();

function getDatePartsForZone(now, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
  };
}

function getDatePartsForOffset(now, offsetMinutes) {
  const localMs = now.getTime() + (offsetMinutes * 60 * 1000);
  const shifted = new Date(localMs);
  return {
    year: String(shifted.getUTCFullYear()),
    month: String(shifted.getUTCMonth() + 1).padStart(2, '0'),
    day: String(shifted.getUTCDate()).padStart(2, '0'),
    hour: String(shifted.getUTCHours()).padStart(2, '0'),
    minute: String(shifted.getUTCMinutes()).padStart(2, '0'),
  };
}

export function getClientTimeConfig(request) {
  const timeZoneRaw = request?.headers?.get('x-client-timezone') || '';
  const timeZone = timeZoneRaw.trim();

  const offsetRaw = request?.headers?.get('x-client-tz-offset') || '';
  const offset = Number.parseInt(offsetRaw, 10);
  const offsetMinutes = Number.isFinite(offset) ? offset : null;

  return { timeZone, offsetMinutes };
}

export function generateKodeInvoice(prefix = 'SPP', options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();

  let parts;
  if (options.timeZone) {
    try {
      parts = getDatePartsForZone(now, options.timeZone);
    } catch {
      parts = null;
    }
  }

  if (!parts && Number.isFinite(options.offsetMinutes)) {
    parts = getDatePartsForOffset(now, options.offsetMinutes);
  }

  if (!parts) {
    parts = {
      year: String(now.getFullYear()),
      month: String(now.getMonth() + 1).padStart(2, '0'),
      day: String(now.getDate()).padStart(2, '0'),
      hour: String(now.getHours()).padStart(2, '0'),
      minute: String(now.getMinutes()).padStart(2, '0'),
    };
  }

  const { year, month, day, hour, minute } = parts;
  const timePart = `${year}${month}${day}-${hour}${minute}`;
  const key = `${prefix}-${timePart}`;

  const count = (kodeMinuteCounter.get(key) || 0) + 1;
  kodeMinuteCounter.set(key, count);

  // Primary format: PREFIX-YYYYMMDD-HHMM.
  // If multiple codes are created in the same minute, append -NN to keep uniqueness.
  if (count === 1) {
    return key;
  }

  return `${key}-${String(count).padStart(2, '0')}`;
}

export function resolveSppTransactionDate(tahunSpp, bulanSpp, fallbackDate = new Date()) {
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

export function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function getNamaBulan(bulan) {
  return NAMA_BULAN[bulan - 1] || '';
}
