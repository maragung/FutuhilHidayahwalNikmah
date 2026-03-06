'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

const JILID_OPTIONS = ['Pra TK','Jilid 1','Jilid 2','Jilid 3','Jilid 4','Jilid 5','Jilid 6','Gharib','Tajwid','Al-Quran'];

function SantriForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const isEdit = Boolean(editId);

  const [fetching, setFetching] = useState(isEdit);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');

  const [formData, setFormData] = useState({
    no_absen: '',
    nik: '',
    nama_lengkap: '',
    jilid: 'Jilid 1',
    alamat: '',
    nama_wali: '',
    no_telp_wali: '',
    email_wali: '',
    tgl_mendaftar: new Date().toISOString().split('T')[0],
    is_subsidi: false,
  });

  useEffect(() => {
    if (!isEdit) return;
    const token = localStorage.getItem('auth_token');
    fetch(`/api/santri/${editId}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          const s = data.data;
          setFormData({
            no_absen: s.no_absen ?? '',
            nik: s.nik || '',
            nama_lengkap: s.nama_lengkap || '',
            jilid: s.jilid || 'Jilid 1',
            alamat: s.alamat || '',
            nama_wali: s.nama_wali || '',
            no_telp_wali: s.no_telp_wali || '',
            email_wali: s.email_wali || '',
            tgl_mendaftar: s.tgl_mendaftar || new Date().toISOString().split('T')[0],
            is_subsidi: Boolean(s.is_subsidi),
          });
        } else {
          setError('Gagal memuat data santri');
        }
      })
      .catch(() => setError('Gagal memuat data santri'))
      .finally(() => setFetching(false));
  }, [editId, isEdit]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError('');
    if (!isEdit && (!formData.nik || formData.nik.length !== 16)) {
      setError('NIK harus 16 digit');
      return;
    }
    if (!formData.nama_lengkap.trim()) {
      setError('Nama lengkap harus diisi');
      return;
    }
    setShowPinModal(true);
    setPin('');
  };

  const handleSubmit = async () => {
    if (!pin) { setError('PIN wajib diisi'); return; }
    setLoading(true);
    setError('');
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(isEdit ? `/api/santri/${editId}` : '/api/santri', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ...formData, pin }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/admin/santri?success=${encodeURIComponent(isEdit ? 'Data santri berhasil diperbarui' : 'Santri berhasil didaftarkan')}`);
      } else {
        setError(data.pesan || 'Gagal menyimpan data santri');
        setShowPinModal(false);
      }
    } catch {
      setError('Terjadi kesalahan, silakan coba lagi');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
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
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin/santri" className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{isEdit ? 'Edit Data Santri' : 'Pendaftaran Santri Baru'}</h1>
          <p className="text-gray-500 text-sm">{isEdit ? 'Perbarui data santri yang sudah terdaftar' : 'Isi data lengkap untuk mendaftarkan santri baru'}</p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className="card max-w-2xl">
        <form onSubmit={handleFormSubmit} className="space-y-5">

          {/* === Identitas Santri === */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Identitas Santri</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Absen</label>
                <input
                  type="number"
                  name="no_absen"
                  value={formData.no_absen}
                  onChange={handleChange}
                  className="input-field"
                  placeholder="mis. 12"
                  min={1}
                  max={999}
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  NIK <span className="text-red-500">*</span>
                  {isEdit && <span className="ml-1 text-xs text-gray-400">(tidak dapat diubah)</span>}
                </label>
                <input
                  type="text"
                  name="nik"
                  value={formData.nik}
                  onChange={handleChange}
                  className={`input-field ${isEdit ? 'bg-gray-50 text-gray-500 cursor-not-allowed' : ''}`}
                  placeholder="16 digit NIK"
                  maxLength={16}
                  pattern="[0-9]{16}"
                  disabled={isEdit}
                  required={!isEdit}
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nama_lengkap"
              value={formData.nama_lengkap}
              onChange={handleChange}
              className="input-field"
              placeholder="Nama lengkap santri"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jilid / Kelas</label>
              <select name="jilid" value={formData.jilid} onChange={handleChange} className="input-field">
                {JILID_OPTIONS.map(j => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mendaftar</label>
              <input type="date" name="tgl_mendaftar" value={formData.tgl_mendaftar} onChange={handleChange} className="input-field" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
            <textarea name="alamat" value={formData.alamat} onChange={handleChange} className="input-field" rows={2} placeholder="Alamat lengkap santri" />
          </div>

          {/* === Data Wali === */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 pt-2 border-t border-gray-100">Data Wali</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Wali</label>
                <input type="text" name="nama_wali" value={formData.nama_wali} onChange={handleChange} className="input-field" placeholder="Nama orang tua / wali" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon Wali</label>
                <input type="tel" name="no_telp_wali" value={formData.no_telp_wali} onChange={handleChange} className="input-field" placeholder="08xxxxxxxxxx" />
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Wali <span className="text-xs text-gray-400">(opsional)</span></label>
              <input type="email" name="email_wali" value={formData.email_wali} onChange={handleChange} className="input-field" placeholder="email.wali@contoh.com" />
            </div>
          </div>

          {/* === Status Subsidi === */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 pt-2 border-t border-gray-100">Status Subsidi</p>
            <label className={`inline-flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all w-full ${formData.is_subsidi ? 'bg-blue-50 border-blue-300' : 'bg-gray-50 border-gray-200 hover:border-gray-300'}`}>
              <input type="checkbox" name="is_subsidi" checked={!!formData.is_subsidi} onChange={handleChange} className="w-4 h-4 accent-blue-600" />
              <div>
                <p className={`text-sm font-semibold ${formData.is_subsidi ? 'text-blue-800' : 'text-gray-700'}`}>
                  {formData.is_subsidi ? '🟦 Santri Subsidi (SPP Subsidi)' : '⬜ Santri Non Subsidi'}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{formData.is_subsidi ? 'Mendapat tarif SPP bersubsidi' : 'Centang untuk mengaktifkan subsidi SPP'}</p>
              </div>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Link href="/admin/santri" className="btn btn-secondary flex-1 text-center">Batal</Link>
            <button type="submit" className="btn btn-primary flex-1">
              {isEdit ? '💾 Simpan Perubahan' : '✅ Daftarkan Santri'}
            </button>
          </div>
        </form>
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Verifikasi PIN</h3>
            <p className="text-sm text-gray-500 mb-4">
              {isEdit ? 'Masukkan PIN untuk menyimpan perubahan data santri.' : 'Masukkan PIN untuk mendaftarkan santri baru.'}
            </p>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && pin && !loading) handleSubmit(); }}
              placeholder="Masukkan PIN"
              className="input-field mb-4"
              maxLength={8}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={() => { setShowPinModal(false); setPin(''); }} className="btn btn-secondary flex-1">Batal</button>
              <button
                onClick={handleSubmit}
                disabled={loading || !pin}
                className="btn btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Menyimpan...
                  </>
                ) : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TambahSantriPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-10 w-10 text-green-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    }>
      <SantriForm />
    </Suspense>
  );
}


