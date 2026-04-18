import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  const protectedPaths = [
    '/back-panel',
    '/student',
    '/admin'
  ];
  
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  
  if (isProtectedPath) {
    const referrer = request.headers.get('referer');
    const origin = request.headers.get('origin');
    
    if (!referrer || (origin && !referrer.includes(origin))) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`可疑的直接訪問嘗試: ${pathname} from ${referrer || 'direct'}`);
      }
    }
    
    const sessionCookie = request.cookies.get('session');
    if (!sessionCookie) {
      if (pathname.startsWith('/student')) {
        return NextResponse.redirect(new URL('/login', request.url));
      } else {
        return NextResponse.redirect(new URL('/panel', request.url));
      }
    }
    
    try {
      const sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));
      
      if (!sessionData?.role) {
        if (pathname.startsWith('/student')) {
          return NextResponse.redirect(new URL('/login', request.url));
        } else {
          return NextResponse.redirect(new URL('/panel', request.url));
        }
      }
      
      if (pathname.startsWith('/student')) {
        if (Array.isArray(sessionData.role)) {
          if (!sessionData.role.includes('student')) {
            return NextResponse.redirect(new URL('/login', request.url));
          }
        } else {
          if (sessionData.role !== 'student') {
        return NextResponse.redirect(new URL('/login', request.url));
      }
        }
      }
      if (pathname.startsWith('/back-panel')) {
        if (Array.isArray(sessionData.role)) {
          if (!sessionData.role.includes('admin') && !sessionData.role.includes('teacher')) {
            return NextResponse.redirect(new URL('/panel', request.url));
          }
        } else {
          if (!['admin', 'teacher'].includes(sessionData.role)) {
        return NextResponse.redirect(new URL('/panel', request.url));
          }
        }
      }
      
    } catch (error) {
      if (pathname.startsWith('/student')) {
        return NextResponse.redirect(new URL('/login', request.url));
      } else {
        return NextResponse.redirect(new URL('/panel', request.url));
      }
    }
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: [

    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}; 