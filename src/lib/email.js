import nodemailer from 'nodemailer';

/** Escape HTML entities to prevent XSS in email templates */
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatWibDdMmYyHm(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return `${get('day')}${get('month')}${get('year')} ${get('hour')}:${get('minute')} WIB`;
}

/* ── Tulis log ke tabel email_logs ─────────────────────────────────────────── */
async function tulisEmailLog({ serverId, serverNama, dari, kepada, subjek, status, errorMessage, response, konteks }) {
  try {
    const { EmailLog } = await import('./models');
    await EmailLog.create({
      email_server_id: serverId || null,
      server_nama: serverNama || null,
      dari: dari || null,
      kepada: kepada || '',
      subjek: subjek || '',
      status,
      error_message: errorMessage || null,
      response: response || null,
      konteks: konteks || 'SYSTEM',
    });
  } catch (err) {
    console.error('Gagal tulis email log:', err);
  }
}

/* Backward-compat: juga tulis ke tabel logs lama */
async function tulisLogLama(level, message, detail) {
  try {
    const { Log } = await import('./models');
    await Log.create({
      level,
      context: 'EMAIL',
      message,
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    });
  } catch (err) {
    console.error('Gagal tulis log email (legacy):', err);
  }
}

/**
 * Ambil daftar EmailServer dari DB, diurutkan: primary dulu, lalu backup, berdasarkan urutan ASC.
 * Fallback ke env vars jika tabel kosong / belum ada.
 */
async function getActiveServers() {
  try {
    const { EmailServer } = await import('./models');
    const servers = await EmailServer.findAll({
      where: { is_active: true },
      order: [
        ['tipe', 'ASC'],   // 'backup' > 'primary' secara alfabet, tapi kita urutkan urutan juga
        ['urutan', 'ASC'],
      ],
    });

    if (servers.length > 0) {
      // Urutkan: primary (urutan 0,1,...) lalu backup (urutan 0,1,...)
      const primary = servers.filter(s => s.tipe === 'primary').sort((a, b) => a.urutan - b.urutan);
      const backup  = servers.filter(s => s.tipe === 'backup').sort((a, b) => a.urutan - b.urutan);
      return [...primary, ...backup];
    }
  } catch { /* tabel belum ada / error → fallback env */ }

  // Fallback ke environment variables (backward compatible)
  const envServers = [];

  const user1 = process.env.GMAIL_EMAIL || process.env.SMTP_USER || '';
  const host1 = process.env.GMAIL_SMTP_HOST || process.env.SMTP_HOST || '';
  if (user1) {
    envServers.push({
      id: null,
      nama: 'ENV: Primary',
      tipe: 'primary',
      smtp_host: host1 || 'smtp.gmail.com',
      smtp_port: parseInt(process.env.GMAIL_SMTP_PORT || process.env.SMTP_PORT || '587'),
      smtp_user: user1,
      smtp_pass: process.env.GMAIL_PASSWORD || process.env.SMTP_PASS || '',
      smtp_from: process.env.GMAIL_FROM || process.env.SMTP_FROM || user1,
      smtp_secure: (process.env.GMAIL_SMTP_SECURE || process.env.SMTP_SECURE || 'false') === 'true',
    });
  }

  const user2 = process.env.OUTLOOK_EMAIL || process.env.SMTP2_USER || '';
  const host2 = process.env.OUTLOOK_SMTP_HOST || process.env.SMTP2_HOST || '';
  if (user2 && host2) {
    envServers.push({
      id: null,
      nama: 'ENV: Backup',
      tipe: 'backup',
      smtp_host: host2,
      smtp_port: parseInt(process.env.OUTLOOK_SMTP_PORT || process.env.SMTP2_PORT || '587'),
      smtp_user: user2,
      smtp_pass: process.env.OUTLOOK_PASSWORD || process.env.SMTP2_PASS || '',
      smtp_from: user2,
      smtp_secure: (process.env.OUTLOOK_SMTP_SECURE || process.env.SMTP2_SECURE || 'false') === 'true',
    });
  }

  return envServers;
}

/**
 * Buat nodemailer transporter dari objek server config.
 */
function createTransporterFromConfig(srv) {
  const port = parseInt(srv.smtp_port) || 587;
  const secure = Boolean(srv.smtp_secure) || port === 465;
  return nodemailer.createTransport({
    host: srv.smtp_host,
    port,
    secure,
    auth: srv.smtp_user ? { user: srv.smtp_user, pass: srv.smtp_pass } : undefined,
    requireTLS: !secure && port === 587,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2',
    },
  });
}

/**
 * Kirim email dengan failover: coba server pertama, lalu kedua, dst.
 * Setiap percobaan di-log ke email_logs.
 * @param {object} mailOptions - nodemailer mail options
 * @param {string} [konteks='SYSTEM'] - konteks untuk log
 */
