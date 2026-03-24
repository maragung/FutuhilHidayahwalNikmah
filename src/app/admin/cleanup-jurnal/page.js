'use client';

import { useState, useEffect } from 'react';

export default function CleanupJurnalPage() {
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState([]);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });

  const fetchPreview = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/cleanup/jurnal-pengeluaran', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setPreview(data.preview || []);
      } else {
        setMessage({ type: 'error', text: data.pesan });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Gagal memuat preview' });
    }
  };

  useEffect(() => {
    fetchPreview();
  }, []);

  const handleCleanup = async () => {
    if (!pin) {
      setMessage({ type: 'error', text: 'PIN wajib diisi' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });
    const token = localStorage.getItem('auth_token');

    try {
      const res = await fetch('/api/cleanup/jurnal-pengeluaran', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pin })
      });

      const data = await res.json();
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: `Berhasil menghapus ${data.deleted_count} jurnal penyesuaian` 
        });
        setPin('');
        fetchPreview();
      } else {
        setMessage({ type: 'error', text: data.pesan });
      }
    } catch (err) {
      setMessage({ type: 'error', text: 'Gagal menghapus jurnal' });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Cleanup Jurnal Penyesuaian</h1>
        <p className="text-gray-500">Hapus jurnal penyesuaian yang salah akibat bug edit pengeluaran</p>
      </div>

      {message.text && (
        <div className={`p-4 rounded-lg border ${
          message.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-700' 
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {message.text}
          <button 
            onClick={() => setMessage({ type: '', text: '' })} 
            className="ml-2 hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}

      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">
          Jurnal Penyesuaian yang Akan Dihapus ({preview.length})
        </h3>

        {preview.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            Tidak ada jurnal penyesuaian yang perlu dibersihkan
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Tanggal</th>
                  <th className="px-4 py-3 text-left">Jenis</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                  <th className="px-4 py-3 text-left">Kode Referensi</th>
                  <th className="px-4 py-3 text-left">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((item) => (
                  <tr key={item.id} className="table-row">
                    <td className="px-4 py-3 font-mono text-sm">{item.id}</td>
                    <td className="px-4 py-3 text-sm">{formatDate(item.tgl_transaksi)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        item.jenis === 'Masuk' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {item.jenis}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-red-600">
                      {formatCurrency(item.nominal)}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{item.referensi_kode}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.keterangan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {preview.length > 0 && (
        <div className="card bg-yellow-50 border-yellow-200">
          <h3 className="font-semibold text-yellow-800 mb-4">⚠️ Konfirmasi Hapus</h3>
          <p className="text-sm text-yellow-700 mb-4">
            Tindakan ini akan menghapus {preview.length} jurnal penyesuaian secara permanen.
            Pastikan Anda sudah backup database terlebih dahulu.
          </p>
          
          <div className="flex items-center gap-4">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="Masukkan PIN untuk konfirmasi"
              className="input-field flex-1"
              maxLength={8}
            />
            <button
              onClick={handleCleanup}
              disabled={loading || !pin}
              className="btn btn-danger"
            >
              {loading ? 'Menghapus...' : 'Hapus Jurnal'}
            </button>
          </div>
        </div>
      )}

      <div className="card bg-blue-50 border-blue-200">
        <h3 className="font-semibold text-blue-800 mb-2">📝 Catatan</h3>
        <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
          <li>Endpoint ini hanya bisa diakses oleh user dengan jabatan <strong>Developer</strong></li>
          <li>Setelah cleanup, refresh halaman <code className="bg-white px-2 py-0.5 rounded">/admin/dana</code></li>
          <li>Jika perlu, edit ulang pengeluaran untuk membuat jurnal yang benar</li>
          <li>Backup database terlebih dahulu untuk keamanan</li>
        </ul>
      </div>
    </div>
  );
}
