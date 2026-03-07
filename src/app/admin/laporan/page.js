'use client';

import { useEffect, useState } from 'react';
import { safeHexColor } from '@/lib/color';

export default function LaporanPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [filter, setFilter] = useState({
    tipe: 'santri',
    tahun: new Date().getFullYear(),
    bulan: '',
    format: 'pdf',
    kegiatan_id: '',
    filter_kategori: '',   // subsidi | non_subsidi | jilid | lunas
    filter_jilid: '',
    include_nik: true,
    include_email: true,
    include_phone: true,
  });
  const [kegiatanList, setKegiatanList] = useState([]);
  const [tahunMulai, setTahunMulai] = useState(new Date().getFullYear());
  const [warnaSubsidi, setWarnaSubsidi] = useState('#045EB8');
  const [warnaNonSubsidi, setWarnaNonSubsidi] = useState('#04B816');

  const tipeLaporan = [
    { value: 'santri', label: 'Data Santri' },
    { value: 'pembayaran', label: 'Laporan Pembayaran SPP' },
    { value: 'status_pembayaran', label: 'Status Pembayaran Per Santri' },
    { value: 'pembayaran_lain', label: 'Laporan Pembayaran Lain' },
    { value: 'infak', label: 'Laporan Infak/Sedekah' },
    { value: 'pengeluaran', label: 'Laporan Pengeluaran' },
    { value: 'jurnal', label: 'Jurnal Kas' },
  ];

  const namaBulan = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

  const formatCurrency = (v) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(v || 0);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const getHeaders = (tipe, f = filter) => {
    switch (tipe) {
      case 'santri':
        return [
          ...(f.include_nik ? [{ key: 'nik', label: 'NIK' }] : []),
          { key: 'nama_lengkap', label: 'Nama Lengkap' },
          { key: 'kategori_subsidi', label: 'Kategori' },
          { key: 'jilid', label: 'Jilid' },
          { key: 'tgl_lahir', label: 'Tgl Lahir', format: 'date' },
          { key: 'nama_wali', label: 'Nama Wali' },
          ...(f.include_phone ? [{ key: 'no_telp_wali', label: 'No Telp Wali' }] : []),
          ...(f.include_email ? [{ key: 'email_wali', label: 'Email Wali' }] : []),
          { key: 'alamat', label: 'Alamat' },
        ];
      case 'pembayaran':
        return [
          { key: 'kode_invoice', label: 'Invoice' },
          { key: 'tanggal', label: 'Tanggal', format: 'date' },
          { key: 'nama_santri', label: 'Nama Santri' },
          { key: 'kategori_subsidi', label: 'Kategori' },
          ...(f.include_nik ? [{ key: 'nik', label: 'NIK' }] : []),
          { key: 'bulan', label: 'Bulan', format: 'bulan' },
          { key: 'tahun', label: 'Tahun' },
          { key: 'nominal', label: 'Nominal', format: 'currency' },
          { key: 'metode', label: 'Metode' },
          { key: 'penerima', label: 'Penerima' },
        ];
      case 'status_pembayaran': {
        const cols = [
          ...(f.include_nik ? [{ key: 'nik', label: 'NIK' }] : []),
          { key: 'nama', label: 'Nama' },
          { key: 'kategori_subsidi', label: 'Kategori' },
          { key: 'jilid', label: 'Jilid' },
        ];
        for (let b = 1; b <= 12; b++) {
          cols.push({ key: `bulan_${b}`, label: namaBulan[b - 1].substring(0, 3) });
        }
        return cols;
      }
      case 'pembayaran_lain':
        return [
          { key: 'kode_invoice', label: 'Invoice' },
          { key: 'tanggal', label: 'Tanggal', format: 'date' },
          { key: 'nama_santri', label: 'Nama Santri' },
          { key: 'kategori_subsidi', label: 'Kategori' },
          ...(f.include_nik ? [{ key: 'nik', label: 'NIK' }] : []),
          ...(f.include_email ? [{ key: 'email_wali', label: 'Email Wali' }] : []),
          ...(f.include_phone ? [{ key: 'no_telp_wali', label: 'No. Ponsel Wali' }] : []),
          { key: 'kegiatan', label: 'Kegiatan' },
          { key: 'nominal', label: 'Nominal', format: 'currency' },
          { key: 'metode', label: 'Metode' },
          { key: 'admin', label: 'Admin' },
          { key: 'keterangan', label: 'Keterangan' },
        ];
      case 'infak':
        return [
          { key: 'kode', label: 'Kode' },
          { key: 'tanggal', label: 'Tanggal', format: 'date' },
          { key: 'donatur', label: 'Donatur' },
          { key: 'nominal', label: 'Nominal', format: 'currency' },
          { key: 'catatan', label: 'Catatan' },
          { key: 'penerima', label: 'Penerima' },
        ];
      case 'pengeluaran':
        return [
          { key: 'kode', label: 'Kode' },
          { key: 'tanggal', label: 'Tanggal', format: 'date' },
          { key: 'judul', label: 'Judul' },
          { key: 'kategori', label: 'Kategori' },
          { key: 'nominal', label: 'Nominal', format: 'currency' },
          { key: 'catatan', label: 'Catatan' },
          { key: 'penanggung_jawab', label: 'PJ' },
        ];
      case 'jurnal':
        return [
          { key: 'tanggal', label: 'Tanggal', format: 'date' },
          { key: 'jenis', label: 'Jenis' },
          { key: 'kode_referensi', label: 'Kode Ref' },
          { key: 'keterangan', label: 'Keterangan' },
          { key: 'nominal', label: 'Nominal', format: 'currency' },
          { key: 'saldo', label: 'Saldo', format: 'currency' },
          { key: 'admin', label: 'Admin' },
        ];
      default:
        return [];
    }
  };

  useEffect(() => {
    const fetchKegiatan = async () => {
      const token = localStorage.getItem('auth_token');
      try {
        const res = await fetch('/api/kegiatan', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) setKegiatanList(data.data || []);
      } catch {}
    };
    fetchKegiatan();

    const fetchSettings = async () => {
      const token = localStorage.getItem('auth_token');
      try {
        const res = await fetch('/api/pengaturan', {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success) {
          const startYear = parseInt(data.data.tahun_mulai_pembukuan || new Date().getFullYear());
          setTahunMulai(startYear);
          setWarnaNonSubsidi(safeHexColor(data.data.warna_non_subsidi, '#04B816'));
          setWarnaSubsidi(safeHexColor(data.data.warna_subsidi, '#045EB8'));
          if (filter.tahun < startYear) {
            setFilter((prev) => ({ ...prev, tahun: startYear }));
          }
        }
      } catch {}
    };
    fetchSettings();
  }, []);

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= tahunMulai; y--) years.push(y);
    return years;
  };

  const generateExcel = async (data, title, headers) => {
    const XLSX = (await import('xlsx')).default;

    const rows = data.map(row => {
      const obj = {};
      headers.forEach(h => {
        let val = row[h.key];
        if (h.format === 'date') val = formatDate(val);
        else if (h.format === 'currency') val = val || 0;
        else if (h.format === 'bulan') val = namaBulan[(val || 1) - 1];
        obj[h.label] = val ?? '-';
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    
    // Set column widths
    const colWidths = headers.map(h => ({ wch: Math.max(h.label.length + 2, 12) }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Data');
    XLSX.writeFile(wb, `${title}.xlsx`);
  };

  const generatePDF = async (data, title, headers) => {
    const { jsPDF } = await import('jspdf');
    await import('jspdf-autotable');

    const isLandscape = headers.length > 7;
    const doc = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });

    // Title
    doc.setFontSize(14);
    doc.text(title, doc.internal.pageSize.getWidth() / 2, 15, { align: 'center' });
    doc.setFontSize(9);
    doc.text(`Diekspor: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })}`, doc.internal.pageSize.getWidth() / 2, 22, { align: 'center' });

    const tableHeaders = headers.map(h => h.label);
    const tableData = data.map(row =>
      headers.map(h => {
        let val = row[h.key];
        if (h.format === 'date') return formatDate(val);
        if (h.format === 'currency') return formatCurrency(val);
        if (h.format === 'bulan') return namaBulan[(val || 1) - 1];
        return val ?? '-';
      })
    );

    doc.autoTable({
      head: [tableHeaders],
      body: tableData,
      startY: 28,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [34, 139, 34], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      margin: { top: 28, left: 10, right: 10 },
    });

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(`Halaman ${i} / ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 8, { align: 'center' });
    }

    doc.save(`${title}.pdf`);
  };

  const handleExport = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const token = localStorage.getItem('auth_token');
    
    try {
      let url = `/api/export?tipe=${filter.tipe}&tahun=${filter.tahun}`;
      if (filter.bulan) url += `&bulan=${filter.bulan}`;
      if (filter.tipe === 'pembayaran_lain' && filter.kegiatan_id) url += `&kegiatan_id=${filter.kegiatan_id}`;
      if ((filter.tipe === 'santri' || filter.tipe === 'status_pembayaran') && filter.filter_kategori) {
        url += `&filter_kategori=${filter.filter_kategori}`;
        if (filter.filter_kategori === 'jilid' && filter.filter_jilid) url += `&filter_jilid=${encodeURIComponent(filter.filter_jilid)}`;
      }
      url += `&include_nik=${filter.include_nik}`;
      url += `&include_email=${filter.include_email}`;
      url += `&include_phone=${filter.include_phone}`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const result = await res.json();

      if (!result.success) {
        setError(result.pesan || 'Gagal mengambil data');
        return;
      }

      if (!result.data || result.data.length === 0) {
        setError('Tidak ada data untuk diekspor');
        return;
      }

      const headers = getHeaders(filter.tipe, filter);
      const tipeLabel = tipeLaporan.find(t => t.value === filter.tipe)?.label || 'Laporan';
      const fileName = `${tipeLabel} ${filter.tahun}${filter.bulan ? ' ' + namaBulan[parseInt(filter.bulan) - 1] : ''}`;

      if (filter.format === 'excel') {
        await generateExcel(result.data, fileName, headers);
      } else {
        await generatePDF(result.data, fileName, headers);
      }

      setSuccess('Laporan berhasil diunduh!');
    } catch (err) {
      console.error(err);
      setError('Gagal mengekspor laporan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Laporan & Export</h1>
        <p className="text-gray-500">Ekspor data ke PDF atau Excel</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Export */}
        <div className="card">
          <h3 className="font-semibold text-gray-800 mb-4">Pengaturan Export</h3>
          <form onSubmit={handleExport} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jenis Laporan <span className="text-red-500">*</span>
              </label>
              <select
                value={filter.tipe}
                onChange={(e) => setFilter({ ...filter, tipe: e.target.value })}
                className="input-field"
                required
              >
                {tipeLaporan.map((tipe) => (
                  <option key={tipe.value} value={tipe.value}>
                    {tipe.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tahun <span className="text-red-500">*</span>
                </label>
                <select
                  value={filter.tahun}
                  onChange={(e) => setFilter({ ...filter, tahun: parseInt(e.target.value) })}
                  className="input-field"
                  required
                >
                  {getYearOptions().map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bulan (Opsional)
                </label>
                <select
                  value={filter.bulan}
                  onChange={(e) => setFilter({ ...filter, bulan: e.target.value })}
                  className="input-field"
                >
                  <option value="">Semua Bulan</option>
                  {namaBulan.map((bulan, idx) => (
                    <option key={idx} value={idx + 1}>{bulan}</option>
                  ))}
                </select>
              </div>
            </div>

            {filter.tipe === 'pembayaran_lain' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kegiatan</label>
                <select
                  value={filter.kegiatan_id}
                  onChange={(e) => setFilter({ ...filter, kegiatan_id: e.target.value })}
                  className="input-field"
                >
                  <option value="">Semua Kegiatan</option>
                  {kegiatanList.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama_kegiatan}</option>
                  ))}
                </select>
              </div>
            )}

            {(filter.tipe === 'santri' || filter.tipe === 'status_pembayaran') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter Kategori</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: '',            label: 'Semua' },
                    { value: 'subsidi',     label: 'Subsidi' },
                    { value: 'non_subsidi', label: 'Non Subsidi' },
                    { value: 'jilid',       label: 'Jilid' },
                    { value: 'lunas',       label: '✓ Lunas' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFilter({ ...filter, filter_kategori: opt.value, filter_jilid: '' })}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                        filter.filter_kategori === opt.value
                          ? 'bg-green-600 text-white border-green-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {filter.filter_kategori === 'jilid' && (
                  <input
                    type="text"
                    value={filter.filter_jilid}
                    onChange={(e) => setFilter({ ...filter, filter_jilid: e.target.value })}
                    placeholder="Masukkan jilid (mis: 1, 2, Iqro 3)"
                    className="input-field mt-2"
                  />
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Field Sensitif</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filter.include_nik}
                    onChange={(e) => setFilter({ ...filter, include_nik: e.target.checked })}
                  />
                  Tampilkan NIK
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filter.include_email}
                    onChange={(e) => setFilter({ ...filter, include_email: e.target.checked })}
                  />
                  Tampilkan Email
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={filter.include_phone}
                    onChange={(e) => setFilter({ ...filter, include_phone: e.target.checked })}
                  />
                  Tampilkan No Ponsel
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Format Export <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFilter({ ...filter, format: 'pdf' })}
                  className={`p-4 rounded-lg border-2 text-center transition-colors ${
                    filter.format === 'pdf'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <svg className="w-12 h-12 mx-auto mb-2 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM8 13h8v2H8v-2zm0 4h5v2H8v-2z"/>
                  </svg>
                  <p className="font-semibold text-gray-800">PDF</p>
                  <p className="text-xs text-gray-600">Portable Document</p>
                </button>

                <button
                  type="button"
                  onClick={() => setFilter({ ...filter, format: 'excel' })}
                  className={`p-4 rounded-lg border-2 text-center transition-colors ${
                    filter.format === 'excel'
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <svg className="w-12 h-12 mx-auto mb-2 text-green-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM8.5 13.5l1.5 3 1.5-3h1.5L11 17l2 3.5h-1.5L10 17l-1.5 3.5H7L9 17l-2-3.5h1.5zM14 9V4l5 5h-5z"/>
                  </svg>
                  <p className="font-semibold text-gray-800">Excel</p>
                  <p className="text-xs text-gray-600">Spreadsheet (.xlsx)</p>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Mengekspor...
                </span>
              ) : (
                <>Export Laporan</>
              )}
            </button>
          </form>
        </div>

        {/* Info Laporan */}
        <div className="space-y-4">
          <div className="card">
            <h3 className="font-semibold text-gray-800 mb-3">Deskripsi Laporan</h3>
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm font-medium text-blue-900">Data Santri</p>
                <p className="text-xs text-blue-700 mt-1">
                  Daftar lengkap semua santri aktif dengan informasi lengkap
                </p>
              </div>

              <div className="p-3 bg-green-50 rounded-lg">
                <p className="text-sm font-medium text-green-900">Laporan Pembayaran SPP</p>
                <p className="text-xs text-green-700 mt-1">
                  Riwayat pembayaran SPP per periode dengan detail transaksi
                </p>
              </div>

              <div className="p-3 bg-purple-50 rounded-lg">
                <p className="text-sm font-medium text-purple-900">Status Pembayaran Per Santri</p>
                <p className="text-xs text-purple-700 mt-1">
                  Status pembayaran 12 bulan untuk semua santri
                </p>
              </div>

              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm font-medium text-yellow-900">Laporan Infak/Sedekah</p>
                <p className="text-xs text-yellow-700 mt-1">
                  Daftar semua infak dan sedekah yang diterima
                </p>
              </div>

              <div className="p-3 bg-red-50 rounded-lg">
                <p className="text-sm font-medium text-red-900">Laporan Pengeluaran</p>
                <p className="text-xs text-red-700 mt-1">
                  Rincian semua pengeluaran berdasarkan kategori
                </p>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-900">Jurnal Kas</p>
                <p className="text-xs text-gray-700 mt-1">
                  Catatan lengkap semua transaksi masuk dan keluar dengan saldo berjalan
                </p>
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-blue-50">
            <h3 className="font-semibold text-gray-800 mb-2">Tips Export</h3>
            <ul className="text-sm text-gray-700 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-600">&#9679;</span>
                <span>Gunakan PDF untuk laporan yang akan dicetak</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">&#9679;</span>
                <span>Gunakan Excel untuk analisis data lebih lanjut</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600">&#9679;</span>
                <span>Filter berdasarkan bulan untuk laporan yang lebih spesifik</span>
              </li>
              <li className="pt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-1 rounded text-xs font-semibold border" style={{ color: warnaNonSubsidi, borderColor: warnaNonSubsidi }}>
                    Non Subsidi
                  </span>
                  <span className="px-2 py-1 rounded text-xs font-semibold border" style={{ color: warnaSubsidi, borderColor: warnaSubsidi }}>
                    Subsidi
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
