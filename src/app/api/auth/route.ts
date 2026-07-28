import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, username, password } = body;

    if (action === 'logout') {
      const response = NextResponse.json({ success: true });
      response.cookies.delete('bk100_auth');
      return response;
    }

    if (action === 'login') {
      const validUser = process.env.ADMIN_USERNAME || 'admin';
      const validPass = process.env.ADMIN_PASSWORD || 'bk100admin';

      if (username === validUser && password === validPass) {
        const response = NextResponse.json({ success: true });
        response.cookies.set('bk100_auth', 'true', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });
        return response;
      }
      return NextResponse.json({ error: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง' }, { status: 401 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
