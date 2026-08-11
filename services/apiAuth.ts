import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookie, type SessionData } from '@/utils/session';
import { adminDb } from '@/services/firebase-admin';

export type AppRole = 'admin' | 'teacher' | 'author' | 'student';

export function normalizeRoles(role: string | string[] | undefined): string[] {
  if (!role) return [];
  return Array.isArray(role) ? role : [role];
}

export function sessionHasRole(session: SessionData, ...allowed: AppRole[]): boolean {
  const roles = normalizeRoles(session.role);
  return allowed.some((r) => roles.includes(r));
}

/** 課程相關教職員（不含作者） */
export function isStaffSession(session: SessionData): boolean {
  return sessionHasRole(session, 'admin', 'teacher');
}

/** 後台可登入身分（管理員／老師／作者） */
export function isPanelSession(session: SessionData): boolean {
  return sessionHasRole(session, 'admin', 'teacher', 'author');
}

/** 可管理部落格內容：僅作者（管理員不承擔部落格業務） */
export function isBlogEditorSession(session: SessionData): boolean {
  return sessionHasRole(session, 'author');
}

export function getSessionFromRequest(req: NextRequest): SessionData | null {
  return getSessionFromCookie(req.headers.get('cookie') || '');
}

export async function getSessionFromServerCookies(): Promise<SessionData | null> {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie?.value) return null;
  return getSessionFromCookie(`session=${sessionCookie.value}`);
}

export type AuthSuccess = { ok: true; session: SessionData };
export type AuthFailure = { ok: false; response: NextResponse };
export type AuthResult = AuthSuccess | AuthFailure;

export function requireAuth(
  session: SessionData | null,
  ...allowedRoles: AppRole[]
): AuthResult {
  if (!session?.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  if (allowedRoles.length > 0 && !sessionHasRole(session, ...allowedRoles)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  return { ok: true as const, session };
}

export function requireAuthFromRequest(
  req: NextRequest,
  ...allowedRoles: AppRole[]
): AuthResult {
  return requireAuth(getSessionFromRequest(req), ...allowedRoles);
}

/** 授權失敗時回傳錯誤 Response，成功時回傳 null */
export function authGuard(result: AuthResult): NextResponse | null {
  if (result.ok === false) return result.response;
  return null;
}

/**
 * 管理員可操作任何課程；老師僅能操作自己在 teachers[] 內的課程。
 * courseId 可用 doc id，或找不到時再嘗試字串鍵。
 */
export async function requireCourseStaffAccess(
  session: SessionData,
  courseId: string | null | undefined
): Promise<AuthResult> {
  if (!session?.id) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  if (!sessionHasRole(session, 'admin', 'teacher')) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }
  if (sessionHasRole(session, 'admin')) {
    return { ok: true as const, session };
  }
  if (!courseId?.trim()) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: '缺少課程識別碼' }, { status: 400 }),
    };
  }

  const id = courseId.trim();
  const snap = await adminDb.collection('courses').doc(id).get();
  if (!snap.exists) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: '找不到課程' }, { status: 404 }),
    };
  }
  const teachers = Array.isArray(snap.data()?.teachers)
    ? (snap.data()!.teachers as string[])
    : [];
  if (!teachers.includes(session.id)) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: '無權限操作此課程' }, { status: 403 }),
    };
  }
  return { ok: true as const, session };
}

export function stripPassword<T extends Record<string, unknown>>(data: T): Omit<T, 'password'> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...rest } = data;
  return rest;
}

export function stripPasswordsFromDocs(
  docs: Array<{ id: string; [key: string]: unknown }>
): Array<Omit<(typeof docs)[number], 'password'>> {
  return docs.map((doc) => stripPassword(doc));
}
