'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function KotakSaranPage() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    nama_pengirim: '',
    email_pengirim: '',
    no_telp_pengirim: '',
    kategori: 'Saran',
    isi_saran: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.isi_saran.length < 10) {
      setError('Isi saran minimal 10 karakter');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const res = await fetch('/api/saran', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(true);
        setFormData({
          nama_pengirim: '',
          email_pengirim: '',
          no_telp_pengirim: '',
          kategori: 'Saran',
          isi_saran: '',
        });
      } else {
        setError(data.pesan || 'Gagal mengirim saran');
      }
    } catch (err) {
      setError('Gagal mengirim saran. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-blue-50 to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-green-700">TPQ Futuhil Hidayah Wal Hikmah</h1>
              <p className="text-sm text-gray-600">Santri Qiroati</p>
            </div>
            <div className="flex gap-4">
              <Link href="/" className="text-green-600 hover:text-green-700 text-sm font-medium">
                Beranda
              </Link>
              <Link href="/cek-pembayaran" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                Cek Pembayaran
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
        <div className="max-w-3xl mx-auto">
          {/* Intro Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-gradient-to-br from-green-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-3">Kotak Saran & Masukan</h2>
              <p className="text-gray-600 leading-relaxed">
                Sampaikan saran, kritik, atau pertanyaan Anda untuk membantu kami meningkatkan pelayanan TPQ.
                <br />
                Semua masukan akan diterima oleh pengurus dan ditindaklanjuti dengan baik.
              </p>
            </div>

            {/* Success Message */}
            {success && (
              <div className="mb-6 p-5 bg-green-50 border-2 border-green-200 rounded-xl">
                <div className="flex items-start">
                  <svg className="w-6 h-6 text-green-600 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-semibold text-green-800">Terima kasih atas masukan Anda!</p>
                    <p className="text-green-700 text-sm mt-1">
                      Saran Anda telah kami terima dan akan segera ditindaklanjuti oleh pengurus TPQ.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-6 p-5 bg-red-50 border-2 border-red-200 rounded-xl">
                <div className="flex items-start">
                  <svg className="w-6 h-6 text-red-600 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-semibold text-red-800">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="nama_pengirim"
                    value={formData.nama_pengirim}
                    onChange={handleChange}
                    placeholder="Nama Anda"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition-colors"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email (Opsional)
                  </label>
                  <input
                    type="email"
                    name="email_pengirim"
                    value={formData.email_pengirim}
                    onChange={handleChange}
                    placeholder="email@contoh.com"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    No. Telepon (Opsional)
                  </label>
                  <input
                    type="tel"
                    name="no_telp_pengirim"
                    value={formData.no_telp_pengirim}
                    onChange={handleChange}
                    placeholder="08xxxxxxxxxx"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Kategori <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="kategori"
                    value={formData.kategori}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition-colors"
                    required
                  >
                    <option value="Saran">💡 Saran</option>
                    <option value="Kritik">📝 Kritik</option>
                    <option value="Pertanyaan">❓ Pertanyaan</option>
                    <option value="Lainnya">📋 Lainnya</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Isi Saran / Masukan <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="isi_saran"
                  value={formData.isi_saran}
                  onChange={handleChange}
                  placeholder="Tuliskan saran, kritik, atau pertanyaan Anda di sini... (minimal 10 karakter)"
                  rows="6"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:outline-none transition-colors resize-none"
                  required
                  minLength="10"
                ></textarea>
                <p className="text-xs text-gray-500 mt-2">
                  {formData.isi_saran.length} karakter
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none shadow-lg"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Mengirim...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Kirim Saran
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
            <div className="flex items-start">
              <svg className="w-6 h-6 text-blue-600 mr-3 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-semibold text-blue-900 mb-2">Informasi Penting</p>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>✓ Saran Anda akan dikirim langsung ke pengurus TPQ</li>
                  <li>✓ Notifikasi email otomatis dikirim ke semua admin</li>
                  <li>✓ Identitas Anda akan dijaga kerahasiaannya</li>
                  <li>✓ Kami akan menindaklanjuti setiap masukan dengan serius</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className="container mx-auto px-4 py-6 text-center text-gray-600 text-sm">
          <p>&copy; {new Date().getFullYear()} TPQ Futuhil Hidayah Wal Hikmah - Santri Qiroati</p>
        </div>
      </footer>
    </div>
  );
}
