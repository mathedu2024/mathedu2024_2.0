import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromCookie, type SessionData } from '@/utils/session';

/** 不需登入即可存取的 API（仍可能在 route 內做欄位過濾） */
const PUBLIC_API_ROUTES: Array<{ path: string; methods?: string[] }> = [
  { path: '/api/auth/login', methods: ['POST'] },
  { path: '/api/auth/logout', methods: ['POST'] },
  { path: '/api/announcement/list', methods: ['GET'] },
  { path: '/api/courses/list', methods: ['GET', 'POST'] },
  { path: '/api/teacher/list', methods: ['GET'] },
];

/** 僅老師/管理員可存取的路徑前綴 */
const STAFF_API_PREFIXES = [
  '/api/admin/',
  '/api/grades/save',
  '/api/grades/get',
  '/api/courses/create',
  '/api/courses/delete',
  '/api/courses/update',
  '/api/courses/archive',
  '/api/announcement/create',
  '/api/announcement/update',
  '/api/announcement/delete',
  '/api/quizzes/',
  '/api/quiz-images/',
  '/api/quiz-submissions/',
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

function isPublicApi(pathname: string, method: string): boolean {
  return PUBLIC_API_ROUTES.some(
    (route) => route.path === pathname && (!route.methods || route.methods.includes(method))
  );
}

function requiresStaff(pathname: string): boolean {
  return STAFF_API_PREFIXES.some((prefix) => pathname.startsWith(prefix) || pathname === prefix);
}

/** Inline staff check — do not import from apiAuth (it pulls next/headers and breaks proxy). */
function isStaffSession(session: SessionData): boolean {
  const roles = Array.isArray(session.role) ? session.role : [session.role];
  return roles.some((role) => role === 'admin' || role === 'teacher');
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

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
