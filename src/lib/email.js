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

// Transporter utama (SMTP server 1)
function createPrimaryTransporter() {
  return nodemailer.createTransport({
    host: process.env.GMAIL_SMTP_HOST || process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.GMAIL_SMTP_PORT || process.env.SMTP_PORT || '587'),
    secure: (process.env.GMAIL_SMTP_SECURE || process.env.SMTP_SECURE || 'false') === 'true',
    auth: (process.env.GMAIL_EMAIL || process.env.SMTP_USER) ? {
      user: process.env.GMAIL_EMAIL || process.env.SMTP_USER,
      pass: process.env.GMAIL_PASSWORD || process.env.SMTP_PASS,
    } : undefined,
    ...(process.env.NODE_ENV === 'development' && !(process.env.GMAIL_EMAIL || process.env.SMTP_USER) && {
      streamTransport: true,
      newline: 'unix',
      buffer: true,
    }),
  });
}

// Transporter cadangan (SMTP server 2)
function createBackupTransporter() {
  if (!(process.env.OUTLOOK_SMTP_HOST || process.env.SMTP2_HOST)) return null;
  return nodemailer.createTransport({
    host: process.env.OUTLOOK_SMTP_HOST || process.env.SMTP2_HOST,
    port: parseInt(process.env.OUTLOOK_SMTP_PORT || process.env.SMTP2_PORT || '587'),
    secure: (process.env.OUTLOOK_SMTP_SECURE || process.env.SMTP2_SECURE || 'false') === 'true',
    auth: (process.env.OUTLOOK_EMAIL || process.env.SMTP2_USER) ? {
      user: process.env.OUTLOOK_EMAIL || process.env.SMTP2_USER,
      pass: process.env.OUTLOOK_PASSWORD || process.env.SMTP2_PASS,
    } : undefined,
  });
}

/**
 * Kirim email dengan fallback ke server cadangan
 */
async function kirimEmail(mailOptions) {
  const hasPrimary = Boolean(process.env.GMAIL_EMAIL || process.env.SMTP_USER);
  if (!hasPrimary && process.env.NODE_ENV !== 'development') {
    console.log('Email SMTP belum dikonfigurasi.');
    return { success: false, message: 'Email tidak dikonfigurasi' };
  }

  const fromPrimary = process.env.GMAIL_EMAIL || process.env.SMTP_USER || process.env.EMAIL_FROM || 'noreply@tpq-futuhil-hidayah.com';
  const fromBackup = process.env.OUTLOOK_EMAIL || process.env.SMTP2_USER || fromPrimary;

  try {
    const primary = createPrimaryTransporter();
    const info = await primary.sendMail({ ...mailOptions, from: fromPrimary });
    if (process.env.NODE_ENV === 'development') {
      console.log('📧 Email (server utama):', info.messageId || 'terkirim');
    }
    return { success: true, messageId: info.messageId, server: 'primary' };
  } catch (primaryError) {
    console.error('Server email utama gagal:', primaryError.message);

    const backup = createBackupTransporter();
    if (backup) {
      try {
        const info = await backup.sendMail({ ...mailOptions, from: fromBackup });
        console.log('📧 Email (server cadangan):', info.messageId || 'terkirim');
        return { success: true, messageId: info.messageId, server: 'backup' };
      } catch (backupError) {
        console.error('Server email cadangan juga gagal:', backupError.message);
        await tulisLogEmailGagal('Gagal kirim email di server utama & cadangan', {
          primary: primaryError.message,
          backup: backupError.message,
          subject: mailOptions.subject,
          to: mailOptions.to,
        });
        return { success: false, error: `Utama: ${primaryError.message}, Cadangan: ${backupError.message}` };
      }
    }

    await tulisLogEmailGagal('Gagal kirim email di server utama (server cadangan tidak tersedia)', {
      primary: primaryError.message,
      subject: mailOptions.subject,
      to: mailOptions.to,
    });

    return { success: false, error: primaryError.message };
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

async function getEmailPenerimaPerubahan(adminId) {
  try {
    const { default: Admin } = await import('./models/Admin');

    const pimpinan = await Admin.findAll({
      where: { is_active: true, jabatan: 'Pimpinan TPQ' },
      attributes: ['email'],
    });

    const emails = new Set(pimpinan.map((a) => a.email).filter(Boolean));

    if (adminId) {
      const actor = await Admin.findByPk(adminId, {
        attributes: ['email', 'terima_email_perubahan'],
      });
      if (actor?.terima_email_perubahan && actor.email) {
        emails.add(actor.email);
      }
    }

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

export {
  kirimEmail,
  kirimEmailSaranBaru,
  kirimEmailAksiAdmin,
  getEmailAdminByJabatan,
  getEmailPenerimaPerubahan,
  formatWibDdMmYyHm,
};
