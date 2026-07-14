import type { Quiz } from '@/services/quizTypes';
import { isQuizExamLockEnabled, isQuizRequireFullscreen } from '@/services/quizTypes';

/** 是否應在進入測驗時從 localStorage 恢復暫存 */
export function shouldRestoreExamDraft(quiz: Quiz): boolean {
  if (isQuizRequireFullscreen(quiz) || isQuizExamLockEnabled(quiz)) return true;
  if (typeof window === 'undefined') return false;
  const entry = performance.getEntriesByType('navigation')[0] as
    | PerformanceNavigationTiming
    | undefined;
  return entry?.type === 'reload';
}

/** 主動離開時是否保留暫存（非全螢幕且未鎖定則不保留） */
export function shouldKeepDraftOnVoluntaryExit(quiz: Quiz): boolean {
  return isQuizRequireFullscreen(quiz) || isQuizExamLockEnabled(quiz);
}
