'use client';

import { useState, useEffect } from 'react';

export default function InfakPage() {
  const [loading, setLoading] = useState(false);
  const [infakList, setInfakList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nama_donatur: '',
    nominal: '',
    catatan: '',
  });
  const [pin, setPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pagination, setPagination] = useState({ total: 0, halaman: 1, totalHalaman: 1 });
  const [selectedInfak, setSelectedInfak] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailInfak, setDetailInfak] = useState(null);

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
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  useEffect(() => {
    fetchInfak();
  }, [pagination.halaman]);

  const fetchInfak = async () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    
    try {
      const res = await fetch(`/api/infak?page=${pagination.halaman}&limit=15`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setInfakList(data.data);
        setPagination(data.pagination);
      }
    } catch (err) {
      setError('Gagal memuat data infak');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.nama_donatur || !formData.nominal) {
      setError('Nama donatur dan nominal wajib diisi');
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
      const res = await fetch('/api/infak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nama_donatur: formData.nama_donatur,
          nominal: parseFloat(formData.nominal),
          catatan: formData.catatan,
          pin,
        })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Infak/sedekah berhasil dicatat!');
        setShowForm(false);
        setShowPinModal(false);
        setPin('');
        setFormData({ nama_donatur: '', nominal: '', catatan: '' });
        fetchInfak();
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal menyimpan infak');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInfak = async () => {
    if (!selectedInfak?.pin_edit) {
      setError('PIN wajib diisi');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/infak/${selectedInfak.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          nama_donatur: selectedInfak.nama_donatur,
          nominal: parseFloat(selectedInfak.nominal),
          catatan: selectedInfak.catatan,
          tgl_terima: selectedInfak.tgl_terima,
          pin: selectedInfak.pin_edit,
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Data infak berhasil diperbarui');
        setShowEditModal(false);
        setSelectedInfak(null);
        fetchInfak();
      } else {
        setError(data.pesan);
      }
    } catch {
      setError('Gagal memperbarui data infak');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInfak = async () => {
    if (!selectedInfak?.pin_delete) {
      setError('PIN wajib diisi');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/infak/${selectedInfak.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pin: selectedInfak.pin_delete })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Data infak berhasil dihapus');
        setShowDeleteModal(false);
        setSelectedInfak(null);
        fetchInfak();
      } else {
        setError(data.pesan);
      }
    } catch {
      setError('Gagal menghapus data infak');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Infak & Sedekah</h1>
          <p className="text-gray-500">Catat pemasukan infak dan sedekah</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
        >
          {showForm ? '✕ Tutup' : '+ Tambah Infak'}
        </button>
      </div>

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

      {/* Form Tambah Infak */}
      {showForm && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Tambah Infak/Sedekah Baru</h3>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Donatur <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.nama_donatur}
                onChange={(e) => setFormData({ ...formData, nama_donatur: e.target.value })}
                placeholder="Nama lengkap donatur"
                className="input-field"
                required
              />
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
                {loading ? 'Menyimpan...' : 'Simpan'}
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

      {/* Daftar Infak */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Riwayat Infak & Sedekah</h3>
        
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
                    <th className="px-4 py-3 text-left">Nama Donatur</th>
                    <th className="px-4 py-3 text-right">Nominal</th>
                    <th className="px-4 py-3 text-left">Catatan</th>
                    <th className="px-4 py-3 text-left">Penerima</th>
                  </tr>
                </thead>
                <tbody>
                  {infakList.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                        Belum ada data infak/sedekah
                      </td>
                    </tr>
                  ) : (
                    infakList.map((infak) => (
                      <tr
                        key={infak.id}
                        className="table-row cursor-pointer hover:bg-green-50"
                        onClick={() => { setDetailInfak(infak); setShowDetailModal(true); }}
                      >
                        <td className="px-4 py-3 font-mono text-sm">{infak.kode_transaksi}</td>
                        <td className="px-4 py-3 text-sm">{formatDate(infak.tgl_terima)}</td>
                        <td className="px-4 py-3">{infak.nama_donatur}</td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600">
                          {formatCurrency(infak.nominal)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {infak.catatan || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">{infak.admin?.nama_lengkap || '-'}</td>
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
      {showDetailModal && detailInfak && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full overflow-hidden">
            <div className="bg-green-600 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                  <span className="text-green-700 font-bold text-lg">💚</span>
                </div>
                <div>
                  <p className="text-white font-semibold">{detailInfak.nama_donatur}</p>
                  <p className="text-green-100 text-sm font-mono">{detailInfak.kode_transaksi}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-white hover:text-green-200 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Tanggal</p>
                  <p className="font-medium">{formatDate(detailInfak.tgl_terima)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Nominal</p>
                  <p className="font-semibold text-green-600 text-base">{formatCurrency(detailInfak.nominal)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Catatan</p>
                  <p className="font-medium">{detailInfak.catatan || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Dicatat oleh</p>
                  <p className="font-medium">{detailInfak.admin?.nama_lengkap || '-'}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { setSelectedInfak({ ...detailInfak, pin_edit: '' }); setShowEditModal(true); setShowDetailModal(false); }}
                  className="btn btn-secondary flex-1"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => { setSelectedInfak({ ...detailInfak, pin_delete: '' }); setShowDeleteModal(true); setShowDetailModal(false); }}
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
            <p className="text-gray-600 mb-4">Masukkan PIN untuk mencatat infak/sedekah.</p>
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

      {showEditModal && selectedInfak && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full space-y-3">
            <h3 className="text-lg font-semibold text-gray-800">Edit Infak/Sedekah</h3>
            <input className="input-field" value={selectedInfak.nama_donatur || ''} onChange={(e) => setSelectedInfak({ ...selectedInfak, nama_donatur: e.target.value })} />
            <input type="number" className="input-field" value={selectedInfak.nominal || ''} onChange={(e) => setSelectedInfak({ ...selectedInfak, nominal: e.target.value })} />
            <textarea className="input-field" value={selectedInfak.catatan || ''} onChange={(e) => setSelectedInfak({ ...selectedInfak, catatan: e.target.value })} rows={3} />
            <input type="password" className="input-field" placeholder="PIN" value={selectedInfak.pin_edit || ''} onChange={(e) => setSelectedInfak({ ...selectedInfak, pin_edit: e.target.value })} />
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1" onClick={() => { setShowEditModal(false); setSelectedInfak(null); }}>Batal</button>
              <button className="btn btn-primary flex-1" onClick={handleUpdateInfak}>Simpan</button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && selectedInfak && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-3">
            <h3 className="text-lg font-semibold text-gray-800">Hapus Infak/Sedekah</h3>
            <p className="text-sm text-gray-600">Hapus transaksi <strong>{selectedInfak.kode_transaksi}</strong>?</p>
            <input type="password" className="input-field" placeholder="PIN" value={selectedInfak.pin_delete || ''} onChange={(e) => setSelectedInfak({ ...selectedInfak, pin_delete: e.target.value })} />
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1" onClick={() => { setShowDeleteModal(false); setSelectedInfak(null); }}>Batal</button>
              <button className="btn btn-danger flex-1" onClick={handleDeleteInfak}>Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
