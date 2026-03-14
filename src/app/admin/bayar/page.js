'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { safeHexColor } from '@/lib/color';
import { createIdempotencyKey } from '@/lib/client-idempotency';

/**
 * Bayar SPP – menggunakan /api/pembayaran/status untuk data bulan_status
 * yang dihitung di sisi server. Bulan wajib selalu mulai dari bulan mendaftar,
 * bukan dari Januari.
 */
function BayarPageInner() {
  const searchParams = useSearchParams();
  const santriIdParam = searchParams.get('santri');
  const TAHUN_STORAGE_KEY = 'bayar_spp_selected_tahun';

  const [statusLoading, setStatusLoading] = useState(false);
  const [statusList, setStatusList] = useState([]);
  const [selectedSantri, setSelectedSantri] = useState(null);
  const [search, setSearch] = useState('');
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [selectedBulan, setSelectedBulan] = useState([]);
  const [nominal, setNominal] = useState(0);
  const [abaikanAturanNominal, setAbaikanAturanNominal] = useState(false);
  const [metodeBayar, setMetodeBayar] = useState('Tunai');
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [paidPayments, setPaidPayments] = useState({});
  const [pin, setPin] = useState('');
  const [cancelModal, setCancelModal] = useState({ show: false, payment: null, bulan: null, cancelPin: '' });
  const [selectedCancelBulan, setSelectedCancelBulan] = useState([]);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [canAbaikanNominal, setCanAbaikanNominal] = useState(false);
  const [sortSantri, setSortSantri] = useState('no_absen');
  const [settings, setSettings] = useState({
    nominal_spp_non_subsidi: '40000',
    nominal_spp_subsidi: '30000',
    warna_non_subsidi: '#04B816',
    warna_subsidi: '#045EB8',
    tahun_mulai_pembukuan: String(new Date().getFullYear()),
  });

  const namaBulan = ['Januari','Februari','Maret','April','Mei','Juni',
                     'Juli','Agustus','September','Oktober','November','Desember'];
  const warnaNonSubsidi = safeHexColor(settings.warna_non_subsidi, '#04B816');
  const warnaSubsidi    = safeHexColor(settings.warna_subsidi,     '#045EB8');

  const formatCurrency = (amount) => new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount || 0);

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const startYear = parseInt(settings.tahun_mulai_pembukuan || currentYear);
    const years = [];
    for (let year = currentYear + 1; year >= startYear; year--) years.push(year);
    return years;
  };

  useEffect(() => {
    try {
      const savedYear = parseInt(localStorage.getItem(TAHUN_STORAGE_KEY) || '', 10);
      if (Number.isInteger(savedYear) && savedYear >= 2000 && savedYear <= 2100) {
        setTahun(savedYear);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(TAHUN_STORAGE_KEY, String(tahun));
    } catch {}
  }, [tahun]);

  // ── Fetch pengaturan & role ────────────────────────────────────────────────
  useEffect(() => {
    const fetchSettings = async () => {
      const token = localStorage.getItem('auth_token');
      try {
        const res  = await fetch('/api/pengaturan', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (data.success) {
          setSettings(prev => ({ ...prev, ...data.data }));
          const startYear = parseInt(data.data.tahun_mulai_pembukuan || new Date().getFullYear());
          const savedYear = parseInt(localStorage.getItem(TAHUN_STORAGE_KEY) || '', 10);
          const hasSavedYear = Number.isInteger(savedYear);
          if (!hasSavedYear) {
            setTahun((prev) => (prev < startYear ? startYear : prev));
          }
        }
      } catch {}
    };
    fetchSettings();
    try {
      const admin = JSON.parse(localStorage.getItem('admin_data') || '{}');
      setCanAbaikanNominal(['Pimpinan TPQ','Bendahara','Sekretaris'].includes(admin.jabatan));
    } catch { setCanAbaikanNominal(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Fetch status pembayaran (menggantikan /api/santri?status=aktif) ────────
  // Endpoint ini menghitung bulan_status di sisi server berdasarkan tgl_mendaftar,
  // tgl_nonaktif, dll. – sehingga "mulai dari bulan mendaftar" selalu tepat.
  const fetchStatusList = async (selectedTahun, keepSelected) => {
    const token = localStorage.getItem('auth_token');
    setStatusLoading(true);
    try {
      const res  = await fetch(`/api/pembayaran/status?tahun=${selectedTahun}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const list = data.data;
        setStatusList(list);

        if (keepSelected) {
          // Sinkronkan selectedSantri dengan data terbaru
          const updated = list.find(s => s.id === keepSelected);
          if (updated) {
            setSelectedSantri(updated);
            if (!abaikanAturanNominal) setNominal(updated.nominal_spp || 0);
          }
        } else if (santriIdParam) {
          const found = list.find(s => s.id === parseInt(santriIdParam));
          if (found) {
            setSelectedSantri(found);
            setNominal(found.nominal_spp || 0);
            fetchPaidPayments(found.id, selectedTahun);
          }
        }
      }
    } catch {
      setError('Gagal memuat data santri');
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusList(tahun, selectedSantri?.id);
    setSelectedBulan([]);
    setPaidPayments({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tahun]);

  // ── Fetch riwayat pembayaran (untuk ID invoice, fitur batalkan) ───────────
  const fetchPaidPayments = async (santriId, selectedTahun) => {
    if (!santriId) return;
    const token  = localStorage.getItem('auth_token');
    const useYear = selectedTahun || tahun;
    try {
      const res  = await fetch(`/api/pembayaran?santri_id=${santriId}&tahun=${useYear}&limit=12`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const payments = {};
        data.data.forEach(p => {
          payments[p.bulan_spp] = {
            id:           p.id,
            kode_invoice: p.kode_invoice,
            nominal:      p.nominal,
            tgl_bayar:    p.tgl_bayar,
            metode_bayar: p.metode_bayar,
          };
        });
        setPaidPayments(payments);
      }
    } catch {}
  };

  // ── Helper: baca bulan_status dari server ──────────────────────────────────
  const getBulanInfo = (bulan) => {
    if (!selectedSantri) return { wajib: false, dibayar: false, alasan: null, canSelectWithManualNominal: false };
    const st = selectedSantri.bulan_status?.[bulan];
    if (!st) return { wajib: false, dibayar: false, alasan: null, canSelectWithManualNominal: false };
    return { 
      wajib: !!st.wajib, 
      dibayar: !!st.dibayar, 
      alasan: st.alasan || null,
      canSelectWithManualNominal: !!st.canSelectWithManualNominal,
    };
  };

  const getEarliestUnpaid = () => {
    if (!selectedSantri) return null;
    for (let b = 1; b <= 12; b++) {
      const { wajib, dibayar } = getBulanInfo(b);
      if (wajib && !dibayar) return b;
    }
    return null;
  };

  const getBulanMulai = () => {
    if (!selectedSantri) return null;
    for (let b = 1; b <= 12; b++) {
      if (getBulanInfo(b).wajib) return b;
    }
    return null;
  };

  // ── Pilih bulan (berurutan untuk wajib, manual untuk nonaktif) ──────────────
  const handleBulanChange = (bulan) => {
    const { wajib, dibayar, canSelectWithManualNominal } = getBulanInfo(bulan);
    if (dibayar) return;
    
    // Bulan wajib harus berurutan dari earliest unpaid
    if (wajib) {
      const earliest = getEarliestUnpaid();
      if (!earliest) return;
      setSelectedBulan(prev => {
        if (prev.includes(bulan)) {
          const sorted = [...prev].sort((a, b) => a - b);
          if (bulan !== sorted[sorted.length - 1]) return prev;
          return prev.filter(b => b !== bulan);
        }
        const sorted = [...prev].sort((a, b) => a - b);
        const expectedNext = sorted.length === 0 ? earliest : sorted[sorted.length - 1] + 1;
        if (bulan !== expectedNext) return prev;
        return [...prev, bulan].sort((a, b) => a - b);
      });
    } 
    // Bulan nonaktif bisa dipilih jika user bisa tulis nominal manual
    else if (canSelectWithManualNominal && canAbaikanNominal) {
      setSelectedBulan(prev => {
        if (prev.includes(bulan)) {
          return prev.filter(b => b !== bulan);
        }
        return [...prev, bulan].sort((a, b) => a - b);
      });
    }
  };

  // ── Submit pembayaran ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedSantri || selectedBulan.length === 0) return;
    if (!pin) { setError('PIN wajib diisi untuk verifikasi'); return; }
    
    // Cek apakah ada bulan nonaktif yang dipilih
    let hasNonaktifMonth = false;
    for (const bulan of selectedBulan) {
      const { canSelectWithManualNominal } = getBulanInfo(bulan);
      if (canSelectWithManualNominal) {
        hasNonaktifMonth = true;
        break;
      }
    }
    
    // Jika ada bulan nonaktif, wajib input nominal manual
    if (hasNonaktifMonth && !abaikanAturanNominal) {
      setError('Bulan nonaktif memerlukan input nominal manual. Harap centang "Input nominal manual".'); 
      return;
    }
    
    setSubmitLoading(true);
    setError('');
    const token = localStorage.getItem('auth_token');
    try {
      const res  = await fetch('/api/pembayaran', {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'x-idempotency-key': createIdempotencyKey('spp')
        },
        body:    JSON.stringify({
          santri_id:              selectedSantri.id,
          bulan_list:             selectedBulan,
          tahun_spp:              tahun,
          nominal_per_bulan:      nominal,
          abaikan_aturan_nominal: abaikanAturanNominal,
          metode_bayar:           metodeBayar,
          pin,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Pembayaran ${selectedBulan.length} bulan berhasil dicatat!`);
        setShowConfirm(false);
        setSelectedBulan([]);
        setPin('');
        await fetchStatusList(tahun, selectedSantri.id);
        await fetchPaidPayments(selectedSantri.id);
      } else {
        setError(data.pesan);
      }
    } catch {
      setError('Gagal menyimpan pembayaran');
    } finally {
      setSubmitLoading(false);
    }
  };

  // ── Batalkan pembayaran ────────────────────────────────────────────────────
  const handleCancelPayment = async () => {
    if (!cancelModal.cancelPin) { setError('PIN wajib diisi'); return; }
    const selectedIds = selectedCancelBulan
      .map((bulan) => paidPayments[bulan]?.id)
      .filter((id) => Number.isInteger(id));
    if (selectedIds.length === 0) {
      setError('Pilih minimal 1 pembayaran yang valid untuk dibatalkan');
      return;
    }

    setCancelLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const res  = await fetch('/api/pembayaran', {
        method:  'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ ids: selectedIds, pin: cancelModal.cancelPin }),
      });
      const data = await res.json();
      if (data.success) {
        if (selectedCancelBulan.length > 1) {
          setSuccess(`${selectedCancelBulan.length} pembayaran berhasil dibatalkan`);
        } else {
          setSuccess(`Pembayaran bulan ${namaBulan[cancelModal.bulan - 1]} berhasil dibatalkan`);
        }
        setCancelModal({ show: false, payment: null, bulan: null, cancelPin: '' });
        setSelectedCancelBulan([]);
        await fetchStatusList(tahun, selectedSantri.id);
        await fetchPaidPayments(selectedSantri.id);
      } else {
        setError(data.pesan || 'Gagal membatalkan pembayaran');
      }
    } catch {
      setError('Terjadi kesalahan saat membatalkan pembayaran');
    } finally {
      setCancelLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const filteredSantri = statusList
    .filter(s =>
      s.nama_lengkap.toLowerCase().includes(search.toLowerCase()) || s.nik.includes(search)
    )
    .sort((a, b) => {
      if (sortSantri === 'no_absen') {
        const aAbsen = a.no_absen ?? Infinity;
        const bAbsen = b.no_absen ?? Infinity;
        if (aAbsen !== bAbsen) return aAbsen - bAbsen;
        return a.nama_lengkap.localeCompare(b.nama_lengkap, 'id');
      }
      return a.nama_lengkap.localeCompare(b.nama_lengkap, 'id');
    });
  const totalBayar     = selectedBulan.length * nominal;
  const earliestUnpaid = getEarliestUnpaid();
  const bulanMulai     = getBulanMulai();
  const paidMonthsDesc = Object.keys(paidPayments)
    .map((b) => parseInt(b, 10))
    .filter((b) => Number.isInteger(b) && b >= 1 && b <= 12)
    .sort((a, b) => b - a);

  const isCancelSelectionAllowed = (bulan) => {
    if (!paidMonthsDesc.length) return false;
    const nextIndex = selectedCancelBulan.length;
    return paidMonthsDesc[nextIndex] === bulan;
  };

  const toggleCancelBulan = (bulan, checked) => {
    setSelectedCancelBulan((prev) => {
      if (checked) {
        const nextIndex = prev.length;
        if (paidMonthsDesc[nextIndex] !== bulan) return prev;
        return [...prev, bulan];
      }

      // Hanya boleh lepas centang paling akhir (LIFO)
      if (prev.length === 0) return prev;
      if (prev[prev.length - 1] !== bulan) return prev;
      return prev.slice(0, -1);
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Bayar SPP</h1>
        <p className="text-gray-500">Catat pembayaran SPP santri</p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="text-red-500 ml-2">✕</button>
        </div>
      )}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex items-start gap-2">
          <span className="shrink-0">✅</span>
          <span className="flex-1">{success}</span>
          <button onClick={() => setSuccess('')} className="text-green-500 ml-2">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Panel kiri: Pilih Santri ──────────────────────────────────── */}
        <div className="card lg:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">1. Pilih Santri</h3>
            <select
              value={tahun}
              onChange={(e) => { setTahun(parseInt(e.target.value)); setSelectedBulan([]); setPaidPayments({}); }}
              title="Pilih tahun pembayaran"
              className="input-field w-auto text-sm py-1"
            >
              {getYearOptions().map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-500 mb-2">
            Pilihan tahun disimpan otomatis dan tetap sama setelah halaman direfresh.
          </p>

          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau NIK..."
            className="input-field mb-2"
          />

          <div className="flex items-center gap-1 mb-3">
            <span className="text-xs text-gray-500 shrink-0">Urut:</span>
            <button
              onClick={() => setSortSantri('no_absen')}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                sortSantri === 'no_absen'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
              }`}
            >
              No. Absen
            </button>
            <button
              onClick={() => setSortSantri('nama')}
              className={`text-xs px-2 py-1 rounded border transition-colors ${
                sortSantri === 'nama'
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
              }`}
            >
              Nama
            </button>
          </div>

          {statusLoading ? (
            <div className="flex items-center justify-center h-32 text-gray-400 text-sm gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Memuat data...
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {filteredSantri.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">Tidak ada santri</p>
              )}
              {filteredSantri.map(santri => {
                const warna = santri.is_subsidi ? warnaSubsidi : warnaNonSubsidi;
                return (
                  <button
                    key={santri.id}
                    onClick={() => {
                      setSelectedSantri(santri);
                      setSelectedBulan([]);
                      setPaidPayments({});
                      if (!abaikanAturanNominal) setNominal(santri.nominal_spp || 0);
                      fetchPaidPayments(santri.id);
                    }}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedSantri?.id === santri.id
                        ? 'bg-green-50 border-green-500'
                        : 'bg-white border-gray-200 hover:border-green-300'
                    }`}
                  >
                    <p className="font-medium text-sm" style={{ color: warna }}>{santri.nama_lengkap}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {santri.no_absen != null && <span className="font-mono mr-1">#{santri.no_absen}</span>}
                      {santri.nik} • {santri.jilid}
                      {!santri.status_aktif && <span className="ml-1 text-red-500">• Nonaktif</span>}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs" style={{ color: warna }}>
                        {santri.is_subsidi ? 'Subsidi' : 'Non Subsidi'}
                      </span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs font-semibold text-gray-600">
                        {formatCurrency(santri.nominal_spp)}/bln
                      </span>
                      {santri.bulan_belum_bayar > 0 && (
                        <span className="ml-auto text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-medium">
                          {santri.bulan_belum_bayar} blm
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Panel kanan: Pilih Bulan ──────────────────────────────────── */}
        <div className="card lg:col-span-2">
          <h3 className="font-semibold text-gray-800 mb-4">2. Pilih Bulan Pembayaran</h3>

          {!selectedSantri ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
              <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm">Pilih santri terlebih dahulu</p>
            </div>
          ) : (
            <>
              {/* Info santri terpilih */}
              <div className="mb-4 p-3 rounded-lg border border-gray-200 bg-gray-50">
                <p className="font-medium" style={{ color: selectedSantri.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>
                  {selectedSantri.nama_lengkap}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  NIK: {selectedSantri.nik} • {selectedSantri.jilid}
                  {selectedSantri.tgl_mendaftar && (
                    <> • Terdaftar: {new Date(selectedSantri.tgl_mendaftar).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })}</>
                  )}
                </p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs">
                  <span className="px-2 py-0.5 rounded-full font-medium"
                    style={{ background: selectedSantri.is_subsidi ? '#EFF6FF' : '#F0FDF4', color: selectedSantri.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>
                    {selectedSantri.is_subsidi ? '🔵 Subsidi' : '🟢 Non Subsidi'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
                    SPP: {formatCurrency(selectedSantri.nominal_spp)}/bln
                  </span>
                  {bulanMulai && (
                    <span className="px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700">
                      Wajib bayar mulai: <strong>{namaBulan[bulanMulai - 1]} {tahun}</strong>
                    </span>
                  )}
                  {earliestUnpaid ? (
                    <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                      Tunggakan dari: <strong>{namaBulan[earliestUnpaid - 1]} {tahun}</strong>
                    </span>
                  ) : selectedSantri.bulan_wajib > 0 ? (
                    <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                      ✓ Lunas {tahun}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Grid bulan */}
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-5">
                {namaBulan.map((nama, index) => {
                  const bulan            = index + 1;
                  const { wajib, dibayar, alasan, canSelectWithManualNominal } = getBulanInfo(bulan);
                  const isSelected       = selectedBulan.includes(bulan);
                  const selectedSorted   = [...selectedBulan].sort((a, b) => a - b);
                  const expectedNext     = selectedSorted.length === 0
                    ? earliestUnpaid
                    : selectedSorted[selectedSorted.length - 1] + 1;
                  const canSelect        = wajib && !dibayar && bulan === expectedNext;
                  const canSelectNonaktif = canSelectWithManualNominal && !dibayar && canAbaikanNominal;
                  const isBeforeReg      = !wajib && alasan === 'Belum Terdaftar';
                  const isNonaktif       = !wajib && alasan === 'Nonaktif';

                  // Sebelum pendaftaran → ungu
                  if (isBeforeReg) {
                    return (
                      <div key={bulan}
                        className="p-3 rounded-lg border-2 bg-purple-50 border-purple-200 text-center cursor-not-allowed"
                        title="Sebelum tanggal pendaftaran – tidak wajib dibayar">
                        <p className="text-sm text-purple-500 font-medium">{nama.substring(0,3)}</p>
                        <p className="text-xs text-purple-400 mt-0.5">◯</p>
                      </div>
                    );
                  }

                  // Nonaktif → bisa dipilih jika setting nominal manual, atau unclickable
                  if (isNonaktif) {
                    // Jika selected, tampilkan sama seperti bulan wajib yang selected
                    if (isSelected) {
                      return (
                        <button key={bulan}
                          onClick={() => handleBulanChange(bulan)}
                          className="p-3 rounded-lg border-2 bg-blue-500 border-blue-600 text-white text-center hover:bg-blue-600 transition-colors"
                          title="Nonaktif - dipilih untuk input manual. Klik untuk hapus.">
                          <p className="text-sm font-medium">{nama.substring(0,3)}</p>
                          <p className="text-xs mt-0.5">✓</p>
                        </button>
                      );
                    }
                    // Jika bisa dipilih (admin dengan akses nominal manual)
                    if (canSelectNonaktif) {
                      return (
                        <button key={bulan}
                          onClick={() => handleBulanChange(bulan)}
                          className="p-3 rounded-lg border-2 bg-orange-50 border-orange-300 text-center hover:bg-orange-100 cursor-pointer transition-colors"
                          title="Nonaktif - bisa dipilih untuk input nominal manual">
                          <p className="text-sm text-orange-600 font-medium">{nama.substring(0,3)}</p>
                          <p className="text-xs text-orange-400 mt-0.5">◆</p>
                        </button>
                      );
                    }
                    // Tidak bisa dipilih
                    return (
                      <div key={bulan}
                        className="p-3 rounded-lg border-2 bg-orange-50 border-orange-200 text-center cursor-not-allowed"
                        title="Santri nonaktif pada bulan ini">
                        <p className="text-sm text-orange-400 font-medium">{nama.substring(0,3)}</p>
                        <p className="text-xs text-orange-400 mt-0.5">–</p>
                      </div>
                    );
                  }

                  // Sudah lunas → hijau, klik untuk detail/batalkan
                  if (dibayar) {
                    return (
                      <button key={bulan}
                        className="p-3 rounded-lg border-2 bg-green-100 border-green-300 text-green-700 text-center hover:bg-green-200 transition-colors"
                        title={`${nama} – Lunas`}>
                        <p className="text-sm font-medium">{nama.substring(0,3)}</p>
                        <svg className="w-4 h-4 mx-auto mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </button>
                    );
                  }

                  // Dipilih (termasuk yang di tengah urutan)
                  if (isSelected) {
                    return (
                      <button key={bulan}
                        onClick={() => handleBulanChange(bulan)}
                        className="p-3 rounded-lg border-2 bg-blue-500 border-blue-600 text-white text-center hover:bg-blue-600 transition-colors"
                        title="Klik untuk hapus pilihan">
                        <p className="text-sm font-medium">{nama.substring(0,3)}</p>
                        <p className="text-xs mt-0.5">✓</p>
                      </button>
                    );
                  }

                  // Bisa dipilih (giliran berikutnya)
                  if (canSelect) {
                    return (
                      <button key={bulan}
                        onClick={() => handleBulanChange(bulan)}
                        className="p-3 rounded-lg border-2 bg-white border-gray-300 hover:border-blue-400 hover:bg-blue-50 text-gray-700 text-center transition-colors"
                        title={`Bayar ${nama}`}>
                        <p className="text-sm font-medium">{nama.substring(0,3)}</p>
                        <p className="text-xs mt-0.5 text-blue-400">○</p>
                      </button>
                    );
                  }

                  // Terkunci (belum giliran)
                  return (
                    <div key={bulan}
                      className="p-3 rounded-lg border-2 bg-gray-50 border-gray-200 text-gray-400 text-center cursor-not-allowed"
                      title="Bayar bulan-bulan sebelumnya terlebih dahulu">
                      <p className="text-sm">{nama.substring(0,3)}</p>
                      <svg className="w-3.5 h-3.5 mx-auto mt-0.5 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                  );
                })}
              </div>

              {/* Nominal & Metode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nominal per Bulan
                    {!abaikanAturanNominal && <span className="ml-1 text-xs text-gray-400">(dari pengaturan)</span>}
                  </label>
                  <input
                    type={abaikanAturanNominal ? 'number' : 'text'}
                    value={abaikanAturanNominal ? nominal : formatCurrency(nominal)}
                    onChange={(e) => {
                      if (!abaikanAturanNominal) return;
                      const v = parseInt(e.target.value || '0', 10);
                      setNominal(Number.isNaN(v) ? 0 : v);
                    }}
                    className={`input-field ${!abaikanAturanNominal ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    readOnly={!abaikanAturanNominal}
                  />
                  {canAbaikanNominal && (
                    <label className="mt-2 flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={abaikanAturanNominal}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setAbaikanAturanNominal(checked);
                          if (!checked && selectedSantri) setNominal(selectedSantri.nominal_spp || 0);
                        }}
                      />
                      Masukkan nominal manual
                    </label>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
                  <select value={metodeBayar} onChange={(e) => setMetodeBayar(e.target.value)} className="input-field">
                    <option value="Tunai">Tunai</option>
                    <option value="Transfer">Transfer</option>
                  </select>
                </div>
              </div>

              {/* Ringkasan & tombol bayar */}
              {selectedBulan.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 mb-4 border border-blue-100">
                  <p className="text-sm text-gray-600">
                    Bulan dipilih: <span className="font-semibold">{selectedBulan.map(b => namaBulan[b-1]).join(', ')}</span>
                  </p>
                  <p className="text-lg font-bold text-blue-700 mt-1">
                    Total: {formatCurrency(totalBayar)}
                    {abaikanAturanNominal && <span className="ml-2 text-xs font-normal text-yellow-600">⚠️ nominal manual</span>}
                  </p>
                </div>
              )}

              <button
                onClick={() => { setShowConfirm(true); setPin(''); }}
                disabled={selectedBulan.length === 0}
                className={`w-full font-semibold py-2.5 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  abaikanAturanNominal ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900' : 'btn-primary'
                }`}
              >
                {abaikanAturanNominal && <span className="mr-1">⚠️</span>}
                {selectedBulan.length > 0
                  ? `Proses Pembayaran (${selectedBulan.length} bulan – ${formatCurrency(totalBayar)})`
                  : 'Proses Pembayaran'}
              </button>

              {/* Daftar batalkan pembayaran */}
              {Object.keys(paidPayments).length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                    <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Batalkan Pembayaran
                  </h4>
                  <p className="text-xs text-gray-500 mb-2">
                    Centang dari bulan terakhir yang dibayar, satu per satu.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(paidPayments)
                      .sort(([a],[b]) => parseInt(b)-parseInt(a))
                      .map(([bulan, payment]) => (
                        <label key={bulan} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200 cursor-pointer">
                          <div>
                            <p className="text-xs font-medium text-green-800">{namaBulan[parseInt(bulan)-1]}</p>
                            <p className="text-xs text-green-600">{formatCurrency(payment.nominal)}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={selectedCancelBulan.includes(parseInt(bulan, 10))}
                            disabled={
                              !selectedCancelBulan.includes(parseInt(bulan, 10)) &&
                              !isCancelSelectionAllowed(parseInt(bulan, 10))
                            }
                            onChange={(e) => toggleCancelBulan(parseInt(bulan, 10), e.target.checked)}
                            className="w-4 h-4"
                          />
                        </label>
                      ))}
                  </div>
                  {selectedCancelBulan.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => {
                          const bulan = selectedCancelBulan[0] || null;
                          const payment = bulan ? paidPayments[bulan] || null : null;
                          setCancelModal({ show: true, payment, bulan, cancelPin: '' });
                        }}
                        className="btn-danger w-full"
                      >
                        Batalkan Pembayaran ({selectedCancelBulan.length} bulan)
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Modal Konfirmasi Pembayaran ──────────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Konfirmasi Pembayaran</h3>
            <div className="space-y-3 mb-6">
              {[
                ['Nama Santri', <span style={{ color: selectedSantri?.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>{selectedSantri?.nama_lengkap}</span>],
                ['NIK',         selectedSantri?.nik],
                ['Tahun',       tahun],
                ['Bulan',       selectedBulan.map(b => namaBulan[b-1]).join(', ')],
                ['Nominal/Bln', `${formatCurrency(nominal)}${abaikanAturanNominal ? ' ⚠️ manual' : ''}`],
                ['Metode',      metodeBayar],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-gray-600">{label}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
              <hr />
              <div className="flex justify-between text-lg font-bold">
                <span>Total Bayar</span>
                <span className="text-green-600">{formatCurrency(totalBayar)}</span>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                PIN Verifikasi <span className="text-red-500">*</span>
              </label>
              <input type="password" value={pin} onChange={(e) => setPin(e.target.value)}
                onKeyDown={(e) => { if (e.key==='Enter' && pin && !submitLoading) handleSubmit(); }}
                placeholder="Masukkan PIN Anda" className="input-field" maxLength={8} autoFocus />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowConfirm(false); setPin(''); }} className="btn-secondary flex-1">Batal</button>
              <button onClick={handleSubmit} disabled={submitLoading||!pin} className="btn-primary flex-1">
                {submitLoading ? 'Memproses...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Batalkan Pembayaran ────────────────────────────────────────── */}
      {cancelModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Batalkan Pembayaran</h3>
            <div className="mb-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-xs font-medium text-gray-600 mb-1">Bulan terpilih untuk dibatalkan:</p>
              <p className="text-sm text-gray-800 font-semibold">
                {selectedCancelBulan
                  .map((b) => namaBulan[b - 1])
                  .join(', ')}
              </p>
            </div>
            <div className="p-3 bg-red-50 rounded-lg mb-4">
              <p className="text-sm text-red-700">
                {selectedCancelBulan.length > 1
                  ? <>Batalkan <strong>{selectedCancelBulan.length} pembayaran</strong> yang dipilih?</>
                  : <>Batalkan pembayaran bulan <strong>{cancelModal.bulan ? namaBulan[cancelModal.bulan-1] : ''}</strong>?</>}
              </p>
              {cancelModal.payment && (
                <div className="mt-2 text-xs text-red-600 space-y-0.5">
                  {cancelModal.payment.kode_invoice && <p>Kode: {cancelModal.payment.kode_invoice}</p>}
                  <p>Nominal: {formatCurrency(cancelModal.payment.nominal)}</p>
                  {cancelModal.payment.tgl_bayar && (
                    <p>Tgl Bayar: {new Date(cancelModal.payment.tgl_bayar).toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' })}</p>
                  )}
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-3">Masukkan PIN untuk konfirmasi pembatalan.</p>
            <input type="password" value={cancelModal.cancelPin}
              onChange={(e) => setCancelModal(prev => ({ ...prev, cancelPin: e.target.value }))}
              onKeyDown={(e) => { if (e.key==='Enter' && cancelModal.cancelPin && !cancelLoading) handleCancelPayment(); }}
              placeholder="Masukkan PIN Anda" className="input-field mb-4" maxLength={8} autoFocus />
            <div className="flex gap-3">
              <button onClick={() => { setCancelModal({ show: false, payment: null, bulan: null, cancelPin: '' }); setSelectedCancelBulan([]); }} className="btn-secondary flex-1">Tidak</button>
              <button onClick={handleCancelPayment} disabled={cancelLoading||!cancelModal.cancelPin||selectedCancelBulan.length===0} className="btn-danger flex-1">
                {cancelLoading ? 'Membatalkan...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BayarPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-10 w-10 text-green-600" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    }>
      <BayarPageInner />
    </Suspense>
  );
}
