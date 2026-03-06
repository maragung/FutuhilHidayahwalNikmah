import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { PembayaranLain, Santri, Kegiatan, Admin, JurnalKas } from '@/lib/models';
import sequelize from '@/lib/db';
import { createBackup } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

// GET - Detail pembayaran lain
export async function GET(request, { params }) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }
    await sequelize.authenticate();

    const { id } = await params;
    const pembayaran = await PembayaranLain.findByPk(id, {
      include: [
        { model: Santri, as: 'santri', attributes: ['nik', 'nama_lengkap', 'jilid', 'is_subsidi'] },
        { model: Kegiatan, as: 'kegiatan', attributes: ['nama_kegiatan', 'nominal'] },
        { model: Admin, as: 'admin', attributes: ['nama_lengkap'] },
      ],
    });

    if (!pembayaran) {
      return NextResponse.json({ success: false, pesan: 'Pembayaran tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: pembayaran });
  } catch (error) {
    console.error('Get pembayaran lain detail error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// DELETE - Hapus pembayaran lain (soft)
export async function DELETE(request, { params }) {
  const t = await sequelize.transaction();
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }
    await sequelize.authenticate();

    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });

    const body = await request.json();
    if (!body.pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(body.pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    const { id } = await params;
    const pembayaran = await PembayaranLain.findByPk(id, {
      include: [{ model: Kegiatan, as: 'kegiatan', attributes: ['gabung_saldo_utama', 'nama_kegiatan'] }],
      transaction: t,
    });
    if (!pembayaran) {
      await t.rollback();
      return NextResponse.json({ success: false, pesan: 'Pembayaran tidak ditemukan' }, { status: 404 });
    }

    const dataSebelum = pembayaran.toJSON();
    if (pembayaran.kegiatan?.gabung_saldo_utama) {
      const lastJurnal = await JurnalKas.findOne({ order: [['id', 'DESC']], transaction: t, lock: t.LOCK.UPDATE });
      const saldoBerjalan = (lastJurnal ? Number(lastJurnal.saldo_berjalan) : 0) - Number(pembayaran.nominal);
      await JurnalKas.create({
        tgl_transaksi: new Date(),
        jenis: 'Keluar',
        nominal: Number(pembayaran.nominal),
        referensi_kode: `REV-${pembayaran.kode_invoice}`,
        keterangan: `Pembatalan pembayaran kegiatan ${pembayaran.kegiatan?.nama_kegiatan || ''}`.trim(),
        saldo_berjalan: saldoBerjalan,
        admin_id: auth.user.id,
      }, { transaction: t });
    }

    await pembayaran.destroy({ transaction: t });

    await t.commit();

    await createBackup('Hapus Pembayaran Lain', 'pembayaran_lain', dataSebelum, null, auth.user.id);
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Hapus Pembayaran Lain',
        deskripsi: `Pembayaran ${dataSebelum.kode_invoice} dihapus`,
        detail: '',
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
    } catch (emailErr) {
      console.error('Gagal kirim email salinan:', emailErr);
    }

    return NextResponse.json({ success: true, pesan: 'Pembayaran berhasil dihapus' });
  } catch (error) {
    await t.rollback();
    console.error('Delete pembayaran lain error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// PUT - Update pembayaran lain
export async function PUT(request, { params }) {
  const t = await sequelize.transaction();
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      await t.rollback();
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }
    await sequelize.authenticate();

    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) {
      await t.rollback();
      return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });
    }

    const body = await request.json();
    if (!body.pin) {
      await t.rollback();
      return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    }
    const pinValid = await admin.validPin(body.pin);
    if (!pinValid) {
      await t.rollback();
      return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });
    }

    const { id: pembayaranId } = await params;
    const pembayaran = await PembayaranLain.findByPk(pembayaranId, {
      include: [{ model: Kegiatan, as: 'kegiatan', attributes: ['gabung_saldo_utama', 'nama_kegiatan'] }],
      transaction: t,
    });
    if (!pembayaran) {
      await t.rollback();
      return NextResponse.json({ success: false, pesan: 'Pembayaran tidak ditemukan' }, { status: 404 });
    }

    const dataSebelum = pembayaran.toJSON();
    const nominalLama = Number(pembayaran.nominal);
    const nominalBaru = body.nominal !== undefined ? Number(body.nominal) : nominalLama;

    await pembayaran.update({
      nominal: nominalBaru,
      metode_bayar: body.metode_bayar || pembayaran.metode_bayar,
      keterangan: body.keterangan !== undefined ? body.keterangan : pembayaran.keterangan,
      tgl_bayar: body.tgl_bayar || pembayaran.tgl_bayar,
    }, { transaction: t });

    if (pembayaran.kegiatan?.gabung_saldo_utama && nominalBaru !== nominalLama) {
      const diff = nominalBaru - nominalLama;
      const lastJurnal = await JurnalKas.findOne({ order: [['id', 'DESC']], transaction: t, lock: t.LOCK.UPDATE });
      const saldoBerjalan = (lastJurnal ? Number(lastJurnal.saldo_berjalan) : 0) + diff;
      await JurnalKas.create({
        tgl_transaksi: new Date(),
        jenis: diff >= 0 ? 'Masuk' : 'Keluar',
        nominal: Math.abs(diff),
        referensi_kode: `ADJ-${pembayaran.kode_invoice}`,
        keterangan: `Penyesuaian pembayaran kegiatan ${pembayaran.kegiatan?.nama_kegiatan || ''}`.trim(),
        saldo_berjalan: saldoBerjalan,
        admin_id: auth.user.id,
      }, { transaction: t });
    }

    await t.commit();
    await createBackup('Update Pembayaran Lain', 'pembayaran_lain', dataSebelum, pembayaran.toJSON(), auth.user.id);
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Update Pembayaran Lain',
        deskripsi: `Pembayaran ${pembayaran.kode_invoice} diperbarui`,
        detail: '',
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
    } catch (emailErr) {
      console.error('Gagal kirim email salinan:', emailErr);
    }

    return NextResponse.json({ success: true, pesan: 'Pembayaran berhasil diperbarui', data: pembayaran });
  } catch (error) {
    await t.rollback();
    console.error('Update pembayaran lain error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
