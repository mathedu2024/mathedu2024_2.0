import {
  SITE_ERROR_CODES,
  SiteDbReadLimitError,
  type SiteErrorCode,
} from './siteErrorCodes';

type ReadLimitEvent = {
  code: SiteErrorCode;
  at: string;
  adminDetail?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var _dbReadGuardState: {
    dayKey: string;
    readCount: number;
    lastLimitEvent: ReadLimitEvent | null;
  } | undefined;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getState() {
  const dayKey = todayKey();
  if (!global._dbReadGuardState || global._dbReadGuardState.dayKey !== dayKey) {
    global._dbReadGuardState = {
      dayKey,
      readCount: 0,
      lastLimitEvent: null,
    };
  }
  return global._dbReadGuardState;
}

function getDailyReadLimit(): number {
  const raw = process.env.FIRESTORE_DAILY_READ_LIMIT;
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function recordLimitEvent(code: SiteErrorCode, adminDetail?: string): void {
  const state = getState();
  state.lastLimitEvent = {
    code,
    at: new Date().toISOString(),
    adminDetail,
  };
  console.error(`[${code}] Firestore read guard: ${adminDetail ?? 'limit reached'}`);
}

export function getDbReadGuardStats() {
  const state = getState();
  return {
    dayKey: state.dayKey,
    readCount: state.readCount,
    dailyLimit: getDailyReadLimit(),
    lastLimitEvent: state.lastLimitEvent,
  };
}

export function assertDbReadBudget(estimatedReads = 1): void {
  const limit = getDailyReadLimit();
  if (!limit) return;

  const state = getState();
  if (state.readCount + estimatedReads > limit) {
    const detail = `daily reads ${state.readCount}/${limit}, requested ~${estimatedReads}`;
    recordLimitEvent(SITE_ERROR_CODES.DB_READ_BUDGET_EXCEEDED, detail);
    throw new SiteDbReadLimitError(SITE_ERROR_CODES.DB_READ_BUDGET_EXCEEDED, detail);
  }
}

export function recordDbReads(count: number): void {
  if (!Number.isFinite(count) || count <= 0) return;

  const limit = getDailyReadLimit();
  const state = getState();
  state.readCount += count;

  if (limit && state.readCount > limit) {
    const detail = `daily reads exceeded after operation (${state.readCount}/${limit})`;
    recordLimitEvent(SITE_ERROR_CODES.DB_READ_DAILY_LIMIT, detail);
    throw new SiteDbReadLimitError(SITE_ERROR_CODES.DB_READ_DAILY_LIMIT, detail);
  }
}

export function mapFirestoreReadError(error: unknown): Error {
  if (error instanceof SiteDbReadLimitError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: number | string })?.code;

  const isQuotaError =
    code === 8 ||
    code === 'resource-exhausted' ||
    code === 'RESOURCE_EXHAUSTED' ||
    /resource.exhausted|quota exceeded|too many requests/i.test(message);

  if (isQuotaError) {
    const detail = message || 'Firestore quota exhausted';
    recordLimitEvent(SITE_ERROR_CODES.DB_READ_FIRESTORE_QUOTA, detail);
    return new SiteDbReadLimitError(SITE_ERROR_CODES.DB_READ_FIRESTORE_QUOTA, detail);
  }

  return error instanceof Error ? error : new Error(message);
}
