import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Absensi, Santri, Admin } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';

// GET — Ambil data absensi
// Query params: ?tanggal=2026-03-08&santri_id=1&bulan=2026-03&page=1&limit=50
export async function GET(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });

    await sequelize.authenticate();

    const { searchParams } = new URL(request.url);
    const tanggal   = searchParams.get('tanggal');
    const santriId  = searchParams.get('santri_id');
    const bulan     = searchParams.get('bulan'); // format: 2026-03
    const page      = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit     = Math.min(200, parseInt(searchParams.get('limit') || '50'));
    const offset    = (page - 1) * limit;

    const where = {};
    if (tanggal) where.tanggal = tanggal;
    if (santriId) where.santri_id = santriId;
    if (bulan && !tanggal) {
      // Filter per bulan: 2026-03 → 2026-03-01 sampai 2026-03-31
      where.tanggal = {
        [Op.gte]: `${bulan}-01`,
        [Op.lte]: `${bulan}-31`,
      };
    }

    const { count, rows } = await Absensi.findAndCountAll({
      where,
      include: [
        { model: Santri, as: 'santri', attributes: ['id', 'no_absen', 'nama_lengkap', 'jilid', 'status_aktif'] },
        { model: Admin, as: 'admin', attributes: ['id', 'nama_lengkap', 'jabatan'] },
      ],
      order: [['tanggal', 'DESC'], ['santri_id', 'ASC']],
      limit,
      offset,
    });

    // Jika query tanggal spesifik, juga hitung ringkasan
    let ringkasan = null;
    if (tanggal) {
      const [stats] = await sequelize.query(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN status = 'hadir' THEN 1 ELSE 0 END) as hadir,
          SUM(CASE WHEN status = 'sakit' THEN 1 ELSE 0 END) as sakit,
          SUM(CASE WHEN status = 'izin'  THEN 1 ELSE 0 END) as izin,
          SUM(CASE WHEN status = 'alpha' THEN 1 ELSE 0 END) as alpha
        FROM absensi WHERE tanggal = :tanggal
      `, { replacements: { tanggal }, type: sequelize.QueryTypes.SELECT });
      ringkasan = stats;
    }

    return NextResponse.json({
      success: true,
      data: rows,
      ringkasan,
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
    });
  } catch (error) {
    console.error('Get absensi error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}

// POST — Simpan / batch-update absensi harian
// Body: { tanggal: "2026-03-08", data: [{ santri_id: 1, status: "hadir", catatan: "" }, ...], pin: "..." }
export async function POST(request) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.success) return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });

    await sequelize.authenticate();
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin) return NextResponse.json({ success: false, pesan: 'Admin tidak ditemukan' }, { status: 404 });

    const body = await request.json();
    const { tanggal, data, pin } = body;

    if (!pin) return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    const pinValid = await admin.validPin(pin);
    if (!pinValid) return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });

    if (!tanggal || !Array.isArray(data) || data.length === 0) {
      return NextResponse.json({ success: false, pesan: 'Tanggal dan data absensi wajib diisi' }, { status: 400 });
    }

    const validStatus = ['hadir', 'sakit', 'izin', 'alpha'];
    let created = 0;
    let updated = 0;

    const t = await sequelize.transaction();
    try {
      for (const item of data) {
        if (!item.santri_id || !validStatus.includes(item.status)) continue;

        const [record, isNew] = await Absensi.findOrCreate({
          where: { santri_id: item.santri_id, tanggal },
          defaults: {
            admin_id: auth.user.id,
            status: item.status,
            catatan: item.catatan || null,
          },
          transaction: t,
        });

        if (!isNew) {
          record.status = item.status;
          record.catatan = item.catatan || record.catatan;
          record.admin_id = auth.user.id;
          await record.save({ transaction: t });
          updated++;
        } else {
          created++;
        }
      }
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }

    return NextResponse.json({
      success: true,
      pesan: `Absensi ${tanggal}: ${created} baru, ${updated} diperbarui`,
      data: { tanggal, created, updated, total: created + updated },
    });
  } catch (error) {
    console.error('Save absensi error:', error);
    return NextResponse.json({ success: false, pesan: 'Terjadi kesalahan server' }, { status: 500 });
  }
}
