'use client';

import { useEffect, useMemo, useState } from 'react';

const createInitialForm = (ustName = '') => ({
  santri_id: '',
  tanggal: new Date().toISOString().split('T')[0],
  jilid: '',
  judul_prestasi: '',
  halaman: '',
  paraf: ustName,
  keterangan: '',
});

export default function PrestasiSantriPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [santriList, setSantriList] = useState([]);
  const [prestasiList, setPrestasiList] = useState([]);
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [bulan, setBulan] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState(createInitialForm());

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const fetchData = async () => {
    if (!token) return;

    setLoading(true);
    setError('');

    try {
      const [santriRes, prestasiRes] = await Promise.all([
        fetch('/api/santri?status=aktif&limit=500', {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/prestasi-santri?tahun=${tahun}${bulan ? `&bulan=${bulan}` : ''}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const [santriData, prestasiData] = await Promise.all([santriRes.json(), prestasiRes.json()]);

      if (!santriData.success) {
        throw new Error(santriData.pesan || 'Gagal memuat data santri');
      }
      if (!prestasiData.success) {
        throw new Error(prestasiData.pesan || 'Gagal memuat data prestasi');
      }

      setSantriList(santriData.data || []);
      setPrestasiList(prestasiData.data || []);
    } catch (err) {
      setError(err.message || 'Gagal memuat data buku prestasi santri');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      const adminData = JSON.parse(localStorage.getItem('admin_data') || 'null');
      setCurrentUser(adminData);
      setForm(createInitialForm(adminData?.nama_lengkap || ''));
    } catch {
      setCurrentUser(null);
      setForm(createInitialForm());
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [tahun, bulan]);

  const filteredPrestasi = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prestasiList.filter((item) => {
      if (!q) return true;

      const kandidat = [
        item.santri?.nama_lengkap,
        item.santri?.jilid,
        item.judul_prestasi,
        item.halaman,
        item.ust_nama,
        item.paraf,
        item.keterangan,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return kandidat.includes(q);
    });
  }, [prestasiList, search]);

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => now - i);
  }, []);

  const getSantriById = (id) => santriList.find((item) => String(item.id) === String(id));

  const resetForm = () => {
    setEditingId(null);
    setForm(createInitialForm(currentUser?.nama_lengkap || ''));
  };

  const updateForm = (key, value) => {
    if (key === 'santri_id') {
      const santri = getSantriById(value);
      setForm((prev) => ({
        ...prev,
        santri_id: value,
        jilid: santri?.jilid || prev.jilid,
      }));
      return;
    }

    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleEdit = (item) => {
    setEditingId(item.id);
    setForm({
      santri_id: String(item.santri_id || item.santri?.id || ''),
      tanggal: item.tanggal || new Date().toISOString().split('T')[0],
      jilid: item.jilid || item.santri?.jilid || '',
      judul_prestasi: item.judul_prestasi || '',
      halaman: item.halaman || '',
      paraf: item.paraf || item.ust_nama || currentUser?.nama_lengkap || '',
      keterangan: item.keterangan || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(`Hapus catatan prestasi untuk ${item.santri?.nama_lengkap || 'santri ini'}?`);
    if (!confirmed) return;

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/prestasi-santri/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.pesan || 'Gagal menghapus prestasi');

      setSuccess(data.pesan || 'Catatan prestasi berhasil dihapus');
      if (editingId === item.id) resetForm();
      await fetchData();
    } catch (err) {
      setError(err.message || 'Gagal menghapus prestasi');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const judulPrestasi = form.judul_prestasi.trim();
      const halaman = form.halaman.trim();

      if (!form.santri_id || !form.tanggal) {
        throw new Error('Nama santri dan tanggal wajib diisi');
      }
      if (!judulPrestasi && !halaman) {
        throw new Error('Isi minimal Surat Pendek & Doa Harian atau Halaman Buku Prestasi Jilid');
      }

      const payload = {
        ...form,
        judul_prestasi: judulPrestasi,
        halaman,
      };

      const isEditing = Boolean(editingId);
      const res = await fetch(isEditing ? `/api/prestasi-santri/${editingId}` : '/api/prestasi-santri', {
        method: isEditing ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.pesan || 'Gagal menyimpan prestasi');

      setSuccess(data.pesan || 'Catatan prestasi berhasil disimpan');
      resetForm();
      await fetchData();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan prestasi');
    } finally {
      setSaving(false);
    }
  };

  const exportSection = async (format) => {
    setExporting(true);
    setError('');

    try {
      if (filteredPrestasi.length === 0) {
        throw new Error('Belum ada data untuk diekspor');
      }

      const rows = filteredPrestasi.map((item) => ({
        nama_santri: item.santri?.nama_lengkap || '-',
        no_absen: item.santri?.no_absen ?? '-',
        tanggal: item.tanggal || '-',
        jilid: item.jilid || item.santri?.jilid || '-',
        surat_doa: item.judul_prestasi || '-',
        halaman: item.halaman || '-',
        ust: item.ust_nama || '-',
        paraf: item.paraf || '-',
        keterangan: item.keterangan || '-',
      }));

      const title = `Buku Prestasi Santri ${tahun}${bulan ? `-${bulan}` : ''}`;

      if (format === 'excel') {
        const XLSX = (await import('xlsx')).default;
        const exportRows = rows.map((row) => ({
          'Nama Santri': row.nama_santri,
          'No. Absen': row.no_absen,
          Tanggal: row.tanggal,
          Jilid: row.jilid,
          'Surat Pendek / Doa Harian': row.surat_doa,
          Halaman: row.halaman,
          Ust: row.ust,
          Paraf: row.paraf,
          Keterangan: row.keterangan,
        }));
        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Prestasi');
        XLSX.writeFile(wb, `${title}.xlsx`);
      } else {
        const { jsPDF } = await import('jspdf');
        await import('jspdf-autotable');
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const headers = [['Nama Santri', 'No. Absen', 'Tanggal', 'Jilid', 'Surat Pendek / Doa Harian', 'Halaman', 'Ust', 'Paraf', 'Keterangan']];
        const body = rows.map((row) => [
          row.nama_santri,
          row.no_absen,
          row.tanggal,
          row.jilid,
          row.surat_doa,
          row.halaman,
          row.ust,
          row.paraf,
          row.keterangan,
        ]);

        doc.setFontSize(14);
        doc.text(title, 14, 15);
        doc.autoTable({
          head: headers,
          body,
          startY: 22,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [22, 163, 74] },
        });
        doc.save(`${title}.pdf`);
      }

      setSuccess('Export buku prestasi santri berhasil dibuat');
    } catch (err) {
      setError(err.message || 'Gagal mengekspor buku prestasi santri');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Buku Prestasi Santri</h1>
          <p className="text-gray-500">Catat Surat Pendek &amp; Doa Harian atau Halaman Buku Prestasi Jilid santri dalam satu form.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <select value={tahun} onChange={(e) => setTahun(parseInt(e.target.value, 10))} className="input-field w-32">
            {yearOptions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select value={bulan} onChange={(e) => setBulan(e.target.value)} className="input-field w-40">
            <option value="">Semua Bulan</option>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                {new Date(2024, i, 1).toLocaleDateString('id-ID', { month: 'long' })}
              </option>
            ))}
          </select>
          <button onClick={fetchData} className="btn-secondary">Muat Ulang</button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500">✕</button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
          <button onClick={() => setSuccess('')} className="ml-2 text-green-500">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[420px,1fr] gap-6">
        <div className="card space-y-4 h-fit">
          <div className="border-b border-gray-100 pb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {editingId ? 'Edit Buku Prestasi Santri' : 'Tambah Buku Prestasi Santri'}
                </h2>
                <p className="text-xs text-gray-500">Ust terisi otomatis dari akun login: <strong>{currentUser?.nama_lengkap || '-'}</strong></p>
              </div>
              {editingId && (
                <button onClick={resetForm} type="button" className="text-sm text-red-600 hover:text-red-700">Batal Edit</button>
              )}
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Santri</label>
                <select value={form.santri_id} onChange={(e) => updateForm('santri_id', e.target.value)} className="input-field" required>
                  <option value="">Pilih santri</option>
                  {santriList.map((item) => (
                    <option key={item.id} value={item.id}>{item.no_absen ? `${item.no_absen}. ` : ''}{item.nama_lengkap} ({item.jilid || '-'})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Jilid</label>
                  <input value={form.jilid} onChange={(e) => updateForm('jilid', e.target.value)} className="input-field" placeholder="Jilid" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                  <input type="date" value={form.tanggal} onChange={(e) => updateForm('tanggal', e.target.value)} className="input-field" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Surat Pendek / Doa Harian</label>
                <input value={form.judul_prestasi} onChange={(e) => updateForm('judul_prestasi', e.target.value)} className="input-field" placeholder="Contoh: An-Nas / Doa sebelum belajar" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Halaman Buku Prestasi Jilid</label>
                <input value={form.halaman} onChange={(e) => updateForm('halaman', e.target.value)} className="input-field" placeholder="Contoh: 12-13" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ust</label>
                  <input value={currentUser?.nama_lengkap || ''} className="input-field bg-gray-50 text-gray-500" disabled />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Paraf</label>
                  <input value={form.paraf} onChange={(e) => updateForm('paraf', e.target.value)} className="input-field" placeholder="Paraf / nama singkat ust" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                <textarea value={form.keterangan} onChange={(e) => updateForm('keterangan', e.target.value)} className="input-field" rows={3} placeholder="Catatan tambahan" />
              </div>
              <button type="submit" disabled={saving} className="btn-primary w-full">
                {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Catatan'}
              </button>
            </form>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Daftar Buku Prestasi Santri</h2>
                <p className="text-sm text-gray-500">{filteredPrestasi.length} catatan ditemukan</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari santri, jilid, ust, surat/doa, halaman, atau catatan"
                  className="input-field min-w-[280px]"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => exportSection('excel')} disabled={exporting} className="btn-secondary whitespace-nowrap">
                    {exporting ? 'Memproses...' : 'Export Excel'}
                  </button>
                  <button type="button" onClick={() => exportSection('pdf')} disabled={exporting} className="btn-primary whitespace-nowrap">
                    {exporting ? 'Memproses...' : 'Export PDF'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="p-6 text-center text-gray-500">Memuat data buku prestasi santri...</div>
            ) : filteredPrestasi.length === 0 ? (
              <div className="p-6 text-center text-gray-500">Belum ada catatan prestasi untuk filter ini.</div>
            ) : (
              <div className="table-container">
                <table className="w-full min-w-[1180px]">
                  <thead>
                    <tr className="bg-green-50 text-xs text-green-800 font-semibold">
                      <th className="px-3 py-3 text-left">Nama Santri</th>
                      <th className="px-3 py-3 text-left">Tanggal</th>
                      <th className="px-3 py-3 text-left">Jilid</th>
                      <th className="px-3 py-3 text-left">Surat Pendek &amp; Doa Harian</th>
                      <th className="px-3 py-3 text-left">Halaman Buku Prestasi Jilid</th>
                      <th className="px-3 py-3 text-left">Ust</th>
                      <th className="px-3 py-3 text-left">Paraf</th>
                      <th className="px-3 py-3 text-left">Keterangan</th>
                      <th className="px-3 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPrestasi.map((item) => (
                      <tr key={item.id} className="table-row">
                        <td className="table-cell">
                          <div className="font-medium text-gray-800">{item.santri?.nama_lengkap || '-'}</div>
                          <div className="text-xs text-gray-500">No. Absen: {item.santri?.no_absen ?? '-'}</div>
                        </td>
                        <td className="table-cell">{item.tanggal ? new Date(item.tanggal).toLocaleDateString('id-ID') : '-'}</td>
                        <td className="table-cell">{item.jilid || item.santri?.jilid || '-'}</td>
                        <td className="table-cell">{item.judul_prestasi || '-'}</td>
                        <td className="table-cell">{item.halaman || '-'}</td>
                        <td className="table-cell">{item.ust_nama || '-'}</td>
                        <td className="table-cell">{item.paraf || '-'}</td>
                        <td className="table-cell">{item.keterangan || '-'}</td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => handleEdit(item)} className="text-blue-600 hover:text-blue-700 text-sm font-medium">Edit</button>
                            <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-700 text-sm font-medium">Hapus</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
