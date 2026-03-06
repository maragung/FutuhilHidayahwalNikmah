import { NextResponse } from 'next/server';
import { buildCaptchaSvg, createCaptchaToken, generateCaptchaCode } from '@/lib/captcha';

export async function GET() {
  try {
    const code = generateCaptchaCode(6);
    const token = createCaptchaToken(code);
    const svg = buildCaptchaSvg(code);
    const image = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

    return NextResponse.json(
      {
        success: true,
        data: {
          token,
          image,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Generate captcha error:', error);
    return NextResponse.json({ success: false, pesan: 'Gagal membuat captcha' }, { status: 500 });
  }
}
