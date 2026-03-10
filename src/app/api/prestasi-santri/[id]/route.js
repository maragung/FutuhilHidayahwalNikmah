import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { BukuPrestasiSantri, Santri, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { createBackup } from '@/lib/utils';

const ROLE_BISA_KELOLA_PRESTASI = ['Developer', 'Pimpinan TPQ', 'Sekretaris', 'Bendahara', 'Pengajar'];
const JENIS_PRESTASI_OPTIONS = ['surat_doa', 'halaman'];

export async function PUT(request, { params }) {
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
      return NextResponse.json({ success: false, pesan: 'Tidak memiliki akses untuk mengubah buku prestasi' }, { status: 403 });
    }

    const { id } = await params;
    const prestasi = await BukuPrestasiSantri.findByPk(id);
    if (!prestasi) {
      return NextResponse.json({ success: false, pesan: 'Catatan prestasi tidak ditemukan' }, { status: 404 });
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

    const dataSebelum = prestasi.toJSON();
    await prestasi.update({
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

    await createBackup('Update Buku Prestasi Santri', 'buku_prestasi_santri', dataSebelum, prestasi.toJSON(), auth.user.id);

    return NextResponse.json({ success: true, pesan: 'Catatan prestasi berhasil diperbarui', data: prestasi });
  } catch (error) {
    console.error('Update prestasi santri error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
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
      return NextResponse.json({ success: false, pesan: 'Tidak memiliki akses untuk menghapus buku prestasi' }, { status: 403 });
    }

    const { id } = await params;
    const prestasi = await BukuPrestasiSantri.findByPk(id);
    if (!prestasi) {
      return NextResponse.json({ success: false, pesan: 'Catatan prestasi tidak ditemukan' }, { status: 404 });
    }

    const dataSebelum = prestasi.toJSON();
    await prestasi.destroy();
    await createBackup('Hapus Buku Prestasi Santri', 'buku_prestasi_santri', dataSebelum, null, auth.user.id);

    return NextResponse.json({ success: true, pesan: 'Catatan prestasi berhasil dihapus' });
  } catch (error) {
    console.error('Delete prestasi santri error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}