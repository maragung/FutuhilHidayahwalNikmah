'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [captchaValue, setCaptchaValue] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaImage, setCaptchaImage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, captcha_token: captchaToken, captcha_value: captchaValue }),
      });

      const data = await res.json();

      if (data.success) {
        // Simpan token di localStorage
        localStorage.setItem('auth_token', data.data.token);
        localStorage.setItem('admin_data', JSON.stringify(data.data.user));
        router.push('/admin/dashboard');
      } else {
        setError(data.pesan || 'Login gagal');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center justify-center gap-3 mb-8">
          <div className="w-14 h-14 bg-green-600 rounded-full flex items-center justify-center">
            <span className="text-white text-2xl font-bold">ف</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-green-800">TPQ Futuhil Hidayah</h1>
            <p className="text-sm text-gray-500">Wal Hikmah - Santri Qiroati</p>
          </div>
        </Link>

        <div className="card">
          <h2 className="text-xl font-bold text-gray-800 text-center mb-6">Login Admin</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Captcha</label>
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
                className="input-field uppercase"
                placeholder="Masukkan 6 karakter captcha"
                required
                maxLength={6}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Memproses...</span>
                </>
              ) : (
                <span>Login</span>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-gray-500 mt-6">
          <Link href="/" className="text-green-600 hover:text-green-700">
            ← Kembali ke Beranda
          </Link>
        </p>
      </div>
    </div>
  );
}
