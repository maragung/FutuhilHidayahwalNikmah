'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { SkeletonTable } from '@/components/SkeletonLoader';

export default function AlumniPage() {
  const [loading, setLoading] = useState(true);
  const [alumniList, setAlumniList] = useState([]);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailSantri, setDetailSantri] = useState(null);
  const [showBatalLulusModal, setShowBatalLulusModal] = useState(false);
  const [selectedSantri, setSelectedSantri] = useState(null);
  const [pin, setPin] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = async () => {
    const token = localStorage.getItem('auth_token');
    setLoading(true);
    try {
      const res = await fetch('/api/santri?status=lulus&limit=500', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setAlumniList(data.data);
      }
    } catch {
      setError('Gagal memuat data alumni');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleBatalLulus = async () => {
    if (!pin) { setError('Masukkan PIN'); return; }
    setActionLoading(true);
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/santri/${selectedSantri.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status_lulus: false, status_aktif: true, pin }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess('Status lulus santri berhasil dibatalkan, santri kembali aktif');
        setShowBatalLulusModal(false);
        setShowDetailModal(false);
        setPin('');
        setSelectedSantri(null);
        fetchData();
      } else {
        setError(data.pesan);
      }
    } catch {
      setError('Gagal membatalkan status lulus');
    } finally {
      setActionLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    if (!search) return alumniList;
    const q = search.toLowerCase();
    return alumniList.filter(s =>
      s.nama_lengkap.toLowerCase().includes(q) || s.nik.includes(q)
    );
  }, [alumniList, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🎓 Alumni / Santri Lulus</h1>
          <p className="text-gray-500">Daftar santri yang telah lulus / khatam</p>
        </div>
        <Link href="/admin/santri" className="btn-secondary inline-flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Kembali ke Data Santri</span>
        </Link>
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

      {/* Search & count */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau NIK alumni..."
              className="input-field"
            />
          </div>
          <span className="text-sm text-gray-500">{filteredData.length} alumni</span>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : (
          <div className="table-container">
            <table className="w-full">
              <thead>
                <tr className="bg-yellow-50 text-xs text-yellow-800 font-semibold">
                  <th className="px-3 py-3 text-center w-10">#</th>
                  <th className="px-3 py-3 text-left min-w-[160px]">Nama Santri</th>
                  <th className="px-3 py-3 text-center">NIK</th>
                  <th className="px-3 py-3 text-center">Jilid Terakhir</th>
                  <th className="px-3 py-3 text-center">No. Absen</th>
                  <th className="px-3 py-3 text-center">Tgl Lulus</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      {alumniList.length === 0 ? 'Belum ada santri yang lulus' : 'Tidak ditemukan'}
                    </td>
                  </tr>
                ) : (
                  filteredData.map((santri, index) => (
                    <tr
                      key={santri.id}
                      className="table-row cursor-pointer hover:bg-yellow-50"
                      onClick={() => { setDetailSantri(santri); setShowDetailModal(true); }}
                    >
                      <td className="px-3 py-3 text-center text-sm text-gray-600">{index + 1}</td>
                      <td className="px-3 py-3">
                        <div>
                          <p className="font-medium text-gray-800">{santri.nama_lengkap}</p>
                          <p className="text-xs text-yellow-600">🎓 Lulus</p>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-sm text-gray-600">{santri.nik}</td>
                      <td className="px-3 py-3 text-center">
                        <span className="badge badge-info">{santri.jilid}</span>
                      </td>
                      <td className="px-3 py-3 text-center text-sm text-gray-600">
                        {santri.no_absen ? `#${santri.no_absen}` : '-'}
                      </td>
                      <td className="px-3 py-3 text-center text-sm text-gray-600">
                        {santri.tgl_lulus
                          ? new Date(santri.tgl_lulus).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && detailSantri && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-bold text-gray-800">Detail Alumni</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white bg-yellow-500">
                {detailSantri.nama_lengkap.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-gray-800 text-lg">{detailSantri.nama_lengkap}</p>
                <p className="text-sm text-yellow-600">🎓 Alumni • {detailSantri.jilid}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {detailSantri.no_absen && (
                <div className="bg-yellow-50 rounded p-3 col-span-2 flex items-center gap-2">
                  <span className="text-xs text-yellow-600 font-medium">No. Absen</span>
                  <span className="font-bold text-yellow-800 text-lg">#{detailSantri.no_absen}</span>
                </div>
              )}
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">NIK</p>
                <p className="font-medium">{detailSantri.nik}</p>
              </div>
              <div className="bg-yellow-50 rounded p-3">
                <p className="text-xs text-gray-500">Status</p>
                <p className="font-medium text-yellow-700">🎓 Lulus</p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">Tgl Mendaftar</p>
                <p className="font-medium">
                  {new Date(detailSantri.tgl_mendaftar).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">Tgl Lulus</p>
                <p className="font-medium">
                  {detailSantri.tgl_lulus
                    ? new Date(detailSantri.tgl_lulus).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
                    : '-'}
                </p>
              </div>
              {detailSantri.alamat && (
                <div className="bg-gray-50 rounded p-3 col-span-2">
                  <p className="text-xs text-gray-500">Alamat</p>
                  <p className="font-medium">{detailSantri.alamat}</p>
                </div>
              )}
              {detailSantri.nama_wali && (
                <div className="bg-gray-50 rounded p-3 col-span-2">
                  <p className="text-xs text-gray-500">Wali</p>
                  <p className="font-medium">{detailSantri.nama_wali}</p>
                  {detailSantri.no_telp_wali && <p className="text-xs text-gray-500">{detailSantri.no_telp_wali}</p>}
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              <button
                onClick={() => {
                  setSelectedSantri(detailSantri);
                  setShowBatalLulusModal(true);
                }}
                className="btn-secondary flex-1 border-orange-400 text-orange-700 hover:bg-orange-50"
              >
                ↩️ Batalkan Lulus
              </button>
              <Link
                href={`/admin/santri/tambah?edit=${detailSantri.id}`}
                className="btn-secondary flex-1 text-center"
                onClick={() => setShowDetailModal(false)}
              >
                ✏️ Edit Data
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Batal Lulus Modal */}
      {showBatalLulusModal && selectedSantri && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Batalkan Status Lulus</h3>
            <p className="text-gray-600 mb-4">
              Batalkan status lulus santri <strong>{selectedSantri.nama_lengkap}</strong>?
              Santri akan kembali aktif dan muncul di halaman Data Santri.
            </p>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && pin && !actionLoading) handleBatalLulus(); }}
              placeholder="Masukkan PIN"
              className="input-field mb-4"
              maxLength={6}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowBatalLulusModal(false); setPin(''); setSelectedSantri(null); }}
                className="btn-secondary flex-1"
              >
                Batal
              </button>
              <button
                onClick={handleBatalLulus}
                disabled={actionLoading}
                className="btn-primary flex-1"
              >
                {actionLoading ? 'Memproses...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
