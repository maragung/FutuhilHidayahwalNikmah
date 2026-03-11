import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Saran, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { kirimEmailSaranBaru } from '@/lib/email';
import { Op } from 'sequelize';
import { verifyCaptchaPayload } from '@/lib/captcha';
import { claimIdempotency, logDuplicateAttempt, releaseGuard, respondWithGuard } from '@/lib/request-guard';
import { ValidationError, isValidEmail, isValidPhone, readEnumValue, readOptionalText, readRequiredText } from '@/lib/request-validation';

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
  let guard;
  try {
    await sequelize.authenticate();

    const body = await request.json();
    const { nama_pengirim, email_pengirim, no_telp_pengirim, kategori, isi_saran, captcha_token, captcha_answer } = body;
    const namaPengirim = readRequiredText(nama_pengirim, 'Nama', { max: 100 });
    const isiSaran = readRequiredText(isi_saran, 'Isi saran', { min: 10, max: 3000 });
    const kategoriValue = readEnumValue(kategori, 'Kategori', ['Saran', 'Kritik', 'Pertanyaan', 'Lainnya'], 'Saran');
    const emailPengirim = readOptionalText(email_pengirim, { max: 100 });
    const teleponPengirim = readOptionalText(no_telp_pengirim, { max: 20 });

    if (emailPengirim && !isValidEmail(emailPengirim)) {
      throw new ValidationError('Email pengirim tidak valid');
    }
    if (teleponPengirim && !isValidPhone(teleponPengirim)) {
      throw new ValidationError('Nomor telepon pengirim tidak valid');
    }

    const guardResult = await claimIdempotency({
      request,
      route: '/api/saran',
      actorScope: 'public',
      ttlMs: 60 * 60 * 1000,
      payload: {
        nama_pengirim: namaPengirim,
        email_pengirim: emailPengirim,
        no_telp_pengirim: teleponPengirim,
        kategori: kategoriValue,
        isi_saran: isiSaran,
      },
    });
    if (!guardResult.success) {
      return guardResult.response;
    }
    guard = guardResult.guard;

    const captchaCheck = verifyCaptchaPayload(captcha_token, captcha_answer);
    if (!captchaCheck.valid) {
      return respondWithGuard(guard, { success: false, pesan: captchaCheck.message }, 400);
    }

    const recentDuplicate = await Saran.findOne({
      where: {
        nama_pengirim: namaPengirim,
        email_pengirim: emailPengirim,
        no_telp_pengirim: teleponPengirim,
        kategori: kategoriValue,
        isi_saran: isiSaran,
        created_at: { [Op.gte]: new Date(Date.now() - 60 * 60 * 1000) },
      },
      order: [['id', 'DESC']],
    });
    if (recentDuplicate) {
      await logDuplicateAttempt('Saran duplikat ditolak', {
        nama_pengirim: namaPengirim,
        kategori: kategoriValue,
        recent_id: recentDuplicate.id,
      });
      return respondWithGuard(guard, { success: false, pesan: 'Saran yang sama sudah pernah dikirim baru-baru ini.' }, 409);
    }

    // Simpan saran
    const saran = await Saran.create({
      nama_pengirim: namaPengirim,
      email_pengirim: emailPengirim,
      no_telp_pengirim: teleponPengirim,
      kategori: kategoriValue,
      isi_saran: isiSaran,
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

    return respondWithGuard(guard, {
      success: true,
      pesan: 'Terima kasih! Saran Anda telah kami terima dan akan segera ditindaklanjuti.',
      data: saran,
    }, 201);
  } catch (error) {
    if (error instanceof ValidationError) {
      return guard
        ? respondWithGuard(guard, { success: false, pesan: error.message }, 400)
        : NextResponse.json({ success: false, pesan: error.message }, { status: 400 });
    }
    await releaseGuard(guard);
    console.error('Error POST saran:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
