import nodemailer from 'nodemailer';

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

async function tulisLogEmailGagal(message, detail) {
  try {
    const { Log } = await import('./models');
    await Log.create({
      level: 'ERROR',
      context: 'EMAIL',
      message,
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    });
  } catch (err) {
    console.error('Gagal tulis log email:', err);
  }
}

async function tulisLogEmailSukses(message, detail) {
  try {
    const { Log } = await import('./models');
    await Log.create({
      level: 'INFO',
      context: 'EMAIL',
      message,
      detail: typeof detail === 'string' ? detail : JSON.stringify(detail),
    });
  } catch (err) {
    console.error('Gagal tulis log email:', err);
  }
}

/**
 * Ambil override SMTP host/port dari Pengaturan DB.
 * Kredensial (user/pass/from/secure) hanya dari env vars — tidak disimpan di DB.
 */
async function getSmtpFromDb() {
  try {
    const { Pengaturan } = await import('./models');
    const keys = ['smtp_host', 'smtp_port'];
    const rows = await Pengaturan.findAll({ where: { kunci: keys } });
    const cfg = {};
    rows.forEach((r) => { cfg[r.kunci] = r.nilai; });
    return cfg;
  } catch {
    return {};
  }
}

// Transporter utama (dari env vars atau DB)
async function createPrimaryTransporter() {
  const dbCfg = await getSmtpFromDb();

  const host = process.env.GMAIL_SMTP_HOST || process.env.SMTP_HOST || dbCfg.smtp_host || 'smtp.gmail.com';
  const port = parseInt(process.env.GMAIL_SMTP_PORT || process.env.SMTP_PORT || dbCfg.smtp_port || '587');
  const secure = (process.env.GMAIL_SMTP_SECURE || process.env.SMTP_SECURE || (port === 465 ? 'true' : 'false')) === 'true';
  const user = process.env.GMAIL_EMAIL || process.env.SMTP_USER || '';
  const pass = process.env.GMAIL_PASSWORD || process.env.SMTP_PASS || '';
  const from = process.env.GMAIL_FROM || process.env.SMTP_FROM || user || 'noreply@tpq.local';

  const transportConfig = {
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
    // Wajibkan STARTTLS pada port 587 agar koneksi selalu terenkripsi
    requireTLS: !secure && port === 587,
    tls: {
      // Verifikasi sertifikat server — jangan izinkan sertifikat palsu
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2',
    },
  };

  return { transporter: nodemailer.createTransport(transportConfig), from, hasAuth: Boolean(user) };
}

// Transporter cadangan (Hotmail / Outlook / SMTP server 2)
function createBackupTransporter() {
  if (!(process.env.OUTLOOK_SMTP_HOST || process.env.SMTP2_HOST)) return null;
  const host = process.env.OUTLOOK_SMTP_HOST || process.env.SMTP2_HOST;
  const port = parseInt(process.env.OUTLOOK_SMTP_PORT || process.env.SMTP2_PORT || '587');
  const secure = (process.env.OUTLOOK_SMTP_SECURE || process.env.SMTP2_SECURE || (port === 465 ? 'true' : 'false')) === 'true';
  const user = process.env.OUTLOOK_EMAIL || process.env.SMTP2_USER;
  const pass = process.env.OUTLOOK_PASSWORD || process.env.SMTP2_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user ? { user, pass } : undefined,
    requireTLS: !secure && port === 587,
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
      minVersion: 'TLSv1.2',
    },
  });
}

/**
 * Kirim email dengan fallback ke server cadangan
 */