async function kirimEmail(mailOptions, konteks = 'SYSTEM') {
  const servers = await getActiveServers();

  if (servers.length === 0) {
    const msg = '[EMAIL] Tidak ada email server yang dikonfigurasi. Tambahkan di menu Developer → Notifikasi Email, atau set env.';
    console.warn(msg);
    await tulisEmailLog({
      kepada: mailOptions.to,
      subjek: mailOptions.subject,
      status: 'failed',
      errorMessage: 'Tidak ada email server yang aktif',
      konteks,
    });
    await tulisLogLama('ERROR', 'Tidak ada email server yang aktif', { subject: mailOptions.subject, to: mailOptions.to });
    return { success: false, message: 'Email tidak dikonfigurasi' };
  }

  const errors = [];

  for (const srv of servers) {
    const transporter = createTransporterFromConfig(srv);
    const from = mailOptions.from || srv.smtp_from || srv.smtp_user || 'noreply@tpq.local';

    try {
      const info = await transporter.sendMail({ ...mailOptions, from });
      console.log(`[EMAIL] Terkirim via "${srv.nama}" ke ${mailOptions.to} | Subject: ${mailOptions.subject}`);

      await tulisEmailLog({
        serverId: srv.id,
        serverNama: srv.nama,
        dari: from,
        kepada: mailOptions.to,
        subjek: mailOptions.subject,
        status: 'success',
        response: info.messageId || null,
        konteks,
      });
      await tulisLogLama('INFO', `Email terkirim via ${srv.nama}`, { subject: mailOptions.subject, to: mailOptions.to, messageId: info.messageId });

      return { success: true, messageId: info.messageId, server: srv.nama, tipe: srv.tipe };
    } catch (err) {
      console.error(`[EMAIL] Server "${srv.nama}" gagal:`, err.message);
      errors.push({ server: srv.nama, tipe: srv.tipe, error: err.message });

      await tulisEmailLog({
        serverId: srv.id,
        serverNama: srv.nama,
        dari: from,
        kepada: mailOptions.to,
        subjek: mailOptions.subject,
        status: 'failed',
        errorMessage: err.message,
        konteks,
      });
    }
  }

  // Semua server gagal
  const errSummary = errors.map(e => `${e.server}: ${e.error}`).join(' | ');
  await tulisLogLama('ERROR', `Semua server email gagal (${errors.length} server)`, { errors, subject: mailOptions.subject, to: mailOptions.to });
  return { success: false, error: errSummary };
}

/**
 * Kirim email notifikasi saran baru ke semua admin
 */
async function kirimEmailSaranBaru(saran, emailAdmins) {
  const mailOptions = {
    from: process.env.EMAIL_FROM || 'noreply@tpq-futuhil-hidayah.com',
    to: emailAdmins.join(', '),
    subject: `[TPQ] Saran Baru: ${saran.kategori} dari ${saran.nama_pengirim}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="margin: 0;">🔔 Saran Baru Masuk</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">TPQ Futuhil Hidayah Wal Hikmah</p>
        </div>
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; font-weight: bold;">Kategori:</td><td>${escHtml(saran.kategori)}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">Pengirim:</td><td>${escHtml(saran.nama_pengirim)}</td></tr>
            ${saran.email_pengirim ? `<tr><td style="padding: 8px 0; font-weight: bold;">Email:</td><td>${escHtml(saran.email_pengirim)}</td></tr>` : ''}
          </table>
          <div style="margin-top: 15px; padding: 12px; background: white; border-left: 4px solid #10b981; border-radius: 4px;">
            <p style="margin: 0 0 5px 0; font-weight: bold;">Isi Saran:</p>
            <p style="margin: 0; line-height: 1.6;">${escHtml(saran.isi_saran)}</p>
          </div>
        </div>
        <div style="background: #f3f4f6; padding: 12px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">Email otomatis - Sistem Manajemen TPQ</p>
        </div>
      </div>
    `,
  };

  return await kirimEmail(mailOptions);
}

/**
 * Kirim salinan notifikasi aksi admin ke email jabatan terkait
 */
