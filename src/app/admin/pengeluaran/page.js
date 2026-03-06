'use client';

import { useState, useEffect } from 'react';

export default function PengeluaranPage() {
  const [loading, setLoading] = useState(false);
  const [pengeluaranList, setPengeluaranList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [saldo, setSaldo] = useState(null);
  const [formData, setFormData] = useState({
    judul: '',
    kategori: 'Lainnya',
    nominal: '',
    catatan: '',
    tgl_keluar: new Date().toISOString().split('T')[0],
  });
  const [pin, setPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pagination, setPagination] = useState({ total: 0, halaman: 1, totalHalaman: 1 });
  const [filterKategori, setFilterKategori] = useState('');
  const [selectedPengeluaran, setSelectedPengeluaran] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailPengeluaran, setDetailPengeluaran] = useState(null);

  const kategoriList = ['Gaji', 'Listrik', 'Sarana', 'Pembangunan', 'ATK', 'Lainnya'];

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    }).format(new Date(date));
  };

  useEffect(() => {
    fetchPengeluaran();
    fetchSaldo();
  }, [pagination.halaman, filterKategori]);

  const fetchSaldo = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/dana', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSaldo(data.data.saldo_akhir);
      }
    } catch (err) {
      console.error('Gagal memuat saldo:', err);
    }
  };

  const fetchPengeluaran = async () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    
    try {
      let url = `/api/pengeluaran?page=${pagination.halaman}&limit=15`;
      if (filterKategori) {
        url += `&kategori=${filterKategori}`;
      }
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPengeluaranList(data.data);
        setPagination(data.pagination);
      }
    } catch (err) {
      setError('Gagal memuat data pengeluaran');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.judul || !formData.nominal || !formData.kategori) {
      setError('Judul, kategori, dan nominal wajib diisi');
      return;
    }

    setShowPinModal(true);
    setPin('');
  };

  const handleSubmit = async () => {
    if (!pin) {
      setError('PIN wajib diisi');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);
    const token = localStorage.getItem('auth_token');

    try {
      const res = await fetch('/api/pengeluaran', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          judul: formData.judul,
          kategori: formData.kategori,
          nominal: parseFloat(formData.nominal),
          catatan: formData.catatan,
          tgl_keluar: formData.tgl_keluar,
          pin,
        })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Pengeluaran berhasil dicatat!');
        setShowForm(false);
        setShowPinModal(false);
        setPin('');
        setFormData({
          judul: '',
          kategori: 'Lainnya',
          nominal: '',
          catatan: '',
          tgl_keluar: new Date().toISOString().split('T')[0],
        });
        fetchPengeluaran();
        fetchSaldo();
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal menyimpan pengeluaran');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePengeluaran = async () => {
    if (!selectedPengeluaran?.pin_edit) {
      setError('PIN wajib diisi');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/pengeluaran/${selectedPengeluaran.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          judul: selectedPengeluaran.judul,
          kategori: selectedPengeluaran.kategori,
          nominal: parseFloat(selectedPengeluaran.nominal),
          catatan: selectedPengeluaran.catatan,
          tgl_keluar: selectedPengeluaran.tgl_keluar,
          pin: selectedPengeluaran.pin_edit,
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Data pengeluaran berhasil diperbarui');
        setShowEditModal(false);
        setSelectedPengeluaran(null);
        fetchPengeluaran();
        fetchSaldo();
      } else {
        setError(data.pesan);
      }
    } catch {
      setError('Gagal memperbarui data pengeluaran');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePengeluaran = async () => {
    if (!selectedPengeluaran?.pin_delete) {
      setError('PIN wajib diisi');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/pengeluaran/${selectedPengeluaran.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pin: selectedPengeluaran.pin_delete })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Data pengeluaran berhasil dihapus');
        setShowDeleteModal(false);
        setSelectedPengeluaran(null);
        fetchPengeluaran();
        fetchSaldo();
      } else {
        setError(data.pesan);
      }
    } catch {
      setError('Gagal menghapus data pengeluaran');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pengeluaran</h1>
          <p className="text-gray-500">Catat pengeluaran TPQ</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
        >
          {showForm ? '✕ Tutup' : '+ Tambah Pengeluaran'}
        </button>
      </div>

      {/* Saldo Card */}
      {saldo !== null && (
        <div className={`card ${saldo >= 0 ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-200'}`}>
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${saldo >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
              <svg className={`w-6 h-6 ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">Saldo Kas Saat Ini</p>
              <p className={`text-2xl font-bold ${saldo >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(saldo)}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2">✕</button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
          <button onClick={() => setSuccess('')} className="ml-2">✕</button>
        </div>
      )}

      {/* Form Tambah Pengeluaran */}
      {showForm && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Tambah Pengeluaran Baru</h3>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Judul Pengeluaran <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.judul}
                  onChange={(e) => setFormData({ ...formData, judul: e.target.value })}
                  placeholder="Contoh: Gaji Pengajar Bulan Januari"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.kategori}
                  onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}
                  className="input-field"
                  required
                >
                  {kategoriList.map(kat => (
                    <option key={kat} value={kat}>{kat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nominal <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData.nominal}
                  onChange={(e) => setFormData({ ...formData, nominal: e.target.value })}
                  placeholder="Jumlah nominal"
                  min="0"
                  step="1000"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tanggal <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={formData.tgl_keluar}
                  onChange={(e) => setFormData({ ...formData, tgl_keluar: e.target.value })}
                  className="input-field"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Catatan
              </label>
              <textarea
                value={formData.catatan}
                onChange={(e) => setFormData({ ...formData, catatan: e.target.value })}
                placeholder="Keterangan tambahan (opsional)"
                rows="3"
                className="input-field"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-secondary"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter & Daftar Pengeluaran */}
      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-gray-800">Riwayat Pengeluaran</h3>
          <select
            value={filterKategori}
            onChange={(e) => setFilterKategori(e.target.value)}
            className="input-field w-auto"
          >
            <option value="">Semua Kategori</option>
            {kategoriList.map(kat => (
              <option key={kat} value={kat}>{kat}</option>
            ))}
          </select>
        </div>
        
        {loading && !showForm ? (
          <div className="flex justify-center py-8">
            <svg className="animate-spin h-8 w-8 text-green-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="table-header">
                    <th className="px-4 py-3 text-left">Kode</th>
                    <th className="px-4 py-3 text-left">Tanggal</th>
                    <th className="px-4 py-3 text-left">Judul</th>
                    <th className="px-4 py-3 text-left">Kategori</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                    <th className="px-4 py-3 text-left">Catatan</th>
                    <th className="px-4 py-3 text-left">Penanggung Jawab</th>
                  </tr>
                </thead>
                <tbody>
                  {pengeluaranList.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-gray-500">
                        Belum ada data pengeluaran
                      </td>
                    </tr>
                  ) : (
                    pengeluaranList.map((item) => (
                      <tr
                        key={item.id}
                        className="table-row cursor-pointer hover:bg-red-50"
                        onClick={() => { setDetailPengeluaran(item); setShowDetailModal(true); }}
                      >
                        <td className="px-4 py-3 font-mono text-sm">{item.kode_pengeluaran}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(item.tgl_keluar)}</td>
                        <td className="px-4 py-3">{item.judul}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                            {item.kategori}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                          {formatCurrency(item.nominal)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.catatan || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">{item.admin?.nama_lengkap || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.totalHalaman > 1 && (
              <div className="flex justify-center gap-2 mt-4">
                <button
                  onClick={() => setPagination({ ...pagination, halaman: pagination.halaman - 1 })}
                  disabled={pagination.halaman === 1}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  ← Sebelumnya
                </button>
                <span className="px-4 py-2">
                  Halaman {pagination.halaman} dari {pagination.totalHalaman}
                </span>
                <button
                  onClick={() => setPagination({ ...pagination, halaman: pagination.halaman + 1 })}
                  disabled={pagination.halaman === pagination.totalHalaman}
                  className="px-4 py-2 border rounded-lg disabled:opacity-50"
                >
                  Selanjutnya →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && detailPengeluaran && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full overflow-hidden">
            <div className="bg-red-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                  <span className="text-red-700 font-bold text-lg">💸</span>
                </div>
                <div>
                  <p className="text-white font-semibold">{detailPengeluaran.judul}</p>
                  <p className="text-red-100 text-sm font-mono">{detailPengeluaran.kode_pengeluaran}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-white hover:text-red-200 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Tanggal</p>
                  <p className="font-medium">{formatDate(detailPengeluaran.tgl_keluar)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Kategori</p>
                  <span className="px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-700 font-medium">{detailPengeluaran.kategori}</span>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Nominal</p>
                  <p className="font-semibold text-red-600 text-base">{formatCurrency(detailPengeluaran.nominal)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Catatan</p>
                  <p className="font-medium">{detailPengeluaran.catatan || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Penanggung Jawab</p>
                  <p className="font-medium">{detailPengeluaran.admin?.nama_lengkap || '-'}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setSelectedPengeluaran({ ...detailPengeluaran, pin_edit: '' }); setShowEditModal(true); setShowDetailModal(false); }}
                  className="btn btn-secondary flex-1"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => { setSelectedPengeluaran({ ...detailPengeluaran, pin_delete: '' }); setShowDeleteModal(true); setShowDetailModal(false); }}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                >
                  🗑️ Hapus
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Verifikasi PIN</h3>
            <p className="text-gray-600 mb-4">Masukkan PIN untuk mencatat pengeluaran.</p>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Masukkan PIN"
              className="input-field mb-4"
              maxLength={8}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowPinModal(false); setPin(''); }}
                className="btn btn-secondary flex-1"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !pin}
                className="btn btn-primary flex-1"
              >
                {loading ? 'Menyimpan...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showEditModal && selectedPengeluaran && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full space-y-3">
            <h3 className="text-lg font-semibold text-gray-800">Edit Pengeluaran</h3>
            <input className="input-field" value={selectedPengeluaran.judul || ''} onChange={(e) => setSelectedPengeluaran({ ...selectedPengeluaran, judul: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <select className="input-field" value={selectedPengeluaran.kategori || 'Lainnya'} onChange={(e) => setSelectedPengeluaran({ ...selectedPengeluaran, kategori: e.target.value })}>
                {kategoriList.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
              <input type="number" className="input-field" value={selectedPengeluaran.nominal || ''} onChange={(e) => setSelectedPengeluaran({ ...selectedPengeluaran, nominal: e.target.value })} />
            </div>
            <input type="date" className="input-field" value={(selectedPengeluaran.tgl_keluar || '').toString().slice(0, 10)} onChange={(e) => setSelectedPengeluaran({ ...selectedPengeluaran, tgl_keluar: e.target.value })} />
            <textarea className="input-field" value={selectedPengeluaran.catatan || ''} onChange={(e) => setSelectedPengeluaran({ ...selectedPengeluaran, catatan: e.target.value })} rows={3} />
            <input type="password" className="input-field" placeholder="PIN" value={selectedPengeluaran.pin_edit || ''} onChange={(e) => setSelectedPengeluaran({ ...selectedPengeluaran, pin_edit: e.target.value })} />
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1" onClick={() => { setShowEditModal(false); setSelectedPengeluaran(null); }}>Batal</button>
              <button className="btn btn-primary flex-1" onClick={handleUpdatePengeluaran}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && selectedPengeluaran && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-3">
            <h3 className="text-lg font-semibold text-gray-800">Hapus Pengeluaran</h3>
            <p className="text-sm text-gray-600">Hapus transaksi <strong>{selectedPengeluaran.kode_pengeluaran}</strong>?</p>
            <input type="password" className="input-field" placeholder="PIN" value={selectedPengeluaran.pin_delete || ''} onChange={(e) => setSelectedPengeluaran({ ...selectedPengeluaran, pin_delete: e.target.value })} />
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1" onClick={() => { setShowDeleteModal(false); setSelectedPengeluaran(null); }}>Batal</button>
              <button className="btn btn-danger flex-1" onClick={handleDeletePengeluaran}>Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
