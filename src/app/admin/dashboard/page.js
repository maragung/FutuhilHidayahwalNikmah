'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [dana, setDana] = useState(null);
  const [santriCount, setSantriCount] = useState(0);
  const [santriBaruCount, setSantriBaruCount] = useState(0);
  const [error, setError] = useState('');

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

  useEffect(() => {
    const fetchData = async () => {
      const token = localStorage.getItem('auth_token');
      
      try {
        // Fetch dana
        const danaRes = await fetch('/api/dana', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const danaData = await danaRes.json();
        if (danaData.success) {
          setDana(danaData.data);
        }

        // Fetch santri count
        const santriRes = await fetch('/api/santri?limit=1', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const santriData = await santriRes.json();
        if (santriData.success) {
          setSantriCount(santriData.pagination.total);
        }

        // Fetch santri baru bulan ini
        const santriBaruRes = await fetch('/api/santri?bulan_daftar_ini=true&limit=1', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const santriBaruData = await santriBaruRes.json();
        if (santriBaruData.success) {
          setSantriBaruCount(santriBaruData.pagination.total);
        }
      } catch (err) {
        setError('Gagal memuat data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500">Selamat datang di Sistem Manajemen TPQ Futuhil Hidayah</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Saldo Kas</p>
              <p className={`text-xl font-bold ${dana?.saldo_akhir >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(dana?.saldo_akhir)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Santri Aktif</p>
              <p className="text-xl font-bold text-blue-600">{santriCount}</p>
              {santriBaruCount > 0 && (
                <p className="text-xs text-green-600 font-medium">+{santriBaruCount} baru bulan ini</p>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Pemasukan Tahun Ini</p>
              <p className="text-xl font-bold text-purple-600">
                {formatCurrency(dana?.total_pemasukan_tahun)}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-500">Pengeluaran Tahun Ini</p>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(dana?.total_pengeluaran_tahun)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/admin/santri/tambah" className="card hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-800">Tambah Santri Baru</p>
              <p className="text-sm text-gray-500">Daftarkan santri baru</p>
            </div>
          </div>
        </Link>

        <Link href="/admin/bayar" className="card hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-800">Catat Pembayaran SPP</p>
              <p className="text-sm text-gray-500">Input pembayaran santri</p>
            </div>
          </div>
        </Link>

        <Link href="/admin/infak" className="card hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-gray-800">Catat Infak/Sedekah</p>
              <p className="text-sm text-gray-500">Pemasukan dari donatur</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Monthly Summary Chart */}
      {dana?.ringkasan_bulanan && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Ringkasan Keuangan Tahun {dana.tahun}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="table-header">
                  <th className="px-3 py-2 text-left">Bulan</th>
                  <th className="px-3 py-2 text-right">SPP</th>
                  <th className="px-3 py-2 text-right">Infak</th>
                  <th className="px-3 py-2 text-right">Pengeluaran</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {dana.ringkasan_bulanan.map((item, index) => (
                  <tr key={index} className="table-row">
                    <td className="table-cell font-medium">{namaBulan[item.bulan - 1]}</td>
                    <td className="table-cell text-right text-green-600">
                      {item.spp > 0 ? formatCurrency(item.spp) : '-'}
                    </td>
                    <td className="table-cell text-right text-purple-600">
                      {item.infak > 0 ? formatCurrency(item.infak) : '-'}
                    </td>
                    <td className="table-cell text-right text-red-600">
                      {item.pengeluaran > 0 ? formatCurrency(item.pengeluaran) : '-'}
                    </td>
                    <td className={`table-cell text-right font-medium ${item.netto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(item.netto)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right text-green-600">
                    {formatCurrency(dana.total_spp_tahun)}
                  </td>
                  <td className="px-3 py-2 text-right text-purple-600">
                    {formatCurrency(dana.total_infak_tahun)}
                  </td>
                  <td className="px-3 py-2 text-right text-red-600">
                    {formatCurrency(dana.total_pengeluaran_tahun)}
                  </td>
                  <td className={`px-3 py-2 text-right ${dana.netto_tahun >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(dana.netto_tahun)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Audit Status */}
      {dana && (
        <div className={`card ${dana.is_consistent ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-3">
            {dana.is_consistent ? (
              <>
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-green-800">Data Keuangan Konsisten</p>
                  <p className="text-sm text-green-600">Semua transaksi tercatat dengan benar dan saldo terverifikasi</p>
                </div>
              </>
            ) : (
              <>
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-red-800">Peringatan: Data Tidak Konsisten</p>
                  <p className="text-sm text-red-600">
                    Terdapat selisih antara saldo tercatat ({formatCurrency(dana.saldo_akhir)}) 
                    dengan hasil verifikasi ({formatCurrency(dana.saldo_verifikasi)})
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
