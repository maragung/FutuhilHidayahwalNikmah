'use client';

import { useState, useEffect, useCallback } from 'react';

const EMPTY_SERVER = {
  nama: '',
  tipe: 'primary',
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_pass: '',
  smtp_from: '',
  smtp_secure: false,
};

export default function NotifikasiEmailPage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [servers, setServers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logStats, setLogStats] = useState({ total: 0, sukses: 0, gagal: 0 });
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_SERVER });
  const [pin, setPin] = useState('');
  const [saving, setSaving] = useState(false);

  // Test email
  const [testEmailLoading, setTestEmailLoading] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deletePin, setDeletePin] = useState('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : '';
  const headers = { Authorization: `Bearer ${token}` };
  const jsonHeaders = { ...headers, 'Content-Type': 'application/json' };

  useEffect(() => {
    fetchCurrentUser();
  }, []);

  useEffect(() => {
    if (currentUser?.jabatan === 'Developer') {
      fetchServers();
      fetchLogs(1);
    }
  }, [currentUser]);

  const fetchCurrentUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { headers });
      const data = await res.json();
      if (data.success) setCurrentUser(data.user);
    } catch { /* ignore */ }
    setLoading(false);
  };

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/email-server', { headers });
      const data = await res.json();
      if (data.success) setServers(data.data || []);
    } catch { /* ignore */ }
  };

  const fetchLogs = async (page = 1) => {
    try {
      const res = await fetch(`/api/email-log?page=${page}&limit=20`, { headers });
      const data = await res.json();
      if (data.success) {
        setLogs(data.data || []);
        setLogStats(data.stats || { total: 0, sukses: 0, gagal: 0 });
        setLogPage(data.pagination?.page || 1);
        setLogTotalPages(data.pagination?.totalPages || 1);
      }
    } catch { /* ignore */ }
  };

  // ── Form handlers ──────────────────────────────────────
  const openAddForm = (tipe = 'primary') => {
    setEditingId(null);
    setForm({ ...EMPTY_SERVER, tipe });
    setPin('');
    setShowForm(true);
    setError('');
  };

  const openEditForm = (server) => {
    setEditingId(server.id);
    setForm({
      nama: server.nama,
      tipe: server.tipe,
      smtp_host: server.smtp_host,
      smtp_port: server.smtp_port,
      smtp_user: server.smtp_user,
      smtp_pass: '', // Tidak tampilkan password lama
      smtp_from: server.smtp_from || '',
      smtp_secure: server.smtp_secure,
    });
    setPin('');
    setShowForm(true);
    setError('');
  };

  const handleSave = async () => {
    if (!pin) { setError('PIN wajib diisi'); return; }
    if (!form.nama || !form.smtp_host || !form.smtp_user) {
      setError('Nama, SMTP Host, dan Email wajib diisi'); return;
    }
    if (!editingId && !form.smtp_pass) {
      setError('Password SMTP wajib diisi untuk server baru'); return;
    }

    setSaving(true);
    setError('');
    try {
      const url = editingId ? `/api/email-server/${editingId}` : '/api/email-server';
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: jsonHeaders,
        body: JSON.stringify({ ...form, pin }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.pesan);
        setShowForm(false);
        setPin('');
        fetchServers();
      } else {
        setError(data.pesan);
      }
    } catch {
      setError('Gagal menyimpan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletePin || !deleteTarget) return;
    try {
      const res = await fetch(`/api/email-server/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: jsonHeaders,
        body: JSON.stringify({ pin: deletePin }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.pesan);
        setDeleteTarget(null);
        setDeletePin('');
        fetchServers();
      } else {
        setError(data.pesan);
      }
    } catch {
      setError('Gagal menghapus');
    }
  };

  const handleTestEmail = async () => {
    setTestEmailLoading(true);
    setTestEmailResult(null);
    try {
      const res = await fetch('/api/pengaturan/test-email', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ email: currentUser?.email }),
      });
      const data = await res.json();
      setTestEmailResult({
        success: data.success,
        message: data.pesan || data.message || (data.success ? 'Berhasil' : 'Gagal'),
      });
      if (data.success) fetchLogs(1);
    } catch {
      setTestEmailResult({ success: false, message: 'Gagal terhubung' });
    } finally {
      setTestEmailLoading(false);
    }
  };

  const handleExportLogs = () => {
    window.open(`/api/email-log?export=json`, '_blank');
  };

  // ── Access check ───────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-10 w-10 text-purple-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (!currentUser || currentUser.jabatan !== 'Developer') {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h2 className="text-xl font-semibold text-gray-700">Akses Terbatas</h2>
        <p className="text-gray-500 mt-2">Hanya Developer yang dapat mengakses konfigurasi Notifikasi Email</p>
      </div>
    );
  }

  const primaryServers = servers.filter(s => s.tipe === 'primary');
  const backupServers  = servers.filter(s => s.tipe === 'backup');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Notifikasi Email</h1>
        <p className="text-gray-500">Kelola server SMTP utama & cadangan untuk pengiriman pemberitahuan CRUD</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}<button onClick={() => setError('')} className="ml-2">✕</button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}<button onClick={() => setSuccess('')} className="ml-2">✕</button>
        </div>
      )}

      {/* ═══ Server Utama ═══ */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500"></span>
            Server Utama (Primary)
          </h3>
          <button onClick={() => openAddForm('primary')} className="btn btn-primary text-sm">
            + Tambah Server Utama
          </button>
        </div>
        {primaryServers.length === 0 ? (
          <p className="text-gray-400 text-sm">Belum ada server utama. Tambahkan untuk mulai mengirim email.</p>
        ) : (
          <div className="space-y-3">
            {primaryServers.map(srv => (
              <ServerCard key={srv.id} server={srv} onEdit={openEditForm} onDelete={setDeleteTarget} />
            ))}
          </div>
        )}
      </div>

      {/* ═══ Server Cadangan ═══ */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            Server Cadangan (Backup)
          </h3>
          <button onClick={() => openAddForm('backup')} className="btn btn-secondary text-sm">
            + Tambah Server Cadangan
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Jika server utama gagal mengirim, sistem otomatis mencoba server cadangan secara berurutan.
        </p>
        {backupServers.length === 0 ? (
          <p className="text-gray-400 text-sm">Belum ada server cadangan.</p>
        ) : (
          <div className="space-y-3">
            {backupServers.map(srv => (
              <ServerCard key={srv.id} server={srv} onEdit={openEditForm} onDelete={setDeleteTarget} />
            ))}
          </div>
        )}
      </div>

      {/* ═══ Test Email ═══ */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
          Test Pengiriman Email
        </h3>
        {testEmailResult && (
          <div className={`p-3 rounded-lg border mb-3 text-sm ${testEmailResult.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
            {testEmailResult.success ? '✓ ' : '✗ '}{testEmailResult.message}
          </div>
        )}
        <button
          onClick={handleTestEmail}
          disabled={testEmailLoading || servers.length === 0}
          className="btn btn-secondary flex items-center gap-2 text-sm"
        >
          {testEmailLoading ? 'Mengirim...' : `Kirim Email Test ke ${currentUser?.email || 'email Anda'}`}
        </button>
      </div>

      {/* ═══ Log Pengiriman Email ═══ */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Log Pengiriman Email
          </h3>
          <button onClick={handleExportLogs} className="btn btn-secondary text-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export JSON
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="p-3 bg-gray-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-gray-800">{logStats.total}</p>
            <p className="text-xs text-gray-500">Total</p>
          </div>
          <div className="p-3 bg-green-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-green-700">{logStats.sukses}</p>
            <p className="text-xs text-green-600">Sukses</p>
          </div>
          <div className="p-3 bg-red-50 rounded-lg text-center">
            <p className="text-2xl font-bold text-red-700">{logStats.gagal}</p>
            <p className="text-xs text-red-600">Gagal</p>
          </div>
        </div>

        {/* Log list */}
        {logs.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">Belum ada log pengiriman email.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {logs.map(log => (
              <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${log.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{log.subjek}</p>
                  <p className="text-gray-500 text-xs">→ {log.kepada}</p>
                  {log.server_nama && <p className="text-gray-400 text-xs">via {log.server_nama}</p>}
                  {log.error_message && <p className="text-red-500 text-xs mt-1">{log.error_message}</p>}
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {logTotalPages > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            <button disabled={logPage <= 1} onClick={() => fetchLogs(logPage - 1)} className="btn btn-secondary text-sm">← Sebelumnya</button>
            <span className="text-sm text-gray-500 py-2">Hal {logPage} / {logTotalPages}</span>
            <button disabled={logPage >= logTotalPages} onClick={() => fetchLogs(logPage + 1)} className="btn btn-secondary text-sm">Berikutnya →</button>
          </div>
        )}
      </div>

      {/* ═══ Add/Edit Server Modal ═══ */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {editingId ? 'Edit Server Email' : 'Tambah Server Email'}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Server</label>
                <input type="text" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} placeholder="misal: Gmail Utama" className="input-field" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipe</label>
                <select value={form.tipe} onChange={e => setForm(f => ({ ...f, tipe: e.target.value }))} className="input-field">
                  <option value="primary">Primary (Utama)</option>
                  <option value="backup">Backup (Cadangan)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
                  <input type="text" value={form.smtp_host} onChange={e => setForm(f => ({ ...f, smtp_host: e.target.value }))} placeholder="smtp.gmail.com" className="input-field" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Port</label>
                  <input type="number" value={form.smtp_port} onChange={e => setForm(f => ({ ...f, smtp_port: parseInt(e.target.value) || 587 }))} placeholder="587" className="input-field" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Email (SMTP User)</label>
                <input type="email" value={form.smtp_user} onChange={e => setForm(f => ({ ...f, smtp_user: e.target.value }))} placeholder="noreply@example.com" className="input-field" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password / App Password
                  {editingId && <span className="text-xs text-gray-400 font-normal ml-1">(kosongkan jika tidak ingin mengubah)</span>}
                </label>
                <input type="password" value={form.smtp_pass} onChange={e => setForm(f => ({ ...f, smtp_pass: e.target.value }))} placeholder={editingId ? '••••••••' : 'Masukkan password'} className="input-field" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Address <span className="text-xs text-gray-400 font-normal">(opsional, default = email di atas)</span>
                </label>
                <input type="email" value={form.smtp_from} onChange={e => setForm(f => ({ ...f, smtp_from: e.target.value }))} placeholder="noreply@tpq.com" className="input-field" />
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" id="smtp_secure" checked={form.smtp_secure} onChange={e => setForm(f => ({ ...f, smtp_secure: e.target.checked }))} className="rounded" />
                <label htmlFor="smtp_secure" className="text-sm text-gray-700">
                  SSL/TLS (port 465). Jika tidak dicentang, menggunakan STARTTLS (port 587).
                </label>
              </div>

              <hr />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Verifikasi PIN</label>
                <input type="password" value={pin} onChange={e => setPin(e.target.value)} placeholder="Masukkan PIN Anda" className="input-field" maxLength={8} />
              </div>
            </div>

            <div className="flex gap-2 mt-5">
              <button onClick={() => { setShowForm(false); setPin(''); }} className="btn btn-secondary flex-1">Batal</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary flex-1">
                {saving ? 'Menyimpan...' : editingId ? 'Simpan Perubahan' : 'Tambah Server'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Delete Confirmation Modal ═══ */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-red-700 mb-2">Hapus Server Email</h3>
            <p className="text-gray-600 mb-4">
              Yakin ingin menghapus server <strong>{deleteTarget.nama}</strong>?
              Aksi ini tidak dapat dikembalikan.
            </p>
            <input
              type="password"
              value={deletePin}
              onChange={e => setDeletePin(e.target.value)}
              placeholder="Masukkan PIN"
              className="input-field mb-4"
              maxLength={8}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setDeleteTarget(null); setDeletePin(''); }} className="btn btn-secondary flex-1">Batal</button>
              <button onClick={handleDelete} disabled={!deletePin} className="btn bg-red-600 text-white hover:bg-red-700 flex-1">Hapus</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Server Card component ────────────────────────────── */
function ServerCard({ server, onEdit, onDelete }) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${server.tipe === 'primary' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
            {server.tipe === 'primary' ? 'Utama' : 'Cadangan'}
          </span>
          <span className="font-semibold text-gray-800">{server.nama}</span>
          {!server.is_active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Nonaktif</span>}
        </div>
        <div className="text-sm text-gray-500 space-y-0.5">
          <p><span className="text-gray-400">Host:</span> {server.smtp_host}:{server.smtp_port} {server.smtp_secure ? '(SSL)' : '(STARTTLS)'}</p>
          <p><span className="text-gray-400">Email:</span> {server.smtp_user}</p>
          {server.smtp_from && server.smtp_from !== server.smtp_user && (
            <p><span className="text-gray-400">From:</span> {server.smtp_from}</p>
          )}
          <p><span className="text-gray-400">Password:</span> {server.smtp_pass_masked || '••••••••'}</p>
        </div>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button onClick={() => onEdit(server)} className="btn btn-secondary text-sm px-3">Edit</button>
        <button onClick={() => onDelete(server)} className="btn text-red-600 border border-red-200 hover:bg-red-50 text-sm px-3">Hapus</button>
      </div>
    </div>
  );
}
