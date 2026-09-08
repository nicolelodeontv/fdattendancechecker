import { NextResponse } from 'next/server';

export function middleware(request) {
  const proto = request.headers.get('x-forwarded-proto');
  const host = request.headers.get('host');

  if (proto === 'http' && host) {
    const url = request.nextUrl.clone();
    url.protocol = 'https:';
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
