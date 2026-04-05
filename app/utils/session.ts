const SESSION_KEY = 'user_session';

export interface SessionData {
  id: string;
  name: string;
  account: string;
  role: string | string[];
  currentRole?: string;
  uid?: string;
}

export const setSession = (sessionData: SessionData) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    
    const cookieValue = JSON.stringify(sessionData);
    document.cookie = `session=${encodeURIComponent(cookieValue)}; path=/; max-age=86400; SameSite=Strict`;
  }
};

export const getSession = (): SessionData | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  
  try {
    const sessionData = localStorage.getItem(SESSION_KEY);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch {
    clearSession();
    return null;
  }
};

export const clearSession = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
    document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
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
    console.log('getSessionFromCookie: cookieString', cookieString);
    const cookies = cookieString.split(';').reduce((acc, cookie) => {
      const parts = cookie.trim().split('=');
      const key = parts[0];
      const value = parts.slice(1).join('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);
    
    const sessionCookie = cookies['session'];
    console.log('getSessionFromCookie: sessionCookie raw', sessionCookie);
    if (sessionCookie) {
      // Some environments may already provide a decoded cookie. Try parse directly first.
      try {
        return JSON.parse(sessionCookie);
      } catch {}

      // Fallback: decode once then parse
      try {
        const once = decodeURIComponent(sessionCookie);
        return JSON.parse(once);
      } catch {}

      // Final fallback: decode twice (legacy behavior)
      try {
        const twice = decodeURIComponent(decodeURIComponent(sessionCookie));
        return JSON.parse(twice);
      } catch (e) {
        console.error('Failed to parse session cookie after decode attempts:', e);
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error('Error parsing session cookie:', error);
    return null;
  }
}; 