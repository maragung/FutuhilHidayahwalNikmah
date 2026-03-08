import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { EmailServer, Admin } from '@/lib/models';
import sequelize from '@/lib/db';

// GET — Ambil semua email server (Developer only)
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });

    await sequelize.authenticate();
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin || admin.jabatan !== 'Developer') {
      return NextResponse.json({ success: false, pesan: 'Hanya Developer yang dapat mengakses konfigurasi email server' }, { status: 403 });
    }

    const servers = await EmailServer.findAll({ order: [['tipe', 'ASC'], ['urutan', 'ASC']] });

    // Mask password untuk keamanan — hanya tampilkan 3 karakter pertama
    const data = servers.map(s => {
      const json = s.toJSON();
      json.smtp_pass_masked = json.smtp_pass ? json.smtp_pass.substring(0, 3) + '••••••••' : '';
      delete json.smtp_pass;
      return json;
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Get email servers error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST — Tambah email server baru (Developer only)
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });

    await sequelize.authenticate();
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin || admin.jabatan !== 'Developer') {
      return NextResponse.json({ success: false, pesan: 'Hanya Developer yang dapat menambah email server' }, { status: 403 });
    }

    const body = await request.json();
    const { pin, nama, tipe, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_secure } = body;

    // Verifikasi PIN
    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    // Validasi
    if (!nama || !smtp_host || !smtp_user || !smtp_pass) {
      return NextResponse.json({ success: false, pesan: 'Nama, SMTP Host, Email, dan Password wajib diisi' }, { status: 400 });
    }

    // Hitung urutan otomatis
    const count = await EmailServer.count({ where: { tipe: tipe || 'primary' } });

    const server = await EmailServer.create({
      nama,
      tipe: tipe || 'primary',
      smtp_host,
      smtp_port: smtp_port || 587,
      smtp_user,
      smtp_pass,
      smtp_from: smtp_from || smtp_user,
      smtp_secure: smtp_secure || false,
      is_active: true,
      urutan: count,
    });

    return NextResponse.json({
      success: true,
      pesan: `Server email "${nama}" berhasil ditambahkan`,
      data: { id: server.id, nama: server.nama, tipe: server.tipe },
    });
  } catch (error) {
    console.error('Create email server error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
