'use client';

import { useMemo, useState } from 'react';

export default function ExportDatabasePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const user = useMemo(() => {
    if (typeof window === 'undefined') return null;
    try { return JSON.parse(localStorage.getItem('admin_data') || 'null'); } catch { return null; }
  }, []);

  const allowed = ['Pimpinan TPQ', 'Sekretaris', 'Bendahara'].includes(user?.jabatan);

  const handleExport = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/export/database', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.pesan || 'Gagal export database');
        return;
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      a.href = url;
      a.download = `backup-database-${ts}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setSuccess('Export database berhasil diunduh.');
    } catch {
      setError('Gagal export database');
    } finally {
      setLoading(false);
    }
  };

  if (!allowed) {
    return (
      <div className="card">
        <h1 className="text-xl font-bold text-gray-800">Export Database</h1>
        <p className="text-gray-500 mt-2">Akses hanya untuk Pimpinan TPQ, Sekretaris, dan Bendahara.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Export Database</h1>
        <p className="text-gray-500">Unduh snapshot data seluruh tabel dalam format JSON</p>
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700">{error}</div>}
      {success && <div className="p-3 bg-green-50 border border-green-200 rounded text-green-700">{success}</div>}

      <div className="card space-y-4">
        <p className="text-sm text-gray-600">File berisi semua tabel. Simpan di lokasi aman karena mengandung data sensitif.</p>
        <button onClick={handleExport} disabled={loading} className="btn btn-primary">
          {loading ? 'Memproses Export...' : 'Export Database (.json)'}
        </button>
      </div>
    </div>
  );
}
