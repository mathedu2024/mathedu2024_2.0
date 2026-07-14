import { NextRequest, NextResponse } from 'next/server';
import {
  isSiteDbLimitError,
  isSiteImgError,
  PUBLIC_UNAVAILABLE_MESSAGE,
  type SiteErrorCode,
} from '@/services/siteErrorCodes';
import { getSessionFromCookie, type SessionData } from '@/utils/session';

export function isAdminSession(session: SessionData | null | undefined): boolean {
  if (!session?.role) return false;
  const roles = Array.isArray(session.role) ? session.role : [session.role];
  return roles.some((role) => {
    const normalized = String(role).toLowerCase();
    return normalized === 'admin' || normalized === '管理員';
  });
}

function buildAdminPayload(code: SiteErrorCode, adminDetail?: string) {
  return {
    siteErrorCode: code,
    ...(adminDetail ? { siteErrorDetail: adminDetail } : {}),
  };
}

function resolveIsAdmin(req?: NextRequest | null): boolean {
  const cookieHeader = req?.headers.get('cookie') ?? null;
  const session = cookieHeader ? getSessionFromCookie(cookieHeader) : null;
  return isAdminSession(session);
}

/** 處理資料庫讀取／寫入上限錯誤，一般使用者僅見通用訊息 */
export function trySiteDbErrorResponse(
  error: unknown,
  req?: NextRequest | null
): NextResponse | null {
  if (!isSiteDbLimitError(error)) return null;

  const isAdmin = resolveIsAdmin(req);
  const body: Record<string, unknown> = {
    error: PUBLIC_UNAVAILABLE_MESSAGE,
  };

  if (isAdmin) {
    Object.assign(body, buildAdminPayload(error.siteErrorCode, error.adminDetail));
  }

  const headers: Record<string, string> = {};
  if (isAdmin) {
    headers['X-Site-Error-Code'] = error.siteErrorCode;
  }

  return NextResponse.json(body, { status: 503, headers });
}

/** 測驗圖片基礎設施錯誤；一般使用者僅見通用訊息，管理員另附 siteErrorCode */
export function trySiteImgErrorResponse(
  error: unknown,
  req?: NextRequest | null
): NextResponse | null {
  if (!isSiteImgError(error)) return null;

  const isAdmin = resolveIsAdmin(req);
  const body: Record<string, unknown> = {
    error: PUBLIC_UNAVAILABLE_MESSAGE,
  };

  if (isAdmin) {
    Object.assign(body, buildAdminPayload(error.siteErrorCode, error.adminDetail));
  }

  const headers: Record<string, string> = {};
  if (isAdmin) {
    headers['X-Site-Error-Code'] = error.siteErrorCode;
  }

  return NextResponse.json(body, { status: error.httpStatus, headers });
}

/** 合併處理 DB／圖片等網站自訂錯誤 */
export function trySiteErrorResponse(
  error: unknown,
  req?: NextRequest | null
): NextResponse | null {
  return trySiteDbErrorResponse(error, req) ?? trySiteImgErrorResponse(error, req);
}

/** @deprecated 請改用 trySiteDbErrorResponse（已涵蓋讀取與寫入） */
export function trySiteDbReadErrorResponse(
  error: unknown,
  req?: NextRequest | null
): NextResponse | null {
  return trySiteDbErrorResponse(error, req);
}

/** 寫入上限錯誤的別名，行為與 trySiteDbErrorResponse 相同 */
export const trySiteDbWriteErrorResponse = trySiteDbErrorResponse;
