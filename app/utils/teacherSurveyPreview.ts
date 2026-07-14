import type { Survey } from '@/services/surveyTypes';
import { ensureSurveySections } from '@/services/surveyTypes';

const PREVIEW_STORAGE_PREFIX = 'teacher_survey_preview:';
const PREVIEW_LATEST_KEY = 'teacher_survey_preview_latest';
const PREVIEW_TTL_MS = 30 * 60 * 1000;

type PreviewPayload = {
  token: string;
  savedAt: number;
  survey: Survey;
};

export function buildTeacherSurveyPreviewPath(token: string): string {
  return `/back-panel/teacher-surveys/preview?t=${encodeURIComponent(token)}`;
}

function writePayload(token: string, survey: Survey): PreviewPayload {
  const payload: PreviewPayload = {
    token,
    savedAt: Date.now(),
    survey: ensureSurveySections(survey),
  };
  const raw = JSON.stringify(payload);
  localStorage.setItem(`${PREVIEW_STORAGE_PREFIX}${token}`, raw);
  localStorage.setItem(PREVIEW_LATEST_KEY, raw);
  return payload;
}

function parsePayload(raw: string | null, expectedToken?: string): Survey | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PreviewPayload;
    if (!parsed?.survey || typeof parsed.savedAt !== 'number' || !parsed.token) return null;
    if (expectedToken && parsed.token !== expectedToken) return null;
    if (Date.now() - parsed.savedAt > PREVIEW_TTL_MS) return null;
    return ensureSurveySections(parsed.survey);
  } catch {
    return null;
  }
}

export function stashTeacherSurveyPreview(survey: Survey): string {
  const token = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    writePayload(token, survey);
  } catch {
    throw new Error('無法準備預覽資料，請稍後再試');
  }
  return token;
}

export function loadTeacherSurveyPreview(token: string): Survey | null {
  if (!token || typeof window === 'undefined') return null;

  const fromToken = parsePayload(
    localStorage.getItem(`${PREVIEW_STORAGE_PREFIX}${token}`),
    token
  );
  if (fromToken) return fromToken;

  const fromLatest = parsePayload(localStorage.getItem(PREVIEW_LATEST_KEY), token);
  if (fromLatest) return fromLatest;

  return null;
}

export function clearTeacherSurveyPreview(token: string): void {
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

export function openTeacherSurveyPreviewInNewTab(
  survey: Survey,
  options?: { targetWindow?: Window | null }
): void {
  const token = stashTeacherSurveyPreview(survey);
  const url = buildTeacherSurveyPreviewPath(token);

  if (options?.targetWindow && !options.targetWindow.closed) {
    options.targetWindow.location.href = url;
    return;
  }

  const win = window.open(url, '_blank');
  if (!win) {
    clearTeacherSurveyPreview(token);
    throw new Error('瀏覽器封鎖了新分頁，請允許此網站開啟彈出式視窗');
  }
}

export function openBlankPreviewTab(): Window | null {
  return window.open('about:blank', '_blank');
}
