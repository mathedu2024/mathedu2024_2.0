/** 預覽／課程互動保活：開啟時本分頁與其他分頁（含原視窗）皆不算閒置登出 */

const KEEPALIVE_KEY = 'teacher_course_interact_keepalive';
/** 超過此時間未續期，視為預覽／互動頁已關閉 */
const KEEPALIVE_TTL_MS = 90_000;

export function pulseInteractKeepalive(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEEPALIVE_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function clearInteractKeepalive(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(KEEPALIVE_KEY);
  } catch {
    /* ignore */
  }
}

export function isInteractKeepaliveActive(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem(KEEPALIVE_KEY);
    if (!raw) return false;
    const ts = Number.parseInt(raw, 10);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < KEEPALIVE_TTL_MS;
  } catch {
    return false;
  }
}

export function isTeacherInteractPath(pathname: string | null | undefined): boolean {
  return (pathname ?? '') === '/back-panel/teacher-courses/interact';
}

/** 測驗／問卷／課程學生端預覽，以及課程互動投影 */
export function isTeacherPreviewOrInteractPath(pathname: string | null | undefined): boolean {
  const p = pathname ?? '';
  return (
    p === '/back-panel/teacher-courses/interact' ||
    p === '/back-panel/teacher-exams/preview' ||
    p === '/back-panel/teacher-surveys/preview' ||
    p === '/back-panel/teacher-courses/preview' ||
    p.startsWith('/back-panel/teacher-courses/preview/')
  );
}

export function shouldSkipIdleLogout(pathname: string | null | undefined): boolean {
  return isTeacherPreviewOrInteractPath(pathname) || isInteractKeepaliveActive();
}

export const TEACHER_SESSION_KEEPALIVE_STORAGE_KEY = KEEPALIVE_KEY;
