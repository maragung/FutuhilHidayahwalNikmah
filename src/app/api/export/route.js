import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Santri, PembayaranSPP, InfakSedekah, Pengeluaran, JurnalKas, Admin, PembayaranLain, Kegiatan, BukuPrestasiSantri } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';

// GET - Export data untuk PDF/Excel
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
    const tipe = searchParams.get('tipe'); // santri, pembayaran, infak, pengeluaran, jurnal
    const tahun = parseInt(searchParams.get('tahun')) || new Date().getFullYear();
    const bulan = searchParams.get('bulan');
    const kegiatanId = searchParams.get('kegiatan_id');
    const jenisPrestasi = searchParams.get('jenis_prestasi') || '';
    const includeNik = searchParams.get('include_nik') !== 'false';
    const includeEmail = searchParams.get('include_email') !== 'false';
    const includePhone = searchParams.get('include_phone') !== 'false';
    const filterKategori = searchParams.get('filter_kategori') || ''; // subsidi|non_subsidi|jilid|lunas
    const filterJilid = searchParams.get('filter_jilid') || '';
    const sortSantri = searchParams.get('sort_santri') === 'nama' ? 'nama' : 'no_absen';
    
    let data = [];
    let title = '';
    
    switch (tipe) {
      case 'santri': {
        const kategoriLabel = filterKategori === 'subsidi' ? ' (Subsidi)'
          : filterKategori === 'non_subsidi' ? ' (Non Subsidi)'
          : filterKategori === 'jilid' && filterJilid ? ` (Jilid ${filterJilid})`
          : filterKategori === 'lunas' ? ' (Lunas)'
          : '';
        title = `Data Santri TPQ Futuhil Hidayah${kategoriLabel}`;

        const santriWhere = { status_aktif: true };
        if (filterKategori === 'subsidi') santriWhere.is_subsidi = true;
        else if (filterKategori === 'non_subsidi') santriWhere.is_subsidi = false;
        else if (filterKategori === 'jilid' && filterJilid) santriWhere.jilid = filterJilid;

        let santriRows = await Santri.findAll({
          where: santriWhere,
          raw: true,
        });

        // Lunas filter: paid all required months up to current month
        if (filterKategori === 'lunas') {
          const now = new Date();
          const tahunSaat = now.getFullYear();
          const bulanSaat = now.getMonth() + 1;
          const batasAkhir = tahun === tahunSaat ? bulanSaat : 12;
          const bayarList = await PembayaranSPP.findAll({
            where: { tahun_spp: tahun },
            attributes: ['santri_id', 'bulan_spp'],
            raw: true,
          });
          const payMap = {};
          bayarList.forEach(p => {
            if (!payMap[p.santri_id]) payMap[p.santri_id] = new Set();
            payMap[p.santri_id].add(p.bulan_spp);
          });
          santriRows = santriRows.filter(s => {
            const tglDaftar = new Date(s.tgl_mendaftar);
            const tahunDaftar = tglDaftar.getFullYear();
            const bulanDaftar = tglDaftar.getMonth() + 1;
            const bulanMulai = tahun < tahunDaftar ? 13 : (tahun === tahunDaftar ? bulanDaftar : 1);
            const bayar = payMap[s.id] || new Set();
            for (let b = bulanMulai; b <= batasAkhir; b++) {
              if (!bayar.has(b)) return false;
            }
            return true;
          });
        }

        const santriComparator = (a, b) => {
          if (sortSantri === 'nama') {
            const namaCompare = String(a.nama_lengkap || '').localeCompare(String(b.nama_lengkap || ''), 'id', {
              sensitivity: 'base',
              numeric: true,
            });
            if (namaCompare !== 0) return namaCompare;
          }

          const noA = a.no_absen == null ? Number.MAX_SAFE_INTEGER : Number(a.no_absen);
          const noB = b.no_absen == null ? Number.MAX_SAFE_INTEGER : Number(b.no_absen);
          if (noA !== noB) return noA - noB;

          return String(a.nama_lengkap || '').localeCompare(String(b.nama_lengkap || ''), 'id', {
            sensitivity: 'base',
            numeric: true,
          });
        };

        santriRows = [...santriRows].sort(santriComparator);

        const pembayaranNominalRows = await PembayaranSPP.findAll({
          where: { tahun_spp: tahun },
          attributes: ['santri_id', 'bulan_spp', [sequelize.fn('SUM', sequelize.col('nominal')), 'total_nominal']],
          group: ['santri_id', 'bulan_spp'],
          raw: true,
        });

        const pembayaranSemuaRows = await PembayaranSPP.findAll({
          attributes: ['santri_id', 'tahun_spp', 'bulan_spp'],
          raw: true,
        });

        const nominalMap = {};
        pembayaranNominalRows.forEach((row) => {
          const sid = Number.parseInt(row.santri_id, 10);
          const bulanKe = Number.parseInt(row.bulan_spp, 10);
          const nominalTotal = Number.parseFloat(row.total_nominal || 0) || 0;
          if (!nominalMap[sid]) nominalMap[sid] = {};
          nominalMap[sid][bulanKe] = nominalTotal;
        });

        const pembayaranSemuaMap = {};
        pembayaranSemuaRows.forEach((row) => {
          const sid = Number.parseInt(row.santri_id, 10);
          const tahunSpp = Number.parseInt(row.tahun_spp, 10);
          const bulanSpp = Number.parseInt(row.bulan_spp, 10);
          const key = `${tahunSpp}-${bulanSpp}`;
          if (!pembayaranSemuaMap[sid]) pembayaranSemuaMap[sid] = new Set();
          pembayaranSemuaMap[sid].add(key);
        });

        const now = new Date();
        const batasAkhirTahunDipilih = tahun === now.getFullYear() ? now.getMonth() + 1 : 12;

        const hitungBulanWajibDanTerbayar = (santri) => {
          const tglDaftar = new Date(santri.tgl_mendaftar);
          const tahunDaftar = tglDaftar.getFullYear();
          const bulanDaftar = tglDaftar.getMonth() + 1;

          let bulanMulai = 1;
          if (tahun < tahunDaftar) {
            bulanMulai = 13;
          } else if (tahun === tahunDaftar) {
            bulanMulai = bulanDaftar;
          }

          let bulanAkhir = 12;
          if (santri.tgl_nonaktif) {
            const tglNonaktif = new Date(santri.tgl_nonaktif);
            if (tglNonaktif.getFullYear() < tahun) {
              bulanAkhir = 0;
            } else if (tglNonaktif.getFullYear() === tahun) {
              bulanAkhir = Math.min(bulanAkhir, tglNonaktif.getMonth());
            }
          }

          bulanAkhir = Math.min(bulanAkhir, batasAkhirTahunDipilih);
          if (bulanMulai > bulanAkhir) {
            return { bulan_wajib: 0, bulan_terbayar: 0 };
          }

          const payMap = nominalMap[santri.id] || {};
          let wajib = 0;
          let terbayar = 0;
          for (let b = bulanMulai; b <= bulanAkhir; b++) {
            wajib += 1;
            if (payMap[b]) terbayar += 1;
          }
          return { bulan_wajib: wajib, bulan_terbayar: terbayar };
        };

        const hitungTerlunasiLifetime = (santri) => {
          const tglDaftar = new Date(santri.tgl_mendaftar);
          const startYear = tglDaftar.getFullYear();
          const startMonth = tglDaftar.getMonth() + 1;

          let endYear = now.getFullYear();
          let endMonth = now.getMonth() + 1;
          if (santri.tgl_nonaktif) {
            const tglNonaktif = new Date(santri.tgl_nonaktif);
            const nonaktifYear = tglNonaktif.getFullYear();
            const nonaktifMonth = tglNonaktif.getMonth();
            if (nonaktifYear < endYear || (nonaktifYear === endYear && nonaktifMonth < endMonth)) {
              endYear = nonaktifYear;
              endMonth = nonaktifMonth;
            }
          }

          const totalWajib = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
          const bulanSejakDaftarSampaiKini = Math.max(0, totalWajib);

          const setBayar = pembayaranSemuaMap[santri.id] || new Set();
          let bulanDibayarTotal = 0;
          for (let y = startYear; y <= endYear; y++) {
            const monthStart = y === startYear ? startMonth : 1;
            const monthEnd = y === endYear ? endMonth : 12;
            for (let m = monthStart; m <= monthEnd; m++) {
              if (setBayar.has(`${y}-${m}`)) bulanDibayarTotal += 1;
            }
          }

          return { bulan_dibayar_total: bulanDibayarTotal, bulan_sejak_daftar_sampai_kini: bulanSejakDaftarSampaiKini };
        };

        data = santriRows.map((s) => {
          const perTahun = hitungBulanWajibDanTerbayar(s);
          const lifetime = hitungTerlunasiLifetime(s);
          return {
            no_absen: s.no_absen ?? '-',
            nama_santri: s.nama_lengkap,
            jilid: s.jilid,
            bulan_1: nominalMap[s.id]?.[1] || 0,
            bulan_2: nominalMap[s.id]?.[2] || 0,
            bulan_3: nominalMap[s.id]?.[3] || 0,
            bulan_4: nominalMap[s.id]?.[4] || 0,
            bulan_5: nominalMap[s.id]?.[5] || 0,
            bulan_6: nominalMap[s.id]?.[6] || 0,
            bulan_7: nominalMap[s.id]?.[7] || 0,
            bulan_8: nominalMap[s.id]?.[8] || 0,
            bulan_9: nominalMap[s.id]?.[9] || 0,
            bulan_10: nominalMap[s.id]?.[10] || 0,
            bulan_11: nominalMap[s.id]?.[11] || 0,
            bulan_12: nominalMap[s.id]?.[12] || 0,
            terlunasi: `${lifetime.bulan_dibayar_total}/${lifetime.bulan_sejak_daftar_sampai_kini}`,
            total: `${perTahun.bulan_terbayar}/${perTahun.bulan_wajib}`,
          };
        });
        break;
      }
        
      case 'pembayaran':
        title = `Laporan Pembayaran SPP Tahun ${tahun}`;
        const wherePayment = { tahun_spp: tahun };
        if (bulan) wherePayment.bulan_spp = parseInt(bulan);
        
        data = await PembayaranSPP.findAll({
          where: wherePayment,
          include: [
            { model: Santri, as: 'santri', attributes: ['nama_lengkap', 'nik', 'is_subsidi'] },
            { model: Admin, as: 'admin', attributes: ['nama_lengkap'] },
          ],
          order: [['tgl_bayar', 'ASC']],
        });
        data = data.map(p => ({
          kode_invoice: p.kode_invoice,
          tanggal: p.tgl_bayar,
          nama_santri: p.santri?.nama_lengkap,
          kategori_subsidi: p.santri?.is_subsidi ? 'Subsidi' : 'Non Subsidi',
          nik: includeNik ? p.santri?.nik : '',
          bulan: p.bulan_spp,
          tahun: p.tahun_spp,
          nominal: p.nominal,
          metode: p.metode_bayar,
          penerima: p.admin?.nama_lengkap,
        }));
        break;
        
      case 'status_pembayaran': {
        const spKategoriLabel = filterKategori === 'subsidi' ? ' (Subsidi)'
          : filterKategori === 'non_subsidi' ? ' (Non Subsidi)'
          : filterKategori === 'jilid' && filterJilid ? ` (Jilid ${filterJilid})`
          : filterKategori === 'lunas' ? ' (Lunas)'
          : '';
        title = `Status Pembayaran SPP Tahun ${tahun}${spKategoriLabel}`;

        const spWhere = { status_aktif: true };
        if (filterKategori === 'subsidi') spWhere.is_subsidi = true;
        else if (filterKategori === 'non_subsidi') spWhere.is_subsidi = false;
        else if (filterKategori === 'jilid' && filterJilid) spWhere.jilid = filterJilid;

        let santriList = await Santri.findAll({
          where: spWhere,
          order: [['nama_lengkap', 'ASC']],
        });
        
        const pembayaranList = await PembayaranSPP.findAll({
          where: { tahun_spp: tahun },
        });
        
        const paymentMap = {};
        pembayaranList.forEach(p => {
          if (!paymentMap[p.santri_id]) paymentMap[p.santri_id] = {};
          paymentMap[p.santri_id][p.bulan_spp] = true;
        });

        // Lunas filter for status_pembayaran
        if (filterKategori === 'lunas') {
          const now = new Date();
          const tahunSaat = now.getFullYear();
          const bulanSaat = now.getMonth() + 1;
          const batasAkhir = tahun === tahunSaat ? bulanSaat : 12;
          santriList = santriList.filter(s => {
            const tglDaftar = new Date(s.tgl_mendaftar);
            const tahunDaftar = tglDaftar.getFullYear();
            const bulanDaftar = tglDaftar.getMonth() + 1;
            const bulanMulai = tahun < tahunDaftar ? 13 : (tahun === tahunDaftar ? bulanDaftar : 1);
            const bayar = paymentMap[s.id] || {};
            for (let b = bulanMulai; b <= batasAkhir; b++) {
              if (!bayar[b]) return false;
            }
            return true;
          });
        }
        
        data = santriList.map(s => {
          const row = {
            nik: includeNik ? s.nik : '',
            nama: s.nama_lengkap,
            jilid: s.jilid,
            kategori_subsidi: s.is_subsidi ? 'Subsidi' : 'Non Subsidi',
          };
          for (let b = 1; b <= 12; b++) {
            row[`bulan_${b}`] = paymentMap[s.id]?.[b] ? '✓' : '-';
          }
          return row;
        });
        break;
      }
        
      case 'infak':
        title = `Laporan Infak/Sedekah Tahun ${tahun}`;
        const startDate = new Date(tahun, 0, 1);
        const endDate = new Date(tahun, 11, 31, 23, 59, 59);
        
        data = await InfakSedekah.findAll({
          where: { tgl_terima: { [Op.between]: [startDate, endDate] } },
          include: [
            { model: Admin, as: 'admin', attributes: ['nama_lengkap'] },
          ],
          order: [['tgl_terima', 'ASC']],
        });
        data = data.map(i => ({
          kode: i.kode_transaksi,
          tanggal: i.tgl_terima,
          donatur: i.nama_donatur,
          nominal: i.nominal,
          catatan: i.catatan,
          penerima: i.admin?.nama_lengkap,
        }));
        break;

      case 'pembayaran_lain': {
        title = `Laporan Pembayaran Lain Tahun ${tahun}`;
        const startDate = new Date(tahun, 0, 1);
        const endDate = new Date(tahun, 11, 31, 23, 59, 59);

        const where = { tgl_bayar: { [Op.between]: [startDate, endDate] } };
        if (kegiatanId) where.kegiatan_id = parseInt(kegiatanId, 10);

        data = await PembayaranLain.findAll({
          where,
          include: [
            { model: Santri, as: 'santri', attributes: ['nama_lengkap', 'nik', 'email_wali', 'no_telp_wali', 'is_subsidi'] },
            { model: Kegiatan, as: 'kegiatan', attributes: ['nama_kegiatan'] },
            { model: Admin, as: 'admin', attributes: ['nama_lengkap'] },
          ],
          order: [['tgl_bayar', 'ASC']],
        });

        data = data.map((p) => ({
          kode_invoice: p.kode_invoice,
          tanggal: p.tgl_bayar,
          nama_santri: p.santri?.nama_lengkap,
          kategori_subsidi: p.santri?.is_subsidi ? 'Subsidi' : 'Non Subsidi',
          nik: includeNik ? p.santri?.nik : '',
          email_wali: includeEmail ? p.santri?.email_wali : '',
          no_telp_wali: includePhone ? p.santri?.no_telp_wali : '',
          kegiatan: p.kegiatan?.nama_kegiatan,
          nominal: p.nominal,
          metode: p.metode_bayar,
          admin: p.admin?.nama_lengkap,
          keterangan: p.keterangan,
        }));
        break;
      }
        
      case 'pengeluaran':
        title = `Laporan Pengeluaran Tahun ${tahun}`;
        const startDateExp = new Date(tahun, 0, 1);
        const endDateExp = new Date(tahun, 11, 31);
        
        data = await Pengeluaran.findAll({
          where: { tgl_keluar: { [Op.between]: [startDateExp, endDateExp] } },
          include: [
            { model: Admin, as: 'admin', attributes: ['nama_lengkap'] },
          ],
          order: [['tgl_keluar', 'ASC']],
        });
        data = data.map(p => ({
          kode: p.kode_pengeluaran,
          tanggal: p.tgl_keluar,
          judul: p.judul,
          kategori: p.kategori,
          nominal: p.nominal,
          catatan: p.catatan,
          penanggung_jawab: p.admin?.nama_lengkap,
        }));
        break;
        
      case 'jurnal':
        title = `Jurnal Kas Tahun ${tahun}`;
        const startDateJur = new Date(tahun, 0, 1);
        const endDateJur = new Date(tahun, 11, 31, 23, 59, 59);
        
        data = await JurnalKas.findAll({
          where: { tgl_transaksi: { [Op.between]: [startDateJur, endDateJur] } },
          include: [
            { model: Admin, as: 'admin', attributes: ['nama_lengkap'] },
          ],
          order: [['tgl_transaksi', 'ASC'], ['id', 'ASC']],
        });
        data = data.map(j => ({
          tanggal: j.tgl_transaksi,
          jenis: j.jenis,
          kode_referensi: j.referensi_kode,
          keterangan: j.keterangan,
          nominal: j.nominal,
          saldo: j.saldo_berjalan,
          admin: j.admin?.nama_lengkap,
        }));
        break;

      case 'prestasi_santri': {
        title = `Buku Prestasi Santri Tahun ${tahun}${jenisPrestasi === 'surat_doa' ? ' - Surat Pendek & Doa Harian' : jenisPrestasi === 'halaman' ? ' - Buku Prestasi Jilid' : ''}`;
        const startDatePrestasi = new Date(tahun, 0, 1);
        const endDatePrestasi = new Date(tahun, 11, 31, 23, 59, 59);

        const wherePrestasi = { tanggal: { [Op.between]: [startDatePrestasi, endDatePrestasi] } };
        if (jenisPrestasi) wherePrestasi.jenis_prestasi = jenisPrestasi;
        if (bulan) {
          wherePrestasi.tanggal = {
            [Op.between]: [
              new Date(tahun, parseInt(bulan, 10) - 1, 1),
              new Date(tahun, parseInt(bulan, 10), 0, 23, 59, 59),
            ],
          };
        }

        data = await BukuPrestasiSantri.findAll({
          where: wherePrestasi,
          include: [
            { model: Santri, as: 'santri', attributes: ['nama_lengkap', 'no_absen', 'jilid'] },
            { model: Admin, as: 'admin', attributes: ['nama_lengkap'] },
          ],
          order: [['tanggal', 'ASC'], ['id', 'ASC']],
        });

        data = data.map((item) => ({
          nama_santri: item.santri?.nama_lengkap,
          no_absen: item.santri?.no_absen,
          tanggal: item.tanggal,
          jilid: item.jilid || item.santri?.jilid,
          jenis_prestasi: item.jenis_prestasi,
          surat_doa: item.judul_prestasi,
          halaman: item.halaman,
          ust: item.ust_nama || item.admin?.nama_lengkap,
          paraf: item.paraf,
          keterangan: item.keterangan,
        }));
        break;
      }
        
      default:
        return NextResponse.json(
          { success: false, pesan: 'Tipe export tidak valid' },
          { status: 400 }
        );
    }
    
    return NextResponse.json({
      success: true,
      title,
      tipe,
      tahun,
      data,
      exported_at: new Date().toISOString(),
      exported_by: auth.user.nama_lengkap,
      include_fields: {
        nik: includeNik,
        email: includeEmail,
        phone: includePhone,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
