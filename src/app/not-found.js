import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center">
        <div className="text-8xl font-extrabold text-primary-200 mb-2">404</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Halaman Tidak Ditemukan
        </h1>
        <p className="text-gray-500 mb-8">
          Halaman yang Anda cari tidak ada atau telah dipindahkan.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
        >
          ← Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}
