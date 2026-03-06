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
  const [pinSetup, setPinSetup] = useState({ show: false, password: '', newPin: '', confirmPin: '' });

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
  }, []);

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
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const handleSetPin = async () => {
    if (!pinSetup.password || !pinSetup.newPin) {
      setError('Password dan PIN baru wajib diisi');
      return;
    }
    if (pinSetup.newPin !== pinSetup.confirmPin) {
      setError('PIN baru dan konfirmasi tidak cocok');
      return;
    }
    if (!/^\d{6}$/.test(pinSetup.newPin)) {
      setError('PIN harus 6 digit angka');
      return;
    }

    setSaving(true);
    setError('');
    const token = localStorage.getItem('auth_token');

    try {
      const res = await fetch('/api/admin/pin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          password: pinSetup.password,
          new_pin: pinSetup.newPin,
        })
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('PIN berhasil diperbarui!');
        setPinSetup({ show: false, password: '', newPin: '', confirmPin: '' });
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal mengatur PIN');
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pengaturan Umum */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Pengaturan Umum</h3>
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
              <div className="p-3 bg-blue-50 rounded-lg">
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

        {/* PIN Management */}
        <div className="space-y-6">
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-4">Pengaturan PIN</h3>
            <p className="text-sm text-gray-600 mb-4">
              PIN digunakan untuk verifikasi setiap transaksi (pembayaran, pengeluaran, infak, dll). 
              PIN default adalah <strong>123456</strong>.
            </p>
            
            {!pinSetup.show ? (
              <button
                onClick={() => setPinSetup({ show: true, password: '', newPin: '', confirmPin: '' })}
                className="btn btn-primary w-full"
              >
                Ubah PIN
              </button>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password Akun</label>
                  <input
                    type="password"
                    value={pinSetup.password}
                    onChange={(e) => setPinSetup({ ...pinSetup, password: e.target.value })}
                    placeholder="Masukkan password akun Anda"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIN Baru (6 digit)</label>
                  <input
                    type="password"
                    value={pinSetup.newPin}
                    onChange={(e) => setPinSetup({ ...pinSetup, newPin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    placeholder="Masukkan PIN baru"
                    className="input-field"
                    maxLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi PIN</label>
                  <input
                    type="password"
                    value={pinSetup.confirmPin}
                    onChange={(e) => setPinSetup({ ...pinSetup, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    placeholder="Ulangi PIN baru"
                    className="input-field"
                    maxLength={6}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSetPin}
                    disabled={saving}
                    className="btn btn-primary flex-1"
                  >
                    {saving ? 'Menyimpan...' : 'Simpan PIN'}
                  </button>
                  <button
                    onClick={() => setPinSetup({ show: false, password: '', newPin: '', confirmPin: '' })}
                    className="btn btn-secondary flex-1"
                  >
                    Batal
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200">
            <h3 className="font-semibold text-gray-800 mb-2">Informasi</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">&#9679;</span>
                <span>Biaya SPP subsidi/non subsidi dan warna audit bisa diubah dengan PIN</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">&#9679;</span>
                <span>Setiap perubahan pengaturan memerlukan verifikasi PIN</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">&#9679;</span>
                <span>Perubahan nominal SPP hanya berlaku untuk pembayaran baru</span>
              </li>
            </ul>
          </div>
        </div>
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
