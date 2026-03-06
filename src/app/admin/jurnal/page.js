'use client';

import { useState, useEffect } from 'react';

export default function JurnalPage() {
  const [loading, setLoading] = useState(false);
  const [jurnalList, setJurnalList] = useState([]);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ total: 0, halaman: 1, totalHalaman: 1 });
  const [filter, setFilter] = useState({
    jenis: '',
    bulan: '',
    tahun: new Date().getFullYear(),
  });
  const [tahunMulai, setTahunMulai] = useState(new Date().getFullYear());

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const formatDateTime = (date) => {
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  useEffect(() => {
    fetchJurnal();
  }, [pagination.halaman, filter]);

  useEffect(() => {
    const fetchSettings = async () => {
      const token = localStorage.getItem('auth_token');
      try {
        const res = await fetch('/api/pengaturan', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          const startYear = parseInt(data.data.tahun_mulai_pembukuan || new Date().getFullYear());
          setTahunMulai(startYear);
          if (filter.tahun < startYear) {
            setFilter((prev) => ({ ...prev, tahun: startYear }));
          }
        }
      } catch {}
    };
    fetchSettings();
  }, []);

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= tahunMulai; y--) years.push(y);
    return years;
  };

  const fetchJurnal = async () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    
    try {
      let url = `/api/jurnal?page=${pagination.halaman}&limit=20&tahun=${filter.tahun}`;
      if (filter.jenis) url += `&jenis=${filter.jenis}`;
      if (filter.bulan) url += `&bulan=${filter.bulan}`;
      
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setJurnalList(data.data);
        setPagination(data.pagination);
      }
    } catch (err) {
      setError('Gagal memuat data jurnal kas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Jurnal Kas</h1>
        <p className="text-gray-500">Catatan seluruh transaksi keuangan</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Filter */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3">Filter Data</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tahun</label>
            <select
              value={filter.tahun}
              onChange={(e) => setFilter({ ...filter, tahun: parseInt(e.target.value) })}
              className="input-field"
            >
              {getYearOptions().map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bulan</label>
            <select
              value={filter.bulan}
              onChange={(e) => setFilter({ ...filter, bulan: e.target.value })}
              className="input-field"
            >
              <option value="">Semua Bulan</option>
              {namaBulan.map((bulan, idx) => (
                <option key={idx} value={idx + 1}>{bulan}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Transaksi</label>
            <select
              value={filter.jenis}
              onChange={(e) => setFilter({ ...filter, jenis: e.target.value })}
              className="input-field"
            >
              <option value="">Semua Jenis</option>
              <option value="Masuk">Masuk</option>
              <option value="Keluar">Keluar</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => setFilter({ jenis: '', bulan: '', tahun: new Date().getFullYear() })}
              className="btn btn-secondary w-full"
            >
              Reset Filter
            </button>
          </div>
        </div>
      </div>

      {/* Tabel Jurnal */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Transaksi Jurnal Kas</h3>
        
        {loading ? (
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
                    <th className="px-4 py-3 text-left">Tanggal</th>
                    <th className="px-4 py-3 text-center">Jenis</th>
                    <th className="px-4 py-3 text-left">Kode Referensi</th>
                    <th className="px-4 py-3 text-left">Keterangan</th>
                    <th className="px-4 py-3 text-right">Masuk</th>
                    <th className="px-4 py-3 text-right">Keluar</th>
                    <th className="px-4 py-3 text-right">Saldo</th>
                    <th className="px-4 py-3 text-left">Admin</th>
                  </tr>
                </thead>
                <tbody>
                  {jurnalList.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-4 py-8 text-center text-gray-500">
                        Belum ada data jurnal kas
                      </td>
                    </tr>
                  ) : (
                    jurnalList.map((jurnal) => (
                      <tr key={jurnal.id} className="table-row">
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {formatDateTime(jurnal.tgl_transaksi)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {jurnal.jenis === 'Masuk' ? (
                            <span className="px-2 py-1 rounded-full text-xs bg-green-100 text-green-700">
                              Masuk
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full text-xs bg-red-100 text-red-700">
                              Keluar
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {jurnal.referensi_kode}
                        </td>
                        <td className="px-4 py-3 text-sm max-w-xs truncate">
                          {jurnal.keterangan}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-green-600">
                          {jurnal.jenis === 'Masuk' ? formatCurrency(jurnal.nominal) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">
                          {jurnal.jenis === 'Keluar' ? formatCurrency(jurnal.nominal) : '-'}
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${jurnal.saldo_berjalan >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                          {formatCurrency(jurnal.saldo_berjalan)}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {jurnal.admin?.nama_lengkap || '-'}
                        </td>
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
    </div>
  );
}
