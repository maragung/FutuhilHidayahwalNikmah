import { NextResponse } from 'next/server';
import Admin from '@/lib/models/Admin';
import sequelize from '@/lib/db';
import { createAuthResponse } from '@/lib/auth';
import { verifyCaptchaPayload } from '@/lib/captcha';

export async function POST(request) {
  try {
    await sequelize.authenticate();
    
    const { username, password, captcha_token, captcha_value } = await request.json();
    
    if (!username || !password) {
      return NextResponse.json(
        { success: false, pesan: 'Username dan password harus diisi' },
        { status: 400 }
      );
    }

    const captchaCheck = verifyCaptchaPayload(captcha_token, captcha_value);
    if (!captchaCheck.valid) {
      return NextResponse.json(
        { success: false, pesan: captchaCheck.message },
        { status: 400 }
      );
    }
    
    const admin = await Admin.findOne({
      where: {
        is_active: true,
        username,
      },
    });
    
    if (!admin) {
      return NextResponse.json(
        { success: false, pesan: 'Username atau password salah' },
        { status: 401 }
      );
    }
    
    const isValid = await admin.validPassword(password);
    
    if (!isValid) {
      return NextResponse.json(
        { success: false, pesan: 'Username atau password salah' },
        { status: 401 }
      );
    }
    
    const authData = createAuthResponse(admin);
    
    const response = NextResponse.json({
      success: true,
      pesan: 'Login berhasil',
      data: authData,
    });
    
    // Set cookie
    response.cookies.set('auth_token', authData.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 hari
    });
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, pesan: 'Terjadi kesalahan server' },
      { status: 500 }
    );
  }
}
