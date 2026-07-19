/** sessionStorage key：未登入掃 QR 後暫存要返回的簽到網址 */
export const STUDENT_LOGIN_NEXT_KEY = 'student_login_next';

/** 僅允許學生端相對路徑，避免 open redirect */
export function isSafeStudentNextPath(path: string | null | undefined): boolean {
  if (!path || !path.startsWith('/') || path.startsWith('//')) return false;
  if (path.includes('://')) return false;
  return path === '/student' || path.startsWith('/student/');
}

export function sanitizeStudentLoginNext(
  path: string | null | undefined,
  fallback = '/student'
): string {
  return isSafeStudentNextPath(path) ? (path as string) : fallback;
}

export function buildStudentLoginUrl(nextPath: string): string {
  const safe = sanitizeStudentLoginNext(nextPath);
  if (safe === '/student') return '/login';
  return `/login?next=${encodeURIComponent(safe)}`;
}

export function rememberStudentLoginNext(nextPath: string): void {
  if (typeof window === 'undefined') return;
  const safe = sanitizeStudentLoginNext(nextPath, '');
  if (!safe) return;
  try {
    sessionStorage.setItem(STUDENT_LOGIN_NEXT_KEY, safe);
  } catch {
    // ignore quota / private mode
  }
}

export function consumeStudentLoginNext(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = sessionStorage.getItem(STUDENT_LOGIN_NEXT_KEY);
    sessionStorage.removeItem(STUDENT_LOGIN_NEXT_KEY);
    return isSafeStudentNextPath(stored) ? stored : null;
  } catch {
    return null;
  }
}
