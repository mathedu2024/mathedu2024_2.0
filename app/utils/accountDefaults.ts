/** 新建帳號／邀請開通後的預設密碼（與管理員「復原密碼」一致） */
export const DEFAULT_ACCOUNT_PASSWORD = 'abcd1234';

export function getSiteUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_SITE_URL || 'https://mathedu2024.vercel.app';
}

/** API 路由依請求推斷站台網址（邀請／重設連結） */
export function getSiteUrlFromRequest(req: { headers: Headers }): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (env) return env;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  return 'https://mathedu2024.vercel.app';
}
