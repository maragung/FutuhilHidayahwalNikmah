import Backup from './models/Backup';

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

export function generateKodeInvoice(prefix = 'SPP') {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  const timestamp = Date.now().toString().slice(-4);
  return `${prefix}-${year}${month}-${timestamp}${random}`;
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
