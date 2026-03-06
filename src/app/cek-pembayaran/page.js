'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { safeHexColor } from '@/lib/color';

export default function CekPembayaranPage() {
  const [nik, setNik] = useState('');
  const [loading, setLoading] = useState(false);
  const [santri, setSantri] = useState(null);
  const [pembayaran, setPembayaran] = useState([]);
  const [error, setError] = useState('');
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [captchaValue, setCaptchaValue] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [settings, setSettings] = useState({
    nama_tpq: 'TPQ Futuhil Hidayah Wal Hikmah',
    warna_non_subsidi: '#04B816',
    warna_subsidi: '#045EB8',
    tahun_mulai_pembukuan: String(new Date().getFullYear()),
  });

  const loadCaptcha = async () => {
    try {
      const res = await fetch('/api/captcha', { cache: 'no-store' });
      const data = await res.json();
      if (data.success) {
        setCaptchaToken(data.data.token);
        setCaptchaImage(data.data.image);
      }
    } catch {
      setError('Gagal memuat captcha');
    }
  };

  useEffect(() => {
    loadCaptcha();
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/publik/pengaturan', { cache: 'no-store' });
        const data = await res.json();
        if (data.success) {
          setSettings((prev) => ({ ...prev, ...data.data }));
          const startYear = parseInt(data.data.tahun_mulai_pembukuan || new Date().getFullYear());
          if (tahun < startYear) setTahun(startYear);
        }
      } catch {}
    };
    loadSettings();
  }, []);

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const startYear = parseInt(settings.tahun_mulai_pembukuan || currentYear);
    const years = [];
    for (let year = currentYear; year >= startYear; year--) years.push(year);
    return years;
  };

  const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 
                    'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
  const warnaNonSubsidi = safeHexColor(settings.warna_non_subsidi, '#04B816');
  const warnaSubsidi = safeHexColor(settings.warna_subsidi, '#045EB8');

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  const handleCari = async (e) => {
    e.preventDefault();
    
    if (nik.length < 10) {
      setError('NIK harus minimal 10 digit');
      return;
    }

    if (captchaValue.length !== 6) {
      setError('Captcha wajib diisi 6 karakter');
      return;
    }

    setLoading(true);
    setError('');
    setSantri(null);
    setPembayaran([]);

    try {
      const res = await fetch(`/api/publik/santri/${nik}?tahun=${tahun}&captcha_token=${encodeURIComponent(captchaToken)}&captcha_value=${encodeURIComponent(captchaValue)}`);
      const data = await res.json();

      if (data.success) {
        const santriData = data.data;
        setSantri(santriData);
        setPembayaran(santriData?.pembayaran || []);
        
        if (!santriData) {
          setError('Data santri dengan NIK tersebut tidak ditemukan');
        }
      } else {
        setError(data.pesan || 'Data tidak ditemukan');
        setCaptchaValue('');
        loadCaptcha();
      }
    } catch (err) {
      setError('Gagal mengambil data. Silakan coba lagi.');
      setCaptchaValue('');
      loadCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const isPaid = (bulan) => {
    return pembayaran.some(p => p.bulan_spp === bulan && p.tahun_spp === tahun);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-green-700">{settings.nama_tpq}</h1>
              <p className="text-sm text-gray-600">Santri Qiroati</p>
            </div>
            <div className="flex gap-4">
              <Link href="/" className="text-green-600 hover:text-green-700 text-sm font-medium">
                Beranda
              </Link>
              <Link href="/kotak-saran" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                Kotak Saran
              </Link>
              <Link href="/admin/login" className="text-green-600 hover:text-green-700 text-sm font-medium">
                Login Admin →
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Intro Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Cek Status Pembayaran SPP</h2>
              <p className="text-gray-600">Masukkan NIK untuk melihat riwayat pembayaran santri</p>
            </div>

            {/* Form Pencarian */}
            <form onSubmit={handleCari} className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nomor Induk Kependudukan (NIK)
                  </label>
                  <input
                    type="text"
                    value={nik}
                    onChange={(e) => setNik(e.target.value.replace(/\D/g, ''))}
                    placeholder="Masukkan 16 digit NIK"
                    maxLength="16"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition-colors"
                    required
                  />
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tahun</label>
                  <select
                    value={tahun}
                    onChange={(e) => setTahun(parseInt(e.target.value))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none"
                  >
                    {getYearOptions().map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Captcha</label>
                <div className="flex items-center gap-2 mb-2">
                  {captchaImage ? (
                    <img src={captchaImage} alt="Captcha" className="h-14 rounded border border-gray-200" />
                  ) : (
                    <div className="h-14 w-[220px] rounded border border-gray-200 bg-gray-50" />
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition-colors uppercase"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Mencari...
                  </span>
                ) : (
                  '🔍 Cek Pembayaran'
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}
          </div>

          {/* Hasil Pencarian */}
          {santri && (
            <div className="space-y-6">
              {/* Info Santri */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Informasi Santri</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">NIK</p>
                    <p className="font-semibold text-gray-800">{santri.nik}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Nama Lengkap</p>
                    <p className="font-semibold" style={{ color: santri.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>{santri.nama_lengkap}</p>
                    <p className="text-xs mt-1" style={{ color: santri.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>
                      {santri.is_subsidi ? 'Subsidi' : 'Non Subsidi'}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Jilid</p>
                    <p className="font-semibold text-gray-800">{santri.jilid}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className={`font-semibold ${santri.status_aktif ? 'text-green-600' : 'text-red-600'}`}>
                      {santri.status_aktif ? '✓ Aktif' : '✗ Tidak Aktif'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Pembayaran */}
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Status Pembayaran SPP Tahun {tahun}
                </h3>
                
                <div className="mb-4 p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                  <p className="text-sm text-blue-800">
                    ℹ️ Kewajiban pembayaran dimulai dari bulan pendaftaran: 
                    <span className="font-semibold"> {new Date(santri.tgl_mendaftar).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })}</span>
                  </p>
                </div>
                
                <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
                  {[...Array(12)].map((_, idx) => {
                    const bulan = idx + 1;
                    const paid = isPaid(bulan);
                    
                    // Cek apakah bulan sebelum bulan pendaftaran
                    const tglMendaftar = new Date(santri.tgl_mendaftar);
                    const bulanDaftar = tglMendaftar.getMonth() + 1;
                    const tahunDaftar = tglMendaftar.getFullYear();
                    
                    let isBeforeRegistration = false;
                    if (tahun === tahunDaftar && bulan < bulanDaftar) {
                      isBeforeRegistration = true;
                    } else if (tahun < tahunDaftar) {
                      isBeforeRegistration = true;
                    }
                    
                    // Bulan sebelum pendaftaran - tidak ditampilkan sebagai kewajiban
                    if (isBeforeRegistration) {
                      return (
                        <div
                          key={bulan}
                          className="p-4 rounded-lg text-center bg-purple-50 border-2 border-purple-200"
                        >
                          <p className="text-xs text-purple-600 mb-1">{namaBulan[idx]}</p>
                          <div className="text-2xl text-purple-500">◯</div>
                          <p className="text-xs text-purple-600 mt-1">Belum Terdaftar</p>
                        </div>
                      );
                    }
                    
                    return (
                      <div
                        key={bulan}
                        className={`p-4 rounded-lg text-center transition-all ${
                          paid
                            ? 'bg-green-100 border-2 border-green-500'
                            : 'bg-red-50 border-2 border-red-300'
                        }`}
                      >
                        <p className="text-xs text-gray-600 mb-1">{namaBulan[idx]}</p>
                        <div className={`text-2xl ${paid ? 'text-green-600' : 'text-red-500'}`}>
                          {paid ? '✓' : '✗'}
                        </div>
                        <p className={`text-xs mt-1 ${paid ? 'text-green-600' : 'text-red-600'}`}>
                          {paid ? 'Lunas' : 'Belum'}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Ringkasan */}
                <div className="border-t pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(() => {
                      // Hitung bulan yang wajib dibayar (dari bulan pendaftaran)
                      const tglMendaftar = new Date(santri.tgl_mendaftar);
                      const bulanDaftar = tglMendaftar.getMonth() + 1;
                      const tahunDaftar = tglMendaftar.getFullYear();
                      
                      let totalWajib = 0;
                      if (tahun > tahunDaftar) {
                        totalWajib = 12;
                      } else if (tahun === tahunDaftar) {
                        totalWajib = 12 - bulanDaftar + 1;
                      }
                      
                      const sudahBayar = pembayaran.length;
                      const belumBayar = Math.max(0, totalWajib - sudahBayar);
                      
                      return (
                        <>
                          <div className="text-center p-3 bg-green-50 rounded-lg">
                            <p className="text-sm text-gray-600">Sudah Bayar</p>
                            <p className="text-2xl font-bold text-green-600">{sudahBayar} Bulan</p>
                          </div>
                          <div className="text-center p-3 bg-red-50 rounded-lg">
                            <p className="text-sm text-gray-600">Belum Bayar</p>
                            <p className="text-2xl font-bold text-red-600">{belumBayar} Bulan</p>
                          </div>
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-gray-600">Total Dibayar</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {formatCurrency(pembayaran.reduce((sum, p) => sum + parseFloat(p.nominal), 0))}
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* Riwayat Pembayaran */}
              {pembayaran.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Riwayat Pembayaran Detail</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b-2 border-gray-200">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Tanggal</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Bulan</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Nominal</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">Metode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pembayaran.map((p, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm">
                              {new Date(p.tgl_bayar).toLocaleDateString('id-ID')}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              {namaBulan[p.bulan_spp - 1]} {p.tahun_spp}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-green-600">
                              {formatCurrency(p.nominal)}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-3 py-1 rounded-full text-xs bg-blue-100 text-blue-700">
                                {p.metode_bayar}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-gray-600">
          <p>© {new Date().getFullYear()} TPQ Futuhil Hidayah Wal Hikmah - Santri Qiroati</p>
        </div>
      </footer>
    </div>
  );
}
