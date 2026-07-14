import {
  SITE_ERROR_CODES,
  SiteDbWriteLimitError,
  type SiteErrorCode,
} from './siteErrorCodes';

type WriteLimitEvent = {
  code: SiteErrorCode;
  at: string;
  adminDetail?: string;
};

declare global {
  // eslint-disable-next-line no-var
  var _dbWriteGuardState: {
    dayKey: string;
    writeCount: number;
    lastLimitEvent: WriteLimitEvent | null;
  } | undefined;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getState() {
  const dayKey = todayKey();
  if (!global._dbWriteGuardState || global._dbWriteGuardState.dayKey !== dayKey) {
    global._dbWriteGuardState = {
      dayKey,
      writeCount: 0,
      lastLimitEvent: null,
    };
  }
  return global._dbWriteGuardState;
}

function getDailyWriteLimit(): number {
  const raw = process.env.FIRESTORE_DAILY_WRITE_LIMIT;
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
  console.error(`[${code}] Firestore write guard: ${adminDetail ?? 'limit reached'}`);
}

export function getDbWriteGuardStats() {
  const state = getState();
  return {
    dayKey: state.dayKey,
    writeCount: state.writeCount,
    dailyLimit: getDailyWriteLimit(),
    lastLimitEvent: state.lastLimitEvent,
  };
}

export function assertDbWriteBudget(estimatedWrites = 1): void {
  const limit = getDailyWriteLimit();
  if (!limit) return;

  const state = getState();
  if (state.writeCount + estimatedWrites > limit) {
    const detail = `daily writes ${state.writeCount}/${limit}, requested ~${estimatedWrites}`;
    recordLimitEvent(SITE_ERROR_CODES.DB_WRITE_BUDGET_EXCEEDED, detail);
    throw new SiteDbWriteLimitError(SITE_ERROR_CODES.DB_WRITE_BUDGET_EXCEEDED, detail);
  }
}

export function recordDbWrites(count: number): void {
  if (!Number.isFinite(count) || count <= 0) return;

  const limit = getDailyWriteLimit();
  const state = getState();
  state.writeCount += count;

  if (limit && state.writeCount > limit) {
    const detail = `daily writes exceeded after operation (${state.writeCount}/${limit})`;
    recordLimitEvent(SITE_ERROR_CODES.DB_WRITE_DAILY_LIMIT, detail);
    throw new SiteDbWriteLimitError(SITE_ERROR_CODES.DB_WRITE_DAILY_LIMIT, detail);
  }
}

export function mapFirestoreWriteError(error: unknown): Error {
  if (error instanceof SiteDbWriteLimitError) return error;

  const message = error instanceof Error ? error.message : String(error);
  const code = (error as { code?: number | string })?.code;

  const isQuotaError =
    code === 8 ||
    code === 'resource-exhausted' ||
    code === 'RESOURCE_EXHAUSTED' ||
    /resource.exhausted|quota exceeded|too many requests/i.test(message);

  if (isQuotaError) {
    const detail = message || 'Firestore write quota exhausted';
    recordLimitEvent(SITE_ERROR_CODES.DB_WRITE_FIRESTORE_QUOTA, detail);
    return new SiteDbWriteLimitError(SITE_ERROR_CODES.DB_WRITE_FIRESTORE_QUOTA, detail);
  }

  return error instanceof Error ? error : new Error(message);
}
