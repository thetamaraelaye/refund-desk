import { NextResponse, type NextRequest } from 'next/server';

// Only checks that a session cookie exists, to send signed-out visitors to the right sign-in page. The
// API verifies every cookie on every request; this is navigation, not security.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith('/chat') && !request.cookies.has('customer-token')) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  if (
    pathname.startsWith('/admin') &&
    pathname !== '/admin/sign-in' &&
    !request.cookies.has('admin-token')
  ) {
    return NextResponse.redirect(new URL('/admin/sign-in', request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ['/chat/:path*', '/admin/:path*'] };
