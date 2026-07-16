/** 跨分頁操作活動心跳：任一頁有操作，其他分頁不應視為閒置而登出 */

const ACTIVITY_KEY = 'app_session_activity';

export function pulseSessionActivity(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function getLastSessionActivityAt(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    if (!raw) return 0;
    const ts = Number.parseInt(raw, 10);
    return Number.isFinite(ts) ? ts : 0;
  } catch {
    return 0;
  }
}

/** 最近 idleTimeoutMs 內任一頁有操作 → 視為仍在使用 */
export function hasRecentSessionActivity(idleTimeoutMs: number): boolean {
  const last = getLastSessionActivityAt();
  if (!last) return false;
  return Date.now() - last < idleTimeoutMs;
}

export const SESSION_ACTIVITY_STORAGE_KEY = ACTIVITY_KEY;
