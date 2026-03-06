'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { safeHexColor } from '@/lib/color';

export default function Home() {
  const [nik, setNik] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [captchaValue, setCaptchaValue] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [settings, setSettings] = useState({
    nama_tpq: 'TPQ Futuhil Hidayah',
    warna_non_subsidi: '#04B816',
    warna_subsidi: '#045EB8',
  });

  const loadCaptcha = async () => {
    try {
      const res = await fetch('/api/captcha', { cache: 'no-store' });
      const result = await res.json();
      if (result.success) {
        setCaptchaToken(result.data.token);
        setCaptchaImage(result.data.image);
      }
    } catch {}
  };

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/publik/pengaturan', { cache: 'no-store' });
        const result = await res.json();
        if (result.success) setSettings((prev) => ({ ...prev, ...result.data }));
      } catch {}
    };
    loadSettings();
    loadCaptcha();
  }, []);

  const namaBulan = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const warnaNonSubsidi = safeHexColor(settings.warna_non_subsidi, '#04B816');
  const warnaSubsidi = safeHexColor(settings.warna_subsidi, '#045EB8');

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!nik.trim()) {
      setError('Masukkan NIK terlebih dahulu');
      return;
    }

    if (captchaValue.length !== 6) {
      setError('Captcha wajib diisi 6 karakter');
      return;
    }

    setLoading(true);
    setError('');
    setData(null);

    try {
      const res = await fetch(`/api/publik/santri/${nik}?captcha_token=${encodeURIComponent(captchaToken)}&captcha_value=${encodeURIComponent(captchaValue)}`);
      const result = await res.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.pesan || 'Data tidak ditemukan');
        setCaptchaValue('');
        loadCaptcha();
      }
    } catch (err) {
      setError('Terjadi kesalahan, silakan coba lagi');
      setCaptchaValue('');
      loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const formatTanggal = (tanggal) => {
    return new Date(tanggal).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  // Group pembayaran by tahun
  const groupedPembayaran = data?.pembayaran?.reduce((acc, p) => {
    if (!acc[p.tahun_spp]) acc[p.tahun_spp] = {};
    acc[p.tahun_spp][p.bulan_spp] = p;
    return acc;
  }, {}) || {};

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xl font-bold">ف</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-green-800">{settings.nama_tpq}</h1>
                <p className="text-sm text-gray-500">Wal Hikmah - Santri Qiroati</p>
              </div>
            </div>
            <Link 
              href="/admin/login" 
              className="text-green-600 hover:text-green-700 font-medium text-sm"
            >
              Login Admin
            </Link>
          </div>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav className="bg-green-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center gap-6 py-2.5 text-sm">
            <Link href="/" className="text-white font-medium hover:text-green-200 transition-colors">
              Beranda
            </Link>
            <Link href="/cek-pembayaran" className="text-green-200 hover:text-white transition-colors">
              Cek Pembayaran
            </Link>
            <Link href="/kotak-saran" className="text-green-200 hover:text-white transition-colors">
              Kotak Saran
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Card */}
        <div className="card mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Cek Status Pembayaran</h2>
          <p className="text-gray-500 mb-6">Masukkan NIK santri untuk melihat status pembayaran SPP</p>
          
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={nik}
                onChange={(e) => setNik(e.target.value)}
                placeholder="Masukkan NIK (16 digit)"
                className="input-field"
                maxLength={16}
              />
              <div className="mt-2">
                <div className="flex items-center gap-2 mb-2">
                  {captchaImage ? (
                    <img src={captchaImage} alt="Captcha" className="h-12 rounded border border-gray-200" />
                  ) : (
                    <div className="h-12 w-[220px] rounded border border-gray-200 bg-gray-50" />
                  )}
                  <button
                    type="button"
                    onClick={loadCaptcha}
                    className="px-3 py-2 rounded border border-gray-200 text-sm hover:bg-gray-50"
                  >
                    Refresh
                  </button>
                </div>
                <input
                  type="text"
                  value={captchaValue}
                  onChange={(e) => setCaptchaValue(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="Masukkan 6 karakter captcha"
                  maxLength={6}
                  className="input-field uppercase"
                  required
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Mencari...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Cari</span>
                </>
              )}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              {error}
            </div>
          )}
        </div>

        {/* Result */}
        {data && (
          <div className="space-y-6">
            {/* Info Santri */}
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Informasi Santri</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">NIK</p>
                  <p className="font-medium text-gray-800">{data.nik}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Nama Lengkap</p>
                  <p className="font-medium" style={{ color: data.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>{data.nama_lengkap}</p>
                  <p className="text-xs mt-1" style={{ color: data.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>
                    {data.is_subsidi ? 'Subsidi' : 'Non Subsidi'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Jilid</p>
                  <p className="font-medium text-gray-800">{data.jilid}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Tanggal Mendaftar</p>
                  <p className="font-medium text-gray-800">{formatTanggal(data.tgl_mendaftar)}</p>
                </div>
              </div>
            </div>

            {/* Status Pembayaran */}
            {Object.keys(groupedPembayaran).length > 0 ? (
              Object.keys(groupedPembayaran).sort((a, b) => b - a).map(tahun => (
                <div key={tahun} className="card">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">
                    Status Pembayaran SPP Tahun {tahun}
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {namaBulan.map((nama, index) => {
                      const bulan = index + 1;
                      const pembayaran = groupedPembayaran[tahun][bulan];
                      const sudahBayar = !!pembayaran;

                      return (
                        <div
                          key={bulan}
                          className={`p-3 rounded-lg text-center ${
                            sudahBayar 
                              ? 'bg-green-100 border border-green-300' 
                              : 'bg-gray-100 border border-gray-200'
                          }`}
                        >
                          <p className={`text-xs font-medium ${sudahBayar ? 'text-green-700' : 'text-gray-500'}`}>
                            {nama.substring(0, 3)}
                          </p>
                          {sudahBayar ? (
                            <svg className="w-6 h-6 text-green-600 mx-auto mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-6 h-6 text-gray-400 mx-auto mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <p className="text-sm text-gray-500">
                      Total Terbayar: <span className="font-semibold text-green-700">
                        {formatCurrency(Object.values(groupedPembayaran[tahun]).reduce((sum, p) => sum + parseFloat(p.nominal), 0))}
                      </span>
                      {' | '}
                      Bulan Terbayar: <span className="font-semibold">{Object.keys(groupedPembayaran[tahun]).length}/12</span>
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="card text-center py-8">
                <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">Belum ada data pembayaran</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-100 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} TPQ Futuhil Hidayah Wal Hikmah. Semua hak dilindungi.
          </p>
        </div>
      </footer>
    </div>
  );
}
