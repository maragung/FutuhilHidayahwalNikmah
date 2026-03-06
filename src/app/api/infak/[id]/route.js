import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { InfakSedekah, Admin, JurnalKas } from '@/lib/models';
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
    const infak = await InfakSedekah.findByPk(id, { transaction: t });
    if (!infak) {
      await t.rollback();
      return NextResponse.json({ success: false, pesan: 'Data infak tidak ditemukan' }, { status: 404 });
    }

    const dataSebelum = infak.toJSON();
    const nominalLama = Number(infak.nominal);
    const nominalBaru = body.nominal !== undefined ? Number(body.nominal) : nominalLama;

    await infak.update({
      nama_donatur: body.nama_donatur || infak.nama_donatur,
      nominal: nominalBaru,
      catatan: body.catatan !== undefined ? body.catatan : infak.catatan,
      tgl_terima: body.tgl_terima || infak.tgl_terima,
    }, { transaction: t });

    const diff = nominalBaru - nominalLama;
    if (diff !== 0) {
      const lastJurnal = await JurnalKas.findOne({ order: [['id', 'DESC']], transaction: t, lock: t.LOCK.UPDATE });
      const saldo = (lastJurnal ? Number(lastJurnal.saldo_berjalan) : 0) + diff;
      await JurnalKas.create({
        tgl_transaksi: new Date(),
        jenis: diff >= 0 ? 'Masuk' : 'Keluar',
        nominal: Math.abs(diff),
        referensi_kode: `ADJ-${infak.kode_transaksi}`,
        keterangan: `Penyesuaian infak ${infak.kode_transaksi}`,
        saldo_berjalan: saldo,
        admin_id: auth.user.id,
      }, { transaction: t });
    }

    await t.commit();
    await createBackup('Update Infak/Sedekah', 'infak_sedekah', dataSebelum, infak.toJSON(), auth.user.id);
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Update Infak/Sedekah',
        deskripsi: `Transaksi ${infak.kode_transaksi} diperbarui`,
        detail: '',
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
    } catch (emailErr) {
      console.error('Gagal kirim email salinan:', emailErr);
    }

    return NextResponse.json({ success: true, pesan: 'Infak berhasil diperbarui', data: infak });
  } catch (error) {
    if (t) await t.rollback();
    console.error('Update infak error:', error);
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
    const infak = await InfakSedekah.findByPk(id, { transaction: t });
    if (!infak) {
      await t.rollback();
      return NextResponse.json({ success: false, pesan: 'Data infak tidak ditemukan' }, { status: 404 });
    }

    const dataSebelum = infak.toJSON();

    const lastJurnal = await JurnalKas.findOne({ order: [['id', 'DESC']], transaction: t, lock: t.LOCK.UPDATE });
    const saldo = (lastJurnal ? Number(lastJurnal.saldo_berjalan) : 0) - Number(infak.nominal);

    await JurnalKas.create({
      tgl_transaksi: new Date(),
      jenis: 'Keluar',
      nominal: Number(infak.nominal),
      referensi_kode: `REV-${infak.kode_transaksi}`,
      keterangan: `Pembatalan infak ${infak.kode_transaksi}`,
      saldo_berjalan: saldo,
      admin_id: auth.user.id,
    }, { transaction: t });

    await infak.destroy({ transaction: t });
    await t.commit();

    await createBackup('Hapus Infak/Sedekah', 'infak_sedekah', dataSebelum, null, auth.user.id);
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Hapus Infak/Sedekah',
        deskripsi: `Transaksi ${dataSebelum.kode_transaksi} dihapus`,
        detail: '',
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
    } catch (emailErr) {
      console.error('Gagal kirim email salinan:', emailErr);
    }

    return NextResponse.json({ success: true, pesan: 'Infak berhasil dihapus' });
  } catch (error) {
    if (t) await t.rollback();
    console.error('Delete infak error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
