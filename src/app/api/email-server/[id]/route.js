import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { EmailServer, Admin } from '@/lib/models';
import sequelize from '@/lib/db';

// PUT — Update email server
export async function PUT(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });

    await sequelize.authenticate();
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin || admin.jabatan !== 'Developer') {
      return NextResponse.json({ success: false, pesan: 'Akses ditolak' }, { status: 403 });
    }

    const { id } = await params;
    const server = await EmailServer.findByPk(id);
    if (!server) return NextResponse.json({ success: false, pesan: 'Server tidak ditemukan' }, { status: 404 });

    const body = await request.json();
    const { pin, nama, tipe, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_secure, is_active } = body;

    // Verifikasi PIN
    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    // Update fields
    if (nama !== undefined) server.nama = nama;
    if (tipe !== undefined) server.tipe = tipe;
    if (smtp_host !== undefined) server.smtp_host = smtp_host;
    if (smtp_port !== undefined) server.smtp_port = smtp_port;
    if (smtp_user !== undefined) server.smtp_user = smtp_user;
    if (smtp_pass !== undefined && smtp_pass !== '') server.smtp_pass = smtp_pass; // Kosong = tidak ubah
    if (smtp_from !== undefined) server.smtp_from = smtp_from;
    if (smtp_secure !== undefined) server.smtp_secure = smtp_secure;
    if (is_active !== undefined) server.is_active = is_active;

    await server.save();

    return NextResponse.json({
      success: true,
      pesan: `Server "${server.nama}" berhasil diperbarui`,
    });
  } catch (error) {
    console.error('Update email server error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// DELETE — Hapus email server
export async function DELETE(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });

    await sequelize.authenticate();
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin || admin.jabatan !== 'Developer') {
      return NextResponse.json({ success: false, pesan: 'Akses ditolak' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { pin } = body;
    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    const { id } = await params;
    const server = await EmailServer.findByPk(id);
    if (!server) return NextResponse.json({ success: false, pesan: 'Server tidak ditemukan' }, { status: 404 });

    const nama = server.nama;
    await server.destroy();

    return NextResponse.json({ success: true, pesan: `Server "${nama}" berhasil dihapus` });
  } catch (error) {
    console.error('Delete email server error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
