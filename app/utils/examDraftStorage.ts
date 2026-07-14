import { isQuestionAnswered } from '@/utils/examAnswerStatus';
import type { StudentAnswers } from '@/services/quizSubmissionTypes';

export interface ExamDraftData {
  answers?: StudentAnswers;
  skippedIds?: string[];
  startedAt?: number;
  deadlineAt?: number | null;
}

const DRAFT_PREFIX = 'quiz-draft:';
const TAKE_ACTIVE_PREFIX = 'quiz-take-active:';
const TAKE_ACTIVE_STALE_MS = 12_000;
const TAKE_ACTIVE_HEARTBEAT_MS = 4_000;
const TAB_ID_KEY = 'quiz-take-tab-id';

interface TakeActiveRecord {
  quizCode: string;
  tabId: string;
  ts: number;
}

export type ExamStartBlockType = 'draft' | 'active-session';

export interface ExamStartCheckResult {
  allowed: boolean;
  blockingQuizCode?: string;
  hasOwnDraft?: boolean;
  reason?: string;
  blockType?: ExamStartBlockType;
}

export function examDraftStorageKey(quizCode: string, studentId: string): string {
  return `${DRAFT_PREFIX}${quizCode}:${studentId}`;
}

function examTakeActiveKey(studentId: string): string {
  return `${TAKE_ACTIVE_PREFIX}${studentId}`;
}

function getExamBrowserTabId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let tabId = sessionStorage.getItem(TAB_ID_KEY);
    if (!tabId) {
      tabId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(TAB_ID_KEY, tabId);
    }
    return tabId;
  } catch {
    return `tab-${Date.now()}`;
  }
}

function readTakeActiveRecord(studentId: string): TakeActiveRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(examTakeActiveKey(studentId));
    if (!raw) return null;
    const record = JSON.parse(raw) as TakeActiveRecord;
    if (!record.quizCode || !record.tabId || !record.ts) return null;
    if (Date.now() - record.ts > TAKE_ACTIVE_STALE_MS) return null;
    return record;
  } catch {
    return null;
  }
}

export function getActiveTakeExamQuizCode(studentId: string): string | null {
  return readTakeActiveRecord(studentId)?.quizCode ?? null;
}

export function setTakeActiveSession(studentId: string, quizCode: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    examTakeActiveKey(studentId),
    JSON.stringify({
      quizCode,
      tabId: getExamBrowserTabId(),
      ts: Date.now(),
    } satisfies TakeActiveRecord)
  );
}

export function clearTakeActiveSession(studentId: string): void {
  if (typeof window === 'undefined') return;
  const key = examTakeActiveKey(studentId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const record = JSON.parse(raw) as TakeActiveRecord;
    if (record.tabId === getExamBrowserTabId()) {
      localStorage.removeItem(key);
    }
  } catch {
    localStorage.removeItem(key);
  }
}

export function takeActiveHeartbeatIntervalMs(): number {
  return TAKE_ACTIVE_HEARTBEAT_MS;
}

export function readExamDraft(quizCode: string, studentId: string): ExamDraftData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(examDraftStorageKey(quizCode, studentId));
    if (!raw) return null;
    return JSON.parse(raw) as ExamDraftData;
  } catch {
    return null;
  }
}

function hasExamDraftAnswers(draft: ExamDraftData): boolean {
  const answers = draft.answers ?? {};
  return Object.keys(answers).some((id) => isQuestionAnswered(answers[id]));
}

/** 是否有實際作答或跳過紀錄（用於阻擋開啟其他測驗） */
export function isExamDraftBlockingOthers(draft: ExamDraftData | null): boolean {
  if (!draft) return false;
  if (hasExamDraftAnswers(draft)) return true;
  if (Array.isArray(draft.skippedIds) && draft.skippedIds.length > 0) return true;
  return false;
}

/** 是否應接續本測驗暫存（含限時計時中的場次） */
export function hasExamDraftToResume(draft: ExamDraftData | null): boolean {
  if (!draft) return false;
  if (isExamDraftBlockingOthers(draft)) return true;
  if (draft.deadlineAt && draft.deadlineAt > Date.now()) return true;
  return false;
}

/** @deprecated 請改用 isExamDraftBlockingOthers 或 hasExamDraftToResume */
export function isExamDraftInProgress(draft: ExamDraftData | null): boolean {
  return hasExamDraftToResume(draft);
}

export function clearExamDraft(quizCode: string, studentId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(examDraftStorageKey(quizCode, studentId));
}

export function listExamDraftEntries(
  studentId: string
): { quizCode: string; draft: ExamDraftData }[] {
  if (typeof window === 'undefined') return [];

  const result: { quizCode: string; draft: ExamDraftData }[] = [];
  const suffix = `:${studentId}`;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(DRAFT_PREFIX) || !key.endsWith(suffix)) continue;
    const quizCode = key.slice(DRAFT_PREFIX.length, key.length - suffix.length);
    if (!quizCode) continue;
    const draft = readExamDraft(quizCode, studentId);
    if (!draft) continue;
    if (hasExamDraftToResume(draft) || isExamDraftBlockingOthers(draft)) {
      result.push({ quizCode, draft });
      continue;
    }
    clearExamDraft(quizCode, studentId);
  }

  return result;
}

/** @deprecated 請改用 listExamDraftEntries */
export function listInProgressExamDrafts(
  studentId: string
): { quizCode: string; draft: ExamDraftData }[] {
  return listExamDraftEntries(studentId).filter(({ draft }) => hasExamDraftToResume(draft));
}

export function canStartExamTake(
  studentId: string,
  targetQuizCode: string
): ExamStartCheckResult {
  const activeQuizCode = getActiveTakeExamQuizCode(studentId);
  if (activeQuizCode && activeQuizCode !== targetQuizCode) {
    return {
      allowed: false,
      blockingQuizCode: activeQuizCode,
      blockType: 'active-session',
      reason: '您已有進行中的測驗作答分頁，請先完成或關閉該分頁後，再開啟其他測驗。',
    };
  }

  const drafts = listExamDraftEntries(studentId);
  const other = drafts.find(
    (d) => d.quizCode !== targetQuizCode && isExamDraftBlockingOthers(d.draft)
  );
  if (other) {
    return {
      allowed: false,
      blockingQuizCode: other.quizCode,
      blockType: 'draft',
      reason: '您尚有未提交的作答紀錄，請先完成該測驗後，再開啟其他測驗。',
    };
  }

  const ownDraft = drafts.some(
    (d) => d.quizCode === targetQuizCode && hasExamDraftToResume(d.draft)
  );
  return { allowed: true, hasOwnDraft: ownDraft };
}
