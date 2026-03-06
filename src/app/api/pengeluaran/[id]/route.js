import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Pengeluaran, Admin, JurnalKas } from '@/lib/models';
import sequelize from '@/lib/db';
import { createBackup } from '@/lib/utils';
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
    const nominalLama = Number(pengeluaran.nominal);
    const nominalBaru = body.nominal !== undefined ? Number(body.nominal) : nominalLama;

    await pengeluaran.update({
      judul: body.judul || pengeluaran.judul,
      kategori: body.kategori || pengeluaran.kategori,
      nominal: nominalBaru,
      catatan: body.catatan !== undefined ? body.catatan : pengeluaran.catatan,
      tgl_keluar: body.tgl_keluar || pengeluaran.tgl_keluar,
    }, { transaction: t });

    const diff = nominalBaru - nominalLama;
    if (diff !== 0) {
      const lastJurnal = await JurnalKas.findOne({ order: [['id', 'DESC']], transaction: t, lock: t.LOCK.UPDATE });
      const saldo = (lastJurnal ? Number(lastJurnal.saldo_berjalan) : 0) - diff;
      await JurnalKas.create({
        tgl_transaksi: new Date(),
        jenis: diff >= 0 ? 'Keluar' : 'Masuk',
        nominal: Math.abs(diff),
        referensi_kode: `ADJ-${pengeluaran.kode_pengeluaran}`,
        keterangan: `Penyesuaian pengeluaran ${pengeluaran.kode_pengeluaran}`,
        saldo_berjalan: saldo,
        admin_id: auth.user.id,
      }, { transaction: t });
    }

    await t.commit();
    await createBackup('Update Pengeluaran', 'pengeluaran', dataSebelum, pengeluaran.toJSON(), auth.user.id);
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Update Pengeluaran',
        deskripsi: `Pengeluaran ${pengeluaran.kode_pengeluaran} diperbarui`,
        detail: '',
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
    } catch (emailErr) {
      console.error('Gagal kirim email salinan:', emailErr);
    }

    return NextResponse.json({ success: true, pesan: 'Pengeluaran berhasil diperbarui', data: pengeluaran });
  } catch (error) {
    if (t) await t.rollback();
    console.error('Update pengeluaran error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
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

    const lastJurnal = await JurnalKas.findOne({ order: [['id', 'DESC']], transaction: t, lock: t.LOCK.UPDATE });
    const saldo = (lastJurnal ? Number(lastJurnal.saldo_berjalan) : 0) + Number(pengeluaran.nominal);

    await JurnalKas.create({
      tgl_transaksi: new Date(),
      jenis: 'Masuk',
      nominal: Number(pengeluaran.nominal),
      referensi_kode: `REV-${pengeluaran.kode_pengeluaran}`,
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
