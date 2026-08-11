/**
 * 網站內特殊錯誤代碼（僅供管理員辨識，勿直接顯示給一般使用者／老師）
 *
 * 讀取：
 * SITE-DB-R001  自訂每日讀取上限已達
 * SITE-DB-R002  Firestore 讀取配額／RESOURCE_EXHAUSTED
 * SITE-DB-R003  單次請求讀取預算不足
 *
 * 寫入：
 * SITE-DB-W001  自訂每日寫入上限已達
 * SITE-DB-W002  Firestore 寫入配額／RESOURCE_EXHAUSTED
 * SITE-DB-W003  單次請求寫入預算不足
 *
 * 測驗圖片儲存（Cloudflare R2，基礎設施／額度類）：
 * SITE-IMG-C001  圖片儲存尚未設定
 * SITE-IMG-C002  圖片儲存服務異常
 * SITE-IMG-U001  圖片上傳失敗（服務端）
 * SITE-IMG-D001  圖片刪除失敗（服務端）
 *
 * 使用者操作問題（格式、大小、張數等）不使用錯誤代碼，直接回傳文字提醒。
 */

export const SITE_ERROR_CODES = {
  DB_READ_DAILY_LIMIT: 'SITE-DB-R001',
  DB_READ_FIRESTORE_QUOTA: 'SITE-DB-R002',
  DB_READ_BUDGET_EXCEEDED: 'SITE-DB-R003',
  DB_WRITE_DAILY_LIMIT: 'SITE-DB-W001',
  DB_WRITE_FIRESTORE_QUOTA: 'SITE-DB-W002',
  DB_WRITE_BUDGET_EXCEEDED: 'SITE-DB-W003',
  IMG_NOT_CONFIGURED: 'SITE-IMG-C001',
  IMG_STORAGE_FAULT: 'SITE-IMG-C002',
  IMG_UPLOAD_FAILED: 'SITE-IMG-U001',
  IMG_DELETE_FAILED: 'SITE-IMG-D001',
} as const;

export type SiteErrorCode = (typeof SITE_ERROR_CODES)[keyof typeof SITE_ERROR_CODES];

/** 回傳給一般使用者的統一訊息（不含額度／基礎設施細節） */
export const PUBLIC_UNAVAILABLE_MESSAGE = '系統忙碌中，請洽管理人員';

export class SiteDbReadLimitError extends Error {
  readonly siteErrorCode: SiteErrorCode;
  readonly adminDetail?: string;

  constructor(code: SiteErrorCode, adminDetail?: string) {
    super(PUBLIC_UNAVAILABLE_MESSAGE);
    this.name = 'SiteDbReadLimitError';
    this.siteErrorCode = code;
    this.adminDetail = adminDetail;
  }
}

export class SiteDbWriteLimitError extends Error {
  readonly siteErrorCode: SiteErrorCode;
  readonly adminDetail?: string;

  constructor(code: SiteErrorCode, adminDetail?: string) {
    super(PUBLIC_UNAVAILABLE_MESSAGE);
    this.name = 'SiteDbWriteLimitError';
    this.siteErrorCode = code;
    this.adminDetail = adminDetail;
  }
}

/**
 * 測驗圖片基礎設施錯誤（R2 未設定／服務異常／上傳刪除失敗）。
 * 對外一律 PUBLIC_UNAVAILABLE_MESSAGE；siteErrorCode 僅管理員可見。
 */
export class SiteImgError extends Error {
  readonly siteErrorCode: SiteErrorCode;
  readonly adminDetail?: string;
  readonly httpStatus: number;

  constructor(code: SiteErrorCode, adminDetail?: string, httpStatus = 503) {
    super(PUBLIC_UNAVAILABLE_MESSAGE);
    this.name = 'SiteImgError';
    this.siteErrorCode = code;
    this.adminDetail = adminDetail;
    this.httpStatus = httpStatus;
  }
}

export function isSiteDbReadLimitError(error: unknown): error is SiteDbReadLimitError {
  return error instanceof SiteDbReadLimitError;
}

export function isSiteDbWriteLimitError(error: unknown): error is SiteDbWriteLimitError {
  return error instanceof SiteDbWriteLimitError;
}

export function isSiteDbLimitError(
  error: unknown
): error is SiteDbReadLimitError | SiteDbWriteLimitError {
  return isSiteDbReadLimitError(error) || isSiteDbWriteLimitError(error);
}

export function isSiteImgError(error: unknown): error is SiteImgError {
  return error instanceof SiteImgError;
}
