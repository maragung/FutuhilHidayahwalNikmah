import { NextResponse } from 'next/server';
import {
  Admin,
  Santri,
  PembayaranSPP,
  InfakSedekah,
  Pengeluaran,
  JurnalKas,
  Backup,
  Saran,
  Pengaturan,
  Kegiatan,
  PembayaranLain,
} from '@/lib/models';
import sequelize from '@/lib/db';

// ─── Tables that can be audited ───────────────────────────────────────────────
const TABLE_MAP = {
  admins:          Admin,
  santri:          Santri,
  pembayaran_spp:  PembayaranSPP,
  infak_sedekah:   InfakSedekah,
  pengeluaran:     Pengeluaran,
  jurnal_kas:      JurnalKas,
  backup_log:      Backup,
  saran:           Saran,
  pengaturan:      Pengaturan,
  kegiatan:        Kegiatan,
  pembayaran_lain: PembayaranLain,
};

// ─── Dev secret guard ─────────────────────────────────────────────────────────
function checkDevSecret(request) {
  const devSecret = process.env.DEV_SECRET;
  if (!devSecret) {
    // If DEV_SECRET is not set, block access entirely in production
    if (process.env.NODE_ENV === 'production') {
      return { ok: false, status: 503, error: 'DEV_SECRET tidak dikonfigurasi di server.' };
    }
    // In dev mode without DEV_SECRET, warn but allow (optional strictness)
    console.warn('[dev/audit] DEV_SECRET tidak diset — endpoint terbuka di mode development');
  } else {
    const provided = request.headers.get('x-dev-secret');
    if (!provided || provided !== devSecret) {
      return { ok: false, status: 401, error: 'Dev secret salah atau tidak diberikan.' };
    }
  }
  return { ok: true };
}

// ─── Fetch all live data ──────────────────────────────────────────────────────
async function fetchLiveData() {
  const entries = await Promise.all(
    Object.entries(TABLE_MAP).map(async ([key, Model]) => {
      const rows = await Model.findAll({ raw: true });
      return [key, rows];
    }),
  );
  return Object.fromEntries(entries);
}

// ─── Compare two record arrays ────────────────────────────────────────────────
function compareTable(liveRows, backupRows) {
  // Index by primary key (id)
  const liveMap   = Object.fromEntries(liveRows.map((r) => [String(r.id), r]));
  const backupMap = Object.fromEntries(backupRows.map((r) => [String(r.id), r]));

  const liveIds   = new Set(Object.keys(liveMap));
  const backupIds = new Set(Object.keys(backupMap));

  // Added in live (not in backup)
  const added = [...liveIds]
    .filter((id) => !backupIds.has(id))
    .map((id) => liveMap[id]);

  // Deleted from live (present in backup but not in live)
  const deleted = [...backupIds]
    .filter((id) => !liveIds.has(id))
    .map((id) => backupMap[id]);

  // Modified: present in both but different values
  const modified = [];
  for (const id of liveIds) {
    if (!backupIds.has(id)) continue;
    const live   = liveMap[id];
    const backup = backupMap[id];
    const diffs  = {};

    const allKeys = new Set([...Object.keys(live), ...Object.keys(backup)]);
    for (const key of allKeys) {
      const lv = live[key]   ?? null;
      const bv = backup[key] ?? null;
      // Compare as strings to handle Date objects and numbers uniformly
      const ls = lv instanceof Date ? lv.toISOString() : String(lv ?? '');
      const bs = bv instanceof Date ? bv.toISOString() : String(bv ?? '');
      if (ls !== bs) {
        diffs[key] = { live: lv, backup: bv };
      }
    }

    if (Object.keys(diffs).length > 0) {
      modified.push({ id, diffs });
    }
  }

  return {
    live_count:     liveRows.length,
    backup_count:   backupRows.length,
    added_count:    added.length,
    deleted_count:  deleted.length,
    modified_count: modified.length,
    is_identical:   added.length === 0 && deleted.length === 0 && modified.length === 0,
    added,
    deleted,
    modified,
  };
}

// ─── GET — Auth check + live stats ───────────────────────────────────────────
export async function GET(request) {
  try {
    const guard = checkDevSecret(request);
    if (!guard.ok) {
      return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
    }

    await sequelize.authenticate();

    // Count rows per table
    const counts = await Promise.all(
      Object.entries(TABLE_MAP).map(async ([key, Model]) => {
        const count = await Model.count();
        return [key, count];
      }),
    );

    const summary = Object.fromEntries(counts);

    return NextResponse.json({
      success:    true,
      tables:     Object.keys(TABLE_MAP),
      summary,
      fetched_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[dev/audit GET]', error);
    return NextResponse.json(
      { success: false, error: 'Gagal terhubung ke database: ' + error.message },
      { status: 500 },
    );
  }
}

// ─── POST — Compare backup data with live DB ──────────────────────────────────
export async function POST(request) {
  try {
    const guard = checkDevSecret(request);
    if (!guard.ok) {
      return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
    }

    await sequelize.authenticate();

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ success: false, error: 'Body bukan JSON yang valid.' }, { status: 400 });
    }

    // Accept: { data: {...}, exported_at, exported_by, checksum }
    // or directly: { admins: [], santri: [], ... }
    const backupData = body.data ?? body;
    const backupMeta = {
      exported_at:  body.exported_at  ?? null,
      exported_by:  body.exported_by  ?? null,
      checksum:     body.checksum     ?? null,
    };

    if (!backupData || typeof backupData !== 'object' || Array.isArray(backupData)) {
      return NextResponse.json(
        { success: false, error: 'Format data backup tidak valid.' },
        { status: 400 },
      );
    }

    // Only audit tables that appear in the backup file
    const tablesToAudit = Object.keys(backupData).filter((k) => k in TABLE_MAP);
    if (tablesToAudit.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada tabel yang bisa diaudit dari data backup ini.' },
        { status: 400 },
      );
    }

    // Fetch live data for affected tables only
    const liveEntries = await Promise.all(
      tablesToAudit.map(async (key) => {
        const rows = await TABLE_MAP[key].findAll({ raw: true });
        return [key, rows];
      }),
    );
    const liveData = Object.fromEntries(liveEntries);

    // Build per-table diff report
    const report = {};
    let totalAdded    = 0;
    let totalDeleted  = 0;
    let totalModified = 0;

    for (const key of tablesToAudit) {
      const liveRows   = liveData[key]   ?? [];
      const backupRows = backupData[key] ?? [];
      const diff       = compareTable(liveRows, backupRows);
      report[key]      = diff;
      totalAdded    += diff.added_count;
      totalDeleted  += diff.deleted_count;
      totalModified += diff.modified_count;
    }

    const isIdentical = totalAdded === 0 && totalDeleted === 0 && totalModified === 0;

    return NextResponse.json({
      success:     true,
      is_identical: isIdentical,
      compared_at: new Date().toISOString(),
      backup_meta: backupMeta,
      tables_audited: tablesToAudit,
      summary: {
        total_added:    totalAdded,
        total_deleted:  totalDeleted,
        total_modified: totalModified,
      },
      report,
    });
  } catch (error) {
    console.error('[dev/audit POST]', error);
    return NextResponse.json(
      { success: false, error: 'Gagal melakukan perbandingan: ' + error.message },
      { status: 500 },
    );
  }
}