async function kirimEmail(mailOptions) {
  try {
    const { transporter, from, hasAuth } = await createPrimaryTransporter();

    if (!hasAuth && process.env.NODE_ENV !== 'development') {
      const msg = '[EMAIL] SMTP belum dikonfigurasi. Set SMTP_HOST/SMTP_USER/SMTP_PASS di .env.local atau di menu Pengaturan.';
      console.warn(msg);
      await tulisLogEmailGagal('SMTP tidak dikonfigurasi', { subject: mailOptions.subject, to: mailOptions.to });
      return { success: false, message: 'Email tidak dikonfigurasi' };
    }

    try {
      const info = await transporter.sendMail({ ...mailOptions, from: mailOptions.from || from });
      console.log(`[EMAIL] Terkirim ke ${mailOptions.to} | Subject: ${mailOptions.subject} | ID: ${info.messageId || '-'}`);
      await tulisLogEmailSukses('Email berhasil dikirim', { subject: mailOptions.subject, to: mailOptions.to, messageId: info.messageId });
      return { success: true, messageId: info.messageId, server: 'primary' };
    } catch (primaryError) {
      console.error('[EMAIL] Server utama gagal:', primaryError.message);

      const backup = createBackupTransporter();
      if (backup) {
        const fromBackup = process.env.OUTLOOK_EMAIL || process.env.SMTP2_USER || from;
        try {
          const info = await backup.sendMail({ ...mailOptions, from: fromBackup });
          console.log(`[EMAIL] Terkirim via server cadangan | Subject: ${mailOptions.subject}`);
          await tulisLogEmailSukses('Email dikirim via server cadangan', { subject: mailOptions.subject, to: mailOptions.to });
          return { success: true, messageId: info.messageId, server: 'backup' };
        } catch (backupError) {
          console.error('[EMAIL] Server cadangan gagal:', backupError.message);
          await tulisLogEmailGagal('Gagal kirim email (utama & cadangan)', {
            primary: primaryError.message,
            backup: backupError.message,
            subject: mailOptions.subject,
            to: mailOptions.to,
          });
          return { success: false, error: `Utama: ${primaryError.message}, Cadangan: ${backupError.message}` };
        }
      }

      await tulisLogEmailGagal('Gagal kirim email (server cadangan tidak tersedia)', {
        primary: primaryError.message,
        subject: mailOptions.subject,
        to: mailOptions.to,
      });
      return { success: false, error: primaryError.message };
    }
  } catch (err) {
    console.error('[EMAIL] Error konfigurasi:', err.message);
    return { success: false, error: err.message };
  }
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
            <tr><td style="padding: 8px 0; font-weight: bold;">Kategori:</td><td>${saran.kategori}</td></tr>
            <tr><td style="padding: 8px 0; font-weight: bold;">Pengirim:</td><td>${saran.nama_pengirim}</td></tr>
            ${saran.email_pengirim ? `<tr><td style="padding: 8px 0; font-weight: bold;">Email:</td><td>${saran.email_pengirim}</td></tr>` : ''}
          </table>
          <div style="margin-top: 15px; padding: 12px; background: white; border-left: 4px solid #10b981; border-radius: 4px;">
            <p style="margin: 0 0 5px 0; font-weight: bold;">Isi Saran:</p>
            <p style="margin: 0; line-height: 1.6;">${saran.isi_saran}</p>
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
          <h2 style="margin: 0;">📋 ${aksi}</h2>
          <p style="margin: 5px 0 0 0; opacity: 0.9;">TPQ Futuhil Hidayah Wal Hikmah</p>
        </div>
        <div style="background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="margin: 0 0 5px; font-size: 13px; color: #6b7280;">Dilakukan oleh: <strong>${adminNama}</strong> (${adminJabatan}) - ${waktu}</p>
          <p style="margin: 10px 0; font-weight: bold;">${deskripsi}</p>
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

    // Juga tambahkan semua Pimpinan TPQ aktif (selalu mendapat notifikasi)
    const pimpinan = await Admin.findAll({
      where: { is_active: true, jabatan: 'Pimpinan TPQ' },
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
 * Cek status konfigurasi email
 */
async function getEmailConfigStatus() {
  const dbCfg = await getSmtpFromDb();
  // Kredensial hanya dari env vars
  const user = process.env.GMAIL_EMAIL || process.env.SMTP_USER || '';
  // Host: env vars lebih utama, DB hanya sebagai override opsional
  const host = process.env.GMAIL_SMTP_HOST || process.env.SMTP_HOST || dbCfg.smtp_host || '';
  return {
    configured: Boolean(user && host),
    source: (process.env.GMAIL_EMAIL || process.env.SMTP_USER) ? 'env' : 'none',
    host: host || null,
    user: user ? user.replace(/(.{3}).*@/, '$1***@') : null,
  };
}

/**
 * Kirim email test
 */
async function kirimEmailTest(toEmail) {
  const status = await getEmailConfigStatus();
  if (!status.configured) {
    return { success: false, error: 'SMTP belum dikonfigurasi. Set GMAIL_EMAIL dan GMAIL_SMTP_HOST di environment variable.' };
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
  });
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
