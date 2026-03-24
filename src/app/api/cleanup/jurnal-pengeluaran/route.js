import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Pengeluaran, Admin, JurnalKas } from '@/lib/models';
import sequelize from '@/lib/db';
import { Op } from 'sequelize';

export async function POST(request) {
  let t;
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    if (auth.user?.jabatan !== 'Developer') {
      return NextResponse.json(
        { success: false, pesan: 'Hanya Developer yang bisa akses cleanup jurnal' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const pin = body?.pin;

    if (!pin) {
      return NextResponse.json({ success: false, pesan: 'PIN wajib diisi' }, { status: 400 });
    }

    // Verify PIN
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin || !(await admin.validPin(pin))) {
      return NextResponse.json({ success: false, pesan: 'PIN tidak valid' }, { status: 403 });
    }

    t = await sequelize.transaction();

    // Find all ADJ jurnal entries related to pengeluaran
    const adjJurnals = await JurnalKas.findAll({
      where: {
        referensi_kode: {
          [Op.like]: 'ADJ-OUT-%'
        },
        keterangan: {
          [Op.like]: '%Penyesuaian pengeluaran%'
        }
      },
      transaction: t,
      order: [['id', 'ASC']]
    });

    if (adjJurnals.length === 0) {
      await t.commit();
      return NextResponse.json({ 
        success: true, 
        pesan: 'Tidak ada jurnal penyesuaian yang perlu dibersihkan',
        deleted_count: 0
      });
    }

    // Delete the ADJ journals
    let deletedCount = 0;
    for (const jurnal of adjJurnals) {
      await jurnal.destroy({ transaction: t });
      deletedCount++;
    }

    await t.commit();

    console.log(`[CLEANUP] Deleted ${deletedCount} jurnal penyesuaian`);

    return NextResponse.json({ 
      success: true, 
      pesan: `Berhasil menghapus ${deletedCount} jurnal penyesuaian`,
      deleted_count: deletedCount,
      deleted_ids: adjJurnals.map(j => j.id)
    });

  } catch (error) {
    console.error('[CLEANUP] Error:', error);
    if (t) await t.rollback();
    return NextResponse.json({ 
      success: false, 
      pesan: 'Terjadi kesalahan server: ' + (error.message || 'Unknown error')
    }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json({ success: false, pesan: auth.error }, { status: 401 });
    }

    if (auth.user?.jabatan !== 'Developer') {
      return NextResponse.json(
        { success: false, pesan: 'Hanya Developer yang bisa akses cleanup jurnal' },
        { status: 403 }
      );
    }

    // Preview ADJ journals that will be deleted
    const adjJurnals = await JurnalKas.findAll({
      where: {
        referensi_kode: {
          [Op.like]: 'ADJ-OUT-%'
        },
        keterangan: {
          [Op.like]: '%Penyesuaian pengeluaran%'
        }
      },
      order: [['id', 'ASC']],
      raw: true
    });

    return NextResponse.json({ 
      success: true, 
      preview: adjJurnals,
      count: adjJurnals.length
    });

  } catch (error) {
    console.error('[CLEANUP PREVIEW] Error:', error);
    return NextResponse.json({ 
      success: false, 
      pesan: 'Terjadi kesalahan server: ' + (error.message || 'Unknown error')
    }, { status: 500 });
  }
}
