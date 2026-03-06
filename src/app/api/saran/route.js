import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Saran, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { kirimEmailSaranBaru } from '@/lib/email';

// GET - Ambil semua saran (butuh auth admin)
export async function GET(request) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, pesan: auth.error },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const kategori = searchParams.get('kategori');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const where = {};
    if (status) where.status = status;
    if (kategori) where.kategori = kategori;

    const { count, rows } = await Saran.findAndCountAll({
      where,
      include: [
        {
          model: Admin,
          as: 'admin',
          attributes: ['id', 'nama_lengkap', 'email'],
        },
      ],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Error GET saran:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}

// POST - Submit saran baru (public, tidak perlu auth)
export async function POST(request) {
  try {
    await sequelize.authenticate();

    const body = await request.json();
    const { nama_pengirim, email_pengirim, no_telp_pengirim, kategori, isi_saran } = body;

    // Validasi
    if (!nama_pengirim || !isi_saran) {
      return NextResponse.json(
        { success: false, pesan: 'Nama dan isi saran harus diisi' },
        { status: 400 }
      );
    }

    if (isi_saran.length < 10) {
      return NextResponse.json(
        { success: false, pesan: 'Isi saran minimal 10 karakter' },
        { status: 400 }
      );
    }

    // Simpan saran
    const saran = await Saran.create({
      nama_pengirim,
      email_pengirim: email_pengirim || null,
      no_telp_pengirim: no_telp_pengirim || null,
      kategori: kategori || 'Saran',
      isi_saran,
      status: 'Belum Dibaca',
    });

    // Kirim email ke semua admin
    try {
      const admins = await Admin.findAll({
        where: { is_active: true },
        attributes: ['email'],
      });
      
      const emailAdmins = admins.map(a => a.email).filter(Boolean);
      
      if (emailAdmins.length > 0) {
        await kirimEmailSaranBaru(saran, emailAdmins);
      }
    } catch (emailError) {
      console.error('Error mengirim email notifikasi:', emailError);
      // Tetap return sukses meski email gagal
    }

    return NextResponse.json({
      success: true,
      pesan: 'Terima kasih! Saran Anda telah kami terima dan akan segera ditindaklanjuti.',
      data: saran,
    });
  } catch (error) {
    console.error('Error POST saran:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
