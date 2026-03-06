'use client';

import { useState, useEffect, useCallback } from 'react';

export default function AkunPage() {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  // QR / Deep-link state
  const [loginPassword, setLoginPassword] = useState('');
  const [qrPassword, setQrPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [deepLink, setDeepLink] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Profile edit state
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState({ username: '', nama_lengkap: '', email: '', terima_email_perubahan: false });
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Password change state
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [pwdData, setPwdData] = useState({ password: '', konfirmasi: '' });
  const [pwdPin, setPwdPin] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // PIN change state
  const [showChangePin, setShowChangePin] = useState(false);
  const [pinSetup, setPinSetup] = useState({ password: '', newPin: '', confirmPin: '' });
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [hasPin, setHasPin] = useState(null);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null);

  const fetchUser = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) {
        const currentUser = data.user || data.data || null;
        if (!currentUser) return;
        setUser(currentUser);
        setEditData({
          username: currentUser.username || '',
          nama_lengkap: currentUser.nama_lengkap || '',
          email: currentUser.email || '',
          terima_email_perubahan: Boolean(currentUser.terima_email_perubahan),
        });
        const stored = JSON.parse(localStorage.getItem('admin_data') || '{}');
        localStorage.setItem('admin_data', JSON.stringify({ ...stored, ...currentUser }));
      }
    } catch {
      setError('Gagal memuat data akun');
    } finally {
      setLoadingUser(false);
    }
  }, []);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  const fetchHasPin = useCallback(async () => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch('/api/admin/pin', { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setHasPin(data.has_pin);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchHasPin(); }, [fetchHasPin]);

  const handleSetPin = async () => {
    if (!pinSetup.password) { setPinError('Password akun wajib diisi'); return; }
    if (!pinSetup.newPin) { setPinError('PIN baru wajib diisi'); return; }
    if (!/^\d{6}$/.test(pinSetup.newPin)) { setPinError('PIN harus tepat 6 digit angka'); return; }
    if (pinSetup.newPin !== pinSetup.confirmPin) { setPinError('Konfirmasi PIN tidak cocok'); return; }

    setPinError(''); setPinSuccess('');
    setPinLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/admin/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: pinSetup.password, new_pin: pinSetup.newPin }),
      });
      const data = await res.json();
      if (data.success) {
        setPinSuccess('PIN berhasil diperbarui!');
        setShowChangePin(false);
        setPinSetup({ password: '', newPin: '', confirmPin: '' });
        setHasPin(true);
      } else {
        setPinError(data.pesan || 'Gagal memperbarui PIN');
      }
    } catch { setPinError('Terjadi kesalahan'); }
    finally { setPinLoading(false); }
  };

  // === QR / DEEP LINK ===
  const handleLoginApp = async () => {
    setError(''); setSuccess('');
    setLoading(true);
    try {
      const token = getToken();
      const resMe = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      const me = await resMe.json();
      if (!me.success) { setError('Gagal mengambil data akun'); return; }
      const currentUsername = me.user?.username || me.data?.username;
      if (!currentUsername) { setError('Username tidak ditemukan'); return; }

      const res = await fetch('/api/auth/app-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: currentUsername, password: loginPassword }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.pesan || 'Password tidak valid'); return; }

      setDeepLink(data.data.deep_link);
      setSuccess('Password valid. Buka tautan di bawah atau scan QR untuk login.');
      window.location.href = data.data.deep_link;
    } catch { setError('Gagal memproses login app'); }
    finally { setLoading(false); }
  };

  const handleGenerateQr = async () => {
    setError(''); setSuccess('');
    setQrLoading(true);
    try {
      const token = getToken();
      const res = await fetch('/api/auth/qr-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: qrPassword }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.pesan || 'Password tidak valid'); return; }

      setQrDataUrl(data.data.qr_data_url);
      setDeepLink(data.data.deep_link);
      setSuccess(`QR login berhasil dibuat. Server: ${data.data.server_url}`);
    } catch { setError('Gagal membuat QR login'); }
    finally { setQrLoading(false); }
  };

  // === PROFILE EDIT ===
  const handleSaveProfile = async () => {
    if (!editData.username || !editData.nama_lengkap || !editData.email) {
      setEditError('Username, nama, dan email wajib diisi'); return;
    }
    setEditError(''); setEditSuccess('');
    setEditLoading(true);
    try {
      const userId = user?.id || JSON.parse(localStorage.getItem('admin_data') || '{}')?.id;
      if (!userId) {
        setEditError('Data akun tidak lengkap, silakan login ulang');
        return;
      }
      const token = getToken();
      const res = await fetch(`/api/admin/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: editData.username,
          nama_lengkap: editData.nama_lengkap,
          email: editData.email,
          terima_email_perubahan: Boolean(editData.terima_email_perubahan),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditSuccess('Profil berhasil diperbarui');
        setEditMode(false);
        fetchUser();
      } else {
        setEditError(data.pesan || 'Gagal memperbarui profil');
      }
    } catch { setEditError('Terjadi kesalahan'); }
    finally { setEditLoading(false); }
  };

  // === GANTI PASSWORD ===
  const handleChangePassword = async () => {
    if (!pwdData.password || pwdData.password.length < 6) {
      setPwdError('Password minimal 6 karakter'); return;
    }
    if (pwdData.password !== pwdData.konfirmasi) {
      setPwdError('Konfirmasi password tidak cocok'); return;
    }
    if (!pwdPin) { setPwdError('PIN wajib diisi'); return; }

    setPwdError(''); setPwdSuccess('');
    setPwdLoading(true);
    try {
      const token = getToken();
      const userId = user?.id || JSON.parse(localStorage.getItem('admin_data') || '{}')?.id;
      if (!userId) {
        setPwdError('Data akun tidak lengkap, silakan login ulang');
        return;
      }
      const res = await fetch(`/api/admin/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: pwdData.password, verify_pin: pwdPin }),
      });
      const data = await res.json();
      if (data.success) {
        setPwdSuccess('Password berhasil diubah');
        setShowChangePwd(false);
        setPwdData({ password: '', konfirmasi: '' });
        setPwdPin('');
      } else {
        setPwdError(data.pesan || 'Gagal mengubah password');
      }
    } catch { setPwdError('Terjadi kesalahan'); }
    finally { setPwdLoading(false); }
  };

  if (loadingUser) {
    return (
      <div className="flex justify-center py-12">
        <svg className="animate-spin h-8 w-8 text-green-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Akun</h1>
        <p className="text-gray-500">Kelola profil, keamanan, dan login ke aplikasi Android</p>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">{error}<button onClick={() => setError('')} className="ml-2 font-bold">✕</button></div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700">{success}<button onClick={() => setSuccess('')} className="ml-2 font-bold">✕</button></div>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* === PROFIL === */}
        <div className="card space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-800">Profil Akun</h3>
            <button
              onClick={() => { setEditMode(!editMode); setEditError(''); setEditSuccess(''); }}
              className="text-sm text-blue-600 hover:underline"
            >
              {editMode ? 'Batal' : 'Edit'}
            </button>
          </div>

          {editSuccess && <div className="p-2 bg-green-50 rounded text-green-700 text-sm">{editSuccess}</div>}
          {editError && <div className="p-2 bg-red-50 rounded text-red-700 text-sm">{editError}</div>}

          {editMode ? (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                <input
                  type="text"
                  value={editData.username}
                  onChange={(e) => setEditData({ ...editData, username: e.target.value.toLowerCase() })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  value={editData.nama_lengkap}
                  onChange={(e) => setEditData({ ...editData, nama_lengkap: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editData.email}
                  onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                  className="input-field"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean(editData.terima_email_perubahan)}
                  onChange={(e) => setEditData({ ...editData, terima_email_perubahan: e.target.checked })}
                />
                Terima email perubahan
              </label>
              <div className="flex gap-2">
                <button onClick={handleSaveProfile} disabled={editLoading} className="btn btn-primary">
                  {editLoading ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button onClick={() => {
                  setEditMode(false);
                  setEditData({
                    username: user?.username || '',
                    nama_lengkap: user?.nama_lengkap || '',
                    email: user?.email || '',
                    terima_email_perubahan: Boolean(user?.terima_email_perubahan),
                  });
                }} className="btn btn-secondary">
                  Batal
                </button>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-700 space-y-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                  <span className="text-green-700 font-bold text-xl">{user?.nama_lengkap?.charAt(0) || 'A'}</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{user?.nama_lengkap || '-'}</p>
                  <p className="text-xs text-gray-500">{user?.jabatan || '-'}</p>
                </div>
              </div>
              <p><span className="font-medium">Username:</span> {user?.username || '-'}</p>
              <p><span className="font-medium">Email:</span> {user?.email || '-'}</p>
              <p><span className="font-medium">Terima email perubahan:</span> {user?.terima_email_perubahan ? 'Aktif' : 'Nonaktif'}</p>
            </div>
          )}

          <hr />

          {/* Ubah PIN */}
          <div>
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setShowChangePin(!showChangePin); setPinError(''); setPinSuccess(''); }}
                className="text-sm text-purple-600 hover:underline font-medium"
              >
                {showChangePin ? '✕ Tutup' : '🔑 Ubah PIN'}
              </button>
              {hasPin === false && (
                <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">PIN belum diatur</span>
              )}
              {hasPin === true && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">PIN aktif</span>
              )}
            </div>

            {showChangePin && (
              <div className="mt-3 space-y-3">
                {pinSuccess && <div className="p-2 bg-green-50 rounded border border-green-200 text-green-700 text-sm">{pinSuccess}</div>}
                {pinError && <div className="p-2 bg-red-50 rounded border border-red-200 text-red-700 text-sm">{pinError}</div>}
                {!pinSuccess && (
                  <>
                    <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                      <p className="text-xs text-purple-700">
                        PIN digunakan untuk verifikasi setiap transaksi (pembayaran, pengeluaran, infak, dll).
                        {hasPin ? ' Masukkan password untuk mengubah PIN.' : ' Atur PIN Anda sekarang.'}
                      </p>
                    </div>
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
                      <label className="block text-sm font-medium text-gray-700 mb-1">PIN Baru <span className="text-red-500">*</span> (6 digit)</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinSetup.newPin}
                        onChange={(e) => setPinSetup({ ...pinSetup, newPin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        placeholder="6 digit angka"
                        className="input-field tracking-widest text-center text-lg"
                        maxLength={6}
                      />
                      <p className="text-xs text-gray-400 mt-1">{pinSetup.newPin.length}/6 digit</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi PIN Baru</label>
                      <input
                        type="password"
                        inputMode="numeric"
                        value={pinSetup.confirmPin}
                        onChange={(e) => setPinSetup({ ...pinSetup, confirmPin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                        placeholder="Ulangi PIN baru"
                        className="input-field tracking-widest text-center text-lg"
                        maxLength={6}
                      />
                      {pinSetup.newPin && pinSetup.confirmPin && (
                        <p className={`text-xs mt-1 ${pinSetup.newPin === pinSetup.confirmPin ? 'text-green-600' : 'text-red-500'}`}>
                          {pinSetup.newPin === pinSetup.confirmPin ? '✓ PIN cocok' : '✗ PIN tidak cocok'}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={handleSetPin}
                      disabled={pinLoading || pinSetup.newPin.length < 6}
                      className="btn btn-primary w-full"
                    >
                      {pinLoading ? 'Menyimpan...' : (hasPin ? 'Perbarui PIN' : 'Atur PIN')}
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          <hr />

          {/* Ganti Password */}
          <div>
            <button
              onClick={() => { setShowChangePwd(!showChangePwd); setPwdError(''); setPwdSuccess(''); }}
              className="text-sm text-orange-600 hover:underline font-medium"
            >
              {showChangePwd ? '✕ Tutup' : '🔒 Ganti Password'}
            </button>

            {showChangePwd && (
              <div className="mt-3 space-y-3">
                {pwdSuccess && <div className="p-2 bg-green-50 rounded text-green-700 text-sm">{pwdSuccess}</div>}
                {pwdError && <div className="p-2 bg-red-50 rounded text-red-700 text-sm">{pwdError}</div>}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                  <input
                    type="password"
                    value={pwdData.password}
                    onChange={(e) => setPwdData({ ...pwdData, password: e.target.value })}
                    placeholder="Minimal 6 karakter"
                    className="input-field"
                    minLength={6}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
                  <input
                    type="password"
                    value={pwdData.konfirmasi}
                    onChange={(e) => setPwdData({ ...pwdData, konfirmasi: e.target.value })}
                    placeholder="Ulangi password baru"
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">PIN Verifikasi</label>
                  <input
                    type="password"
                    value={pwdPin}
                    onChange={(e) => setPwdPin(e.target.value)}
                    placeholder="Masukkan PIN Anda"
                    className="input-field"
                    maxLength={8}
                  />
                </div>
                <button onClick={handleChangePassword} disabled={pwdLoading} className="btn btn-primary w-full">
                  {pwdLoading ? 'Menyimpan...' : 'Simpan Password Baru'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* === QR LOGIN APP === */}
        <div className="card space-y-4">
          <h3 className="font-semibold text-gray-800">QR Login Aplikasi Android</h3>
          <p className="text-sm text-gray-600">
            Buat QR code untuk login ke aplikasi Android. Scan dengan kamera aplikasi.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password untuk Generate QR</label>
            <input
              type="password"
              className="input-field"
              placeholder="Masukkan password"
              value={qrPassword}
              onChange={(e) => setQrPassword(e.target.value)}
            />
          </div>
          <button
            onClick={handleGenerateQr}
            disabled={qrLoading || !qrPassword}
            className="btn btn-primary w-full"
          >
            {qrLoading ? 'Membuat QR...' : 'Buat QR Login'}
          </button>

          {qrDataUrl && (
            <div className="text-center">
              <img src={qrDataUrl} alt="QR Login App" className="mx-auto rounded border" />
              <p className="text-xs text-gray-500 mt-2">Scan di aplikasi Android untuk login otomatis</p>
            </div>
          )}
        </div>

        {/* === LOGIN DEEP LINK === */}
        <div className="card space-y-4 lg:col-span-2">
          <h3 className="font-semibold text-gray-800">Login Langsung via Deep Link</h3>
          <p className="text-sm text-gray-600">Buka tautan untuk login ke aplikasi Android di perangkat ini (ada jeda proses 3 detik).</p>

          <div className="flex gap-3">
            <input
              type="password"
              className="input-field flex-1"
              placeholder="Masukkan password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
            />
            <button onClick={handleLoginApp} disabled={loading || !loginPassword} className="btn btn-secondary whitespace-nowrap">
              {loading ? 'Memverifikasi...' : 'Buka Aplikasi'}
            </button>
          </div>

          {deepLink && (
            <div className="p-3 bg-gray-50 rounded text-xs break-all">
              <p className="font-semibold text-gray-700 mb-1">Deep Link:</p>
              <a href={deepLink} className="text-blue-600 hover:underline">{deepLink}</a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
