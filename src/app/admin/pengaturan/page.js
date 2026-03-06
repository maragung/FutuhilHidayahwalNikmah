'use client';

import { useState, useEffect } from 'react';

export default function PengaturanPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pin, setPin] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  // Email / SMTP state
  const [emailStatus, setEmailStatus] = useState(null);
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState(null);

  const settingsConfig = [
    { key: 'nama_tpq', label: 'Nama TPQ', type: 'text', placeholder: 'Nama TPQ' },
    { key: 'nominal_spp_non_subsidi', label: 'Biaya SPP Non Subsidi (Rp)', type: 'number', placeholder: '40000' },
    { key: 'nominal_spp_subsidi', label: 'Biaya SPP Subsidi (Rp)', type: 'number', placeholder: '30000' },
    { key: 'warna_non_subsidi', label: 'Warna Santri Non Subsidi', type: 'color', placeholder: '#04B816' },
    { key: 'warna_subsidi', label: 'Warna Santri Subsidi', type: 'color', placeholder: '#045EB8' },
    { key: 'tahun_mulai_pembukuan', label: 'Mulai Tahun Pembukuan', type: 'number', placeholder: String(new Date().getFullYear()) },
    { key: 'alamat_tpq', label: 'Alamat TPQ', type: 'textarea', placeholder: 'Alamat lengkap TPQ' },
    { key: 'no_telp_tpq', label: 'No. Telepon TPQ', type: 'text', placeholder: '08xxxxxxxxxx' },
  ];

  useEffect(() => {
    fetchSettings();
    fetchCurrentUser();
    fetchEmailStatus();
  }, []);

  const fetchEmailStatus = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/pengaturan/test-email', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setEmailStatus(data.data);
    } catch { /* ignore */ }
  };

  const handleTestEmail = async () => {
    setTestEmailLoading(true);
    setTestEmailResult(null);
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/pengaturan/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: currentUser?.email }),
      });
      const data = await res.json();
      setTestEmailResult({ success: data.success, message: data.pesan || data.message || (data.success ? 'Berhasil' : 'Gagal') });
      if (data.success) fetchEmailStatus();
    } catch (e) {
      setTestEmailResult({ success: false, message: 'Gagal terhubung ke server' });
    } finally {
      setTestEmailLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setCurrentUser(data.user);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSettings = async () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch('/api/pengaturan', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data.data || {});
      }
    } catch (err) {
      setError('Gagal memuat pengaturan');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveClick = () => {
    setShowPinModal(true);
    setPin('');
  };

  const handleSave = async () => {
    if (!pin) {
      setError('PIN wajib diisi');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    const token = localStorage.getItem('auth_token');

    try {
      const res = await fetch('/api/pengaturan', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ settings, pin })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Pengaturan berhasil disimpan!');
        setShowPinModal(false);
        setPin('');
        fetchEmailStatus(); // refresh status email setelah simpan
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount || 0);
  };

  // Check access
  if (currentUser && !['Pimpinan TPQ', 'Bendahara'].includes(currentUser.jabatan)) {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h2 className="text-xl font-semibold text-gray-700">Akses Terbatas</h2>
        <p className="text-gray-500 mt-2">Hanya Pimpinan TPQ dan Bendahara yang dapat mengakses pengaturan</p>
      </div>
    );
  }

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
        <h1 className="text-2xl font-bold text-gray-800">Pengaturan</h1>
        <p className="text-gray-500">Konfigurasi sistem TPQ</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pengaturan Umum */}
        <div className="lg:col-span-2 card">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Pengaturan Umum
          </h3>
          <div className="space-y-4">
            {settingsConfig.map(config => (
              <div key={config.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {config.label}
                </label>
                {config.type === 'textarea' ? (
                  <textarea
                    value={settings[config.key] || ''}
                    onChange={(e) => handleChange(config.key, e.target.value)}
                    placeholder={config.placeholder}
                    rows={3}
                    className="input-field"
                  />
                ) : config.type === 'color' ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={settings[config.key] || config.placeholder}
                      onChange={(e) => handleChange(config.key, e.target.value)}
                      className="h-11 w-16 border border-gray-200 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings[config.key] || ''}
                      onChange={(e) => handleChange(config.key, e.target.value)}
                      placeholder={config.placeholder}
                      className="input-field"
                    />
                  </div>
                ) : (
                  <input
                    type={config.type}
                    value={settings[config.key] || ''}
                    onChange={(e) => handleChange(config.key, e.target.value)}
                    placeholder={config.placeholder}
                    className="input-field"
                  />
                )}
              </div>
            ))}

            {settings.nominal_spp_non_subsidi && settings.nominal_spp_subsidi && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-700">
                  SPP Non Subsidi: <span className="font-bold">{formatCurrency(settings.nominal_spp_non_subsidi)}</span>
                </p>
                <p className="text-sm text-blue-700 mt-1">
                  SPP Subsidi: <span className="font-bold">{formatCurrency(settings.nominal_spp_subsidi)}</span>
                </p>
              </div>
            )}

            <button
              onClick={handleSaveClick}
              className="btn btn-primary w-full"
            >
              Simpan Pengaturan
            </button>
          </div>
        </div>

        {/* Informasi */}
        <div className="space-y-4">
          <div className="card bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Informasi
            </h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>Simpan pengaturan memerlukan verifikasi PIN akun Anda</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>Perubahan nominal SPP hanya berlaku untuk pembayaran baru</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>Warna digunakan untuk membedakan status subsidi santri</span>
              </li>
            </ul>
          </div>

          <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              PIN Akun
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              PIN digunakan untuk verifikasi setiap transaksi. Ubah PIN melalui halaman <strong>Akun</strong>.
            </p>
            <a
              href="/admin/akun"
              className="btn btn-secondary w-full text-center text-sm"
            >
              Ke Halaman Akun →
            </a>
          </div>
        </div>
      </div>

      {/* Notifikasi Email */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Notifikasi Email
        </h3>

        {/* Status + info baris atas */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {emailStatus === null ? (
            <span className="text-xs px-3 py-1 rounded-full bg-gray-100 text-gray-500">Memeriksa...</span>
          ) : emailStatus.configured ? (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium bg-green-100 text-green-700">
              <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
              Server aktif
              {emailStatus.source && <span className="opacity-70">· {emailStatus.source}</span>}
              {emailStatus.host && <span className="opacity-70">· {emailStatus.host}</span>}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full font-medium bg-red-100 text-red-600">
              <span className="w-2 h-2 rounded-full bg-red-500 inline-block"></span>
              Server tidak aktif
            </span>
          )}
          <button
            onClick={fetchEmailStatus}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            title="Refresh status"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Email pemberitahuan dikirim ke admin yang mengaktifkan <strong>Terima email perubahan</strong> di halaman Akun.
          Kredensial SMTP dikonfigurasi melalui environment variable / Vercel.
          Opsi di bawah hanya untuk override host dan port jika diperlukan.
        </p>

        {/* Override host + port (opsional) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SMTP Host <span className="text-xs text-gray-400 font-normal">(opsional, override env)</span>
            </label>
            <input
              type="text"
              value={settings.smtp_host || ''}
              onChange={(e) => handleChange('smtp_host', e.target.value)}
              placeholder="Kosongkan untuk pakai env var"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SMTP Port <span className="text-xs text-gray-400 font-normal">(opsional, override env)</span>
            </label>
            <input
              type="number"
              value={settings.smtp_port || ''}
              onChange={(e) => handleChange('smtp_port', e.target.value)}
              placeholder="587"
              className="input-field"
            />
          </div>
        </div>

        {/* Hasil test email */}
        {testEmailResult && (
          <div className={`p-3 rounded-lg border mb-4 text-sm ${testEmailResult.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {testEmailResult.success ? '✓ ' : '✗ '}{testEmailResult.message}
            {testEmailResult.success && currentUser?.email && (
              <span className="text-green-600 ml-1">→ {currentUser.email}</span>
            )}
          </div>
        )}

        {/* Tombol test */}
        <button
          onClick={handleTestEmail}
          disabled={testEmailLoading || !emailStatus?.configured}
          className="btn btn-secondary flex items-center gap-2 text-sm"
          title={!emailStatus?.configured ? 'SMTP belum terkonfigurasi' : `Kirim ke ${currentUser?.email || 'email Anda'}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          {testEmailLoading ? 'Mengirim...' : `Kirim Email Test${currentUser?.email ? ` ke ${currentUser.email}` : ''}`}
        </button>
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Verifikasi PIN</h3>
            <p className="text-gray-600 mb-4">Masukkan PIN untuk menyimpan perubahan pengaturan.</p>
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
                onClick={handleSave}
                disabled={saving || !pin}
                className="btn btn-primary flex-1"
              >
                {saving ? 'Menyimpan...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
