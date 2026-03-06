import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { PembayaranSPP, Santri, Admin, JurnalKas } from '@/lib/models';
import sequelize from '@/lib/db';
import { createBackup } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

async function verifyPin(authUserId, pin) {
  const admin = await Admin.findByPk(authUserId);
  if (!admin) return { ok: false, status: 404, pesan: 'Admin tidak ditemukan' };
  if (!pin) return { ok: false, status: 400, pesan: 'PIN wajib diisi' };
  const valid = await admin.validPin(pin);
  if (!valid) return { ok: false, status: 403, pesan: 'PIN tidak valid' };
  return { ok: true, admin };
}

export async function GET(request, { params }) {
  try {
    await sequelize.authenticate();
    const auth = await verifyAuth(request);
    if (!auth.success) return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });

    const { id } = await params;
    const pembayaran = await PembayaranSPP.findByPk(id, {
      include: [
        { model: Santri, as: 'santri', attributes: ['id', 'nik', 'nama_lengkap', 'jilid'] },
        { model: Admin, as: 'admin', attributes: ['id', 'nama_lengkap', 'jabatan'] },
      ],
    });

    if (!pembayaran) return NextResponse.json({ success: false, pesan: 'Data pembayaran tidak ditemukan' }, { status: 404 });

    return NextResponse.json({ success: true, data: pembayaran });
  } catch (error) {
    console.error('Get pembayaran detail error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
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
    const pembayaran = await PembayaranSPP.findByPk(id, { transaction: t });
    if (!pembayaran) {
      await t.rollback();
      return NextResponse.json({ success: false, pesan: 'Data pembayaran tidak ditemukan' }, { status: 404 });
    }

    const dataSebelum = pembayaran.toJSON();
    const nominalLama = Number(pembayaran.nominal);

    const updateData = {
      nominal: body.nominal !== undefined ? Number(body.nominal) : nominalLama,
      metode_bayar: body.metode_bayar || pembayaran.metode_bayar,
      keterangan: body.keterangan !== undefined ? body.keterangan : pembayaran.keterangan,
      bulan_spp: body.bulan_spp ? Number(body.bulan_spp) : pembayaran.bulan_spp,
      tahun_spp: body.tahun_spp ? Number(body.tahun_spp) : pembayaran.tahun_spp,
    };

    await pembayaran.update(updateData, { transaction: t });

    await JurnalKas.update({
      nominal: updateData.nominal,
      keterangan: `SPP ${pembayaran.santri_id} - Bulan ${updateData.bulan_spp}/${updateData.tahun_spp}`,
    }, {
      where: { referensi_kode: pembayaran.kode_invoice },
      transaction: t,
    });

    const selisih = Number(updateData.nominal) - nominalLama;
    if (selisih !== 0) {
      const lastJurnal = await JurnalKas.findOne({ order: [['id', 'DESC']], transaction: t, lock: t.LOCK.UPDATE });
      const saldoTerakhir = lastJurnal ? Number(lastJurnal.saldo_berjalan) : 0;
      await JurnalKas.create({
        tgl_transaksi: new Date(),
        jenis: selisih > 0 ? 'Masuk' : 'Keluar',
        nominal: Math.abs(selisih),
        referensi_kode: `ADJ-${pembayaran.kode_invoice}`,
        keterangan: `Penyesuaian nominal pembayaran ${pembayaran.kode_invoice}`,
        saldo_berjalan: saldoTerakhir + selisih,
        admin_id: auth.user.id,
      }, { transaction: t });
    }

    await t.commit();
    await createBackup('Update Pembayaran SPP', 'pembayaran_spp', dataSebelum, pembayaran.toJSON(), auth.user.id);
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Update Pembayaran SPP',
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
    if (t) await t.rollback();
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json(
        { success: false, pesan: 'Periode SPP ini sudah ada untuk santri tersebut' },
        { status: 400 }
      );
    }
    console.error('Update pembayaran error:', error);
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
    const pembayaran = await PembayaranSPP.findByPk(id, { transaction: t });
    if (!pembayaran) {
      await t.rollback();
      return NextResponse.json({ success: false, pesan: 'Data pembayaran tidak ditemukan' }, { status: 404 });
    }

    const dataSebelum = pembayaran.toJSON();

    const lastJurnal = await JurnalKas.findOne({ order: [['id', 'DESC']], transaction: t, lock: t.LOCK.UPDATE });
    const saldoTerakhir = lastJurnal ? Number(lastJurnal.saldo_berjalan) : 0;

    await JurnalKas.create({
      tgl_transaksi: new Date(),
      jenis: 'Keluar',
      nominal: Number(pembayaran.nominal),
      referensi_kode: `REV-${pembayaran.kode_invoice}`,
      keterangan: `Pembatalan pembayaran ${pembayaran.kode_invoice}`,
      saldo_berjalan: saldoTerakhir - Number(pembayaran.nominal),
      admin_id: auth.user.id,
    }, { transaction: t });

    await pembayaran.destroy({ transaction: t });

    await t.commit();
    await createBackup('Hapus Pembayaran SPP', 'pembayaran_spp', dataSebelum, null, auth.user.id);
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Hapus Pembayaran SPP',
        deskripsi: `Pembayaran ${dataSebelum.kode_invoice} dibatalkan`,
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
    if (t) await t.rollback();
    console.error('Delete pembayaran error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
