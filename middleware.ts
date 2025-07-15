import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // 需要保護的路徑
  const protectedPaths = [
    '/back-panel',
    '/student',
    '/admin'
  ];
  
  // 檢查是否訪問受保護的路徑
  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));
  
  if (isProtectedPath) {
    // 優化：簡化 referrer 檢查
    const referrer = request.headers.get('referer');
    const origin = request.headers.get('origin');
    
    // 如果是直接訪問（沒有 referrer）或來自外部網站
    if (!referrer || (origin && !referrer.includes(origin))) {
      // 記錄可疑訪問（僅在開發環境）
      if (process.env.NODE_ENV === 'development') {
        console.warn(`可疑的直接訪問嘗試: ${pathname} from ${referrer || 'direct'}`);
      }
    }
    
    // 檢查 session cookie
    const sessionCookie = request.cookies.get('session');
    if (!sessionCookie) {
      // 沒有 session，重定向到對應的登入頁面
      if (pathname.startsWith('/student')) {
        return NextResponse.redirect(new URL('/login', request.url));
      } else {
        return NextResponse.redirect(new URL('/panel', request.url));
      }
    }
    
    try {
      // 解析 session cookie
      const sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));
      
      // 優化：簡化 session 驗證
      if (!sessionData?.role) {
        if (pathname.startsWith('/student')) {
          return NextResponse.redirect(new URL('/login', request.url));
        } else {
          return NextResponse.redirect(new URL('/panel', request.url));
        }
      }
      
      // 根據路徑檢查角色權限
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
      // 優化：簡化錯誤處理
      if (pathname.startsWith('/student')) {
        return NextResponse.redirect(new URL('/login', request.url));
      } else {
        return NextResponse.redirect(new URL('/panel', request.url));
      }
    }
  }
  
  // 允許正常訪問
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}; 