'use client';

import { useEffect } from 'react';

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Terjadi Kesalahan
        </h1>
        <p className="text-gray-500 mb-6">
          {error?.message
            ? 'Maaf, terjadi kesalahan yang tidak terduga. Silakan coba lagi.'
            : 'Maaf, halaman ini tidak dapat ditampilkan saat ini.'}
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            Coba Lagi
          </button>
          <a
            href="/"
            className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Kembali ke Beranda
          </a>
        </div>
      </div>
    </div>
  );
}
