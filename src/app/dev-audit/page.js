'use client';

import { useState, useRef, useCallback } from 'react';

// ─── Human-readable table labels ─────────────────────────────────────────────
const TABLE_LABELS = {
  admins:          'Admin',
  santri:          'Santri',
  pembayaran_spp:  'Pembayaran SPP',
  infak_sedekah:   'Infak / Sedekah',
  pengeluaran:     'Pengeluaran',
  jurnal_kas:      'Jurnal Kas',
  backup_log:      'Log Backup',
  saran:           'Kotak Saran',
  pengaturan:      'Pengaturan',
  kegiatan:        'Kegiatan',
  pembayaran_lain: 'Pembayaran Lain',
};

// ─── Utilities ────────────────────────────────────────────────────────────────
function formatValue(v) {
  if (v === null || v === undefined)
    return <span className="text-zinc-500 italic text-xs">null</span>;
  if (typeof v === 'boolean')
    return <span className="text-purple-400">{String(v)}</span>;
  const s = String(v);
  if (s.length > 120)
    return <span title={s} className="cursor-help">{s.slice(0, 117)}…</span>;
  return s;
}

function Badge({ count, variant }) {
  const classes = {
    green:  'bg-emerald-900/60 text-emerald-300 border border-emerald-700',
    red:    'bg-red-900/60 text-red-300 border border-red-700',
    blue:   'bg-blue-900/60 text-blue-300 border border-blue-700',
    yellow: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
    zinc:   'bg-zinc-800 text-zinc-400 border border-zinc-600',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold ${classes[variant] || classes.zinc}`}>
      {count}
    </span>
  );
}

// ─── Diff row for modified records ───────────────────────────────────────────
function DiffRow({ item }) {
  const [open, setOpen] = useState(false);
  const diffKeys = Object.keys(item.diffs);
  return (
    <div className="border border-zinc-700 rounded mb-1 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 transition-colors text-left"
      >
        <span className="text-yellow-400 font-mono text-xs">ID {item.id}</span>
        <span className="text-zinc-400 text-xs">
          {diffKeys.length} field changed: {diffKeys.slice(0, 5).join(', ')}
          {diffKeys.length > 5 ? ` +${diffKeys.length - 5} more` : ''}
        </span>
        <span className="ml-auto text-zinc-500 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="bg-zinc-900">
                <th className="px-3 py-1.5 text-left text-zinc-400 font-semibold w-1/4">Field</th>
                <th className="px-3 py-1.5 text-left text-blue-400 font-semibold w-[37.5%]">Live DB (current)</th>
                <th className="px-3 py-1.5 text-left text-orange-400 font-semibold w-[37.5%]">Backup (snapshot)</th>
              </tr>
            </thead>
            <tbody>
              {diffKeys.map((key) => (
                <tr key={key} className="border-t border-zinc-800">
                  <td className="px-3 py-1.5 text-zinc-300">{key}</td>
                  <td className="px-3 py-1.5 text-blue-300 break-all">{formatValue(item.diffs[key].live)}</td>
                  <td className="px-3 py-1.5 text-orange-300 break-all">{formatValue(item.diffs[key].backup)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Record table for added / deleted rows ────────────────────────────────────
function RecordTable({ rows }) {
  if (!rows || rows.length === 0) return null;
  const keys = Object.keys(rows[0]);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono">
        <thead>
          <tr className="bg-zinc-900">
            {keys.map((k) => (
              <th key={k} className="px-3 py-1.5 text-left text-zinc-400 font-semibold whitespace-nowrap">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-800/50 transition-colors">
              {keys.map((k) => (
                <td key={k} className="px-3 py-1.5 text-zinc-300 break-all max-w-[200px]">{formatValue(row[k])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Single-table report panel ────────────────────────────────────────────────
function TableReport({ tableKey, data }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState(
    data.added_count > 0 ? 'added' : data.deleted_count > 0 ? 'deleted' : 'modified',
  );
  const label = TABLE_LABELS[tableKey] || tableKey;

  const borderClass = data.is_identical
    ? 'border-emerald-700 bg-emerald-950/30'
    : 'border-yellow-700 bg-yellow-950/30';

  return (
    <div className={`border rounded-lg overflow-hidden mb-3 ${borderClass}`}>
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-zinc-900/60 hover:bg-zinc-800/60 transition-colors text-left"
      >
        <span className="text-zinc-200 font-semibold text-sm w-48 shrink-0">{label}</span>
        <span className="text-zinc-500 text-xs font-mono">
          Live: {data.live_count} | Backup: {data.backup_count}
        </span>
        <div className="flex gap-1.5 ml-2">
          {data.is_identical ? (
            <Badge count="✓ Identical" variant="green" />
          ) : (
            <>
              {data.added_count   > 0 && <Badge count={`+${data.added_count} new`}      variant="blue"   />}
              {data.deleted_count > 0 && <Badge count={`-${data.deleted_count} deleted`} variant="red"    />}
              {data.modified_count > 0 && <Badge count={`~${data.modified_count} changed`} variant="yellow" />}
            </>
          )}
        </div>
        <span className="ml-auto text-zinc-500">{open ? '▲' : '▼'}</span>
      </button>

      {/* Detail */}
      {open && !data.is_identical && (
        <div className="bg-zinc-950/40">
          {/* Tab bar */}
          <div className="flex border-b border-zinc-700">
            {data.added_count > 0 && (
              <button
                onClick={() => setTab('added')}
                className={`px-4 py-2 text-xs font-semibold transition-colors ${tab === 'added' ? 'text-blue-400 border-b-2 border-blue-400 bg-blue-950/20' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                ＋ Added to DB ({data.added_count})
              </button>
            )}
            {data.deleted_count > 0 && (
              <button
                onClick={() => setTab('deleted')}
                className={`px-4 py-2 text-xs font-semibold transition-colors ${tab === 'deleted' ? 'text-red-400 border-b-2 border-red-400 bg-red-950/20' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                − Deleted from DB ({data.deleted_count})
              </button>
            )}
            {data.modified_count > 0 && (
              <button
                onClick={() => setTab('modified')}
                className={`px-4 py-2 text-xs font-semibold transition-colors ${tab === 'modified' ? 'text-yellow-400 border-b-2 border-yellow-400 bg-yellow-950/20' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                ∿ Modified ({data.modified_count})
              </button>
            )}
          </div>

          {/* Tab content */}
          <div className="p-3">
            {tab === 'added'    && data.added_count    > 0 && <RecordTable rows={data.added} />}
            {tab === 'deleted'  && data.deleted_count  > 0 && <RecordTable rows={data.deleted} />}
            {tab === 'modified' && data.modified_count > 0 && (
              <div>
                {data.modified.map((item) => (
                  <DiffRow key={item.id} item={item} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DevAuditPage() {
  const [devSecret,   setDevSecret]   = useState('');
  const [showSecret,  setShowSecret]  = useState(false);
  const [verifying,   setVerifying]   = useState(false);
  const [verified,    setVerified]    = useState(false);
  const [liveStats,   setLiveStats]   = useState(null);
  const [authError,   setAuthError]   = useState('');

  const [backupMeta,     setBackupMeta]     = useState(null);
  const [backupData,     setBackupData]     = useState(null);
  const [backupError,    setBackupError]    = useState('');
  const [backupFileName, setBackupFileName] = useState('');

  const [comparing,    setComparing]    = useState(false);
  const [compareError, setCompareError] = useState('');
  const [report,       setReport]       = useState(null);

  const fileRef = useRef(null);

  // Auth ──────────────────────────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    if (!devSecret.trim()) { setAuthError('Enter dev secret first.'); return; }
    setVerifying(true);
    setAuthError('');
    try {
      const res  = await fetch('/api/dev/audit', { headers: { 'x-dev-secret': devSecret.trim() } });
      const json = await res.json();
      if (!json.success) { setAuthError(json.error || 'Verification failed.'); return; }
      setVerified(true);
      setLiveStats(json);
    } catch {
      setAuthError('Could not reach server.');
    } finally {
      setVerifying(false);
    }
  }, [devSecret]);

  // File upload ───────────────────────────────────────────────────────────────
  const handleFileChange = useCallback((e) => {
    const file = e.target?.files?.[0] ?? e;
    if (!file) return;
    setBackupError('');
    setBackupFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const data   = parsed.data ?? parsed;
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          setBackupError('Invalid format. Use a file exported from the Export Database page.');
          setBackupData(null); setBackupMeta(null);
          return;
        }
        setBackupData(data);
        setBackupMeta({
          exported_at: parsed.exported_at ?? null,
          exported_by: parsed.exported_by ?? null,
          checksum:    parsed.checksum    ?? null,
        });
        setReport(null);
      } catch {
        setBackupError('File is not valid JSON.');
        setBackupData(null); setBackupMeta(null);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  // Compare ───────────────────────────────────────────────────────────────────
  const handleCompare = useCallback(async () => {
    if (!backupData) { setCompareError('Upload a backup file first.'); return; }
    setComparing(true); setCompareError(''); setReport(null);
    try {
      const body = { ...(backupMeta || {}), data: backupData };
      const res  = await fetch('/api/dev/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-dev-secret': devSecret.trim() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) { setCompareError(json.error || 'Comparison failed.'); return; }
      setReport(json);
    } catch {
      setCompareError('Could not reach server.');
    } finally {
      setComparing(false);
    }
  }, [backupData, backupMeta, devSecret]);

  // Refresh live stats ────────────────────────────────────────────────────────
  const handleRefreshLive = useCallback(async () => {
    setVerifying(true);
    try {
      const res  = await fetch('/api/dev/audit', { headers: { 'x-dev-secret': devSecret.trim() } });
      const json = await res.json();
      if (json.success) setLiveStats(json);
    } catch { /* ignore */ }
    finally { setVerifying(false); }
  }, [devSecret]);

  // Reset ─────────────────────────────────────────────────────────────────────
  const handleLogout = () => {
    setVerified(false); setLiveStats(null); setReport(null);
    setDevSecret(''); setAuthError('');
  };

  const handleClearFile = () => {
    setBackupData(null); setBackupMeta(null);
    setBackupFileName(''); setReport(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">

      {/* Top bar */}
      <div className="border-b border-zinc-800 bg-zinc-900/80 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
          <span className="font-bold text-zinc-100 tracking-wide text-sm">DEV AUDIT TOOL</span>
          <span className="text-zinc-500 text-xs hidden sm:block">— TPQ Database Audit &amp; Comparison</span>
          {verified && liveStats && (
            <span className="ml-auto text-xs text-zinc-500 font-mono">
              {new Date(liveStats.fetched_at).toLocaleString('id-ID')}
            </span>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Warning banner */}
        <div className="rounded-xl border border-red-800 bg-red-950/40 px-4 py-3 flex items-start gap-3">
          <span className="text-2xl mt-0.5">⚠️</span>
          <div>
            <p className="font-bold text-red-300 text-sm">DEVELOPER-ONLY PAGE</p>
            <p className="text-red-400/80 text-xs mt-0.5">
              This page does <strong>not</strong> appear in the admin menu. Access requires a{' '}
              <code className="bg-red-900/60 px-1 rounded">DEV_SECRET</code> configured on the server.
              Do not share this URL with regular users.
            </p>
          </div>
        </div>

        {/* Auth panel */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
          <h2 className="font-bold text-zinc-200 mb-4 text-base flex items-center gap-2">
            <span>🔐</span> Developer Authentication
          </h2>
          {verified ? (
            <div className="flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <p className="text-emerald-300 text-sm font-medium">Authenticated — DB connected</p>
              <button
                onClick={handleLogout}
                className="ml-auto text-xs text-zinc-500 hover:text-red-400 transition-colors"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Dev Secret</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={devSecret}
                      onChange={(e) => setDevSecret(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                      placeholder="Enter DEV_SECRET from server .env…"
                      className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => setShowSecret((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 text-xs"
                      tabIndex={-1}
                    >
                      {showSecret ? '🙈' : '👁'}
                    </button>
                  </div>
                  <button
                    onClick={handleVerify}
                    disabled={verifying || !devSecret}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    {verifying ? 'Verifying…' : 'Verify'}
                  </button>
                </div>
              </div>
              {authError && (
                <p className="text-red-400 text-xs bg-red-950/40 border border-red-800 px-3 py-2 rounded-lg">{authError}</p>
              )}
              <p className="text-zinc-600 text-xs">
                Set <code className="bg-zinc-800 px-1 rounded">DEV_SECRET=your_secret_value</code> in the server{' '}
                <code className="bg-zinc-800 px-1 rounded">.env</code> file.
              </p>
            </div>
          )}
        </div>

        {verified && (
          <>
            {/* Live DB stats */}
            {liveStats && (
              <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-bold text-zinc-200 text-base flex items-center gap-2">
                    <span>🗄️</span> Live Database (MySQL)
                  </h2>
                  <button
                    onClick={handleRefreshLive}
                    disabled={verifying}
                    className="text-xs text-zinc-500 hover:text-blue-400 transition-colors"
                  >
                    {verifying ? '⟳ Loading…' : '⟳ Refresh'}
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                  {liveStats.tables.map((key) => (
                    <div key={key} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 flex items-center justify-between">
                      <span className="text-zinc-400 text-xs truncate mr-2">{TABLE_LABELS[key] || key}</span>
                      <span className="text-blue-300 font-mono text-sm font-bold shrink-0">
                        {liveStats.summary[key] ?? '?'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Upload backup file */}
            <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
              <h2 className="font-bold text-zinc-200 text-base flex items-center gap-2 mb-4">
                <span>📂</span> Import Backup File
              </h2>
              <p className="text-zinc-500 text-xs mb-4">
                Upload the JSON file produced by the admin <strong className="text-zinc-400">Export Database</strong> page.
                Supported format: plain JSON (<code className="bg-zinc-800 px-1 rounded">.json</code>).
                Encrypted backups are not supported here.
              </p>

              <div
                className="border-2 border-dashed border-zinc-600 hover:border-blue-500 rounded-xl p-8 text-center cursor-pointer transition-colors group"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFileChange(file);
                }}
              >
                <p className="text-4xl mb-2">📥</p>
                <p className="text-zinc-400 text-sm group-hover:text-blue-400 transition-colors">
                  Click or drop backup JSON here
                </p>
                <p className="text-zinc-600 text-xs mt-1">backup-database-*.json</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {backupFileName && !backupError && (
                <div className="mt-3 flex items-start gap-3 bg-zinc-800/60 border border-zinc-700 rounded-lg px-4 py-3">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <div className="min-w-0">
                    <p className="text-zinc-200 text-sm font-medium truncate">{backupFileName}</p>
                    {backupMeta && (
                      <div className="text-zinc-500 text-xs mt-0.5 space-y-0.5">
                        {backupMeta.exported_at && (
                          <p>Exported at: <span className="text-zinc-400">{new Date(backupMeta.exported_at).toLocaleString('id-ID')}</span></p>
                        )}
                        {backupMeta.exported_by && (
                          <p>Exported by: <span className="text-zinc-400">{backupMeta.exported_by}</span></p>
                        )}
                        {backupData && (
                          <p>Tables found: <span className="text-zinc-400">{Object.keys(backupData).join(', ')}</span></p>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleClearFile}
                    className="ml-auto text-zinc-600 hover:text-red-400 transition-colors text-sm shrink-0"
                  >✕</button>
                </div>
              )}
              {backupError && (
                <p className="mt-3 text-red-400 text-xs bg-red-950/40 border border-red-800 px-3 py-2 rounded-lg">❌ {backupError}</p>
              )}
            </div>

            {/* Run comparison */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleCompare}
                disabled={comparing || !backupData}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg transition-colors flex items-center gap-2"
              >
                {comparing ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Comparing…
                  </>
                ) : (
                  <>🔍 Run Audit &amp; Comparison</>
                )}
              </button>
              {backupData && !comparing && (
                <p className="text-zinc-500 text-xs">
                  Will compare {Object.keys(backupData).length} table(s) against live DB.
                </p>
              )}
            </div>

            {compareError && (
              <p className="text-red-400 text-xs bg-red-950/40 border border-red-800 px-3 py-2 rounded-lg">❌ {compareError}</p>
            )}

            {/* Audit report */}
            {report && (
              <div className="space-y-4">
                {/* Summary cards */}
                <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
                  <h2 className="font-bold text-zinc-200 text-base flex items-center gap-2 mb-4">
                    <span>📊</span> Audit Summary
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                    <div className={`rounded-lg border p-3 text-center ${report.is_identical ? 'border-emerald-700 bg-emerald-950/40' : 'border-zinc-700 bg-zinc-800'}`}>
                      <p className="text-2xl font-bold font-mono text-emerald-400">
                        {report.is_identical ? '✓' : '✗'}
                      </p>
                      <p className="text-zinc-400 text-xs mt-1">{report.is_identical ? 'Identical' : 'Differences found'}</p>
                    </div>
                    <div className="rounded-lg border border-blue-800 bg-blue-950/30 p-3 text-center">
                      <p className="text-2xl font-bold font-mono text-blue-400">+{report.summary.total_added}</p>
                      <p className="text-zinc-400 text-xs mt-1">Records Added (in DB)</p>
                    </div>
                    <div className="rounded-lg border border-red-800 bg-red-950/30 p-3 text-center">
                      <p className="text-2xl font-bold font-mono text-red-400">-{report.summary.total_deleted}</p>
                      <p className="text-zinc-400 text-xs mt-1">Records Deleted</p>
                    </div>
                    <div className="rounded-lg border border-yellow-800 bg-yellow-950/30 p-3 text-center">
                      <p className="text-2xl font-bold font-mono text-yellow-400">~{report.summary.total_modified}</p>
                      <p className="text-zinc-400 text-xs mt-1">Records Modified</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
                    <span>Audit time: <span className="text-zinc-400">{new Date(report.compared_at).toLocaleString('id-ID')}</span></span>
                    {report.backup_meta?.exported_at && (
                      <span>Backup from: <span className="text-zinc-400">{new Date(report.backup_meta.exported_at).toLocaleString('id-ID')}</span></span>
                    )}
                    {report.backup_meta?.exported_by && (
                      <span>Exported by: <span className="text-zinc-400">{report.backup_meta.exported_by}</span></span>
                    )}
                    <span>Tables audited: <span className="text-zinc-400">{report.tables_audited?.join(', ')}</span></span>
                  </div>
                </div>

                {/* Per-table detail */}
                <div className="rounded-xl border border-zinc-700 bg-zinc-900 p-5">
                  <h2 className="font-bold text-zinc-200 text-base flex items-center gap-2 mb-4">
                    <span>📋</span> Per-Table Detail
                  </h2>
                  <p className="text-zinc-500 text-xs mb-4">
                    Colour key: <span className="text-blue-400">■ New in DB</span>&nbsp;&nbsp;
                    <span className="text-red-400">■ Deleted from DB</span>&nbsp;&nbsp;
                    <span className="text-yellow-400">■ Modified in DB</span>
                    {' '}— all relative to the backup snapshot.
                  </p>
                  {Object.entries(report.report)
                    .sort((a, b) => {
                      const scoreA = a[1].added_count + a[1].deleted_count + a[1].modified_count;
                      const scoreB = b[1].added_count + b[1].deleted_count + b[1].modified_count;
                      return scoreB - scoreA;
                    })
                    .map(([key, data]) => (
                      <TableReport key={key} tableKey={key} data={data} />
                    ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="text-center text-zinc-700 text-xs py-4 border-t border-zinc-800">
          TPQ Futuhil Hidayah Wal Hikmah — Dev Audit Tool
          &nbsp;·&nbsp; This page is not indexed or shown in the admin menu.
        </div>
      </div>
    </div>
  );
}
