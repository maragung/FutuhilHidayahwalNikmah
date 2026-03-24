import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Pengeluaran, Admin, JurnalKas } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';
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

    // Save the ORIGINAL expense date for journal reversal
    const tglKeluarAsli = pengeluaran.tgl_keluar;
    
    // Determine the NEW date (may be same as original if not changed)
    let tglKeluarBaru = tglKeluarAsli;
    if (body.tgl_keluar) {
      const dateStr = String(body.tgl_keluar).substring(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        const parsedDate = new Date(dateStr + 'T00:00:00');
        if (!isNaN(parsedDate.getTime())) {
          tglKeluarBaru = dateStr;
        }
      }
    }

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
        // Validate the date is real (not 2024-99-99)
        const parsedDate = new Date(dateStr + 'T00:00:00');
        if (!isNaN(parsedDate.getTime())) {
          updateData.tgl_keluar = dateStr;
          console.log('[PUT /api/pengeluaran/:id] Date formatted and validated:', dateStr);
        } else {
          console.warn('[PUT /api/pengeluaran/:id] Invalid date value:', body.tgl_keluar);
        }
      } else {
        console.warn('[PUT /api/pengeluaran/:id] Date format mismatch:', body.tgl_keluar);
      }
    }

    console.log('[PUT /api/pengeluaran/:id] Updating with data:', updateData);
    await pengeluaran.update(updateData, { transaction: t });
    console.log('[PUT /api/pengeluaran/:id] Update successful');

    const diff = nominalBaru - nominalLama;
    console.log('[PUT /api/pengeluaran/:id] Nominal diff:', diff);
    console.log('[PUT /api/pengeluaran/:id] Date changed from', tglKeluarAsli, 'to', tglKeluarBaru);

    // Handle journal entries for date change and/or nominal change
    if (tglKeluarAsli !== tglKeluarBaru || diff !== 0) {
      console.log('[PUT /api/pengeluaran/:id] Creating jurnal kas adjustment...');
      
      if (tglKeluarAsli !== tglKeluarBaru && diff === 0) {
        // Only date changed, nominal same: Reverse at old date, add at new date
        console.log('[PUT /api/pengeluaran/:id] Date change only, creating reversal and re-entry...');
        
        // Reverse at old date
        const lastJurnalOld = await JurnalKas.findOne({ 
          where: { tgl_transaksi: { [Op.lte]: tglKeluarAsli } },
          order: [['tgl_transaksi', 'DESC'], ['id', 'DESC']],
          transaction: t, 
          lock: t.LOCK.UPDATE 
        });
        const saldoOld = (lastJurnalOld ? Number(lastJurnalOld.saldo_berjalan) : 0) + nominalLama;
        
        await JurnalKas.create({
          tgl_transaksi: tglKeluarAsli,
          tanggal_aksi: tglKeluarAsli,
          jenis: 'Masuk', // Reverse the expense (money comes back)
          nominal: nominalLama,
          referensi_kode: buildSafeJurnalRef('ADJ', pengeluaran.kode_pengeluaran, pengeluaran.id, 'OLD'),
          keterangan: `Penyesuaian tanggal pengeluaran ${pengeluaran.kode_pengeluaran} (dari ${tglKeluarAsli})`,
          saldo_berjalan: saldoOld,
          admin_id: auth.user.id,
        }, { transaction: t });
        
        // Add at new date
        const lastJurnalNew = await JurnalKas.findOne({ 
          where: { tgl_transaksi: { [Op.lte]: tglKeluarBaru } },
          order: [['tgl_transaksi', 'DESC'], ['id', 'DESC']],
          transaction: t, 
          lock: t.LOCK.UPDATE 
        });
        const saldoNew = (lastJurnalNew ? Number(lastJurnalNew.saldo_berjalan) : 0) - nominalBaru;
        
        await JurnalKas.create({
          tgl_transaksi: tglKeluarBaru,
          tanggal_aksi: tglKeluarBaru,
          jenis: 'Keluar', // Record the expense again (money goes out)
          nominal: nominalBaru,
          referensi_kode: buildSafeJurnalRef('ADJ', pengeluaran.kode_pengeluaran, pengeluaran.id, 'NEW'),
          keterangan: `Penyesuaian tanggal pengeluaran ${pengeluaran.kode_pengeluaran} (ke ${tglKeluarBaru})`,
          saldo_berjalan: saldoNew,
          admin_id: auth.user.id,
        }, { transaction: t });
        
      } else if (tglKeluarAsli !== tglKeluarBaru && diff !== 0) {
        // Both date and nominal changed: Reverse full amount at old date, add full amount at new date
        console.log('[PUT /api/pengeluaran/:id] Date and nominal changed, creating full reversal and re-entry...');
        
        // Reverse at old date
        const lastJurnalOld = await JurnalKas.findOne({ 
          where: { tgl_transaksi: { [Op.lte]: tglKeluarAsli } },
          order: [['tgl_transaksi', 'DESC'], ['id', 'DESC']],
          transaction: t, 
          lock: t.LOCK.UPDATE 
        });
        const saldoOld = (lastJurnalOld ? Number(lastJurnalOld.saldo_berjalan) : 0) + nominalLama;
        
        await JurnalKas.create({
          tgl_transaksi: tglKeluarAsli,
          tanggal_aksi: tglKeluarAsli,
          jenis: 'Masuk',
          nominal: nominalLama,
          referensi_kode: buildSafeJurnalRef('ADJ', pengeluaran.kode_pengeluaran, pengeluaran.id, 'OLD'),
          keterangan: `Penyesuaian pengeluaran ${pengeluaran.kode_pengeluaran} (dari ${tglKeluarAsli})`,
          saldo_berjalan: saldoOld,
          admin_id: auth.user.id,
        }, { transaction: t });
        
        // Add at new date with new nominal
        const lastJurnalNew = await JurnalKas.findOne({ 
          where: { tgl_transaksi: { [Op.lte]: tglKeluarBaru } },
          order: [['tgl_transaksi', 'DESC'], ['id', 'DESC']],
          transaction: t, 
          lock: t.LOCK.UPDATE 
        });
        const saldoNew = (lastJurnalNew ? Number(lastJurnalNew.saldo_berjalan) : 0) - nominalBaru;
        
        await JurnalKas.create({
          tgl_transaksi: tglKeluarBaru,
          tanggal_aksi: tglKeluarBaru,
          jenis: 'Keluar',
          nominal: nominalBaru,
          referensi_kode: buildSafeJurnalRef('ADJ', pengeluaran.kode_pengeluaran, pengeluaran.id, 'NEW'),
          keterangan: `Penyesuaian pengeluaran ${pengeluaran.kode_pengeluaran} (ke ${tglKeluarBaru})`,
          saldo_berjalan: saldoNew,
          admin_id: auth.user.id,
        }, { transaction: t });
        
      } else {
        // Only nominal changed, date same: Just adjust the difference at the same date
        const lastJurnal = await JurnalKas.findOne({ order: [['id', 'DESC']], transaction: t, lock: t.LOCK.UPDATE });
        const saldo = (lastJurnal ? Number(lastJurnal.saldo_berjalan) : 0) - diff;
        console.log('[PUT /api/pengeluaran/:id] Last jurnal saldo:', lastJurnal ? lastJurnal.saldo_berjalan : 0, 'New saldo:', saldo);

        // Use the expense date for adjustment
        const tglPenyesuaian = updateData.tgl_keluar ? new Date(updateData.tgl_keluar) : new Date();

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
      }
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

    // Delete any ADJ journals related to this pengeluaran first (cleanup from previous edits)
    const adjJournals = await JurnalKas.findAll({
      where: {
        referensi_kode: {
          [Op.like]: `ADJ-${pengeluaran.kode_pengeluaran}%`
        }
      },
      transaction: t
    });
    
    for (const adjJournal of adjJournals) {
      await adjJournal.destroy({ transaction: t });
    }
    
    if (adjJournals.length > 0) {
      console.log(`[DELETE] Cleaned up ${adjJournals.length} ADJ journals for pengeluaran ${pengeluaran.id}`);
    }

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
