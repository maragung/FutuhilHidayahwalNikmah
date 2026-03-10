import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { BukuPrestasiSantri, Santri, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';
import { createBackup } from '@/lib/utils';

const ROLE_BISA_KELOLA_PRESTASI = ['Developer', 'Pimpinan TPQ', 'Sekretaris', 'Bendahara', 'Pengajar'];
const JENIS_PRESTASI_OPTIONS = ['surat_doa', 'halaman'];

export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    await sequelize.authenticate();

    const { searchParams } = new URL(request.url);
    const jenisPrestasi = searchParams.get('jenis_prestasi') || '';
    const santriId = searchParams.get('santri_id') || '';
    const tahun = parseInt(searchParams.get('tahun') || `${new Date().getFullYear()}`, 10);
    const bulan = searchParams.get('bulan') || '';

    const where = {};
    if (jenisPrestasi && JENIS_PRESTASI_OPTIONS.includes(jenisPrestasi)) {
      where.jenis_prestasi = jenisPrestasi;
    }
    if (santriId) {
      where.santri_id = parseInt(santriId, 10);
    }

    const startDate = bulan
      ? `${tahun}-${String(parseInt(bulan, 10)).padStart(2, '0')}-01`
      : `${tahun}-01-01`;
    const endDate = bulan
      ? `${tahun}-${String(parseInt(bulan, 10)).padStart(2, '0')}-31`
      : `${tahun}-12-31`;
    where.tanggal = { [Op.between]: [startDate, endDate] };

    const rows = await BukuPrestasiSantri.findAll({
      where,
      include: [
        { model: Santri, as: 'santri', attributes: ['id', 'no_absen', 'nama_lengkap', 'jilid'] },
        { model: Admin, as: 'admin', attributes: ['id', 'nama_lengkap', 'jabatan'] },
      ],
      order: [['tanggal', 'DESC'], ['santri_id', 'ASC'], ['id', 'DESC']],
    });

    return NextResponse.json({ success: true, data: rows });
  } catch (error) {
    console.error('Get prestasi santri error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) {
      return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });
    }
    if (!ROLE_BISA_KELOLA_PRESTASI.includes(admin.jabatan)) {
      return NextResponse.json({ success: false, pesan: 'Tidak memiliki akses untuk mencatat buku prestasi' }, { status: 403 });
    }

    const body = await request.json();
    const { santri_id, tanggal, jenis_prestasi, judul_prestasi, jilid, halaman, paraf, keterangan } = body;

    if (!santri_id || !tanggal || !jenis_prestasi) {
      return NextResponse.json({ success: false, pesan: 'Santri, tanggal, dan jenis prestasi wajib diisi' }, { status: 400 });
    }
    if (!JENIS_PRESTASI_OPTIONS.includes(jenis_prestasi)) {
      return NextResponse.json({ success: false, pesan: 'Jenis prestasi tidak valid' }, { status: 400 });
    }
    if (jenis_prestasi === 'surat_doa' && !String(judul_prestasi || '').trim()) {
      return NextResponse.json({ success: false, pesan: 'Surat pendek / doa harian wajib diisi' }, { status: 400 });
    }
    if (jenis_prestasi === 'halaman' && !String(halaman || '').trim()) {
      return NextResponse.json({ success: false, pesan: 'Halaman wajib diisi' }, { status: 400 });
    }

    const santri = await Santri.findByPk(santri_id);
    if (!santri) {
      return NextResponse.json({ success: false, pesan: 'Santri tidak ditemukan' }, { status: 404 });
    }

    const prestasi = await BukuPrestasiSantri.create({
      santri_id: santri.id,
      admin_id: admin.id,
      tanggal,
      jenis_prestasi,
      judul_prestasi: jenis_prestasi === 'surat_doa' ? String(judul_prestasi || '').trim() : null,
      jilid: String(jilid || santri.jilid || '').trim() || santri.jilid,
      halaman: jenis_prestasi === 'halaman' ? String(halaman || '').trim() : null,
      ust_nama: admin.nama_lengkap,
      paraf: jenis_prestasi === 'halaman' ? (String(paraf || '').trim() || admin.nama_lengkap) : null,
      keterangan: String(keterangan || '').trim() || null,
    });

    await createBackup('Tambah Buku Prestasi Santri', 'buku_prestasi_santri', null, prestasi.toJSON(), auth.user.id);

    return NextResponse.json({ success: true, pesan: 'Catatan prestasi berhasil ditambahkan', data: prestasi }, { status: 201 });
  } catch (error) {
    console.error('Create prestasi santri error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}