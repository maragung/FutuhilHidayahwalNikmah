import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Kegiatan, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';
import { createBackup } from '@/lib/utils';
import { claimIdempotency, logDuplicateAttempt, releaseGuard, respondWithGuard } from '@/lib/request-guard';
import { ValidationError, readOptionalText, readPositiveAmount, readRequiredText } from '@/lib/request-validation';

// GET - Ambil semua kegiatan
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }
    await sequelize.authenticate();

    const kegiatan = await Kegiatan.findAll({
      include: [{ model: Admin, as: 'admin', attributes: ['nama_lengkap'] }],
      order: [['created_at', 'DESC']],
    });

    return NextResponse.json({ success: true, data: kegiatan });
  } catch (error) {
    console.error('Get kegiatan error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST - Buat kegiatan baru
export async function POST(request) {
  let guard;
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }
    await sequelize.authenticate();

    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });

    const body = await request.json();
    const { nama_kegiatan, nominal, keterangan, pin, gabung_saldo_utama } = body;
    const namaKegiatan = readRequiredText(nama_kegiatan, 'Nama kegiatan', { max: 150 });
    const nominalValue = readPositiveAmount(nominal, 'Nominal');
    const keteranganText = readOptionalText(keterangan, { max: 500 });

    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    const guardResult = await claimIdempotency({
      request,
      route: '/api/kegiatan',
      actorScope: 'admin',
      actorId: auth.user.id,
      ttlMs: 15 * 60 * 1000,
      payload: {
        nama_kegiatan: namaKegiatan,
        nominal: nominalValue,
        keterangan: keteranganText,
        gabung_saldo_utama: gabung_saldo_utama !== undefined ? Boolean(gabung_saldo_utama) : true,
      },
    });
    if (!guardResult.success) {
      return guardResult.response;
    }
    guard = guardResult.guard;

    const recentDuplicate = await Kegiatan.findOne({
      where: {
        nama_kegiatan: namaKegiatan,
        nominal: nominalValue,
      },
      order: [['id', 'DESC']],
    });
    if (recentDuplicate) {
      await logDuplicateAttempt('Kegiatan duplikat ditolak', {
        admin_id: auth.user.id,
        nama_kegiatan: namaKegiatan,
        recent_id: recentDuplicate.id,
      });
      return respondWithGuard(guard, { success: false, pesan: 'Kegiatan serupa sudah ada. Periksa daftar kegiatan sebelum menambah baru.' }, 409);
    }

    const kegiatan = await Kegiatan.create({
      nama_kegiatan: namaKegiatan,
      nominal: nominalValue,
      keterangan: keteranganText,
      gabung_saldo_utama: gabung_saldo_utama !== undefined ? Boolean(gabung_saldo_utama) : true,
      admin_id: auth.user.id,
    });

    // Backup & notifikasi
    await createBackup('Tambah Kegiatan', 'kegiatan', null, kegiatan.toJSON(), auth.user.id);
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Kegiatan Baru Dibuat',
        deskripsi: `Kegiatan "${namaKegiatan}" dengan nominal Rp ${nominalValue.toLocaleString('id-ID')} telah dibuat.`,
        detail: '',
        adminNama: admin.nama_lengkap,
        adminJabatan: admin.jabatan,
        emailTujuan,
      });
    } catch (e) { console.error('Email error:', e); }

    return respondWithGuard(guard, { success: true, pesan: 'Kegiatan berhasil dibuat', data: kegiatan }, 201);
  } catch (error) {
    if (error instanceof ValidationError) {
      return guard
        ? respondWithGuard(guard, { success: false, pesan: error.message }, 400)
        : NextResponse.json({ success: false, pesan: error.message }, { status: 400 });
    }
    await releaseGuard(guard);
    console.error('Create kegiatan error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
