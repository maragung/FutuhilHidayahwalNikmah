import { NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { Saran, Admin } from '@/lib/models';
import sequelize from '@/lib/db';

// PUT - Update status atau tanggapan saran
export async function PUT(request, { params }) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, pesan: auth.error },
        { status: 401 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { status, tanggapan } = body;

    const saran = await Saran.findByPk(id);
    if (!saran) {
      return NextResponse.json({ success: false, pesan: 'Saran tidak ditemukan' }, { status: 404 });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (tanggapan !== undefined) {
      updateData.tanggapan = tanggapan;
      updateData.admin_id = auth.user.id;
    }

    await saran.update(updateData);

    const updated = await Saran.findByPk(id, {
      include: [
        {
          model: Admin,
          as: 'admin',
          attributes: ['id', 'nama_lengkap', 'email'],
        },
      ],
    });

    return NextResponse.json({
      success: true,
      pesan: 'Saran berhasil diupdate',
      data: updated,
    });
  } catch (error) {
    console.error('Error PUT saran:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}

// DELETE - Hapus saran
export async function DELETE(request, { params }) {
  try {
    await sequelize.authenticate();

    const auth = await verifyAuth(request);
    if (!auth.success) {
      return NextResponse.json(
        { success: false, pesan: auth.error },
        { status: 401 }
      );
    }

    // Cek apakah admin adalah Pimpinan TPQ
    const admin = await Admin.findByPk(auth.user.id);
    if (!admin || admin.jabatan !== 'Pimpinan TPQ') {
      return NextResponse.json(
        { success: false, pesan: 'Hanya Pimpinan TPQ yang dapat menghapus saran' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const saran = await Saran.findByPk(id);

    if (!saran) {
      return NextResponse.json({ success: false, pesan: 'Saran tidak ditemukan' }, { status: 404 });
    }

    await saran.destroy();

    return NextResponse.json({
      success: true,
      pesan: 'Saran berhasil dihapus',
    });
  } catch (error) {
    console.error('Error DELETE saran:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
