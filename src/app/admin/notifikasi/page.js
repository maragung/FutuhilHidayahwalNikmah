'use client';

import { useState, useEffect, useCallback } from 'react';

const TABEL_LABEL = {
  santri: 'Santri',
  pembayaran_spp: 'Pembayaran SPP',
  pengeluaran: 'Pengeluaran',
  infak_sedekah: 'Infak/Sedekah',
  jurnal_kas: 'Jurnal Kas',
  admins: 'Admin',
  pengaturan: 'Pengaturan',
};

const AKSI_CONFIG = {
  tambah:   { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500', label: 'Tambah' },
  create:   { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500', label: 'Tambah' },
  insert:   { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-500', label: 'Tambah' },
  ubah:     { bg: 'bg-blue-100',  text: 'text-blue-800',  dot: 'bg-blue-500',  label: 'Ubah' },
  update:   { bg: 'bg-blue-100',  text: 'text-blue-800',  dot: 'bg-blue-500',  label: 'Ubah' },
  edit:     { bg: 'bg-blue-100',  text: 'text-blue-800',  dot: 'bg-blue-500',  label: 'Ubah' },
  hapus:    { bg: 'bg-red-100',   text: 'text-red-800',   dot: 'bg-red-500',   label: 'Hapus' },
  delete:   { bg: 'bg-red-100',   text: 'text-red-800',   dot: 'bg-red-500',   label: 'Hapus' },
  batal:    { bg: 'bg-red-100',   text: 'text-red-800',   dot: 'bg-red-500',   label: 'Batalkan' },
  batalkan: { bg: 'bg-red-100',   text: 'text-red-800',   dot: 'bg-red-500',   label: 'Batalkan' },
};

function getAksiConfig(aksi = '') {
  const key = aksi.toLowerCase().trim();
  for (const [k, v] of Object.entries(AKSI_CONFIG)) {
    if (key.includes(k)) return v;
  }
  return { bg: 'bg-gray-100', text: 'text-gray-800', dot: 'bg-gray-400', label: aksi };
}

const HIDDEN_KEYS = ['password', 'pin', 'password_hash'];

function formatValue(v) {
  if (v === null || v === undefined) return <span className="text-gray-400 italic">null</span>;
  if (typeof v === 'object') return <span className="text-gray-600">{JSON.stringify(v)}</span>;
  return String(v);
}

function ObjectTable({ obj, index }) {
  const entries = Object.entries(obj).filter(([k]) => !HIDDEN_KEYS.includes(k.toLowerCase()));
  return (
    <table className="w-full text-sm">
      {index !== undefined && (
        <thead>
          <tr><th colSpan={2} className="text-left pb-1 pt-2 text-xs text-gray-400">#{index + 1}</th></tr>
        </thead>
      )}
      <tbody>
        {entries.map(([k, v]) => (
          <tr key={k} className="border-b border-gray-100 last:border-0">
            <td className="py-1 pr-3 font-medium text-gray-600 whitespace-nowrap w-2/5">{k}</td>
            <td className="py-1 text-gray-800 break-all">{formatValue(v)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DataTable({ data, title }) {
  if (!data) return <p className="text-sm text-gray-400 italic">Tidak ada data</p>;

  let parsed = data;
  if (typeof data === 'string') {
    try { parsed = JSON.parse(data); } catch { return <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all">{data}</pre>; }
  }

  if (parsed === null || parsed === undefined) {
    return <p className="text-sm text-gray-400 italic">Tidak ada data</p>;
  }

  // Array of records
  if (Array.isArray(parsed)) {
    return (
      <div>
        {title && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>}
        {parsed.length === 0 && <p className="text-sm text-gray-400 italic">Data kosong</p>}
        {parsed.map((item, i) => (
          <div key={i} className={i > 0 ? 'mt-3 pt-3 border-t border-gray-200' : ''}>
            {parsed.length > 1 && <p className="text-xs text-gray-400 mb-1">#{i + 1}</p>}
            {typeof item === 'object' && item !== null
              ? <ObjectTable obj={item} />
              : <p className="text-sm text-gray-800">{String(item)}</p>
            }
          </div>
        ))}
      </div>
    );
  }

  // Plain object
  if (typeof parsed === 'object') {
    return (
      <div>
        {title && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>}
        <ObjectTable obj={parsed} />
      </div>
    );
  }

  return <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all">{String(parsed)}</pre>;
}

export default function NotifikasiPage() {
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError]           = useState('');
  const [page, setPage]             = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected]     = useState(null);

  const formatDate = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  const fetchData = useCallback(async (p = 1, append = false) => {
    const token = localStorage.getItem('auth_token');
    if (!token) { setError('Tidak ada sesi login'); setLoading(false); return; }
    try {
      const res  = await fetch(`/api/notifikasi?page=${p}&limit=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.pesan || 'Gagal memuat data');
      setItems(prev => append ? [...prev, ...json.data] : json.data);
      setTotalPages(json.pagination.totalPages);
      setPage(json.pagination.page);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => { fetchData(1); }, [fetchData]);

  const handleLoadMore = () => {
    if (page < totalPages && !loadingMore) {
      setLoadingMore(true);
      fetchData(page + 1, true);
    }
  };

  if (loading) {
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
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Notifikasi</h1>
          <p className="text-sm text-gray-500 mt-1">Riwayat aktivitas yang Anda lakukan</p>
        </div>
        <button
          onClick={() => { setLoading(true); setPage(1); fetchData(1); }}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          title="Refresh"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-4 text-sm">{error}</div>
      )}

      {items.length === 0 && !error ? (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <p className="font-medium">Belum ada aktivitas</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const cfg = getAksiConfig(item.aksi);
            const tabelLabel = TABEL_LABEL[item.tabel] || item.tabel;
            return (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className="w-full text-left bg-white rounded-xl shadow-sm border border-gray-100 hover:border-green-200 hover:shadow-md transition-all p-4"
              >
                <div className="flex items-start gap-3">
                  {/* Color dot */}
                  <div className={`mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                      </span>
                      <span className="text-sm font-medium text-gray-700">{tabelLabel}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{formatDate(item.tgl_backup)}</p>
                  </div>
                  <svg className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
            );
          })}

          {/* Load more */}
          {page < totalPages && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full py-3 text-sm text-green-700 font-medium hover:bg-green-50 rounded-xl border border-green-200 transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Memuat...' : 'Muat lebih banyak'}
            </button>
          )}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${getAksiConfig(selected.aksi).dot}`} />
                <div>
                  <p className="font-semibold text-gray-800">
                    {getAksiConfig(selected.aksi).label} — {TABEL_LABEL[selected.tabel] || selected.tabel}
                  </p>
                  <p className="text-xs text-gray-400">{formatDate(selected.tgl_backup)}</p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto p-5 space-y-5">
              {selected.data_sesudah && (
                <div className="bg-green-50 rounded-xl p-4">
                  <DataTable data={selected.data_sesudah} title="Data Sesudah" />
                </div>
              )}
              {selected.data_sebelum && (
                <div className="bg-red-50 rounded-xl p-4">
                  <DataTable data={selected.data_sebelum} title="Data Sebelum" />
                </div>
              )}
              {!selected.data_sebelum && !selected.data_sesudah && (
                <p className="text-sm text-gray-400 italic text-center py-4">Tidak ada detail data tersimpan</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
