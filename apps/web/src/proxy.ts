import { NextResponse, type NextRequest } from 'next/server';

// Only checks that a session cookie exists, to send signed-out visitors to the sign-in page. The API
// verifies every cookie on every request; this is navigation, not security.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/chat') && !request.cookies.has('customer-token')) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if (pathname.startsWith('/admin') && !request.cookies.has('admin-token')) {
    return NextResponse.redirect(new URL('/?signin=staff', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/chat/:path*', '/admin/:path*'] };