async function kirimEmailAksiAdmin({ aksi, deskripsi, detail, adminNama, adminJabatan, emailTujuan }) {
  if (!emailTujuan || emailTujuan.length === 0) return { success: false };

  const warna = {
    'Developer': '#6d28d9',
    'Bendahara': '#2563eb',
    'Sekretaris': '#7c3aed',
    'Pengajar': '#0891b2',
    'Pimpinan TPQ': '#059669',
  };

  const bg = warna[adminJabatan] || '#059669';
  const waktu = formatWibDdMmYyHm(new Date());

  const mailOptions = {
    to: emailTujuan.join(', '),
    subject: `[TPQ] Salinan Aksi: ${aksi} oleh ${adminNama}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: ${bg}; color: white; padding: 20px; border-radius: 10px 10px 0 0;">
          <h2 style="margin: 0;">📋 ${escHtml(aksi)}</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">TPQ Futuhil Hidayah Wal Hikmah</p>
        </div>
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0 0 5px; font-size: 13px; color: #6b7280;">Dilakukan oleh: <strong>${escHtml(adminNama)}</strong> (${escHtml(adminJabatan)}) - ${waktu}</p>
          <p style="margin: 10px 0; font-weight: bold;">${escHtml(deskripsi)}</p>
          ${detail || ''}
        </div>
        <div style="background: #f3f4f6; padding: 12px; text-align: center; border-radius: 0 0 10px 10px;">
          <p style="margin: 0; color: #6b7280; font-size: 12px;">Salinan otomatis - Sistem Manajemen TPQ</p>
        </div>
      </div>
    `,
  };

  return await kirimEmail(mailOptions);
}

async function getEmailPenerimaPerubahan(_adminId) {
  try {
    const { default: Admin } = await import('./models/Admin');

    // Ambil semua admin aktif yang mengaktifkan notifikasi email
    const admins = await Admin.findAll({
      where: { is_active: true, terima_email_perubahan: true },
      attributes: ['id', 'email'],
    });

    const emails = new Set(admins.map((a) => a.email).filter(Boolean));

    // Juga tambahkan semua Developer & Pimpinan TPQ aktif (selalu mendapat notifikasi)
    const pimpinan = await Admin.findAll({
      where: { is_active: true, jabatan: ['Developer', 'Pimpinan TPQ'] },
      attributes: ['email'],
    });
    pimpinan.forEach((a) => { if (a.email) emails.add(a.email); });

    return Array.from(emails);
  } catch (error) {
    console.error('Error mengambil penerima perubahan:', error);
    return [];
  }
}

/**
 * Ambil email admin berdasarkan jabatan
 */
async function getEmailAdminByJabatan(jabatanList) {
  try {
    const { default: Admin } = await import('./models/Admin');
    const { Op } = await import('sequelize');

    const admins = await Admin.findAll({
      where: {
        is_active: true,
        jabatan: { [Op.in]: jabatanList },
      },
      attributes: ['email'],
    });

    return admins.map(a => a.email).filter(Boolean);
  } catch (error) {
    console.error('Error mengambil email admin:', error);
    return [];
  }
}

/**
 * Cek status konfigurasi email — sekarang baca dari EmailServer tabel
 */
async function getEmailConfigStatus() {
  const servers = await getActiveServers();
  if (servers.length === 0) {
    return { configured: false, source: 'none', host: null, user: null, servers: [] };
  }

  const primary = servers.find(s => s.tipe === 'primary') || servers[0];
  const masked = primary.smtp_user ? primary.smtp_user.replace(/(.{3}).*@/, '$1***@') : null;

  return {
    configured: true,
    source: primary.id ? 'database' : 'env',
    host: primary.smtp_host || null,
    user: masked,
    servers: servers.map(s => ({
      id: s.id,
      nama: s.nama,
      tipe: s.tipe,
      host: s.smtp_host,
      port: s.smtp_port,
      user: s.smtp_user ? s.smtp_user.replace(/(.{3}).*@/, '$1***@') : null,
      secure: s.smtp_secure,
      active: true,
    })),
  };
}

/**
 * Kirim email test
 */
async function kirimEmailTest(toEmail) {
  const status = await getEmailConfigStatus();
  if (!status.configured) {
    return { success: false, error: 'Tidak ada email server yang dikonfigurasi. Tambahkan di menu Developer → Notifikasi Email.' };
  }
  return kirimEmail({
    to: toEmail,
    subject: '[TPQ] Test Email Notifikasi',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 10px;">
        <div style="background: #10b981; color: white; padding: 16px; border-radius: 8px 8px 0 0; margin: -20px -20px 20px;">
          <h2 style="margin:0;">✅ Email Test Berhasil</h2>
        </div>
        <p>Notifikasi email sistem TPQ <strong>Futuhil Hidayah Wal Hikmah</strong> berfungsi dengan baik.</p>
        <p style="color: #6b7280; font-size: 12px;">Dikirim pada: ${formatWibDdMmYyHm(new Date())}</p>
      </div>`,
  }, 'TEST');
}

export {
  kirimEmail,
  kirimEmailSaranBaru,
  kirimEmailAksiAdmin,
  getEmailAdminByJabatan,
  getEmailPenerimaPerubahan,
  getEmailConfigStatus,
  kirimEmailTest,
  formatWibDdMmYyHm,
};
