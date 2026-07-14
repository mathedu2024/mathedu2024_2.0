import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionFromCookie, type SessionData } from '@/utils/session';

export type AppRole = 'admin' | 'teacher' | 'student';

export function normalizeRoles(role: string | string[] | undefined): string[] {
  if (!role) return [];
  return Array.isArray(role) ? role : [role];
}

export function sessionHasRole(session: SessionData, ...allowed: AppRole[]): boolean {
  const roles = normalizeRoles(session.role);
  return allowed.some((r) => roles.includes(r));
}

export function isStaffSession(session: SessionData): boolean {
  return sessionHasRole(session, 'admin', 'teacher');
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
