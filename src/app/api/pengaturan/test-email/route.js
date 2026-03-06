import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import sequelize from '@/lib/db';
import { kirimEmailTest, getEmailConfigStatus } from '@/lib/email';

// GET - Cek status konfigurasi email
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    await sequelize.authenticate();
    const status = await getEmailConfigStatus();

    return NextResponse.json({ success: true, data: status });
  } catch (error) {
    console.error('Get email status error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST - Kirim email test
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    if (!['Pimpinan TPQ', 'Bendahara'].includes(auth.user.jabatan)) {
      return NextResponse.json({ success: false, pesan: 'Akses ditolak' }, { status: 403 });
    }

    await sequelize.authenticate();

    const body = await request.json().catch(() => ({}));
    const toEmail = body.email || auth.user.email;

    if (!toEmail) {
      return NextResponse.json({ success: false, pesan: 'Email tujuan tidak ditemukan' }, { status: 400 });
    }

    const result = await kirimEmailTest(toEmail);

    if (result.success) {
      return NextResponse.json({
        success: true,
        pesan: `Email test berhasil dikirim ke ${toEmail}`,
        messageId: result.messageId,
        server: result.server,
      });
    } else {
      return NextResponse.json({
        success: false,
        pesan: result.error || result.message || 'Gagal mengirim email test',
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
