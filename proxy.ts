import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie, type SessionData } from '@/utils/session';

/** 不需登入即可存取的 API（仍可能在 route 內做欄位過濾） */
const PUBLIC_API_ROUTES: Array<{ path: string; methods?: string[] }> = [
  { path: '/api/auth/login', methods: ['POST'] },
  { path: '/api/auth/logout', methods: ['POST'] },
  { path: '/api/auth/google', methods: ['POST'] },
  { path: '/api/auth/register', methods: ['POST'] },
  { path: '/api/auth/forgot-password', methods: ['POST'] },
  { path: '/api/auth/resend-verification', methods: ['POST'] },
  { path: '/api/announcement/list', methods: ['GET'] },
  { path: '/api/courses/list', methods: ['GET', 'POST'] },
  { path: '/api/teacher/list', methods: ['GET'] },
  { path: '/api/blog/posts', methods: ['GET'] },
  { path: '/api/blog/categories', methods: ['GET'] },
  { path: '/api/blog/comments', methods: ['GET'] },
  { path: '/api/exam-dates/list', methods: ['GET'] },
  { path: '/api/blog/sitemap', methods: ['GET'] },
];

/** 公開路徑前綴（含動態 slug） */
const PUBLIC_API_PREFIXES: Array<{ prefix: string; methods?: string[] }> = [
  { prefix: '/api/blog/posts/', methods: ['GET'] },
  { prefix: '/api/auth/reset-password/', methods: ['GET', 'POST'] },
  { prefix: '/api/auth/verify-email/', methods: ['POST'] },
];

/** 僅老師/管理員可存取的路徑前綴 */
const STAFF_API_PREFIXES = [
  '/api/admin/',
  '/api/grades/save',
  '/api/grades/get',
  '/api/courses/create',
  '/api/courses/clone',
  '/api/courses/delete',
  '/api/courses/update',
  '/api/courses/archive',
  '/api/announcement/create',
  '/api/announcement/update',
  '/api/announcement/delete',
  '/api/quizzes/',
  '/api/quiz-images/',
  '/api/quiz-submissions/',
  '/api/surveys/',
  '/api/lessons/',
  '/api/upload-image',
  '/api/exam-dates/create',
  '/api/exam-dates/delete',
  '/api/course-student-list/',
  '/api/student/list',
  '/api/student/save',
  '/api/student/delete',
  '/api/student/bulk-import',
  '/api/student/reset-password',
  '/api/teacher/batch',
];

/** 管理員／作者可寫入的部落格後台 API */
const BLOG_EDITOR_API_PREFIXES = [
  '/api/blog/posts',
  '/api/blog/categories',
  '/api/blog/comments',
  '/api/blog/admin',
  '/api/blog/upload-cover',
  '/api/blog/upload-image',
];

function isPublicApi(pathname: string, method: string): boolean {
  if (
    PUBLIC_API_ROUTES.some(
      (route) => route.path === pathname && (!route.methods || route.methods.includes(method))
    )
  ) {
    return true;
  }
  return PUBLIC_API_PREFIXES.some(
    (route) =>
      pathname.startsWith(route.prefix) &&
      pathname !== route.prefix.replace(/\/$/, '') &&
      (!route.methods || route.methods.includes(method))
  );
}

function requiresStaff(pathname: string): boolean {
  return STAFF_API_PREFIXES.some((prefix) => pathname.startsWith(prefix) || pathname === prefix);
}

function requiresBlogEditor(pathname: string, method: string): boolean {
  if (method === 'GET' && (pathname.startsWith('/api/blog/posts') || pathname === '/api/blog/categories')) {
    return false;
  }
  return BLOG_EDITOR_API_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/** Inline staff check — do not import from apiAuth (it pulls next/headers and breaks proxy). */
function isStaffSession(session: SessionData): boolean {
  const roles = Array.isArray(session.role) ? session.role : [session.role];
  return roles.some((role) => role === 'admin' || role === 'teacher');
}

function isBlogEditorSession(session: SessionData): boolean {
  const roles = Array.isArray(session.role) ? session.role : [session.role];
  return roles.some((role) => role === 'author');
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  if (isPublicApi(pathname, request.method)) {
    return NextResponse.next();
  }

  const session = getSessionFromCookie(request.headers.get('cookie') || '');
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (requiresStaff(pathname) && !isStaffSession(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (requiresBlogEditor(pathname, request.method) && !isBlogEditorSession(session)) {
    // 學生留言建立仍允許已登入使用者（route 內再檢查）
    if (!(pathname.startsWith('/api/blog/comments') && request.method === 'POST')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
