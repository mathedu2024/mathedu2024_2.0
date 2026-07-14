import type { SurveyAnswers } from '@/services/surveyTypes';

export interface SurveyDraftData {
  answers: SurveyAnswers;
  otherTexts: Record<string, string>;
  savedAt: number;
}

const DRAFT_PREFIX = 'survey-draft:';

export function surveyDraftStorageKey(surveyCode: string, studentId: string): string {
  return `${DRAFT_PREFIX}${surveyCode}:${studentId}`;
}

export function loadSurveyDraft(
  surveyCode: string,
  studentId: string
): SurveyDraftData | null {
  if (typeof window === 'undefined' || !surveyCode || !studentId) return null;
  try {
    const raw = localStorage.getItem(surveyDraftStorageKey(surveyCode, studentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SurveyDraftData;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      answers: parsed.answers && typeof parsed.answers === 'object' ? parsed.answers : {},
      otherTexts:
        parsed.otherTexts && typeof parsed.otherTexts === 'object' ? parsed.otherTexts : {},
      savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveSurveyDraft(
  surveyCode: string,
  studentId: string,
  data: { answers: SurveyAnswers; otherTexts: Record<string, string> }
): void {
  if (typeof window === 'undefined' || !surveyCode || !studentId) return;
  try {
    const payload: SurveyDraftData = {
      answers: data.answers,
      otherTexts: data.otherTexts,
      savedAt: Date.now(),
    };
    localStorage.setItem(surveyDraftStorageKey(surveyCode, studentId), JSON.stringify(payload));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearSurveyDraft(surveyCode: string, studentId: string): void {
  if (typeof window === 'undefined' || !surveyCode || !studentId) return;
  try {
    localStorage.removeItem(surveyDraftStorageKey(surveyCode, studentId));
  } catch {
    /* ignore */
  }
}
