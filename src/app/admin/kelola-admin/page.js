'use client';

import { useState, useEffect } from 'react';

function ExportDatabaseSection() {
  const [exportPassword, setExportPassword] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportSuccess, setExportSuccess] = useState('');

  const handleExportPlain = async () => {
    setExportError(''); setExportSuccess('');
    setExportLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/export/database', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) { setExportError(data.pesan); return; }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-tpq-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess('Database berhasil diekspor sebagai JSON');
    } catch { setExportError('Gagal mengekspor database'); }
    finally { setExportLoading(false); }
  };

  const handleExportEncrypted = async () => {
    if (!exportPassword || exportPassword.length < 4) {
      setExportError('Password enkripsi minimal 4 karakter'); return;
    }
    setExportError(''); setExportSuccess('');
    setExportLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/export/database', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: exportPassword }),
      });
      if (!res.ok) {
        const data = await res.json();
        setExportError(data.pesan || 'Gagal mengekspor');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-tpq-${new Date().toISOString().split('T')[0]}.tpqdb`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess('Database terenkripsi berhasil diekspor (.tpqdb)');
      setExportPassword('');
    } catch { setExportError('Gagal mengekspor database terenkripsi'); }
    finally { setExportLoading(false); }
  };

  return (
    <div className="space-y-3">
      {exportError && <div className="p-2 bg-red-50 rounded text-red-700 text-sm">{exportError}</div>}
      {exportSuccess && <div className="p-2 bg-green-50 rounded text-green-700 text-sm">{exportSuccess}</div>}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Password Enkripsi <span className="text-gray-400">(opsional untuk enkripsi AES-256)</span>
          </label>
          <input
            type="password"
            value={exportPassword}
            onChange={(e) => setExportPassword(e.target.value)}
            placeholder="Password untuk enkripsi file"
            className="input-field"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPlain}
            disabled={exportLoading}
            className="btn btn-secondary text-sm"
          >
            {exportLoading ? 'Mengunduh...' : '↓ JSON Biasa'}
          </button>
          <button
            onClick={handleExportEncrypted}
            disabled={exportLoading || !exportPassword}
            className="btn btn-primary text-sm"
          >
            {exportLoading ? 'Mengunduh...' : '↓ Terenkripsi (.tpqdb)'}
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-500">File .tpqdb dienkripsi dengan AES-256. Simpan password dengan aman untuk keperluan restore.</p>
    </div>
  );
}

export default function ManageAdminPage() {
  const [loading, setLoading] = useState(false);
  const [adminList, setAdminList] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nama_lengkap: '',
    jabatan: 'Pengajar',
    email: '',
    username: '',
    password: '',
  });
  const [pinForm, setPinForm] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, id: null, pin: '' });
  const [editAccess, setEditAccess] = useState({ show: false, admin: null, akses: {} });
  const [resetPassword, setResetPassword] = useState({ show: false, admin: null, password: '', konfirmasi: '', pin: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const jabatanList = ['Pengajar', 'Sekretaris', 'Bendahara', 'Pimpinan TPQ', 'Lainnya'];
  
  const menuAkses = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'santri', label: 'Daftar Santri' },
    { key: 'tambah_santri', label: 'Pendaftaran Santri' },
    { key: 'bayar', label: 'Bayar SPP' },
    { key: 'pembayaran_lain', label: 'Pembayaran Lain' },
    { key: 'infak', label: 'Infak/Sedekah' },
    { key: 'pengeluaran', label: 'Pengeluaran' },
    { key: 'dana', label: 'Keuangan' },
    { key: 'jurnal', label: 'Jurnal Kas' },
    { key: 'saran', label: 'Kotak Saran' },
    { key: 'laporan', label: 'Laporan/Export' },
    { key: 'pengaturan', label: 'Pengaturan' },
  ];

  useEffect(() => {
    fetchCurrentUser();
    fetchAdmins();
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

  const fetchAdmins = async () => {
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    
    try {
      const res = await fetch('/api/admin', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAdminList(data.data);
      }
    } catch (err) {
      setError('Gagal memuat data admin');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.nama_lengkap || !formData.email || !formData.username || !formData.password) {
      setError('Semua field wajib diisi');
      return;
    }
    if (formData.username.length < 3) {
      setError('Username minimal 3 karakter');
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(formData.username)) {
      setError('Username hanya boleh huruf, angka, titik, strip, atau underscore');
      return;
    }

    setShowPinModal(true);
    setPinForm('');
  };

  const handleSubmit = async () => {
    if (!pinForm) {
      setError('PIN wajib diisi');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);
    const token = localStorage.getItem('auth_token');

    try {
      const res = await fetch('/api/admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          verify_pin: pinForm,
        })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Admin baru berhasil ditambahkan!');
        setShowForm(false);
        setShowPinModal(false);
        setPinForm('');
        setFormData({ nama_lengkap: '', jabatan: 'Pengajar', email: '', username: '', password: '' });
        fetchAdmins();
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal menambahkan admin');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm.pin) {
      setError('PIN wajib diisi');
      return;
    }

    setError('');
    setSuccess('');
    setLoading(true);
    const token = localStorage.getItem('auth_token');

    try {
      const res = await fetch(`/api/admin/${deleteConfirm.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ pin: deleteConfirm.pin })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Admin berhasil dihapus!');
        setDeleteConfirm({ show: false, id: null, pin: '' });
        fetchAdmins();
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal menghapus admin');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAccess = async () => {
    setError('');
    setLoading(true);
    const token = localStorage.getItem('auth_token');

    try {
      const res = await fetch(`/api/admin/${editAccess.admin.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          akses: editAccess.akses,
          pin: editAccess.pin || '',
        })
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Akses ${editAccess.admin.nama_lengkap} berhasil diperbarui!`);
        setEditAccess({ show: false, admin: null, akses: {} });
        fetchAdmins();
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal memperbarui akses');
    } finally {
      setLoading(false);
    }
  };

  const openAccessEditor = (admin) => {
    const currentAkses = admin.akses || {};
    setEditAccess({ show: true, admin, akses: currentAkses, pin: '' });
  };

  const handleResetPassword = async () => {
    if (!resetPassword.password || resetPassword.password.length < 6) {
      setError('Password minimal 6 karakter'); return;
    }
    if (resetPassword.password !== resetPassword.konfirmasi) {
      setError('Konfirmasi password tidak cocok'); return;
    }
    if (!resetPassword.pin) {
      setError('PIN wajib diisi'); return;
    }
    setError(''); setSuccess('');
    setLoading(true);
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/admin/${resetPassword.admin.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ password: resetPassword.password, verify_pin: resetPassword.pin }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Password ${resetPassword.admin.nama_lengkap} berhasil direset!`);
        setResetPassword({ show: false, admin: null, password: '', konfirmasi: '', pin: '' });
      } else {
        setError(data.pesan || 'Gagal mereset password');
      }
    } catch { setError('Terjadi kesalahan'); }
    finally { setLoading(false); }
  };

  // Only Pimpinan TPQ can manage admins
  if (currentUser && currentUser.jabatan !== 'Pimpinan TPQ') {
    return (
      <div className="text-center py-12">
        <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <h2 className="text-xl font-semibold text-gray-700">Akses Terbatas</h2>
        <p className="text-gray-500 mt-2">Hanya Pimpinan TPQ yang dapat mengelola data admin</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Kelola Admin</h1>
          <p className="text-gray-500">Manajemen akun administrator</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary"
        >
          {showForm ? '✕ Tutup' : '+ Tambah Admin'}
        </button>
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

      {/* Form Tambah Admin */}
      {showForm && (
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Tambah Admin Baru</h3>
          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama Lengkap <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.nama_lengkap}
                  onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                  placeholder="Nama lengkap"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Jabatan <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.jabatan}
                  onChange={(e) => setFormData({ ...formData, jabatan: e.target.value })}
                  className="input-field"
                  required
                >
                  {jabatanList.map(jab => (
                    <option key={jab} value={jab}>{jab}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@example.com"
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '') })}
                  placeholder="Minimal 3 karakter (huruf, angka, . _ -)"
                  className="input-field"
                  minLength={3}
                  maxLength={50}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Digunakan untuk login selain email</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Minimal 6 karakter"
                  className="input-field"
                  minLength="6"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
              >
                Simpan
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn btn-secondary"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Daftar Admin */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-4">Daftar Administrator</h3>
        
        {loading && !showForm ? (
          <div className="flex justify-center py-8">
            <svg className="animate-spin h-8 w-8 text-green-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminList.map((admin) => (
              <div key={admin.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-800">{admin.nama_lengkap}</h4>
                    <p className="text-sm text-gray-600">{admin.jabatan}</p>
                  </div>
                  <div className="flex gap-1">
                    {admin.id !== currentUser?.id && (
                      <>
                        {/* Sembunyikan kelola akses jika target adalah Pimpinan TPQ lain */}
                        {admin.jabatan !== 'Pimpinan TPQ' && (
                          <button
                            onClick={() => openAccessEditor(admin)}
                            className="text-blue-500 hover:text-blue-700 p-1"
                            title="Kelola Akses"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => setResetPassword({ show: true, admin, password: '', konfirmasi: '', pin: '' })}
                          className="text-orange-500 hover:text-orange-700 p-1"
                          title="Reset Password"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteConfirm({ show: true, id: admin.id, pin: '' })}
                          className="text-red-500 hover:text-red-700 p-1"
                          title="Hapus admin"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="space-y-1 text-sm">
                  {admin.username && (
                    <p className="text-gray-600">
                      <span className="font-medium">Username:</span>{' '}
                      <span className="font-mono bg-gray-100 px-1 rounded text-xs">{admin.username}</span>
                    </p>
                  )}
                  <p className="text-gray-600">
                    <span className="font-medium">Email:</span> {admin.email}
                  </p>
                  <p className={`${admin.is_active ? 'text-green-600' : 'text-red-600'}`}>
                    <span className="font-medium">Status:</span> {admin.is_active ? 'Aktif' : 'Nonaktif'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Export Database Section */}
      <div className="card">
        <h3 className="font-semibold text-gray-800 mb-2">Export Database</h3>
        <p className="text-sm text-gray-600 mb-4">
          Unduh backup seluruh data database. Untuk keamanan, enkripsi file dengan password.
        </p>
        <ExportDatabaseSection />
      </div>

      {/* PIN Modal for Add Admin */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Verifikasi PIN</h3>
            <p className="text-gray-600 mb-4">Masukkan PIN Anda untuk menambahkan admin baru.</p>
            <input
              type="password"
              value={pinForm}
              onChange={(e) => setPinForm(e.target.value)}
              placeholder="Masukkan PIN"
              className="input-field mb-4"
              maxLength={8}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowPinModal(false); setPinForm(''); }}
                className="btn btn-secondary flex-1"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !pinForm}
                className="btn btn-primary flex-1"
              >
                {loading ? 'Menyimpan...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Konfirmasi Hapus Admin</h3>
            <p className="text-gray-600 mb-4">
              Masukkan PIN Anda untuk menghapus admin ini.
            </p>
            <input
              type="password"
              value={deleteConfirm.pin}
              onChange={(e) => setDeleteConfirm({ ...deleteConfirm, pin: e.target.value })}
              placeholder="Masukkan PIN"
              className="input-field mb-4"
              maxLength={8}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={loading || !deleteConfirm.pin}
                className="btn bg-red-600 hover:bg-red-700 text-white flex-1"
              >
                {loading ? 'Menghapus...' : 'Hapus'}
              </button>
              <button
                onClick={() => setDeleteConfirm({ show: false, id: null, pin: '' })}
                className="btn btn-secondary flex-1"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access Control Modal */}
      {editAccess.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              Kelola Akses: {editAccess.admin?.nama_lengkap}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Jabatan: {editAccess.admin?.jabatan}
            </p>

            <div className="space-y-2 mb-4">
              {menuAkses.map(menu => (
                <label key={menu.key} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editAccess.akses[menu.key] !== false}
                    onChange={(e) => {
                      setEditAccess(prev => ({
                        ...prev,
                        akses: { ...prev.akses, [menu.key]: e.target.checked }
                      }));
                    }}
                    className="w-4 h-4 text-green-600 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">{menu.label}</span>
                </label>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">PIN Verifikasi</label>
              <input
                type="password"
                value={editAccess.pin || ''}
                onChange={(e) => setEditAccess(prev => ({ ...prev, pin: e.target.value }))}
                placeholder="Masukkan PIN Anda"
                className="input-field"
                maxLength={8}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setEditAccess({ show: false, admin: null, akses: {} })}
                className="btn btn-secondary flex-1"
              >
                Batal
              </button>
              <button
                onClick={handleSaveAccess}
                disabled={loading || !editAccess.pin}
                className="btn btn-primary flex-1"
              >
                {loading ? 'Menyimpan...' : 'Simpan Akses'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Reset Password Modal */}
      {resetPassword.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Reset Password Admin</h3>
            <p className="text-sm text-gray-600 mb-4">
              Reset password untuk: <strong>{resetPassword.admin?.nama_lengkap}</strong> ({resetPassword.admin?.jabatan})
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password Baru</label>
                <input
                  type="password"
                  value={resetPassword.password}
                  onChange={(e) => setResetPassword(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Minimal 6 karakter"
                  className="input-field"
                  minLength={6}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Konfirmasi Password</label>
                <input
                  type="password"
                  value={resetPassword.konfirmasi}
                  onChange={(e) => setResetPassword(prev => ({ ...prev, konfirmasi: e.target.value }))}
                  placeholder="Ulangi password baru"
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">PIN Anda (verifikasi)</label>
                <input
                  type="password"
                  value={resetPassword.pin}
                  onChange={(e) => setResetPassword(prev => ({ ...prev, pin: e.target.value }))}
                  placeholder="Masukkan PIN Anda"
                  className="input-field"
                  maxLength={8}
                  autoFocus
                />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setResetPassword({ show: false, admin: null, password: '', konfirmasi: '', pin: '' })}
                className="btn btn-secondary flex-1"
              >
                Batal
              </button>
              <button
                onClick={handleResetPassword}
                disabled={loading || !resetPassword.pin}
                className="btn bg-orange-600 hover:bg-orange-700 text-white flex-1"
              >
                {loading ? 'Menyimpan...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
