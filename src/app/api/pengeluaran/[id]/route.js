import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Pengeluaran, Admin, JurnalKas } from '@/lib/models';
import sequelize from '@/lib/db';
import { createBackup, buildSafeJurnalRef } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

async function verifyPin(adminId, pin) {
  const admin = await Admin.findByPk(adminId);
  if (!admin) return { ok: false, status: 404, pesan: 'Admin tidak ditemukan' };
  if (!pin) return { ok: false, status: 400, pesan: 'PIN wajib diisi' };
  const valid = await admin.validPin(pin);
  if (!valid) return { ok: false, status: 403, pesan: 'PIN tidak valid' };
  return { ok: true };
}

export async function PUT(request, { params }) {
  let t;
  try {
    console.log('[PUT /api/pengeluaran/:id] Starting update...');
    await sequelize.authenticate();
    console.log('[PUT /api/pengeluaran/:id] Database authenticated');
    
    const auth = await verifyAuth(request);
    if (!auth.success) {
      console.log('[PUT /api/pengeluaran/:id] Auth failed:', auth.error);
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }
    console.log('[PUT /api/pengeluaran/:id] Auth success, user:', auth.user.id);

    const body = await request.json();
    console.log('[PUT /api/pengeluaran/:id] Request body:', body);
    
    const pinCheck = await verifyPin(auth.user.id, body.pin);
    if (!pinCheck.ok) {
      console.log('[PUT /api/pengeluaran/:id] PIN check failed:', pinCheck.pesan);
      return NextResponse.json({ success: false, pesan: pinCheck.pesan }, { status: pinCheck.status });
    }
    console.log('[PUT /api/pengeluaran/:id] PIN verified');

    t = await sequelize.transaction();
    console.log('[PUT /api/pengeluaran/:id] Transaction started');

    const { id } = await params;
    console.log('[PUT /api/pengeluaran/:id] Looking for pengeluaran with id:', id);
    
    const pengeluaran = await Pengeluaran.findByPk(id, { transaction: t });
    if (!pengeluaran) {
      await t.rollback();
      console.log('[PUT /api/pengeluaran/:id] Pengeluaran not found');
      return NextResponse.json({ success: false, pesan: 'Data pengeluaran tidak ditemukan' }, { status: 404 });
    }
    console.log('[PUT /api/pengeluaran/:id] Pengeluaran found:', pengeluaran.toJSON());

    const dataSebelum = pengeluaran.toJSON();
    const nominalLama = Number(pengeluaran.nominal);
    const nominalBaru = body.nominal !== undefined ? Number(body.nominal) : nominalLama;

    // Validate nominal
    if (isNaN(nominalBaru) || nominalBaru < 0) {
      await t.rollback();
      console.log('[PUT /api/pengeluaran/:id] Invalid nominal:', nominalBaru);
      return NextResponse.json({ success: false, pesan: 'Nominal tidak valid' }, { status: 400 });
    }

    // Prepare update data
    const updateData = {
      judul: body.judul || pengeluaran.judul,
      kategori: body.kategori || pengeluaran.kategori,
      nominal: nominalBaru,
      catatan: body.catatan !== undefined ? body.catatan : pengeluaran.catatan,
    };

    // Handle date field properly for DATEONLY type
    if (body.tgl_keluar) {
      // Ensure date is in YYYY-MM-DD format
      const dateStr = String(body.tgl_keluar).substring(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        updateData.tgl_keluar = dateStr;
        console.log('[PUT /api/pengeluaran/:id] Date formatted:', dateStr);
      }
    }

    console.log('[PUT /api/pengeluaran/:id] Updating with data:', updateData);
    await pengeluaran.update(updateData, { transaction: t });
    console.log('[PUT /api/pengeluaran/:id] Update successful');

    const diff = nominalBaru - nominalLama;
    console.log('[PUT /api/pengeluaran/:id] Nominal diff:', diff);

    if (diff !== 0) {
      console.log('[PUT /api/pengeluaran/:id] Creating jurnal kas adjustment...');
      const lastJurnal = await JurnalKas.findOne({ order: [['id', 'DESC']], transaction: t, lock: t.LOCK.UPDATE });
      const saldo = (lastJurnal ? Number(lastJurnal.saldo_berjalan) : 0) - diff;
      console.log('[PUT /api/pengeluaran/:id] Last jurnal saldo:', lastJurnal ? lastJurnal.saldo_berjalan : 0, 'New saldo:', saldo);

      // Use the expense date for the adjustment entry, not today's date
      const tglPenyesuaian = pengeluaran.tgl_keluar ? new Date(pengeluaran.tgl_keluar) : new Date();

      await JurnalKas.create({
        tgl_transaksi: tglPenyesuaian,
        tanggal_aksi: tglPenyesuaian,
        jenis: diff >= 0 ? 'Keluar' : 'Masuk',
        nominal: Math.abs(diff),
        referensi_kode: buildSafeJurnalRef('ADJ', pengeluaran.kode_pengeluaran, pengeluaran.id),
        keterangan: `Penyesuaian pengeluaran ${pengeluaran.kode_pengeluaran}`,
        saldo_berjalan: saldo,
        admin_id: auth.user.id,
      }, { transaction: t });
      console.log('[PUT /api/pengeluaran/:id] Jurnal kas adjustment created');
    }

    console.log('[PUT /api/pengeluaran/:id] Committing transaction...');
    await t.commit();
    console.log('[PUT /api/pengeluaran/:id] Transaction committed');
    
    console.log('[PUT /api/pengeluaran/:id] Creating backup...');
    await createBackup('Update Pengeluaran', 'pengeluaran', dataSebelum, pengeluaran.toJSON(), auth.user.id);
    console.log('[PUT /api/pengeluaran/:id] Backup created');
    
    try {
      console.log('[PUT /api/pengeluaran/:id] Sending email notification...');
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Update Pengeluaran',
        deskripsi: `Pengeluaran ${pengeluaran.kode_pengeluaran} diperbarui`,
        detail: '',
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
      console.log('[PUT /api/pengeluaran/:id] Email notification sent');
    } catch (emailErr) {
      console.error('[PUT /api/pengeluaran/:id] Failed to send email:', emailErr);
    }

    console.log('[PUT /api/pengeluaran/:id] Success!');
    return NextResponse.json({ success: true, pesan: 'Pengeluaran berhasil diperbarui', data: pengeluaran });
  } catch (error) {
    console.error('[PUT /api/pengeluaran/:id] ERROR:', error);
    console.error('[PUT /api/pengeluaran/:id] Error stack:', error.stack);
    if (t) {
      console.log('[PUT /api/pengeluaran/:id] Rolling back transaction...');
      await t.rollback();
    }
    return NextResponse.json({ 
      success: false, 
      pesan: 'Terjadi kesalahan server: ' + (error.message || 'Unknown error'),
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  let t;
  try {
    await sequelize.authenticate();
    const auth = await verifyAuth(request);
    if (!auth.success) return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });

    const body = await request.json();
    const pinCheck = await verifyPin(auth.user.id, body.pin);
    if (!pinCheck.ok) return NextResponse.json({ success: false, pesan: pinCheck.pesan }, { status: pinCheck.status });

    t = await sequelize.transaction();

    const { id } = await params;
    const pengeluaran = await Pengeluaran.findByPk(id, { transaction: t });
    if (!pengeluaran) {
      await t.rollback();
      return NextResponse.json({ success: false, pesan: 'Data pengeluaran tidak ditemukan' }, { status: 404 });
    }

    const dataSebelum = pengeluaran.toJSON();

    // Use the expense date for the reversal entry, not today's date
    const tglPembatalan = pengeluaran.tgl_keluar ? new Date(pengeluaran.tgl_keluar) : new Date();
    
    const lastJurnal = await JurnalKas.findOne({ order: [['id', 'DESC']], transaction: t, lock: t.LOCK.UPDATE });
    const saldo = (lastJurnal ? Number(lastJurnal.saldo_berjalan) : 0) + Number(pengeluaran.nominal);

    await JurnalKas.create({
      tgl_transaksi: tglPembatalan,
      tanggal_aksi: tglPembatalan,
      jenis: 'Masuk',
      nominal: Number(pengeluaran.nominal),
      referensi_kode: buildSafeJurnalRef('REV', pengeluaran.kode_pengeluaran, pengeluaran.id),
      keterangan: `Pembatalan pengeluaran ${pengeluaran.kode_pengeluaran}`,
      saldo_berjalan: saldo,
      admin_id: auth.user.id,
    }, { transaction: t });

    await pengeluaran.destroy({ transaction: t });
    await t.commit();

    await createBackup('Hapus Pengeluaran', 'pengeluaran', dataSebelum, null, auth.user.id);
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Hapus Pengeluaran',
        deskripsi: `Pengeluaran ${dataSebelum.kode_pengeluaran} dihapus`,
        detail: '',
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
    } catch (emailErr) {
      console.error('Gagal kirim email salinan:', emailErr);
    }

    return NextResponse.json({ success: true, pesan: 'Pengeluaran berhasil dihapus' });
  } catch (error) {
    if (t) await t.rollback();
    console.error('Delete pengeluaran error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
