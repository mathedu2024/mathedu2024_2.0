import type { Quiz } from '@/services/quizTypes';
import { ensureQuizSections } from '@/services/quizTypes';

const PREVIEW_STORAGE_PREFIX = 'teacher_exam_preview:';
const PREVIEW_LATEST_KEY = 'teacher_exam_preview_latest';
const PREVIEW_TTL_MS = 30 * 60 * 1000;

type PreviewPayload = {
  token: string;
  savedAt: number;
  quiz: Quiz;
};

export function buildTeacherExamPreviewPath(token: string): string {
  return `/back-panel/teacher-exams/preview?t=${encodeURIComponent(token)}`;
}

function writePayload(token: string, quiz: Quiz): PreviewPayload {
  const payload: PreviewPayload = {
    token,
    savedAt: Date.now(),
    quiz: ensureQuizSections(quiz),
  };
  const raw = JSON.stringify(payload);
  localStorage.setItem(`${PREVIEW_STORAGE_PREFIX}${token}`, raw);
  localStorage.setItem(PREVIEW_LATEST_KEY, raw);
  return payload;
}

function parsePayload(raw: string | null, expectedToken?: string): Quiz | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PreviewPayload;
    if (!parsed?.quiz || typeof parsed.savedAt !== 'number' || !parsed.token) return null;
    if (expectedToken && parsed.token !== expectedToken) return null;
    if (Date.now() - parsed.savedAt > PREVIEW_TTL_MS) return null;
    return ensureQuizSections(parsed.quiz);
  } catch {
    return null;
  }
}

/** 將目前編輯中的考卷暫存，供新分頁預覽讀取 */
export function stashTeacherExamPreview(quiz: Quiz): string {
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    writePayload(token, quiz);
  } catch {
    throw new Error('無法準備預覽資料，請稍後再試');
  }
  return token;
}

export function loadTeacherExamPreview(token: string): Quiz | null {
  if (!token || typeof window === 'undefined') return null;

  const fromToken = parsePayload(
    localStorage.getItem(`${PREVIEW_STORAGE_PREFIX}${token}`),
    token
  );
  if (fromToken) return fromToken;

  // 備援：Strict Mode／競態下 token key 可能已被清，改讀最新一筆
  const fromLatest = parsePayload(localStorage.getItem(PREVIEW_LATEST_KEY), token);
  if (fromLatest) return fromLatest;

  return null;
}

export function clearTeacherExamPreview(token: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (token) localStorage.removeItem(`${PREVIEW_STORAGE_PREFIX}${token}`);
    const latestRaw = localStorage.getItem(PREVIEW_LATEST_KEY);
    if (latestRaw) {
      try {
        const latest = JSON.parse(latestRaw) as PreviewPayload;
        if (!token || latest.token === token) {
          localStorage.removeItem(PREVIEW_LATEST_KEY);
        }
      } catch {
        localStorage.removeItem(PREVIEW_LATEST_KEY);
      }
    }
  } catch {
    /* ignore */
  }
}

/** 與學生作答相同：以新分頁開啟學生版預覽 */
export function openTeacherExamPreviewInNewTab(
  quiz: Quiz,
  options?: { targetWindow?: Window | null }
): void {
  const token = stashTeacherExamPreview(quiz);
  const url = buildTeacherExamPreviewPath(token);

  if (options?.targetWindow && !options.targetWindow.closed) {
    options.targetWindow.location.href = url;
    return;
  }

  // 必須在使用者點擊的同步呼叫堆疊內開啟，否則會被瀏覽器擋下
  const win = window.open(url, '_blank');
  if (!win) {
    clearTeacherExamPreview(token);
    throw new Error('瀏覽器封鎖了新分頁，請允許此網站開啟彈出式視窗');
  }
}

/**
 * 在 click handler 同步開啟空白分頁，避免 setTimeout 後 window.open 被擋。
 * 回傳視窗供後續導向預覽 URL。
 */
export function openBlankPreviewTab(): Window | null {
  return window.open('about:blank', '_blank');
}

