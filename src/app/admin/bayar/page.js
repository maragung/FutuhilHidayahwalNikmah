'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { safeHexColor } from '@/lib/color';

export default function BayarPage() {
  const searchParams = useSearchParams();
  const santriIdParam = searchParams.get('santri');
  
  const [loading, setLoading] = useState(false);
  const [santriList, setSantriList] = useState([]);
  const [selectedSantri, setSelectedSantri] = useState(null);
  const [search, setSearch] = useState('');
  const [tahun, setTahun] = useState(new Date().getFullYear());
  const [selectedBulan, setSelectedBulan] = useState([]);
  const [nominal, setNominal] = useState(50000);
  const [abaikanAturanNominal, setAbaikanAturanNominal] = useState(false);
  const [metodeBayar, setMetodeBayar] = useState('Tunai');
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [paidMonths, setPaidMonths] = useState({});
  const [paidPayments, setPaidPayments] = useState({}); // bulan -> {id, kode_invoice, nominal, tgl_bayar}
  const [pin, setPin] = useState('');
  const [cancelModal, setCancelModal] = useState({ show: false, payment: null, bulan: null, cancelPin: '' });
  const [cancelLoading, setCancelLoading] = useState(false);
  const [canAbaikanNominal, setCanAbaikanNominal] = useState(false);
  const [settings, setSettings] = useState({
    nominal_spp_non_subsidi: '40000',
    nominal_spp_subsidi: '30000',
    warna_non_subsidi: '#04B816',
    warna_subsidi: '#045EB8',
    tahun_mulai_pembukuan: String(new Date().getFullYear()),
  });

  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const warnaNonSubsidi = safeHexColor(settings.warna_non_subsidi, '#04B816');
  const warnaSubsidi = safeHexColor(settings.warna_subsidi, '#045EB8');

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const getTarifSantri = (santri) => {
    const tarifNonSubsidi = parseFloat(settings.nominal_spp_non_subsidi || 40000);
    const tarifSubsidi = parseFloat(settings.nominal_spp_subsidi || 30000);
    if (!santri) return tarifNonSubsidi;
    if (santri.is_subsidi) return tarifSubsidi;
    if (!santri.nama_wali || !santri.no_telp_wali) return tarifNonSubsidi;

    const jumlahKeluarga = santriList.filter((s) =>
      s.status_aktif &&
      s.nama_wali === santri.nama_wali &&
      s.no_telp_wali === santri.no_telp_wali
    ).length;

    return jumlahKeluarga >= 2 ? tarifSubsidi : tarifNonSubsidi;
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const startYear = parseInt(settings.tahun_mulai_pembukuan || currentYear);
    const years = [];
    for (let year = currentYear + 1; year >= startYear; year--) years.push(year);
    return years;
  };

  // Fetch santri list
  useEffect(() => {
    const fetchSantri = async () => {
      const token = localStorage.getItem('auth_token');
      try {
        const res = await fetch('/api/santri?status=aktif&limit=200', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          setSantriList(data.data);
          
          if (santriIdParam) {
            const found = data.data.find(s => s.id === parseInt(santriIdParam));
            if (found) {
              setSelectedSantri(found);
            }
          }
        }
      } catch (err) {
        setError('Gagal memuat data santri');
      }
    };
    fetchSantri();
  }, [santriIdParam]);

  useEffect(() => {
    try {
      const admin = JSON.parse(localStorage.getItem('admin_data') || '{}');
      setCanAbaikanNominal(['Pimpinan TPQ', 'Bendahara', 'Sekretaris'].includes(admin.jabatan));
    } catch {
      setCanAbaikanNominal(false);
    }
  }, []);

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

  useEffect(() => {
    if (selectedSantri) {
      fetchPaymentStatus();
      if (!abaikanAturanNominal) {
        setNominal(getTarifSantri(selectedSantri));
      }
    }
  }, [selectedSantri, tahun, settings, santriList, abaikanAturanNominal]);

  const getWajibRange = () => {
    if (!selectedSantri) return { start: 1, end: 12, valid: false };
    const tglMendaftar = new Date(selectedSantri.tgl_mendaftar);
    const tahunDaftar = tglMendaftar.getFullYear();
    const bulanDaftar = tglMendaftar.getMonth() + 1;

    if (tahun < tahunDaftar) return { start: 13, end: 12, valid: false };

    const start = tahun === tahunDaftar ? bulanDaftar : 1;
    let end = 12;
    if (selectedSantri.tgl_nonaktif) {
      const tglNonaktif = new Date(selectedSantri.tgl_nonaktif);
      if (tglNonaktif.getFullYear() < tahun) return { start: 13, end: 12, valid: false };
      if (tglNonaktif.getFullYear() === tahun) end = Math.min(12, tglNonaktif.getMonth());
    }

    return { start, end, valid: end >= start };
  };

  const getEarliestUnpaid = () => {
    const range = getWajibRange();
    if (!range.valid) return null;
    for (let b = range.start; b <= range.end; b++) {
      if (!paidMonths[b]) return b;
    }
    return null;
  };

  const fetchPaymentStatus = async () => {
    const token = localStorage.getItem('auth_token');
    try {
      const res = await fetch(`/api/pembayaran?santri_id=${selectedSantri.id}&tahun=${tahun}&limit=12`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        const paid = {};
        const payments = {};
        data.data.forEach(p => {
          paid[p.bulan_spp] = true;
          payments[p.bulan_spp] = {
            id: p.id,
            kode_invoice: p.kode_invoice,
            nominal: p.nominal,
            tgl_bayar: p.tgl_bayar,
            metode_bayar: p.metode_bayar,
          };
        });
        setPaidMonths(paid);
        setPaidPayments(payments);
        setSelectedBulan([]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelPayment = async () => {
    if (!cancelModal.cancelPin) {
      setError('PIN wajib diisi');
      return;
    }
    setCancelLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/api/pembayaran/${cancelModal.payment.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ pin: cancelModal.cancelPin }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(`Pembayaran bulan ${namaBulan[cancelModal.bulan - 1]} berhasil dibatalkan`);
        setCancelModal({ show: false, payment: null, bulan: null, cancelPin: '' });
        fetchPaymentStatus();
      } else {
        setError(data.pesan || 'Gagal membatalkan pembayaran');
      }
    } catch {
      setError('Terjadi kesalahan saat membatalkan pembayaran');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleSelectSantri = (santri) => {
    setSelectedSantri(santri);
    setSelectedBulan([]);
    setSearch('');
  };

  const handleBulanChange = (bulan) => {
    if (paidMonths[bulan]) return;

    const range = getWajibRange();
    if (!range.valid || bulan < range.start || bulan > range.end) return;

    const earliest = getEarliestUnpaid();
    if (!earliest) return;
    
    setSelectedBulan(prev => {
      if (prev.includes(bulan)) {
        const sorted = [...prev].sort((a, b) => a - b);
        const last = sorted[sorted.length - 1];
        if (bulan !== last) return prev;
        return prev.filter(b => b !== bulan).sort((a, b) => a - b);
      } else {
        const sorted = [...prev].sort((a, b) => a - b);
        const expectedNext = sorted.length === 0 ? earliest : sorted[sorted.length - 1] + 1;
        if (bulan !== expectedNext) return prev;
        return [...prev, bulan].sort((a, b) => a - b);
      }
    });
  };

  const handleSubmit = async () => {
    if (!selectedSantri || selectedBulan.length === 0) return;
    
    if (!pin) {
      setError('PIN wajib diisi untuk verifikasi');
      return;
    }

    setSubmitLoading(true);
    setError('');
    
    const token = localStorage.getItem('auth_token');
    
    try {
      const res = await fetch('/api/pembayaran', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          santri_id: selectedSantri.id,
          bulan_list: selectedBulan,
          tahun_spp: tahun,
          nominal_per_bulan: nominal,
          abaikan_aturan_nominal: abaikanAturanNominal,
          metode_bayar: metodeBayar,
          pin,
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setSuccess(`Pembayaran ${selectedBulan.length} bulan berhasil dicatat!`);
        setShowConfirm(false);
        setSelectedBulan([]);
        setPin('');
        fetchPaymentStatus();
      } else {
        setError(data.pesan);
      }
    } catch (err) {
      setError('Gagal menyimpan pembayaran');
    } finally {
      setSubmitLoading(false);
    }
  };

  const filteredSantri = santriList.filter(s => 
    s.nama_lengkap.toLowerCase().includes(search.toLowerCase()) ||
    s.nik.includes(search)
  );

  const totalBayar = selectedBulan.length * nominal;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Bayar SPP</h1>
        <p className="text-gray-500">Catat pembayaran SPP santri</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pilih Santri */}
        <div className="card lg:col-span-1">
          <h3 className="font-semibold text-gray-800 mb-4">1. Pilih Santri</h3>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama atau NIK..."
            className="input-field mb-3"
          />
          <div className="max-h-80 overflow-y-auto space-y-2">
            {filteredSantri.slice(0, 20).map(santri => (
              <button
                key={santri.id}
                onClick={() => handleSelectSantri(santri)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedSantri?.id === santri.id
                    ? 'bg-green-50 border-green-500'
                    : 'bg-white border-gray-200 hover:border-green-300'
                }`}
              >
                <p className="font-medium" style={{ color: santri.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>{santri.nama_lengkap}</p>
                <p className="text-xs text-gray-500">{santri.nik} • {santri.jilid} • {santri.is_subsidi ? 'Subsidi' : 'Non Subsidi'}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Pilih Bulan */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">2. Pilih Bulan Pembayaran</h3>
            <select
              value={tahun}
              onChange={(e) => setTahun(parseInt(e.target.value))}
              className="input-field w-auto"
            >
              {getYearOptions().map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          {!selectedSantri ? (
            <div className="text-center py-8 text-gray-500">
              Pilih santri terlebih dahulu
            </div>
          ) : (
            <>
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="font-medium" style={{ color: selectedSantri.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>{selectedSantri.nama_lengkap}</p>
                <p className="text-sm text-gray-500">
                  NIK: {selectedSantri.nik} • {selectedSantri.jilid} • 
                  Terdaftar: {new Date(selectedSantri.tgl_mendaftar).toLocaleDateString('id-ID', { year: 'numeric', month: 'long' })}
                </p>
                <p className="text-xs mt-1" style={{ color: selectedSantri.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>
                  {selectedSantri.is_subsidi ? 'Kategori: Subsidi' : 'Kategori: Non Subsidi'}
                </p>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 mb-6">
                {namaBulan.map((nama, index) => {
                  const bulan = index + 1;
                  const isPaid = paidMonths[bulan];
                  const isSelected = selectedBulan.includes(bulan);
                  const range = getWajibRange();
                  const earliestUnpaid = getEarliestUnpaid();
                  const selectedSorted = [...selectedBulan].sort((a, b) => a - b);
                  const expectedNext = selectedSorted.length === 0 ? earliestUnpaid : selectedSorted[selectedSorted.length - 1] + 1;
                  const canSelect = range.valid && bulan >= range.start && bulan <= range.end && !isPaid && bulan === expectedNext;

                  const tglMendaftar = new Date(selectedSantri.tgl_mendaftar);
                  const bulanDaftar = tglMendaftar.getMonth() + 1;
                  const tahunDaftar = tglMendaftar.getFullYear();
                  
                  let isBeforeRegistration = false;
                  if (tahun === tahunDaftar && bulan < bulanDaftar) {
                    isBeforeRegistration = true;
                  } else if (tahun < tahunDaftar) {
                    isBeforeRegistration = true;
                  }

                  if (isBeforeRegistration) {
                    return (
                      <div
                        key={bulan}
                        className="p-3 rounded-lg border-2 bg-purple-50 border-purple-200 text-center cursor-not-allowed"
                      >
                        <p className="text-sm text-purple-600">{nama.substring(0, 3)}</p>
                        <p className="text-xs text-purple-600">◯</p>
                      </div>
                    );
                  }

                  if (!range.valid || bulan > range.end) {
                    return (
                      <div
                        key={bulan}
                        className="p-3 rounded-lg border-2 bg-gray-50 border-gray-200 text-center opacity-60 cursor-not-allowed"
                      >
                        <p className="text-sm text-gray-400">{nama.substring(0, 3)}</p>
                        <p className="text-xs text-gray-400">-</p>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={bulan}
                      onClick={() => handleBulanChange(bulan)}
                      disabled={isPaid || (!isSelected && !canSelect)}
                      className={`p-3 rounded-lg border-2 text-center transition-all ${
                        isPaid
                          ? 'bg-green-100 border-green-300 text-green-700 cursor-not-allowed'
                          : isSelected
                          ? 'bg-blue-500 border-blue-600 text-white'
                          : canSelect
                            ? 'bg-white border-gray-200 hover:border-blue-400'
                            : 'bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <p className="text-sm font-medium">{nama.substring(0, 3)}</p>
                      {isPaid && (
                        <svg className="w-5 h-5 mx-auto mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mb-4 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                <p>Pembayaran wajib berurutan dari bulan yang belum lunas pertama.</p>
                <p>Bulan sebelum tanggal daftar ditandai ungu dan tidak bisa dibayar.</p>
              </div>

              {/* Nominal & Metode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nominal per Bulan (dari Pengaturan)</label>
                  <input
                    type={abaikanAturanNominal ? 'number' : 'text'}
                    value={abaikanAturanNominal ? nominal : formatCurrency(nominal)}
                    onChange={(e) => {
                      if (!abaikanAturanNominal) return;
                      const value = parseInt(e.target.value || '0', 10);
                      setNominal(Number.isNaN(value) ? 0 : value);
                    }}
                    className={`input-field ${abaikanAturanNominal ? '' : 'bg-gray-100 cursor-not-allowed'}`}
                    readOnly={!abaikanAturanNominal}
                  />
                  {canAbaikanNominal && (
                    <label className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={abaikanAturanNominal}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setAbaikanAturanNominal(checked);
                          if (!checked && selectedSantri) {
                            setNominal(getTarifSantri(selectedSantri));
                          }
                        }}
                      />
                      Abaikan aturan (isi nominal manual)
                    </label>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Metode Pembayaran</label>
                  <select
                    value={metodeBayar}
                    onChange={(e) => setMetodeBayar(e.target.value)}
                    className="input-field"
                  >
                    <option value="Tunai">Tunai</option>
                    <option value="Transfer">Transfer</option>
                  </select>
                </div>
              </div>

              {/* Summary */}
              {selectedBulan.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-gray-600">
                    Bulan dipilih: <span className="font-semibold">{selectedBulan.map(b => namaBulan[b-1]).join(', ')}</span>
                  </p>
                  <p className="text-lg font-bold text-blue-700 mt-1">
                    Total: {formatCurrency(totalBayar)}
                  </p>
                </div>
              )}

              <button
                onClick={() => { setShowConfirm(true); setPin(''); }}
                disabled={selectedBulan.length === 0}
                className={`w-full font-semibold py-2 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  abaikanAturanNominal
                    ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900'
                    : 'btn-primary'
                }`}
              >
                {abaikanAturanNominal && <span className="mr-2">⚠️</span>}
                Proses Pembayaran
              </button>

              {/* Batalkan Pembayaran */}
              {Object.keys(paidPayments).length > 0 && (
                <div className="mt-6 pt-4 border-t border-gray-200">
                  <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Batalkan Pembayaran
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(paidPayments)
                      .sort(([a], [b]) => parseInt(a) - parseInt(b))
                      .map(([bulan, payment]) => (
                        <div key={bulan} className="flex items-center justify-between p-2 bg-green-50 rounded border border-green-200">
                          <div>
                            <p className="text-xs font-medium text-green-800">{namaBulan[parseInt(bulan) - 1]}</p>
                            <p className="text-xs text-green-600">{formatCurrency(payment.nominal)}</p>
                          </div>
                          <button
                            onClick={() => setCancelModal({ show: true, payment, bulan: parseInt(bulan), cancelPin: '' })}
                            className="text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded px-1 py-0.5 border border-red-200"
                            title={`Batalkan pembayaran ${namaBulan[parseInt(bulan) - 1]}`}
                          >
                            Batal
                          </button>
                        </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Konfirmasi Pembayaran</h3>
            
            <div className="space-y-3 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Nama Santri</span>
                <span className="font-medium" style={{ color: selectedSantri?.is_subsidi ? warnaSubsidi : warnaNonSubsidi }}>{selectedSantri?.nama_lengkap}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">NIK</span>
                <span className="font-medium">{selectedSantri?.nik}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tahun</span>
                <span className="font-medium">{tahun}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Bulan</span>
                <span className="font-medium">{selectedBulan.map(b => namaBulan[b-1]).join(', ')}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Nominal per Bulan</span>
                <span className="font-medium">{formatCurrency(nominal)}{abaikanAturanNominal ? ' (manual)' : ''}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Metode</span>
                <span className="font-medium">{metodeBayar}</span>
              </div>
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
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="Masukkan PIN Anda"
                className="input-field"
                maxLength={6}
                autoFocus
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowConfirm(false); setPin(''); }}
                className="btn-secondary flex-1"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitLoading || !pin}
                className="btn-primary flex-1"
              >
                {submitLoading ? 'Memproses...' : 'Konfirmasi'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Cancel Modal */}
      {cancelModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-2">Batalkan Pembayaran</h3>
            <div className="p-3 bg-red-50 rounded-lg mb-4">
              <p className="text-sm text-red-700">
                Apakah Anda yakin ingin membatalkan pembayaran bulan{' '}
                <strong>{cancelModal.bulan ? namaBulan[cancelModal.bulan - 1] : ''}</strong>?
              </p>
              {cancelModal.payment && (
                <div className="mt-2 text-xs text-red-600 space-y-1">
                  <p>Kode: {cancelModal.payment.kode_invoice}</p>
                  <p>Nominal: {formatCurrency(cancelModal.payment.nominal)}</p>
                  <p>Tgl Bayar: {new Date(cancelModal.payment.tgl_bayar).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-3">Masukkan PIN untuk konfirmasi pembatalan.</p>
            <input
              type="password"
              value={cancelModal.cancelPin}
              onChange={(e) => setCancelModal(prev => ({ ...prev, cancelPin: e.target.value }))}
              placeholder="Masukkan PIN Anda"
              className="input-field mb-4"
              maxLength={8}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setCancelModal({ show: false, payment: null, bulan: null, cancelPin: '' })}
                className="btn-secondary flex-1"
              >
                Tidak
              </button>
              <button
                onClick={handleCancelPayment}
                disabled={cancelLoading || !cancelModal.cancelPin}
                className="btn-danger flex-1"
              >
                {cancelLoading ? 'Membatalkan...' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
