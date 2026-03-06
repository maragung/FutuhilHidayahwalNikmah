'use client';

import { useState, useEffect, useCallback } from 'react';
import { safeHexColor } from '@/lib/color';

export default function PembayaranLainPage() {
  const [activeTab, setActiveTab] = useState('pembayaran');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pin, setPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);

  // Kegiatan state
  const [kegiatanList, setKegiatanList] = useState([]);
  const [kegiatanForm, setKegiatanForm] = useState({ nama_kegiatan: '', nominal: '', keterangan: '', gabung_saldo_utama: true });
  const [editKegiatan, setEditKegiatan] = useState(null);

  // Pembayaran state
  const [pembayaranList, setPembayaranList] = useState([]);
  const [santriList, setSantriList] = useState([]);
  const [payForm, setPayForm] = useState({
    santri_id: '', kegiatan_id: '', nominal: '', metode_bayar: 'Tunai', keterangan: ''
  });
  const [settings, setSettings] = useState({
    warna_non_subsidi: '#04B816',
    warna_subsidi: '#045EB8',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editPayment, setEditPayment] = useState(null);
  const [showDetailPembayaran, setShowDetailPembayaran] = useState(false);
  const [detailPembayaran, setDetailPembayaran] = useState(null);

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const warnaNonSubsidi = safeHexColor(settings.warna_non_subsidi, '#04B816');
  const warnaSubsidi = safeHexColor(settings.warna_subsidi, '#045EB8');

  const fetchKegiatan = useCallback(async () => {
    try {
      const res = await fetch('/api/kegiatan', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setKegiatanList(data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const fetchPembayaran = useCallback(async (p = 1) => {
    try {
      const res = await fetch(`/api/pembayaran-lain?page=${p}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPembayaranList(data.data || []);
        setTotalPages(data.totalPages || 1);
        setPage(data.page || 1);
      }
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  const fetchSantri = useCallback(async () => {
    try {
      const res = await fetch('/api/santri', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setSantriList(data.data || []);
    } catch (err) {
      console.error(err);
    }
  }, [token]);

  useEffect(() => {
    Promise.all([fetchKegiatan(), fetchPembayaran(), fetchSantri()]).finally(() => setLoading(false));
  }, [fetchKegiatan, fetchPembayaran, fetchSantri]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/pengaturan', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setSettings((prev) => ({ ...prev, ...data.data }));
        }
      } catch {}
    };

    if (token) fetchSettings();
  }, [token]);

  // Auto-fill nominal when kegiatan selected
  useEffect(() => {
    if (payForm.kegiatan_id) {
      const kegiatan = kegiatanList.find(k => k.id == payForm.kegiatan_id);
      if (kegiatan) {
        setPayForm(prev => ({ ...prev, nominal: kegiatan.nominal?.toString() || '' }));
      }
    }
  }, [payForm.kegiatan_id, kegiatanList]);

  const showPinFor = (action) => {
    setPendingAction(action);
    setPin('');
    setShowPinModal(true);
  };

  const handlePinConfirm = async () => {
    if (!pin) { setError('PIN wajib diisi'); return; }
    setShowPinModal(false);

    if (pendingAction === 'addKegiatan') await submitKegiatan();
    else if (pendingAction === 'editKegiatan') await submitEditKegiatan();
    else if (pendingAction === 'deleteKegiatan') await submitDeleteKegiatan();
    else if (pendingAction === 'addPembayaran') await submitPembayaran();
    else if (pendingAction === 'editPembayaran') await submitEditPembayaran();
    else if (pendingAction === 'deletePembayaran') await submitDeletePembayaran();

    setPendingAction(null);
  };

  // === KEGIATAN HANDLERS ===
  const handleAddKegiatan = (e) => {
    e.preventDefault();
    if (!kegiatanForm.nama_kegiatan || !kegiatanForm.nominal) {
      setError('Nama kegiatan dan nominal wajib diisi');
      return;
    }
    showPinFor('addKegiatan');
  };

  const submitKegiatan = async () => {
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/kegiatan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...kegiatanForm, pin })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Kegiatan berhasil ditambahkan!');
        setKegiatanForm({ nama_kegiatan: '', nominal: '', keterangan: '', gabung_saldo_utama: true });
        fetchKegiatan();
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal menambahkan kegiatan');
    }
  };

  const handleStartEditKegiatan = (k) => {
    setEditKegiatan({ id: k.id, nama_kegiatan: k.nama_kegiatan, nominal: k.nominal, keterangan: k.keterangan || '', is_active: k.is_active, gabung_saldo_utama: k.gabung_saldo_utama !== false });
  };

  const handleSaveEditKegiatan = () => {
    if (!editKegiatan.nama_kegiatan || !editKegiatan.nominal) {
      setError('Nama kegiatan dan nominal wajib diisi');
      return;
    }
    showPinFor('editKegiatan');
  };

  const submitEditKegiatan = async () => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/kegiatan/${editKegiatan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...editKegiatan, pin })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Kegiatan berhasil diperbarui!');
        setEditKegiatan(null);
        fetchKegiatan();
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal memperbarui kegiatan');
    }
  };

  const handleDeleteKegiatan = (k) => {
    setDeleteTarget({ type: 'kegiatan', id: k.id, name: k.nama_kegiatan });
    showPinFor('deleteKegiatan');
  };

  const submitDeleteKegiatan = async () => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/kegiatan/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Kegiatan berhasil dihapus!');
        setDeleteTarget(null);
        fetchKegiatan();
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal menghapus kegiatan');
    }
  };

  // === PEMBAYARAN HANDLERS ===
  const handleAddPembayaran = (e) => {
    e.preventDefault();
    if (!payForm.santri_id || !payForm.kegiatan_id || !payForm.nominal) {
      setError('Santri, kegiatan, dan nominal wajib diisi');
      return;
    }
    showPinFor('addPembayaran');
  };

  const submitPembayaran = async () => {
    setError(''); setSuccess('');
    try {
      const res = await fetch('/api/pembayaran-lain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...payForm, pin })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Pembayaran berhasil! Invoice: ${data.data?.kode_invoice || '-'}`);
        setPayForm({ santri_id: '', kegiatan_id: '', nominal: '', metode_bayar: 'Tunai', keterangan: '' });
        fetchPembayaran(1);
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal menyimpan pembayaran');
    }
  };

  const handleDeletePembayaran = (p) => {
    setDeleteTarget({ type: 'pembayaran', id: p.id, name: p.kode_invoice });
    showPinFor('deletePembayaran');
  };

  const handleStartEditPembayaran = (p) => {
    setEditPayment({
      id: p.id,
      kode_invoice: p.kode_invoice,
      nominal: p.nominal,
      metode_bayar: p.metode_bayar || 'Tunai',
      keterangan: p.keterangan || '',
      tgl_bayar: p.tgl_bayar ? new Date(p.tgl_bayar).toISOString().slice(0, 10) : '',
    });
  };

  const submitEditPembayaran = async () => {
    if (!editPayment) return;
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/pembayaran-lain/${editPayment.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          nominal: parseFloat(editPayment.nominal),
          metode_bayar: editPayment.metode_bayar,
          keterangan: editPayment.keterangan,
          tgl_bayar: editPayment.tgl_bayar,
          pin,
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Pembayaran berhasil diperbarui!');
        setEditPayment(null);
        fetchPembayaran(page);
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal memperbarui pembayaran');
    }
  };

  const submitDeletePembayaran = async () => {
    setError(''); setSuccess('');
    try {
      const res = await fetch(`/api/pembayaran-lain/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Pembayaran berhasil dihapus!');
        setDeleteTarget(null);
        fetchPembayaran(page);
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal menghapus pembayaran');
    }
  };

  const formatCurrency = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-10 w-10 text-green-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Pembayaran Lain</h1>
        <p className="text-gray-500">Kelola kegiatan dan pembayaran non-SPP</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 font-bold">✕</button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
          <button onClick={() => setSuccess('')} className="ml-2 font-bold">✕</button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('pembayaran')}
          className={`px-4 py-2 font-medium transition ${activeTab === 'pembayaran' ? 'text-green-700 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Pembayaran
        </button>
        <button
          onClick={() => setActiveTab('kegiatan')}
          className={`px-4 py-2 font-medium transition ${activeTab === 'kegiatan' ? 'text-green-700 border-b-2 border-green-600' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Kegiatan
        </button>
      </div>

      {activeTab === 'kegiatan' && (
        <div className="space-y-6">
          {/* Add Kegiatan Form */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Tambah Kegiatan</h3>
            <form onSubmit={handleAddKegiatan} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                type="text"
                value={kegiatanForm.nama_kegiatan}
                onChange={(e) => setKegiatanForm({ ...kegiatanForm, nama_kegiatan: e.target.value })}
                placeholder="Nama Kegiatan"
                className="input-field"
                required
              />
              <input
                type="number"
                value={kegiatanForm.nominal}
                onChange={(e) => setKegiatanForm({ ...kegiatanForm, nominal: e.target.value })}
                placeholder="Nominal (Rp)"
                className="input-field"
                required
              />
              <input
                type="text"
                value={kegiatanForm.keterangan}
                onChange={(e) => setKegiatanForm({ ...kegiatanForm, keterangan: e.target.value })}
                placeholder="Keterangan (opsional)"
                className="input-field"
              />
              <select
                value={kegiatanForm.gabung_saldo_utama ? '1' : '0'}
                onChange={(e) => setKegiatanForm({ ...kegiatanForm, gabung_saldo_utama: e.target.value === '1' })}
                className="input-field"
              >
                <option value="1">Gabung dengan saldo utama</option>
                <option value="0">Pisahkan dana</option>
              </select>
              <div className="md:col-span-3">
                <button type="submit" className="btn btn-primary">Tambah Kegiatan</button>
              </div>
            </form>
          </div>

          {/* Kegiatan List */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Daftar Kegiatan</h3>
            {kegiatanList.length === 0 ? (
              <p className="text-gray-500 text-center py-4">Belum ada kegiatan</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left">
                      <th className="px-4 py-3">Nama Kegiatan</th>
                      <th className="px-4 py-3">Nominal</th>
                      <th className="px-4 py-3">Keterangan</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Admin</th>
                      <th className="px-4 py-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {kegiatanList.map(k => (
                      <tr key={k.id} className="hover:bg-gray-50">
                        {editKegiatan?.id === k.id ? (
                          <>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editKegiatan.nama_kegiatan}
                                onChange={(e) => setEditKegiatan({ ...editKegiatan, nama_kegiatan: e.target.value })}
                                className="input-field text-sm"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                value={editKegiatan.nominal}
                                onChange={(e) => setEditKegiatan({ ...editKegiatan, nominal: e.target.value })}
                                className="input-field text-sm"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="text"
                                value={editKegiatan.keterangan}
                                onChange={(e) => setEditKegiatan({ ...editKegiatan, keterangan: e.target.value })}
                                className="input-field text-sm"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <select
                                value={editKegiatan.is_active ? '1' : '0'}
                                onChange={(e) => setEditKegiatan({ ...editKegiatan, is_active: e.target.value === '1' })}
                                className="input-field text-sm"
                              >
                                <option value="1">Aktif</option>
                                <option value="0">Nonaktif</option>
                              </select>
                              <select
                                value={editKegiatan.gabung_saldo_utama ? '1' : '0'}
                                onChange={(e) => setEditKegiatan({ ...editKegiatan, gabung_saldo_utama: e.target.value === '1' })}
                                className="input-field text-sm mt-2"
                              >
                                <option value="1">Gabung saldo utama</option>
                                <option value="0">Pisah dana</option>
                              </select>
                            </td>
                            <td className="px-4 py-3">-</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex gap-1 justify-center">
                                <button onClick={handleSaveEditKegiatan} className="btn btn-primary text-xs !py-1 !px-2">Simpan</button>
                                <button onClick={() => setEditKegiatan(null)} className="btn btn-secondary text-xs !py-1 !px-2">Batal</button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 font-medium">{k.nama_kegiatan}</td>
                            <td className="px-4 py-3">{formatCurrency(k.nominal)}</td>
                            <td className="px-4 py-3 text-gray-500">{k.keterangan || '-'}</td>
                            <td className="px-4 py-3">
                              <span className={`badge ${k.is_active ? 'badge-success' : 'badge-danger'}`}>
                                {k.is_active ? 'Aktif' : 'Nonaktif'}
                              </span>
                              <div className="text-xs text-gray-500 mt-1">{k.gabung_saldo_utama ? 'Gabung saldo' : 'Pisah dana'}</div>
                            </td>
                            <td className="px-4 py-3 text-gray-500">{k.admin?.nama_lengkap || '-'}</td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex gap-1 justify-center">
                                <button onClick={() => handleStartEditKegiatan(k)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Edit</button>
                                <button onClick={() => handleDeleteKegiatan(k)} className="text-red-600 hover:text-red-800 text-xs font-medium">Hapus</button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'pembayaran' && (
        <div className="space-y-6">
          {/* Payment Form */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Catat Pembayaran</h3>
            <form onSubmit={handleAddPembayaran} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Santri</label>
                  <select
                    value={payForm.santri_id}
                    onChange={(e) => setPayForm({ ...payForm, santri_id: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="">-- Pilih Santri --</option>
                    {santriList.map(s => (
                      <option key={s.id} value={s.id}>{s.is_subsidi ? '[Subsidi]' : '[Non Subsidi]'} {s.nama_lengkap} ({s.nik})</option>
                    ))}
                  </select>
                  {payForm.santri_id && (
                    <p className="text-xs mt-1" style={{ color: santriList.find((s) => String(s.id) === String(payForm.santri_id))?.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>
                      {santriList.find((s) => String(s.id) === String(payForm.santri_id))?.is_subsidi ? 'Kategori: Subsidi' : 'Kategori: Non Subsidi'}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Kegiatan</label>
                  <select
                    value={payForm.kegiatan_id}
                    onChange={(e) => setPayForm({ ...payForm, kegiatan_id: e.target.value })}
                    className="input-field"
                    required
                  >
                    <option value="">-- Pilih Kegiatan --</option>
                    {kegiatanList.filter(k => k.is_active).map(k => (
                      <option key={k.id} value={k.id}>{k.nama_kegiatan} - {formatCurrency(k.nominal)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nominal</label>
                  <input
                    type="number"
                    value={payForm.nominal}
                    onChange={(e) => setPayForm({ ...payForm, nominal: e.target.value })}
                    placeholder="Nominal pembayaran"
                    className="input-field bg-gray-100"
                    readOnly
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metode Bayar</label>
                  <select
                    value={payForm.metode_bayar}
                    onChange={(e) => setPayForm({ ...payForm, metode_bayar: e.target.value })}
                    className="input-field"
                  >
                    <option value="Tunai">Tunai</option>
                    <option value="Transfer">Transfer</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan (opsional)</label>
                <input
                  type="text"
                  value={payForm.keterangan}
                  onChange={(e) => setPayForm({ ...payForm, keterangan: e.target.value })}
                  placeholder="Keterangan tambahan"
                  className="input-field"
                />
              </div>
              <button type="submit" className="btn btn-primary">Simpan Pembayaran</button>
            </form>
          </div>

          {/* Pembayaran List */}
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Riwayat Pembayaran Lain</h3>
            {pembayaranList.length === 0 ? (
              <p className="text-gray-500 text-center py-8">Belum ada data pembayaran</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-4 py-3">Invoice</th>
                        <th className="px-4 py-3">Tanggal</th>
                        <th className="px-4 py-3">Santri</th>
                        <th className="px-4 py-3">Kegiatan</th>
                        <th className="px-4 py-3">Nominal</th>
                        <th className="px-4 py-3">Metode</th>
                        <th className="px-4 py-3">Admin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pembayaranList.map(p => (
                        <tr
                          key={p.id}
                          className="hover:bg-gray-50 cursor-pointer"
                          onClick={() => { setDetailPembayaran(p); setShowDetailPembayaran(true); }}
                        >
                          <td className="px-4 py-3 font-mono text-xs">{p.kode_invoice}</td>
                          <td className="px-4 py-3">{formatDate(p.tgl_bayar)}</td>
                          <td className="px-4 py-3 font-medium" style={{ color: p.santri?.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>
                            {p.santri?.nama_lengkap || '-'}
                          </td>
                          <td className="px-4 py-3">{p.kegiatan?.nama_kegiatan || '-'}</td>
                          <td className="px-4 py-3 text-green-700 font-medium">{formatCurrency(p.nominal)}</td>
                          <td className="px-4 py-3">
                            <span className={`badge ${p.metode_bayar === 'tunai' ? 'badge-info' : 'badge-warning'}`}>
                              {p.metode_bayar}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-500">{p.admin?.nama_lengkap || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-4 pt-4 border-t">
                    <button
                      onClick={() => fetchPembayaran(page - 1)}
                      disabled={page <= 1}
                      className="btn btn-secondary text-sm !py-1"
                    >
                      ← Prev
                    </button>
                    <span className="text-sm text-gray-500">
                      Halaman {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => fetchPembayaran(page + 1)}
                      disabled={page >= totalPages}
                      className="btn btn-secondary text-sm !py-1"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Detail Pembayaran Modal */}
      {showDetailPembayaran && detailPembayaran && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full overflow-hidden">
            <div className="bg-green-700 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                  <span className="text-green-700 font-bold text-lg">💳</span>
                </div>
                <div>
                  <p className="text-white font-semibold">{detailPembayaran.santri?.nama_lengkap || '-'}</p>
                  <p className="text-green-100 text-sm font-mono">{detailPembayaran.kode_invoice}</p>
                </div>
              </div>
              <button onClick={() => setShowDetailPembayaran(false)} className="text-white hover:text-green-200 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-gray-500">Tanggal</p>
                  <p className="font-medium">{formatDate(detailPembayaran.tgl_bayar)}</p>
                </div>
                <div>
                  <p className="text-gray-500">Metode</p>
                  <span className={`badge ${detailPembayaran.metode_bayar === 'tunai' ? 'badge-info' : 'badge-warning'}`}>{detailPembayaran.metode_bayar}</span>
                </div>
                <div>
                  <p className="text-gray-500">Kegiatan</p>
                  <p className="font-medium">{detailPembayaran.kegiatan?.nama_kegiatan || '-'}</p>
                </div>
                <div>
                  <p className="text-gray-500">Nominal</p>
                  <p className="font-semibold text-green-700 text-base">{formatCurrency(detailPembayaran.nominal)}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Keterangan</p>
                  <p className="font-medium">{detailPembayaran.keterangan || '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-500">Dicatat oleh</p>
                  <p className="font-medium">{detailPembayaran.admin?.nama_lengkap || '-'}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { handleStartEditPembayaran(detailPembayaran); setShowDetailPembayaran(false); }}
                  className="btn btn-secondary flex-1"
                >
                  ✏️ Edit
                </button>
                <button
                  onClick={() => { handleDeletePembayaran(detailPembayaran); setShowDetailPembayaran(false); }}
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
            {deleteTarget && (
              <p className="text-gray-600 mb-2">
                Hapus {deleteTarget.type === 'kegiatan' ? 'kegiatan' : 'pembayaran'}: <strong>{deleteTarget.name}</strong>?
              </p>
            )}
            <p className="text-gray-600 mb-4">Masukkan PIN untuk melanjutkan.</p>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Masukkan PIN"
              className="input-field mb-4"
              maxLength={6}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowPinModal(false); setPin(''); setDeleteTarget(null); setPendingAction(null); }}
                className="btn btn-secondary flex-1"
              >
                Batal
              </button>
              <button
                onClick={handlePinConfirm}
                disabled={!pin}
                className="btn btn-primary flex-1"
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}

      {editPayment && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md space-y-3">
            <h3 className="text-lg font-semibold text-gray-800">Edit Pembayaran Lain</h3>
            <p className="text-xs text-gray-500">Invoice: {editPayment.kode_invoice}</p>
            <input type="number" className="input-field" value={editPayment.nominal} onChange={(e) => setEditPayment({ ...editPayment, nominal: e.target.value })} />
            <select className="input-field" value={editPayment.metode_bayar} onChange={(e) => setEditPayment({ ...editPayment, metode_bayar: e.target.value })}>
              <option value="Tunai">Tunai</option>
              <option value="Transfer">Transfer</option>
            </select>
            <input type="date" className="input-field" value={editPayment.tgl_bayar || ''} onChange={(e) => setEditPayment({ ...editPayment, tgl_bayar: e.target.value })} />
            <input className="input-field" value={editPayment.keterangan || ''} onChange={(e) => setEditPayment({ ...editPayment, keterangan: e.target.value })} placeholder="Keterangan" />
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1" onClick={() => setEditPayment(null)}>Batal</button>
              <button className="btn btn-primary flex-1" onClick={() => showPinFor('editPembayaran')}>Simpan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
