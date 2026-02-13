import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // TODO: Integrate with NextAuth.js or custom JWT verification
  // For now, we simulate protection based on a cookie
  
  const token = request.cookies.get('auth_token');
  const { pathname } = request.nextUrl;

  // Public paths that don't require auth
  const publicPaths = ['/login', '/register', '/landing', '/'];

  if (publicPaths.some(path => pathname.startsWith(path))) {
    if (token) {
      // If already logged in, redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Protected paths
  if (!token) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*', 
    '/learn/:path*', 
    '/practice/:path*', 
    '/settings/:path*',
    '/login',
    '/register'
  ],
};