export default function TambahSantriPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [formData, setFormData] = useState({
    nik: '',
    nama_lengkap: '',
    jilid: 'Jilid 1',
    alamat: '',
    nama_wali: '',
    no_telp_wali: '',
    email_wali: '',
    tgl_mendaftar: new Date().toISOString().split('T')[0],
    is_subsidi: false,
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!formData.nik || formData.nik.length !== 16) {
      setError('NIK harus 16 digit');
      return;
    }

    if (!formData.nama_lengkap.trim()) {
      setError('Nama lengkap harus diisi');
      return;
    }

    setShowPinModal(true);
    setPin('');
  };

  const handleSubmit = async () => {
    if (!pin) {
      setError('PIN wajib diisi');
      return;
    }

    setLoading(true);
    setError('');

    const token = localStorage.getItem('auth_token');

    try {
      const res = await fetch('/api/santri', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...formData, pin }),
      });

      const data = await res.json();

      if (data.success) {
        router.push('/admin/santri?success=Santri+berhasil+ditambahkan');
      } else {
        setError(data.pesan || 'Gagal menambahkan santri');
      }
    } catch (err) {
      setError('Terjadi kesalahan, silakan coba lagi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/santri" className="p-2 hover:bg-gray-100 rounded-lg">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pendaftaran Santri</h1>
          <p className="text-gray-500">Daftarkan santri baru ke TPQ</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="card max-w-2xl">
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                NIK (Nomor Induk Kependudukan) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="nik"
                value={formData.nik}
                onChange={handleChange}
                className="input-field"
                placeholder="16 digit NIK"
                maxLength={16}
                pattern="[0-9]{16}"
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nama Lengkap <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="nama_lengkap"
                value={formData.nama_lengkap}
                onChange={handleChange}
                className="input-field"
                placeholder="Nama lengkap santri"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jilid</label>
              <select
                name="jilid"
                value={formData.jilid}
                onChange={handleChange}
                className="input-field"
              >
                <option value="Pra TK">Pra TK</option>
                <option value="Jilid 1">Jilid 1</option>
                <option value="Jilid 2">Jilid 2</option>
                <option value="Jilid 3">Jilid 3</option>
                <option value="Jilid 4">Jilid 4</option>
                <option value="Jilid 5">Jilid 5</option>
                <option value="Jilid 6">Jilid 6</option>
                <option value="Gharib">Gharib</option>
                <option value="Tajwid">Tajwid</option>
                <option value="Al-Quran">Al-Quran</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tanggal Mendaftar</label>
              <input
                type="date"
                name="tgl_mendaftar"
                value={formData.tgl_mendaftar}
                onChange={handleChange}
                className="input-field"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
              <textarea
                name="alamat"
                value={formData.alamat}
                onChange={handleChange}
                className="input-field"
                rows={2}
                placeholder="Alamat lengkap santri"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Wali</label>
              <input
                type="text"
                name="nama_wali"
                value={formData.nama_wali}
                onChange={handleChange}
                className="input-field"
                placeholder="Nama orang tua/wali"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">No. Telepon Wali</label>
              <input
                type="tel"
                name="no_telp_wali"
                value={formData.no_telp_wali}
                onChange={handleChange}
                className="input-field"
                placeholder="08xxxxxxxxxx"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Wali</label>
              <input
                type="email"
                name="email_wali"
                value={formData.email_wali}
                onChange={handleChange}
                className="input-field"
                placeholder="email.wali@contoh.com (opsional)"
              />
            </div>

            <div className="md:col-span-2">
              <label className="inline-flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <input
                  type="checkbox"
                  name="is_subsidi"
                  checked={!!formData.is_subsidi}
                  onChange={handleChange}
                  className="w-4 h-4"
                />
                <span className="text-sm text-blue-800">
                  <strong>Jadikan sebagai Santri bersubsidi</strong>
                </span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Link href="/admin/santri" className="btn-secondary flex-1 text-center">
              Batal
            </Link>
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              Simpan Santri
            </button>
          </div>
        </form>
      </div>

      {/* PIN Modal */}
      {showPinModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Verifikasi PIN</h3>
            <p className="text-gray-600 mb-4">Masukkan PIN untuk menyimpan data santri baru.</p>
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
                className="btn-secondary flex-1"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !pin}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Konfirmasi</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
