'use client';

import { useEffect, useMemo, useState } from 'react';

const TAB_OPTIONS = [
  { key: 'surat_doa', label: 'Surat Pendek & Doa Harian' },
  { key: 'halaman', label: 'Buku Prestasi Halaman' },
];

const initialSuratForm = {
  santri_id: '',
  tanggal: new Date().toISOString().split('T')[0],
  jilid: '',
  judul_prestasi: '',
  keterangan: '',
};

const initialHalamanForm = {
  santri_id: '',
  tanggal: new Date().toISOString().split('T')[0],
  jilid: '',
  halaman: '',
  paraf: '',
  keterangan: '',
};

export default function PrestasiSantriPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [santriList, setSantriList] = useState([]);
  const [prestasiList, setPrestasiList] = useState([]);
  const [tab, setTab] = useState('surat_doa');
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [bulan, setBulan] = useState('');
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [suratForm, setSuratForm] = useState(initialSuratForm);
  const [halamanForm, setHalamanForm] = useState(initialHalamanForm);

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const fetchData = async () => {
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
      setError(err.message || 'Gagal memuat data buku prestasi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    try {
      setCurrentUser(JSON.parse(localStorage.getItem('admin_data') || 'null'));
    } catch {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    fetchData();
  }, [tahun, bulan]);

  const filteredPrestasi = useMemo(() => {
    const q = search.trim().toLowerCase();
    return prestasiList.filter((item) => {
      if (item.jenis_prestasi !== tab) return false;
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
  }, [prestasiList, search, tab]);

  const yearOptions = useMemo(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => now - i);
  }, []);

  const getSantriById = (id) => santriList.find((item) => String(item.id) === String(id));

  const updateSuratForm = (key, value) => {
    if (key === 'santri_id') {
      const santri = getSantriById(value);
      setSuratForm((prev) => ({ ...prev, santri_id: value, jilid: santri?.jilid || '' }));
      return;
    }
    setSuratForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateHalamanForm = (key, value) => {
    if (key === 'santri_id') {
      const santri = getSantriById(value);
      setHalamanForm((prev) => ({
        ...prev,
        santri_id: value,
        jilid: santri?.jilid || '',
        paraf: prev.paraf || currentUser?.nama_lengkap || '',
      }));
      return;
    }
    setHalamanForm((prev) => ({ ...prev, [key]: value }));
  };

  const resetForms = () => {
    setEditingId(null);
    setSuratForm(initialSuratForm);
    setHalamanForm({ ...initialHalamanForm, paraf: currentUser?.nama_lengkap || '' });
  };

  useEffect(() => {
    if (currentUser?.nama_lengkap) {
      setHalamanForm((prev) => ({ ...prev, paraf: prev.paraf || currentUser.nama_lengkap }));
    }
  }, [currentUser]);

  const handleEdit = (item) => {
    setEditingId(item.id);
    setTab(item.jenis_prestasi);

    if (item.jenis_prestasi === 'surat_doa') {
      setSuratForm({
        santri_id: String(item.santri_id || item.santri?.id || ''),
        tanggal: item.tanggal || new Date().toISOString().split('T')[0],
        jilid: item.jilid || item.santri?.jilid || '',
        judul_prestasi: item.judul_prestasi || '',
        keterangan: item.keterangan || '',
      });
    } else {
      setHalamanForm({
        santri_id: String(item.santri_id || item.santri?.id || ''),
        tanggal: item.tanggal || new Date().toISOString().split('T')[0],
        jilid: item.jilid || item.santri?.jilid || '',
        halaman: item.halaman || '',
        paraf: item.paraf || item.ust_nama || currentUser?.nama_lengkap || '',
        keterangan: item.keterangan || '',
      });
    }
+    window.scrollTo({ top: 0, behavior: 'smooth' });
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
      if (editingId === item.id) resetForms();
      fetchData();
    } catch (err) {
      setError(err.message || 'Gagal menghapus prestasi');
    } finally {
      setSaving(false);
    }
  };

  const submitSurat = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!suratForm.santri_id || !suratForm.tanggal || !suratForm.judul_prestasi.trim()) {
        throw new Error('Nama santri, tanggal, dan surat/doa wajib diisi');
      }

      const payload = {
        ...suratForm,
        jenis_prestasi: 'surat_doa',
      };

      const res = await fetch(editingId && tab === 'surat_doa' ? `/api/prestasi-santri/${editingId}` : '/api/prestasi-santri', {
        method: editingId && tab === 'surat_doa' ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.pesan || 'Gagal menyimpan prestasi');

      setSuccess(data.pesan || 'Catatan prestasi berhasil disimpan');
      resetForms();
      fetchData();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan prestasi');
    } finally {
      setSaving(false);
    }
  };

  const submitHalaman = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (!halamanForm.santri_id || !halamanForm.tanggal || !halamanForm.halaman.trim()) {
        throw new Error('Nama santri, tanggal, dan halaman wajib diisi');
      }

      const payload = {
        ...halamanForm,
        jenis_prestasi: 'halaman',
      };

      const res = await fetch(editingId && tab === 'halaman' ? `/api/prestasi-santri/${editingId}` : '/api/prestasi-santri', {
        method: editingId && tab === 'halaman' ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.pesan || 'Gagal menyimpan prestasi halaman');

      setSuccess(data.pesan || 'Catatan prestasi berhasil disimpan');
      resetForms();
      fetchData();
    } catch (err) {
      setError(err.message || 'Gagal menyimpan prestasi halaman');
    } finally {
      setSaving(false);
    }
  };

  const exportSection = async (format, jenis) => {
    setExporting(true);
    setError('');

    try {
      const data = prestasiList.filter((item) => item.jenis_prestasi === jenis);
      if (data.length === 0) throw new Error('Belum ada data untuk diekspor');

      const rows = data.map((item) => ({
        nama_santri: item.santri?.nama_lengkap || '-',
        jilid: item.jilid || item.santri?.jilid || '-',
        tanggal: item.tanggal || '-',
        surat_doa: item.judul_prestasi || '-',
        halaman: item.halaman || '-',
        ust: item.ust_nama || '-',
        paraf: item.paraf || '-',
        keterangan: item.keterangan || '-',
      }));

      const title = jenis === 'surat_doa'
        ? `Buku Prestasi Surat Pendek & Doa ${tahun}${bulan ? `-${bulan}` : ''}`
        : `Buku Prestasi Halaman ${tahun}${bulan ? `-${bulan}` : ''}`;

      if (format === 'excel') {
        const XLSX = (await import('xlsx')).default;
        const exportRows = rows.map((row) => jenis === 'surat_doa'
          ? {
              'Nama Santri': row.nama_santri,
              Jilid: row.jilid,
              Tanggal: row.tanggal,
              'Surat Pendek / Doa Harian': row.surat_doa,
              Ust: row.ust,
              Keterangan: row.keterangan,
            }
          : {
              'Nama Santri': row.nama_santri,
              Tanggal: row.tanggal,
              Jilid: row.jilid,
              Halaman: row.halaman,
              Ust: row.ust,
              Paraf: row.paraf,
              Keterangan: row.keterangan,
            });
        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Prestasi');
        XLSX.writeFile(wb, `${title}.xlsx`);
      } else {
        const { jsPDF } = await import('jspdf');
        await import('jspdf-autotable');
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const headers = jenis === 'surat_doa'
          ? [['Nama Santri', 'Jilid', 'Tanggal', 'Surat Pendek / Doa Harian', 'Ust', 'Keterangan']]
          : [['Nama Santri', 'Tanggal', 'Jilid', 'Halaman', 'Ust', 'Paraf', 'Keterangan']];
        const body = rows.map((row) => jenis === 'surat_doa'
          ? [row.nama_santri, row.jilid, row.tanggal, row.surat_doa, row.ust, row.keterangan]
          : [row.nama_santri, row.tanggal, row.jilid, row.halaman, row.ust, row.paraf, row.keterangan]);

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

      setSuccess('Export buku prestasi berhasil dibuat');
    } catch (err) {
      setError(err.message || 'Gagal mengekspor buku prestasi');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Buku Prestasi Santri</h1>
          <p className="text-gray-500">Catatan surat pendek, doa harian, dan prestasi halaman santri.</p>
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
          <div className="flex flex-wrap gap-2">
            {TAB_OPTIONS.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => { setTab(item.key); setEditingId(null); setError(''); setSuccess(''); }}
                className={`px-3 py-2 rounded-lg text-sm font-medium border ${tab === item.key ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-300'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">
                  {editingId ? 'Edit Catatan Prestasi' : 'Tambah Catatan Prestasi'}
                </h2>
                <p className="text-xs text-gray-500">Ust terisi otomatis dari akun login: <strong>{currentUser?.nama_lengkap || '-'}</strong></p>
              </div>
              {editingId && (
                <button onClick={resetForms} type="button" className="text-sm text-red-600 hover:text-red-700">Batal Edit</button>
              )}
            </div>

            {tab === 'surat_doa' ? (
              <form className="space-y-3" onSubmit={submitSurat}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Santri</label>
                  <select value={suratForm.santri_id} onChange={(e) => updateSuratForm('santri_id', e.target.value)} className="input-field" required>
                    <option value="">Pilih santri</option>
                    {santriList.map((item) => (
                      <option key={item.id} value={item.id}>{item.no_absen ? `${item.no_absen}. ` : ''}{item.nama_lengkap} ({item.jilid || '-'})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jilid</label>
                    <input value={suratForm.jilid} onChange={(e) => updateSuratForm('jilid', e.target.value)} className="input-field" placeholder="Jilid" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                    <input type="date" value={suratForm.tanggal} onChange={(e) => updateSuratForm('tanggal', e.target.value)} className="input-field" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Surat Pendek / Doa Harian</label>
                  <input value={suratForm.judul_prestasi} onChange={(e) => updateSuratForm('judul_prestasi', e.target.value)} className="input-field" placeholder="Contoh: An-Nas / Doa sebelum belajar" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ust</label>
                  <input value={currentUser?.nama_lengkap || ''} className="input-field bg-gray-50 text-gray-500" disabled />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                  <textarea value={suratForm.keterangan} onChange={(e) => updateSuratForm('keterangan', e.target.value)} className="input-field" rows={3} placeholder="Catatan tambahan" />
                </div>
                <button type="submit" disabled={saving} className="btn-primary w-full">
                  {saving ? 'Menyimpan...' : editingId && tab === 'surat_doa' ? 'Simpan Perubahan' : 'Tambah Catatan'}
                </button>
              </form>
            ) : (
              <form className="space-y-3" onSubmit={submitHalaman}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nama Santri</label>
                  <select value={halamanForm.santri_id} onChange={(e) => updateHalamanForm('santri_id', e.target.value)} className="input-field" required>
                    <option value="">Pilih santri</option>
                    {santriList.map((item) => (
                      <option key={item.id} value={item.id}>{item.no_absen ? `${item.no_absen}. ` : ''}{item.nama_lengkap} ({item.jilid || '-'})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal</label>
                    <input type="date" value={halamanForm.tanggal} onChange={(e) => updateHalamanForm('tanggal', e.target.value)} className="input-field" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Jilid</label>
                    <input value={halamanForm.jilid} onChange={(e) => updateHalamanForm('jilid', e.target.value)} className="input-field" placeholder="Jilid" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Halaman</label>
                    <input value={halamanForm.halaman} onChange={(e) => updateHalamanForm('halaman', e.target.value)} className="input-field" placeholder="Contoh: 12-13" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Paraf</label>
                    <input value={halamanForm.paraf} onChange={(e) => updateHalamanForm('paraf', e.target.value)} className="input-field" placeholder="Paraf / nama singkat ust" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ust</label>
                  <input value={currentUser?.nama_lengkap || ''} className="input-field bg-gray-50 text-gray-500" disabled />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
                  <textarea value={halamanForm.keterangan} onChange={(e) => updateHalamanForm('keterangan', e.target.value)} className="input-field" rows={3} placeholder="Catatan tambahan" />
                </div>
                <button type="submit" disabled={saving} className="btn-primary w-full">
                  {saving ? 'Menyimpan...' : editingId && tab === 'halaman' ? 'Simpan Perubahan' : 'Tambah Catatan'}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{TAB_OPTIONS.find((item) => item.key === tab)?.label}</h2>
                <p className="text-sm text-gray-500">{filteredPrestasi.length} catatan ditemukan</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari santri, jilid, ust, atau catatan"
                  className="input-field min-w-[260px]"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => exportSection('excel', tab)} disabled={exporting} className="btn-secondary whitespace-nowrap">
                    {exporting ? 'Memproses...' : 'Export Excel'}
                  </button>
                  <button type="button" onClick={() => exportSection('pdf', tab)} disabled={exporting} className="btn-primary whitespace-nowrap">
                    {exporting ? 'Memproses...' : 'Export PDF'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="card p-0 overflow-hidden">
            {loading ? (
              <div className="p-6 text-center text-gray-500">Memuat data buku prestasi...</div>
            ) : filteredPrestasi.length === 0 ? (
              <div className="p-6 text-center text-gray-500">Belum ada catatan prestasi untuk filter ini.</div>
            ) : tab === 'surat_doa' ? (
              <div className="table-container">
                <table className="w-full min-w-[900px]">
                  <thead>
                    <tr className="bg-green-50 text-xs text-green-800 font-semibold">
                      <th className="px-3 py-3 text-left">Nama Santri</th>
                      <th className="px-3 py-3 text-left">Jilid</th>
                      <th className="px-3 py-3 text-left">Tanggal</th>
                      <th className="px-3 py-3 text-left">Surat Pendek & Doa Harian</th>
                      <th className="px-3 py-3 text-left">Ust</th>
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
                        <td className="table-cell">{item.jilid || item.santri?.jilid || '-'}</td>
                        <td className="table-cell">{item.tanggal ? new Date(item.tanggal).toLocaleDateString('id-ID') : '-'}</td>
                        <td className="table-cell">{item.judul_prestasi || '-'}</td>
                        <td className="table-cell">{item.ust_nama || '-'}</td>
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
            ) : (
              <div className="table-container">
                <table className="w-full min-w-[980px]">
                  <thead>
                    <tr className="bg-green-50 text-xs text-green-800 font-semibold">
                      <th className="px-3 py-3 text-left">Nama Santri</th>
                      <th className="px-3 py-3 text-left">Tanggal</th>
                      <th className="px-3 py-3 text-left">Jilid</th>
                      <th className="px-3 py-3 text-left">Halaman</th>
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
