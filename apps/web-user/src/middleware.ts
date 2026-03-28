import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/landing', '/'];

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get("host") || "";
  const token = request.cookies.get('auth_token');
  const { pathname } = url;

  // 1. B2B MULTI-TENANCY: Extract Tenant ID from Subdomain
  // If running locally, hostname might be localhost:3000. In prod, vus.zenc.ai
  let tenantId = "default";

  // Basic Subdomain Extraction (e.g., vus.zenc.ai -> vus)
  if (
    hostname.includes(".") &&
    !hostname.includes("localhost") &&
    !hostname.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/) // not an IP
  ) {
    const parts = hostname.split(".");
    if (parts.length > 2) {
      tenantId = parts[0];
    }
  }

  // Inject tenantId into headers for Server Components to read
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', tenantId);

  // 2. AUTHENTICATION ROUTING
  // Exact match for root to avoid infinite redirects on /
  if (pathname === '/') {
      return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // Public paths that don't require auth
  const isPublicPath = PUBLIC_PATHS.some(path => pathname === path || (path !== '/' && pathname.startsWith(path)));

  if (isPublicPath) {
    if (token) {
      // If already logged in, redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  // Protected paths
  if (!token) {
    // Redirect to login if not authenticated
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Proceed with injected tenant header
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
