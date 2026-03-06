import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import {
  Admin,
  Santri,
  PembayaranSPP,
  InfakSedekah,
  Pengeluaran,
  JurnalKas,
  Backup,
  Saran,
  Pengaturan,
  Kegiatan,
  PembayaranLain,
} from '@/lib/models';
import sequelize from '@/lib/db';
import crypto from 'crypto';

const ALLOWED = ['Pimpinan TPQ', 'Sekretaris', 'Bendahara'];

async function fetchAllData() {
  const [
    admins, santri, pembayaran_spp, infak_sedekah,
    pengeluaran, jurnal_kas, backup_log, saran,
    pengaturan, kegiatan, pembayaran_lain,
  ] = await Promise.all([
    Admin.findAll({ raw: true }),
    Santri.findAll({ raw: true }),
    PembayaranSPP.findAll({ raw: true }),
    InfakSedekah.findAll({ raw: true }),
    Pengeluaran.findAll({ raw: true }),
    JurnalKas.findAll({ raw: true }),
    Backup.findAll({ raw: true }),
    Saran.findAll({ raw: true }),
    Pengaturan.findAll({ raw: true }),
    Kegiatan.findAll({ raw: true }),
    PembayaranLain.findAll({ raw: true }),
  ]);

  return {
    admins, santri, pembayaran_spp, infak_sedekah,
    pengeluaran, jurnal_kas, backup_log, saran,
    pengaturan, kegiatan, pembayaran_lain,
  };
}

// GET - Export database plain JSON (backward compatibility)
export async function GET(request) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    if (!ALLOWED.includes(auth.user.jabatan)) {
      return NextResponse.json({ success: false, pesan: 'Tidak memiliki akses export database' }, { status: 403 });
    }

    const data = await fetchAllData();

    return NextResponse.json({
      success: true,
      exported_at: new Date().toISOString(),
      exported_by: auth.user.nama_lengkap,
      data,
    });
  } catch (error) {
    console.error('Export database error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST - Export database terenkripsi dengan password
export async function POST(request) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    if (!ALLOWED.includes(auth.user.jabatan)) {
      return NextResponse.json({ success: false, pesan: 'Tidak memiliki akses export database' }, { status: 403 });
    }

    const body = await request.json();
    const { password } = body;

    if (!password || password.length < 4) {
      return NextResponse.json({ success: false, pesan: 'Password enkripsi minimal 4 karakter' }, { status: 400 });
    }

    const data = await fetchAllData();
    const payload = JSON.stringify({
      success: true,
      exported_at: new Date().toISOString(),
      exported_by: auth.user.nama_lengkap,
      data,
    }, null, 2);

    // Enkripsi dengan AES-256-CBC
    const key = crypto.createHash('sha256').update(password).digest(); // 32 bytes
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    const encrypted = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);

    // Format: 4-byte magic + 16-byte IV + encrypted data
    const magic = Buffer.from('TPQD'); // TPQ Database marker
    const result = Buffer.concat([magic, iv, encrypted]);

    return new Response(result, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="backup-tpq-${new Date().toISOString().split('T')[0]}.tpqdb"`,
        'Content-Length': result.length.toString(),
      },
    });
  } catch (error) {
    console.error('Export database encrypted error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

