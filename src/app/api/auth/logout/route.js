import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const response = NextResponse.json({
      success: true,
      pesan: 'Logout berhasil',
    });

    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
    });

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan saat logout' },
      { status: 500 }
    );
  }
}
