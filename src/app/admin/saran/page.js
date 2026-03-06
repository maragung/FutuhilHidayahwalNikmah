'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

export default function SaranPage() {
  const [loading, setLoading] = useState(true);
  const [saranList, setSaranList] = useState([]);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [selectedSaran, setSelectedSaran] = useState(null);
  const [tanggapan, setTanggapan] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [pinModal, setPinModal] = useState({ show: false, action: null, id: null });
  const [pinInput, setPinInput] = useState('');

  useEffect(() => {
    fetchSaran();
  }, [filterStatus, filterKategori]);

  const fetchSaran = async () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    
    try {
      let url = '/api/saran?limit=100';
      if (filterStatus) url += `&status=${filterStatus}`;
      if (filterKategori) url += `&kategori=${filterKategori}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (data.success) {
        setSaranList(data.data);
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal memuat data saran');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = (saran) => {
    setSelectedSaran(saran);
    setTanggapan(saran.tanggapan || '');
    
    // Mark as read if not already
    if (saran.status === 'Belum Dibaca') {
      updateStatus(saran.id, 'Sudah Dibaca');
    }
  };

  const updateStatus = async (id, newStatus) => {
    const token = localStorage.getItem('auth_token');
    
    try {
      await fetch(`/api/saran/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus }),
      });
      
      fetchSaran();
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleSubmitTanggapan = async (pin) => {
    if (!selectedSaran || !tanggapan.trim()) return;
    
    setSubmitLoading(true);
    const token = localStorage.getItem('auth_token');
    
    try {
      const res = await fetch(`/api/saran/${selectedSaran.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          tanggapan: tanggapan.trim(),
          status: 'Ditindaklanjuti',
          pin,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setSelectedSaran(null);
        setTanggapan('');
        fetchSaran();
      } else {
        alert(data.pesan || 'Gagal menyimpan tanggapan');
      }
    } catch (err) {
      alert('Gagal menyimpan tanggapan');
    } finally {
      setSubmitLoading(false);
    }, pin) => {
    const token = localStorage.getItem('auth_token');
    
    try {
      const res = await fetch(`/api/saran/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ pin }),
      const res = await fetch(`/api/saran/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const data = await res.json();
      if (data.success) {
        fetchSaran();
        if (selectedSaran?.id === id) {
          setSelectedSaran(null);
        }
      } else {
        alert(data.pesan);
      }
    } catch (err) {
      alert('Gagal menghapus saran');
    }
  };

  const openPinModal = (action, id) => {
    setPinInput('');
    setPinModal({ show: true, action, id });
  };

  const handlePinConfirm = async () => {
    if (!pinInput.trim()) return;
    const { action, id: targetId } = pinModal;
    setPinModal({ show: false, action: null, id: null });
    
    if (action === 'tanggapan') {
      await handleSubmitTanggapan(pinInput);
    } else if (action === 'delete') {
      await handleDelete(targetId, pinInput);
    }
    setPinInput('');
  };

  const getKategoriColor = (kategori) => {
    const colors = {
      'Saran': 'bg-blue-100 text-blue-800',
      'Kritik': 'bg-orange-100 text-orange-800',
      'Pertanyaan': 'bg-purple-100 text-purple-800',
      'Lainnya': 'bg-gray-100 text-gray-800',
    };
    return colors[kategori] || colors['Lainnya'];
  };

  const getStatusColor = (status) => {
    const colors = {
      'Belum Dibaca': 'bg-red-100 text-red-800',
      'Sudah Dibaca': 'bg-yellow-100 text-yellow-800',
      'Ditindaklanjuti': 'bg-green-100 text-green-800',
    };
    return colors[status] || colors['Belum Dibaca'];
  };

  const belumDibaca = saranList.filter(s => s.status === 'Belum Dibaca').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Kotak Saran & Masukan</h1>
          <p className="text-gray-500">Kelola saran dan masukan dari masyarakat</p>
        </div>
        {belumDibaca > 0 && (
          <div className="bg-red-500 text-white px-4 py-2 rounded-full font-semibold animate-pulse">
            {belumDibaca} Saran Baru
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input-field"
            >
              <option value="">Semua Status</option>
              <option value="Belum Dibaca">Belum Dibaca</option>
              <option value="Sudah Dibaca">Sudah Dibaca</option>
              <option value="Ditindaklanjuti">Ditindaklanjuti</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter Kategori</label>
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="input-field"
            >
              <option value="">Semua Kategori</option>
              <option value="Saran">Saran</option>
              <option value="Kritik">Kritik</option>
              <option value="Pertanyaan">Pertanyaan</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setFilterStatus('');
                setFilterKategori('');
              }}
              className="btn-secondary"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* List Saran */}
        <div className="space-y-3">
          {loading ? (
            <div className="card text-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto"></div>
              <p className="text-gray-500 mt-3">Memuat data...</p>
            </div>
          ) : saranList.length === 0 ? (
            <div className="card text-center py-12">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-500">Belum ada saran masuk</p>
            </div>
          ) : (
            saranList.map(saran => (
              <div
                key={saran.id}
                onClick={() => handleOpenDetail(saran)}
                className={`card p-4 cursor-pointer transition-all hover:shadow-lg border-2 ${
                  selectedSaran?.id === saran.id
                    ? 'border-green-500 bg-green-50'
                    : saran.status === 'Belum Dibaca'
                    ? 'border-red-200 bg-red-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-800">{saran.nama_pengirim}</h3>
                    <p className="text-xs text-gray-500">
                      {format(new Date(saran.created_at), 'dd MMM yyyy, HH:mm', { locale: id })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${getKategoriColor(saran.kategori)}`}>
                      {saran.kategori}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                  {saran.isi_saran}
                </p>

                <div className="flex justify-between items-center">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getStatusColor(saran.status)}`}>
                    {saran.status}
                  </span>
                  {saran.email_pengirim && (
                    <span className="text-xs text-gray-500">📧 {saran.email_pengirim}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail Saran */}
        <div className="sticky top-6">
          {selectedSaran ? (
            <div className="card">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">{selectedSaran.nama_pengirim}</h3>
                  <p className="text-sm text-gray-500">
                    {format(new Date(selectedSaran.created_at), 'dd MMMM yyyy, HH:mm', { locale: id })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSaran(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full ${getKategoriColor(selectedSaran.kategori)}`}>
                    {selectedSaran.kategori}
                  </span>
                  <span className={`text-xs px-3 py-1 rounded-full ${getStatusColor(selectedSaran.status)}`}>
                    {selectedSaran.status}
                  </span>
                </div>

                {selectedSaran.email_pengirim && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Email:</span> {selectedSaran.email_pengirim}
                  </p>
                )}
                {selectedSaran.no_telp_pengirim && (
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">No. Telp:</span> {selectedSaran.no_telp_pengirim}
                  </p>
                )}
              </div>

              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Isi Saran:</p>
                <p className="text-gray-800 whitespace-pre-wrap">{selectedSaran.isi_saran}</p>
              </div>

              {selectedSaran.tanggapan && (
                <div className="bg-green-50 p-4 rounded-lg mb-4 border-l-4 border-green-500">
                  <p className="text-sm font-medium text-green-800 mb-2">
                    Tanggapan {selectedSaran.admin && `oleh ${selectedSaran.admin.nama_lengkap}`}:
                  </p>
                  <p className="text-gray-800 whitespace-pre-wrap">{selectedSaran.tanggapan}</p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tulis Tanggapan:
                  </label>
                  <textarea
                    value={tanggapan}
                    onChange={(e) => setTanggapan(e.target.value)}
                    placeholder="Tulis tanggapan untuk saran ini..."
                    rows="4"
                    className="input-field resize-none"
                  ></textarea>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      if (!tanggapan.trim()) return;
                      openPinModal('tanggapan', selectedSaran.id);
                    }}
                    disabled={!tanggapan.trim() || submitLoading}
                    className="btn-primary flex-1"
                  >
                    {submitLoading ? 'Menyimpan...' : '💾 Simpan Tanggapan'}
                  </button>
                  
                  <button
                    onClick={() => openPinModal('delete', selectedSaran.id)}
                    className="btn-danger"
                  >
                    🗑️
                  </button>
                </div>

                <div className="flex gap-2">
                  {selectedSaran.status !== 'Sudah Dibaca' && (
                    <button
                      onClick={() => updateStatus(selectedSaran.id, 'Sudah Dibaca')}
                      className="btn-secondary text-xs flex-1"
                    >
                      Tandai Sudah Dibaca
                    </button>
                  )}
                  {selectedSaran.status !== 'Ditindaklanjuti' && (
                    <button
                      onClick={() => updateStatus(selectedSaran.id, 'Ditindaklanjuti')}
                      className="btn-secondary text-xs flex-1"
                    >
                      Tandai Ditindaklanjuti
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-16">
              <svg className="w-16 h-16 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <p className="text-gray-500">Pilih saran untuk melihat detail</p>
            </div>
          )}
        </div>
      </div>

      {/* PIN Confirmation Modal */}
      {pinModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              {pinModal.action === 'delete' ? '🗑️ Konfirmasi Hapus' : '🔐 Konfirmasi PIN'}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {pinModal.action === 'delete'
                ? 'Masukkan PIN untuk menghapus saran ini.'
                : 'Masukkan PIN untuk menyimpan tanggapan.'}
            </p>
            <input
              type="password"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePinConfirm()}
              placeholder="Masukkan PIN"
              className="input-field mb-4"
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setPinModal({ show: false, action: null, id: null }); setPinInput(''); }}
                className="btn-secondary flex-1"
              >
                Batal
              </button>
              <button
                onClick={handlePinConfirm}
                disabled={!pinInput.trim()}
                className={`flex-1 ${pinModal.action === 'delete' ? 'btn-danger' : 'btn-primary'}`}
              >
                {pinModal.action === 'delete' ? 'Hapus' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
