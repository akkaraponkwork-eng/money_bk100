import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('bk100_auth');
  const { pathname } = request.nextUrl;
  
  const isLoginPage = pathname === '/login';
  const isAuthApi = pathname.startsWith('/api/auth');
  const isPublicResource = pathname.startsWith('/_next') || pathname === '/favicon.ico';

  if (isPublicResource) {
    return NextResponse.next();
  }

  if (!token && !isLoginPage && !isAuthApi) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (token && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
