import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Pengeluaran, Admin, JurnalKas, Log } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';
import { createBackup, generateKodeInvoice, getClientTimeConfig } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';
import { claimIdempotency, logDuplicateAttempt, releaseGuard, respondWithGuard } from '@/lib/request-guard';
import { ValidationError, readDateValue, readEnumValue, readOptionalText, readPositiveAmount, readRequiredText } from '@/lib/request-validation';

// GET - Ambil semua pengeluaran
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
    const tahun = searchParams.get('tahun');
    const kategori = searchParams.get('kategori');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;
    
    const where = {};
    
    if (tahun) {
      const startDate = new Date(tahun, 0, 1);
      const endDate = new Date(tahun, 11, 31);
      where.tgl_keluar = { [Op.between]: [startDate, endDate] };
    }
    
    if (kategori) {
      where.kategori = kategori;
    }
    
    const { count, rows } = await Pengeluaran.findAndCountAll({
      where,
      include: [
        { model: Admin, as: 'admin', attributes: ['nama_lengkap'] },
      ],
      order: [['tgl_keluar', 'DESC']],
      limit,
      offset,
    });
    
    // Hitung total pengeluaran
    const total = await Pengeluaran.sum('nominal', { where });
    
    return NextResponse.json({
      success: true,
      data: rows,
      total_pengeluaran: total || 0,
      pagination: {
        total: count,
        halaman: page,
        limit,
        totalHalaman: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get pengeluaran error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}

// POST - Tambah pengeluaran
export async function POST(request) {
  let t;
  let guard;
  
  try {
    await sequelize.authenticate();
    
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, pesan: auth.error },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { judul, nominal, catatan, tgl_keluar, kategori, pin } = body;
    const judulText = readRequiredText(judul, 'Judul', { max: 150 });
    const nominalValue = readPositiveAmount(nominal, 'Nominal');
    const kategoriValue = readEnumValue(kategori, 'Kategori', ['Gaji', 'Listrik', 'Sarana', 'Pembangunan', 'ATK', 'Lainnya'], 'Lainnya');
    const catatanText = readOptionalText(catatan, { max: 500 });
    const tanggalKeluar = readDateValue(tgl_keluar, 'Tanggal keluar', new Date());

    const guardResult = await claimIdempotency({
      request,
      route: '/api/pengeluaran',
      actorScope: 'admin',
      actorId: auth.user.id,
      ttlMs: 15 * 60 * 1000,
      payload: {
        judul: judulText,
        kategori: kategoriValue,
        nominal: nominalValue,
        catatan: catatanText,
        tgl_keluar: tanggalKeluar.toISOString(),
      },
    });
    if (!guardResult.success) {
      return guardResult.response;
    }
    guard = guardResult.guard;
    
    // PIN verification
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });
    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });
    
    const recentDuplicate = await Pengeluaran.findOne({
      where: {
        judul: judulText,
        kategori: kategoriValue,
        nominal: nominalValue,
        createdAt: { [Op.gte]: new Date(Date.now() - 10 * 60 * 1000) },
      },
      order: [['id', 'DESC']],
    });
    if (recentDuplicate) {
      await logDuplicateAttempt('Pengeluaran duplikat ditolak', {
        admin_id: auth.user.id,
        recent_code: recentDuplicate.kode_pengeluaran,
        judul: judulText,
        nominal: nominalValue,
      });
      return respondWithGuard(guard, { success: false, pesan: 'Pengeluaran serupa baru saja dicatat. Periksa riwayat sebelum mencoba lagi.' }, 409);
    }
    
    t = await sequelize.transaction();

    const kodePengeluaran = generateKodeInvoice('OUT', getClientTimeConfig(request));
    
    const pengeluaran = await Pengeluaran.create({
      kode_pengeluaran: kodePengeluaran,
      judul: judulText,
      nominal: nominalValue,
      catatan: catatanText,
      tgl_keluar: tanggalKeluar,
      admin_id: auth.user.id,
      kategori: kategoriValue,
    }, { transaction: t });
    
    // Ambil saldo terakhir
    const lastJurnal = await JurnalKas.findOne({
      order: [['id', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const saldoBerjalan = (lastJurnal ? parseFloat(lastJurnal.saldo_berjalan) : 0) - nominalValue;
    
    // Catat ke jurnal kas
    await JurnalKas.create({
      tgl_transaksi: tanggalKeluar,
      jenis: 'Keluar',
      nominal: nominalValue,
      referensi_kode: kodePengeluaran,
      keterangan: judulText,
      saldo_berjalan: saldoBerjalan,
      admin_id: auth.user.id,
    }, { transaction: t });
    
    await t.commit();
    
    // Backup
    await createBackup('Tambah Pengeluaran', 'pengeluaran', null, pengeluaran.toJSON(), auth.user.id);

    // Audit log
    try {
      await Log.create({
        level: 'INFO',
        context: 'PENGELUARAN',
        message: `[${auth.user.username}] Catat pengeluaran: ${judulText}`,
        detail: JSON.stringify({ judul: judulText, nominal: nominalValue, kategori: kategoriValue, catatan: catatanText }),
      });
    } catch (_) {}
    
    // Kirim salinan email ke Pimpinan TPQ & Bendahara
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Pengeluaran Baru',
        deskripsi: `Pengeluaran: ${judulText}`,
        detail: `<table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Judul</strong></td><td style="padding:5px;border:1px solid #ddd;">${judulText}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Kategori</strong></td><td style="padding:5px;border:1px solid #ddd;">${kategoriValue}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Nominal</strong></td><td style="padding:5px;border:1px solid #ddd;">Rp ${nominalValue.toLocaleString('id-ID')}</td></tr>
        </table>`,
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
    } catch (emailErr) {
      console.error('Gagal kirim email salinan:', emailErr);
    }
    
    return respondWithGuard(guard, {
      success: true,
      pesan: 'Pengeluaran berhasil dicatat',
      data: pengeluaran,
    }, 201);
  } catch (error) {
    if (t) await t.rollback();
    if (error instanceof ValidationError) {
      return guard
        ? respondWithGuard(guard, { success: false, pesan: error.message }, 400)
        : NextResponse.json({ success: false, pesan: error.message }, { status: 400 });
    }
    await releaseGuard(guard);
    console.error('Create pengeluaran error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
