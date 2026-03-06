'use client';

import { useState, useEffect } from 'react';

export default function DanaPage() {
  const [loading, setLoading] = useState(true);
  const [dana, setDana] = useState(null);
  const [error, setError] = useState('');
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [tahunMulai, setTahunMulai] = useState(new Date().getFullYear());

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

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
          if (tahun < startYear) setTahun(startYear);
        }
      } catch {}
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    fetchDana();
  }, [tahun]);

  const yearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= tahunMulai; y--) years.push(y);
    return years;
  };

  const fetchDana = async () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    
    try {
      const res = await fetch(`/api/dana?tahun=${tahun}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDana(data.data);
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal memuat data dana');
    } finally {
      setLoading(false);
    }
  };

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Keuangan TPQ</h1>
          <p className="text-gray-500">Ringkasan keuangan dan saldo kas</p>
        </div>
        <select
          value={tahun}
          onChange={(e) => setTahun(parseInt(e.target.value))}
          className="input-field w-40"
        >
          {yearOptions().map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <p className="text-sm text-green-700 mb-1">Saldo Kas Saat Ini</p>
          <p className={`text-3xl font-bold ${dana?.saldo_akhir >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(dana?.saldo_akhir)}
          </p>
          <p className="text-xs text-green-600 mt-2">Update: {new Date().toLocaleDateString('id-ID')}</p>
        </div>

        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <p className="text-sm text-blue-700 mb-1">Total Pemasukan {tahun}</p>
          <p className="text-2xl font-bold text-blue-600">
            {formatCurrency(dana?.total_pemasukan_tahun)}
          </p>
          <p className="text-xs text-blue-600 mt-2">
            SPP: {formatCurrency(dana?.total_spp_tahun || 0)}
          </p>
          <p className="text-xs text-blue-600">
            Infak: {formatCurrency(dana?.total_infak_tahun || 0)}
          </p>
        </div>

        <div className="card bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <p className="text-sm text-red-700 mb-1">Total Pengeluaran {tahun}</p>
          <p className="text-2xl font-bold text-red-600">
            {formatCurrency(dana?.total_pengeluaran_tahun)}
          </p>
          <p className="text-xs text-red-600 mt-2">
            {dana?.jumlah_pengeluaran || 0} transaksi
          </p>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <p className="text-sm text-purple-700 mb-1">Surplus/Defisit {tahun}</p>
          <p className={`text-2xl font-bold ${(dana?.total_pemasukan_tahun - dana?.total_pengeluaran_tahun) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(dana?.total_pemasukan_tahun - dana?.total_pengeluaran_tahun)}
          </p>
          <p className="text-xs text-purple-600 mt-2">
            {(dana?.total_pemasukan_tahun - dana?.total_pengeluaran_tahun) >= 0 ? 'Surplus' : 'Defisit'}
          </p>
        </div>
      </div>

      {/* Ringkasan Bulanan */}
      {dana?.ringkasan_bulanan && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Ringkasan Keuangan Per Bulan Tahun {tahun}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left">Bulan</th>
                  <th className="px-4 py-3 text-right">SPP</th>
                  <th className="px-4 py-3 text-right">Infak</th>
                  <th className="px-4 py-3 text-right">Total Masuk</th>
                  <th className="px-4 py-3 text-right">Pengeluaran</th>
                  <th className="px-4 py-3 text-right">Saldo Bersih</th>
                </tr>
              </thead>
              <tbody>
                {dana.ringkasan_bulanan.map((bulan, idx) => {
                  const totalMasuk = bulan.pemasukan_jurnal ?? ((bulan.spp || 0) + (bulan.infak || 0));
                  const totalKeluar = bulan.pengeluaran_jurnal ?? (bulan.pengeluaran || 0);
                  const saldoBersih = totalMasuk - totalKeluar;
                  
                  return (
                    <tr key={idx} className="table-row">
                      <td className="px-4 py-3 font-medium">{namaBulan[bulan.bulan - 1]}</td>
                      <td className="px-4 py-3 text-right text-green-600">
                        {formatCurrency(bulan.spp)}
                      </td>
                      <td className="px-4 py-3 text-right text-blue-600">
                        {formatCurrency(bulan.infak)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-green-600">
                        {formatCurrency(totalMasuk)}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600">
                        {formatCurrency(totalKeluar)}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${saldoBersih >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(saldoBersih)}
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-gray-100 font-bold">
                  <td className="px-4 py-3">TOTAL</td>
                  <td className="px-4 py-3 text-right text-green-600">
                    {formatCurrency(dana.total_spp_tahun)}
                  </td>
                  <td className="px-4 py-3 text-right text-blue-600">
                    {formatCurrency(dana.total_infak_tahun)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600">
                    {formatCurrency(dana.total_pemasukan_tahun)}
                  </td>
                  <td className="px-4 py-3 text-right text-red-600">
                    {formatCurrency(dana.total_pengeluaran_tahun)}
                  </td>
                  <td className={`px-4 py-3 text-right ${(dana.total_pemasukan_tahun - dana.total_pengeluaran_tahun) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(dana.total_pemasukan_tahun - dana.total_pengeluaran_tahun)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Backup */}
      {dana?.backup_terakhir && (
        <div className="card bg-gray-50">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-700">Backup Terakhir</p>
              <p className="text-xs text-gray-500">
                {new Date(dana.backup_terakhir).toLocaleString('id-ID')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
