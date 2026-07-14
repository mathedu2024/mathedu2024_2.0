import { clearSidebarCache } from './sidebarCache';

const SESSION_KEY = 'user_session';

export interface SessionData {
  id: string;
  name: string;
  account: string;
  role: string | string[];
  currentRole?: string;
  uid?: string;
}

/** 僅寫入 API／proxy 需要的欄位，避免把 Firebase token 等過大欄位塞進 cookie */
function toSessionCookiePayload(sessionData: SessionData): SessionData {
  return {
    id: sessionData.id,
    name: sessionData.name,
    account: sessionData.account,
    role: sessionData.role,
    ...(sessionData.currentRole ? { currentRole: sessionData.currentRole } : {}),
    ...(sessionData.uid ? { uid: sessionData.uid } : {}),
  };
}

/** 瀏覽器工作階段 cookie（不設 max-age，關閉瀏覽器後即失效） */
function writeSessionCookie(sessionData: SessionData) {
  const cookieValue = JSON.stringify(toSessionCookiePayload(sessionData));
  document.cookie = `session=${encodeURIComponent(cookieValue)}; path=/; SameSite=Strict`;
}

/** 清除舊版寫入 localStorage 的登入殘餘 */
function purgeLegacyLocalSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
}

function readSessionFromDocumentCookie(): SessionData | null {
  if (typeof document === 'undefined') return null;
  return getSessionFromCookie(document.cookie);
}

export const setSession = (sessionData: SessionData) => {
  if (typeof window !== 'undefined') {
    clearSidebarCache();
    purgeLegacyLocalSession();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    writeSessionCookie(sessionData);
  }
};

/** 重新寫入既有 session cookie（維持工作階段），不清除 sidebar 快取 */
export const refreshSessionCookie = (sessionData: SessionData) => {
  if (typeof window === 'undefined') return;
  purgeLegacyLocalSession();
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  writeSessionCookie(sessionData);
};

export const getSession = (): SessionData | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    purgeLegacyLocalSession();

    // Cookie 為跨分頁唯一真相來源；關閉瀏覽器後會失效
    const fromCookie = readSessionFromDocumentCookie();
    if (!fromCookie) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }

    // 將舊版 max-age=24h cookie 轉成工作階段 cookie，避免關閉瀏覽器後仍殘留
    writeSessionCookie(fromCookie);

    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as SessionData;
        if (parsed?.id === fromCookie.id) return parsed;
      } catch {
        sessionStorage.removeItem(SESSION_KEY);
      }
    }

    // 新分頁：從 cookie 還原 tab 內快取
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(fromCookie));
    return fromCookie;
  } catch {
    clearSession();
    return null;
  }
};

export const clearSession = () => {
  if (typeof window === 'undefined') return;

  clearSidebarCache();
  purgeLegacyLocalSession();
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // ignore
  }
  sessionStorage.clear();

  const expire = 'Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = `session=; path=/; expires=${expire}; SameSite=Strict`;
  document.cookie = `session=; path=/; expires=${expire}; SameSite=Lax`;

  window.dispatchEvent(new Event('auth-logout'));
};

export const isAuthenticated = (): boolean => {
  return getSession() !== null;
};

export const hasRole = (role: 'admin' | 'teacher' | 'student'): boolean => {
  const session = getSession();
  return session?.role === role;
};

export const isSessionValid = (): boolean => {
  const session = getSession();
  return session !== null;
};

export const getSessionFromCookie = (cookieString: string): SessionData | null => {
  try {
    const sessionValues: string[] = [];
    for (const cookie of cookieString.split(';')) {
      const trimmed = cookie.trim();
      if (!trimmed.startsWith('session=')) continue;
      sessionValues.push(trimmed.slice('session='.length));
    }
    if (sessionValues.length === 0) return null;

    const tryParse = (raw: string): SessionData | null => {
      const attempts = [raw, (() => { try { return decodeURIComponent(raw); } catch { return null; } })()];
      try {
        attempts.push(decodeURIComponent(decodeURIComponent(raw)));
      } catch {
        /* ignore */
      }
      for (const candidate of attempts) {
        if (!candidate) continue;
        try {
          const parsed = JSON.parse(candidate) as SessionData;
          if (parsed?.id) return parsed;
        } catch {
          /* try next */
        }
      }
      return null;
    };

    // 同名 cookie 可能同時存在（httpOnly + 前端寫入）；由後往前找第一個可解析且有效的
    for (let i = sessionValues.length - 1; i >= 0; i--) {
      const parsed = tryParse(sessionValues[i]);
      if (parsed) return parsed;
    }

    console.error('Failed to parse session cookie after decode attempts');
    return null;
  } catch (error) {
    console.error('Error parsing session cookie:', error);
    return null;
  }
};
