'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { safeHexColor } from '@/lib/color';
import { SkeletonTable } from '@/components/SkeletonLoader';

const SORT_OPTIONS = [
  { value: 'nama', label: 'Nama' },
  { value: 'no_absen', label: 'No. Absen' },
  { value: 'tgl_mendaftar', label: 'Waktu Terdaftar' },
];

export default function DaftarSantriPage() {
  const [loading, setLoading] = useState(true);
  const [statusPembayaran, setStatusPembayaran] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [search, setSearch] = useState('');
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [selectedKategori, setSelectedKategori] = useState([]); // subsidi|non_subsidi|lunas|laki_laki|perempuan
  const [selectedJilid, setSelectedJilid] = useState([]);
  const [sortBy, setSortBy] = useState('no_absen');
  const [sortDir, setSortDir] = useState('asc');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailSantri, setDetailSantri] = useState(null);
  const [selectedSantri, setSelectedSantri] = useState(null);
  const [pin, setPin] = useState('');
  const [statusAction, setStatusAction] = useState('nonaktif');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [settings, setSettings] = useState({
    warna_non_subsidi: '#04B816',
    warna_subsidi: '#045EB8',
    tahun_mulai_pembukuan: String(new Date().getFullYear()),
  });

  const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const warnaNonSubsidi = safeHexColor(settings.warna_non_subsidi, '#04B816');
  const warnaSubsidi = safeHexColor(settings.warna_subsidi, '#045EB8');
  const isPengajar = currentUser?.jabatan === 'Pengajar';
  const canManageSantriStatus = ['Developer', 'Pimpinan TPQ', 'Sekretaris', 'Bendahara'].includes(currentUser?.jabatan);
  const canDeleteSantri = ['Developer', 'Pimpinan TPQ', 'Sekretaris', 'Bendahara'].includes(currentUser?.jabatan);

  const fetchData = async () => {
    const token = localStorage.getItem('auth_token');
    setLoading(true);
    
    try {
      const res = await fetch(`/api/pembayaran/status?tahun=${tahun}&include_nonaktif=true`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      
      if (data.success) {
        setStatusPembayaran(data.data);
      }
    } catch (err) {
      setError('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    try {
      setCurrentUser(JSON.parse(localStorage.getItem('admin_data') || 'null'));
    } catch {}
    // Baca pesan sukses dari URL
    const params = new URLSearchParams(window.location.search);
    const msg = params.get('success');
    if (msg) {
      setSuccess(decodeURIComponent(msg));
      window.history.replaceState({}, '', '/admin/santri');
    }
  }, [tahun]);

  useEffect(() => {
    const fetchSettings = async () => {
      const token = localStorage.getItem('auth_token');
      try {
        const res = await fetch('/api/pengaturan', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setSettings((prev) => ({ ...prev, ...data.data }));
          const startYear = parseInt(data.data.tahun_mulai_pembukuan || new Date().getFullYear());
          if (tahun < startYear) setTahun(startYear);
        }
      } catch {}
    };
    fetchSettings();
  }, []);

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const startYear = parseInt(settings.tahun_mulai_pembukuan || currentYear);
    const years = [];
    for (let year = currentYear; year >= startYear; year--) years.push(year);
    return years;
  };

  const toggleKategori = (key) => {
    setSelectedKategori((prev) => prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]);
  };

  const toggleJilid = (jilid) => {
    setSelectedJilid((prev) => prev.includes(jilid) ? prev.filter((item) => item !== jilid) : [...prev, jilid]);
  };

  const resetFilter = () => {
    setSelectedKategori([]);
    setSelectedJilid([]);
    setSortBy('no_absen');
    setSortDir('asc');
  };

  const isLunas = (santri) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const batas = tahun === currentYear ? currentMonth : 12;
    for (let b = 1; b <= batas; b++) {
      const st = santri.bulan_status?.[b];
      if (st?.wajib && !st?.dibayar) return false;
    }
    return santri.bulan_wajib > 0;
  };

  const sortData = (data) => {
    const sorted = [...data].sort((a, b) => {
      if (sortBy === 'no_absen') {
        const aNo = a.no_absen ?? Number.MAX_SAFE_INTEGER;
        const bNo = b.no_absen ?? Number.MAX_SAFE_INTEGER;
        return aNo - bNo;
      }
      if (sortBy === 'tgl_mendaftar') {
        const aDate = a.tgl_mendaftar ? new Date(a.tgl_mendaftar).getTime() : 0;
        const bDate = b.tgl_mendaftar ? new Date(b.tgl_mendaftar).getTime() : 0;
        return aDate - bDate;
      }
      return String(a.nama_lengkap || '').localeCompare(String(b.nama_lengkap || ''), 'id', { sensitivity: 'base', numeric: true });
    });

    return sortDir === 'desc' ? sorted.reverse() : sorted;
  };

  const handleStatusChange = async () => {
    if (!pin) {
      setError('Masukkan PIN');
      return;
    }

    setDeleteLoading(true);
    const token = localStorage.getItem('auth_token');

    try {
      let res;
      if (statusAction === 'aktifkan') {
        res = await fetch(`/api/santri/${selectedSantri.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status_aktif: true, pin }),
        });
      } else if (statusAction === 'nonaktif') {
        res = await fetch(`/api/santri/${selectedSantri.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status_aktif: false, pin }),
        });
      } else if (statusAction === 'luluskan') {
        res = await fetch(`/api/santri/${selectedSantri.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status_lulus: true, pin }),
        });
      } else {
        res = await fetch(`/api/santri/${selectedSantri.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ pin }),
        });
      }

      const data = await res.json();

      if (data.success) {
        const pesanSukses = statusAction === 'aktifkan'
          ? 'Santri berhasil diaktifkan kembali'
          : statusAction === 'luluskan'
          ? 'Santri berhasil ditandai lulus'
          : statusAction === 'hapus'
          ? 'Santri berhasil dihapus permanen'
          : 'Santri berhasil dinonaktifkan';
        setSuccess(pesanSukses);
        setShowDeleteModal(false);
        setPin('');
        setSelectedSantri(null);
        fetchData();
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal memproses');
    } finally {
      setDeleteLoading(false);
    }
  };

  const filteredData = useMemo(() => {
    return sortData(statusPembayaran.filter(s => {
      if (search) {
        const query = search.toLowerCase();
        const cocok =
          s.nama_lengkap.toLowerCase().includes(query) ||
          s.nik.includes(search) ||
          String(s.no_absen || '').includes(search) ||
          String(s.jenis_kelamin || '').toLowerCase().includes(query);
        if (!cocok) return false;
      }

      const subsidiFilter = selectedKategori.filter((key) => key === 'subsidi' || key === 'non_subsidi');
      if (subsidiFilter.length === 1) {
        if (subsidiFilter[0] === 'subsidi' && !s.is_subsidi) return false;
        if (subsidiFilter[0] === 'non_subsidi' && s.is_subsidi) return false;
      }

      const genderFilter = selectedKategori.filter((key) => key === 'laki_laki' || key === 'perempuan');
      if (genderFilter.length === 1) {
        if (genderFilter[0] === 'laki_laki' && s.jenis_kelamin !== 'Laki-laki') return false;
        if (genderFilter[0] === 'perempuan' && s.jenis_kelamin !== 'Perempuan') return false;
      }

      if (selectedKategori.includes('lunas') && !isLunas(s)) return false;
      if (selectedJilid.length > 0 && !selectedJilid.includes(s.jilid)) return false;
      return true;
    }));
  }, [statusPembayaran, search, selectedKategori, selectedJilid, tahun, sortBy, sortDir]);

  const jilidList = useMemo(() => {
    const set = new Set(statusPembayaran.map(s => s.jilid).filter(Boolean));
    return [...set].sort((a, b) => String(a).localeCompare(String(b), 'id', { numeric: true }));
  }, [statusPembayaran]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Data Santri</h1>
          <p className="text-gray-500">Status pembayaran SPP santri</p>
        </div>
        {!isPengajar && (
          <Link href="/admin/santri/tambah" className="btn-primary inline-flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Tambah Santri</span>
          </Link>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 text-red-500">✕</button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          {success}
          <button onClick={() => setSuccess('')} className="ml-2 text-green-500">✕</button>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex flex-col sm:flex-row gap-4 mb-3">
          <div className="flex-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama atau NIK..."
              className="input-field"
            />
          </div>
          <div>
            <select
              value={tahun}
              onChange={(e) => setTahun(parseInt(e.target.value))}
              className="input-field"
            >
              {getYearOptions().map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            {[
              { key: 'subsidi', label: 'Subsidi' },
              { key: 'non_subsidi', label: 'Non Subsidi' },
              { key: 'lunas', label: '✓ Lunas' },
              { key: 'laki_laki', label: 'Laki-laki' },
              { key: 'perempuan', label: 'Perempuan' },
            ].map((chip) => {
              const active = selectedKategori.includes(chip.key);
              return (
                <button
                  key={chip.key}
                  onClick={() => toggleKategori(chip.key)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    active
                      ? 'bg-green-600 text-white border-green-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
            <button onClick={resetFilter} className="px-3 py-1 rounded-full text-sm font-medium border bg-white text-gray-500 border-gray-300 hover:border-red-300 hover:text-red-600">
              Reset
            </button>
            <span className="ml-auto text-xs text-gray-500">{filteredData.length} santri</span>
          </div>

          {jilidList.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Filter Jilid (multi select)</p>
              <div className="flex flex-wrap gap-2">
                {jilidList.map((j) => {
                  const active = selectedJilid.includes(j);
                  return (
                    <button
                      key={j}
                      onClick={() => toggleJilid(j)}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                        active
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {j}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="sm:w-52">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Sortir</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="input-field py-2 text-sm">
                {SORT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div className="sm:w-44">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Arah</label>
              <select value={sortDir} onChange={(e) => setSortDir(e.target.value)} className="input-field py-2 text-sm">
                <option value="asc">Naik</option>
                <option value="desc">Turun</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0">
        {loading ? (
          <SkeletonTable rows={8} cols={17} />
        ) : (
          <div className="table-container">
            <table className="w-full min-w-[900px]">
              <thead>
                  <tr className="bg-green-50 text-xs text-green-800 font-semibold">
                    <th className="px-3 py-3 text-center sticky left-0 bg-green-50 w-10" title="Nomor absen santri">No</th>
                    <th className="px-3 py-3 text-left sticky left-10 bg-green-50 min-w-[160px]">Nama Santri</th>
                    <th className="px-3 py-3 text-center uppercase tracking-wide">Jilid</th>
                  {namaBulan.map((b, i) => (
                    <th key={i} className="px-2 py-3 text-center">{b}</th>
                  ))}
                  <th className="px-3 py-3 text-center">Terlunasi</th>
                  <th className="px-3 py-3 text-center">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={17} className="text-center py-8 text-gray-500">
                      Tidak ada data santri
                    </td>
                  </tr>
                ) : (
                  filteredData.map((santri) => (
                    <tr
                      key={santri.id}
                      className="table-row cursor-pointer hover:bg-green-50"
                      onClick={() => { setDetailSantri(santri); setShowDetailModal(true); }}
                    >
                        <td className="px-2 py-3 text-center text-xs text-gray-600 sticky left-0 bg-white w-10">
                          <div className="font-semibold text-sm text-gray-800">{santri.no_absen ?? '-'}</div>
                        </td>
                        <td className="table-cell sticky left-10 bg-white min-w-[160px]">
                        <div>
                          <p className="font-medium" style={{ color: santri.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>{santri.nama_lengkap}</p>
                          <div className="flex flex-wrap items-center gap-1 mt-0.5">
                            <span className="text-xs" style={{ color: santri.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>
                              {santri.is_subsidi ? 'Subsidi' : 'Non Subsidi'}
                            </span>
                            {santri.jenis_kelamin && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                                {santri.jenis_kelamin}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{santri.nik}</p>
                          <p className={`text-xs ${santri.status_aktif ? 'text-green-600' : 'text-red-600'}`}>{santri.status_aktif ? 'Aktif' : 'Nonaktif'}</p>
                        </div>
                      </td>
                      <td className="table-cell text-center">
                        <span className="badge badge-info">{santri.jilid}</span>
                      </td>
                      {[...Array(12)].map((_, i) => {
                        const bulan = i + 1;
                        const status = santri.bulan_status[bulan];
                        return (
                          <td key={i} className="px-2 py-3 text-center">
                            {status?.dibayar ? (
                              <span className="inline-block w-6 h-6 bg-green-500 text-white rounded-full text-xs leading-6">✓</span>
                            ) : !status?.wajib && status?.alasan === 'Belum Terdaftar' ? (
                              <span className="inline-block w-6 h-6 bg-red-100 text-red-500 rounded-full text-xs leading-6">✕</span>
                            ) : (
                              <span className="inline-block w-6 h-6 bg-gray-200 text-gray-400 rounded-full text-xs leading-6">-</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="table-cell text-center">
                        <span className="badge badge-info">
                          {(santri.bulan_dibayar_total || 0)}/{(santri.bulan_sejak_daftar_sampai_kini || 0)}
                        </span>
                      </td>
                      <td className="table-cell text-center">
                        <span className={`badge ${santri.bulan_wajib > 0 && santri.bulan_terbayar >= santri.bulan_wajib ? 'badge-success' : santri.bulan_terbayar >= 6 ? 'badge-warning' : 'badge-danger'}`}>
                          {santri.bulan_terbayar}/{santri.bulan_wajib}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Santri Modal */}
      {showDetailModal && detailSantri && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="text-lg font-bold text-gray-800">Detail Santri</h3>
              <button onClick={() => setShowDetailModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-white"
                style={{ backgroundColor: detailSantri.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>
                {detailSantri.nama_lengkap.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-gray-800 text-lg" style={{ color: detailSantri.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>
                  {detailSantri.nama_lengkap}
                </p>
                <p className="text-sm text-gray-500">{detailSantri.is_subsidi ? 'Subsidi' : 'Non Subsidi'} • {detailSantri.jilid}{detailSantri.jenis_kelamin ? ` • ${detailSantri.jenis_kelamin}` : ''}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              {detailSantri.no_absen && (
                <div className="bg-green-50 rounded p-3 col-span-2 flex items-center gap-2">
                  <span className="text-xs text-green-600 font-medium">No. Absen</span>
                  <span className="font-bold text-green-800 text-lg">#{detailSantri.no_absen}</span>
                </div>
              )}
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">NIK</p>
                <p className="font-medium">{detailSantri.nik}</p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">Status</p>
                <p className={`font-medium ${detailSantri.status_aktif ? 'text-green-600' : 'text-red-600'}`}>
                  {detailSantri.status_aktif ? 'Aktif' : 'Nonaktif'}
                </p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">Jenis Kelamin</p>
                <p className="font-medium">{detailSantri.jenis_kelamin || '-'}</p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">Tgl Mendaftar</p>
                <p className="font-medium">{new Date(detailSantri.tgl_mendaftar).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">Terlunasi</p>
                <p className="font-medium">{detailSantri.bulan_dibayar_total || 0}/{detailSantri.bulan_sejak_daftar_sampai_kini || 0} bulan</p>
              </div>
              <div className="bg-gray-50 rounded p-3">
                <p className="text-xs text-gray-500">Pembayaran {tahun}</p>
                <p className="font-medium">{detailSantri.bulan_terbayar}/{detailSantri.bulan_wajib} bulan</p>
              </div>
              {detailSantri.nama_wali && (
                <div className="bg-gray-50 rounded p-3 col-span-2">
                  <p className="text-xs text-gray-500">Wali</p>
                  <p className="font-medium">{detailSantri.nama_wali}</p>
                  {detailSantri.no_telp_wali && <p className="text-xs text-gray-500">{detailSantri.no_telp_wali}</p>}
                </div>
              )}
            </div>

            {/* Status bulan */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Status Pembayaran {tahun}</p>
              <div className="grid grid-cols-6 gap-1">
                {namaBulan.map((b, i) => {
                  const bulan = i + 1;
                  const status = detailSantri.bulan_status?.[bulan];
                  return (
                    <div key={bulan} className={`rounded text-center py-1 text-xs font-medium ${
                      status?.dibayar ? 'bg-green-100 text-green-700' :
                      !status?.wajib ? 'bg-gray-100 text-gray-400' :
                      'bg-red-50 text-red-600'
                    }`}>
                      <p>{b}</p>
                      <p>{status?.dibayar ? '✓' : !status?.wajib ? '-' : '✗'}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
              {!isPengajar && canManageSantriStatus && (
                <Link
                  href={`/admin/bayar?santri=${detailSantri.id}`}
                  className="btn-primary flex-1 text-center"
                  onClick={() => setShowDetailModal(false)}
                >
                  💳 Bayar SPP
                </Link>
              )}
              {canManageSantriStatus && (
                <button
                  onClick={() => {
                    setSelectedSantri(detailSantri);
                    setStatusAction(detailSantri.status_aktif ? 'nonaktif' : 'aktifkan');
                    setShowDetailModal(false);
                    setShowDeleteModal(true);
                  }}
                  className={`flex-1 ${detailSantri.status_aktif ? 'btn-danger' : 'btn-primary'}`}
                >
                  {detailSantri.status_aktif ? '⛔ Nonaktifkan' : '✅ Aktifkan'}
                </button>
              )}
              {canManageSantriStatus && detailSantri.status_aktif && (
                <button
                  onClick={() => {
                    setSelectedSantri(detailSantri);
                    setStatusAction('luluskan');
                    setShowDetailModal(false);
                    setShowDeleteModal(true);
                  }}
                  className="flex-1 btn-secondary border-yellow-400 text-yellow-700 hover:bg-yellow-50"
                >
                  🎓 Luluskan
                </button>
              )}
              {canDeleteSantri && (
                <button
                  onClick={() => {
                    setSelectedSantri(detailSantri);
                    setStatusAction('hapus');
                    setShowDetailModal(false);
                    setShowDeleteModal(true);
                  }}
                  className="flex-1 btn-danger"
                >
                  🗑️ Hapus Santri
                </button>
              )}
              <Link
                href={`/admin/santri/tambah?edit=${detailSantri.id}`}
                className="btn-secondary flex-1 text-center"
                onClick={() => setShowDetailModal(false)}
              >
                {isPengajar ? '📘 Ubah Jilid' : '✏️ Edit Data'}
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Action Confirm Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              {statusAction === 'luluskan'
                ? 'Konfirmasi Kelulusan'
                : statusAction === 'hapus'
                ? 'Konfirmasi Hapus Santri'
                : 'Konfirmasi'}
            </h3>
            <p className="text-gray-600 mb-4">
              {statusAction === 'aktifkan'
                ? <>Aktifkan kembali santri <strong style={{ color: selectedSantri?.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>{selectedSantri?.nama_lengkap}</strong>? Masukkan PIN untuk konfirmasi.</>
                : statusAction === 'luluskan'
                ? <>Tandai santri <strong style={{ color: selectedSantri?.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>{selectedSantri?.nama_lengkap}</strong> sebagai <strong>LULUS</strong>? Santri akan dipindahkan ke halaman Alumni dan tidak dihitung SPP lagi.</>
                : statusAction === 'hapus'
                ? <>Hapus permanen santri <strong style={{ color: selectedSantri?.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>{selectedSantri?.nama_lengkap}</strong> dari data santri? Riwayat pembayaran, pembayaran lain, absensi, dan buku prestasi santri ini juga akan ikut terhapus.</>
                : <>Nonaktifkan santri <strong style={{ color: selectedSantri?.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>{selectedSantri?.nama_lengkap}</strong>? Masukkan PIN untuk konfirmasi.</>
              }
            </p>
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && pin && !deleteLoading) handleStatusChange(); }}
              placeholder="Masukkan PIN"
              className="input-field mb-4"
              maxLength={6}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setPin(''); setSelectedSantri(null); }}
                className="btn-secondary flex-1"
              >
                Batal
              </button>
              <button
                onClick={handleStatusChange}
                disabled={deleteLoading}
                className={`${statusAction === 'aktifkan' ? 'btn-primary' : statusAction === 'luluskan' ? 'btn-primary' : 'btn-danger'} flex-1`}
              >
                {deleteLoading ? 'Memproses...' : (statusAction === 'aktifkan' ? 'Aktifkan' : statusAction === 'luluskan' ? '🎓 Luluskan' : statusAction === 'hapus' ? '🗑️ Hapus' : 'Nonaktifkan')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
