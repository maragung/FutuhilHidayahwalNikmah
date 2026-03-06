import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { PembayaranSPP, Santri, Admin, JurnalKas, Pengaturan } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';
import { createBackup, generateKodeInvoice } from '@/lib/utils';
import { kirimEmailAksiAdmin, getEmailPenerimaPerubahan } from '@/lib/email';

// GET - Ambil semua pembayaran
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
    const tahun = searchParams.get('tahun') || new Date().getFullYear();
    const bulan = searchParams.get('bulan');
    const santri_id = searchParams.get('santri_id');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 50;
    const offset = (page - 1) * limit;
    
    const where = { tahun_spp: tahun };
    
    if (bulan) {
      where.bulan_spp = bulan;
    }
    
    if (santri_id) {
      where.santri_id = santri_id;
    }
    
    const { count, rows } = await PembayaranSPP.findAndCountAll({
      where,
      include: [
        { model: Santri, as: 'santri', attributes: ['nik', 'nama_lengkap', 'jilid', 'tgl_mendaftar', 'status_aktif', 'tgl_nonaktif', 'nama_wali', 'no_telp_wali'] },
        { model: Admin, as: 'admin', attributes: ['nama_lengkap'] },
      ],
      order: [['tgl_bayar', 'DESC']],
      limit,
      offset,
    });
    
    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        halaman: page,
        limit,
        totalHalaman: Math.ceil(count / limit),
      },
    });
  } catch (error) {
    console.error('Get pembayaran error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}

// POST - Tambah pembayaran baru (multi bulan)
export async function POST(request) {
  let t;
  
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
    const { santri_id, bulan_list, tahun_spp, nominal_per_bulan, metode_bayar, keterangan, pin, abaikan_aturan_nominal } = body;
    
    // PIN verification
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });
    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });
    
    if (!santri_id || !bulan_list || bulan_list.length === 0 || !tahun_spp) {
      return NextResponse.json(
        { success: false, pesan: 'Santri dan bulan harus dipilih' },
        { status: 400 }
      );
    }
    
    const santri = await Santri.findByPk(santri_id);
    if (!santri) {
      return NextResponse.json(
        { success: false, pesan: 'Santri tidak ditemukan' },
        { status: 404 }
      );
    }
    
    const tahunInt = parseInt(tahun_spp, 10);
    if (!Number.isInteger(tahunInt)) {
      return NextResponse.json(
        { success: false, pesan: 'Tahun SPP tidak valid' },
        { status: 400 }
      );
    }

    const bulanList = [...new Set((bulan_list || []).map((b) => parseInt(b, 10)).filter((b) => b >= 1 && b <= 12))].sort((a, b) => a - b);
    if (bulanList.length === 0) {
      return NextResponse.json(
        { success: false, pesan: 'Bulan pembayaran tidak valid' },
        { status: 400 }
      );
    }

    const tglDaftar = new Date(santri.tgl_mendaftar);
    const tahunDaftar = tglDaftar.getFullYear();
    const bulanDaftar = tglDaftar.getMonth() + 1;

    let bulanAwalWajib = 1;
    if (tahunInt < tahunDaftar) {
      return NextResponse.json(
        { success: false, pesan: 'Tahun pembayaran sebelum santri terdaftar' },
        { status: 400 }
      );
    }
    if (tahunInt === tahunDaftar) {
      bulanAwalWajib = bulanDaftar;
    }

    let bulanAkhirWajib = 12;
    if (santri.tgl_nonaktif) {
      const tglNonaktif = new Date(santri.tgl_nonaktif);
      if (tglNonaktif.getFullYear() < tahunInt) {
        return NextResponse.json(
          { success: false, pesan: 'Santri sudah nonaktif pada tahun tersebut' },
          { status: 400 }
        );
      }
      if (tglNonaktif.getFullYear() === tahunInt) {
        bulanAkhirWajib = Math.min(bulanAkhirWajib, tglNonaktif.getMonth());
      }
    }

    if (bulanAkhirWajib < bulanAwalWajib) {
      return NextResponse.json(
        { success: false, pesan: 'Tidak ada kewajiban SPP pada periode ini' },
        { status: 400 }
      );
    }

    // Cek bulan yang sudah dibayar
    const existingPayments = await PembayaranSPP.findAll({
      where: {
        santri_id,
        tahun_spp: tahunInt,
        bulan_spp: { [Op.between]: [bulanAwalWajib, bulanAkhirWajib] },
      },
    });

    const paidSet = new Set(existingPayments.map((p) => p.bulan_spp));

    const paidInRequest = bulanList.filter((b) => paidSet.has(b));
    if (paidInRequest.length > 0) {
      return NextResponse.json(
        { success: false, pesan: `Bulan ${paidInRequest.join(', ')} sudah dibayar` },
        { status: 400 }
      );
    }

    const bulanTidakWajib = bulanList.filter((b) => b < bulanAwalWajib || b > bulanAkhirWajib);
    if (bulanTidakWajib.length > 0) {
      return NextResponse.json(
        { success: false, pesan: `Bulan ${bulanTidakWajib.join(', ')} tidak termasuk masa wajib bayar` },
        { status: 400 }
      );
    }

    let bulanPertamaBelumBayar = null;
    for (let b = bulanAwalWajib; b <= bulanAkhirWajib; b++) {
      if (!paidSet.has(b)) {
        bulanPertamaBelumBayar = b;
        break;
      }
    }

    if (!bulanPertamaBelumBayar) {
      return NextResponse.json(
        { success: false, pesan: 'Semua bulan wajib sudah lunas' },
        { status: 400 }
      );
    }

    const expected = [];
    for (let i = 0; i < bulanList.length; i++) {
      expected.push(bulanPertamaBelumBayar + i);
    }
    if (expected[expected.length - 1] > bulanAkhirWajib || bulanList.some((b, i) => b !== expected[i])) {
      return NextResponse.json(
        { success: false, pesan: `Pembayaran tidak boleh melompati bulan. Harus mulai dari bulan ${bulanPertamaBelumBayar} secara berurutan.` },
        { status: 400 }
      );
    }
    
    // Aturan nominal keluarga + subsidi:
    // - non subsidi default dari pengaturan
    // - subsidi dari pengaturan jika centang subsidi atau keluarga >=2 anak aktif
    const nominalNonSubsidi = parseInt(await Pengaturan.getNilai('nominal_spp_non_subsidi', '40000'), 10) || 40000;
    const nominalSubsidi = parseInt(await Pengaturan.getNilai('nominal_spp_subsidi', '30000'), 10) || 30000;

    let dapatSubsidi = Boolean(santri.is_subsidi);
    if (!dapatSubsidi && santri.nama_wali && santri.no_telp_wali) {
      const jumlahAnakKeluarga = await Santri.count({
        where: {
          nama_wali: santri.nama_wali,
          no_telp_wali: santri.no_telp_wali,
          status_aktif: true,
        },
      });
      if (jumlahAnakKeluarga >= 2) {
        dapatSubsidi = true;
      }
    }

    const nominalAturan = dapatSubsidi ? nominalSubsidi : nominalNonSubsidi;

    let nominalPerBulan = nominalAturan;
    if (Boolean(abaikan_aturan_nominal)) {
      if (!['Pimpinan TPQ', 'Bendahara', 'Sekretaris'].includes(auth.user.jabatan)) {
        return NextResponse.json(
          { success: false, pesan: 'Tidak memiliki akses untuk abaikan aturan nominal' },
          { status: 403 }
        );
      }
      const manualNominal = parseInt(nominal_per_bulan, 10);
      if (!Number.isInteger(manualNominal) || manualNominal <= 0) {
        return NextResponse.json(
          { success: false, pesan: 'Nominal manual tidak valid' },
          { status: 400 }
        );
      }
      nominalPerBulan = manualNominal;
    }

    t = await sequelize.transaction();

    const pembayaranList = [];
    
    // Ambil saldo terakhir
    const lastJurnal = await JurnalKas.findOne({
      order: [['id', 'DESC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    let saldoBerjalan = lastJurnal ? parseFloat(lastJurnal.saldo_berjalan) : 0;
    
    for (const bulan of bulanList) {
      const kodeInvoice = generateKodeInvoice('SPP');
      
      const pembayaran = await PembayaranSPP.create({
        kode_invoice: kodeInvoice,
        santri_id,
        admin_id: auth.user.id,
        tgl_bayar: new Date(),
        bulan_spp: bulan,
        tahun_spp: tahunInt,
        nominal: nominalPerBulan,
        metode_bayar: metode_bayar || 'Tunai',
        keterangan,
      }, { transaction: t });
      
      pembayaranList.push(pembayaran);
      
      // Update saldo
      saldoBerjalan += nominalPerBulan;
      
      // Catat ke jurnal kas
      await JurnalKas.create({
        tgl_transaksi: new Date(),
        jenis: 'Masuk',
        nominal: nominalPerBulan,
        referensi_kode: kodeInvoice,
        keterangan: `SPP ${santri.nama_lengkap} - Bulan ${bulan}/${tahunInt}`,
        saldo_berjalan: saldoBerjalan,
        admin_id: auth.user.id,
      }, { transaction: t });
    }
    
    await t.commit();
    
    // Backup
    await createBackup('Tambah Pembayaran SPP', 'pembayaran_spp', null, pembayaranList, auth.user.id);
    
    // Kirim salinan email ke Pimpinan TPQ & Bendahara
    try {
      const emailTujuan = await getEmailPenerimaPerubahan(auth.user.id);
      await kirimEmailAksiAdmin({
        aksi: 'Pembayaran SPP',
        deskripsi: `Pembayaran SPP ${bulanList.length} bulan untuk ${santri.nama_lengkap}`,
        detail: `<table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Santri</strong></td><td style="padding:5px;border:1px solid #ddd;">${santri.nama_lengkap} (${santri.nik})</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Bulan</strong></td><td style="padding:5px;border:1px solid #ddd;">${bulanList.join(', ')}/${tahunInt}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Nominal/Bulan</strong></td><td style="padding:5px;border:1px solid #ddd;">Rp ${nominalPerBulan.toLocaleString('id-ID')}${Boolean(abaikan_aturan_nominal) ? ' (manual)' : ''}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Total</strong></td><td style="padding:5px;border:1px solid #ddd;">Rp ${(bulanList.length * nominalPerBulan).toLocaleString('id-ID')}</td></tr>
          <tr><td style="padding:5px;border:1px solid #ddd;"><strong>Metode</strong></td><td style="padding:5px;border:1px solid #ddd;">${metode_bayar || 'Tunai'}</td></tr>
        </table>`,
        adminNama: auth.user.nama_lengkap,
        adminJabatan: auth.user.jabatan,
        emailTujuan,
      });
    } catch (emailErr) {
      console.error('Gagal kirim email salinan:', emailErr);
    }
    
    return NextResponse.json({
      success: true,
      pesan: `Pembayaran ${bulanList.length} bulan berhasil dicatat`,
      data: pembayaranList,
      nominal_per_bulan: nominalPerBulan,
    }, { status: 201 });
  } catch (error) {
    if (t) await t.rollback();
    if (error?.name === 'SequelizeUniqueConstraintError') {
      return NextResponse.json(
        { success: false, pesan: 'Pembayaran untuk bulan tersebut sudah tercatat' },
        { status: 400 }
      );
    }
    console.error('Create pembayaran error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
