'use client';

import { useEffect, useCallback, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getSession } from '@/utils/session';
import { logoutClient } from '@/utils/logoutClient';
import Swal from '@/utils/swalTheme';
import {
  clearInteractKeepalive,
  isTeacherPreviewOrInteractPath,
  pulseInteractKeepalive,
  shouldSkipIdleLogout,
  TEACHER_SESSION_KEEPALIVE_STORAGE_KEY,
} from '@/utils/interactKeepalive';
import {
  hasRecentSessionActivity,
  pulseSessionActivity,
  SESSION_ACTIVITY_STORAGE_KEY,
} from '@/utils/sessionActivity';

const STUDENT_TIMEOUT = 3 * 60 * 60 * 1000;
const TEACHER_TIMEOUT = 30 * 60 * 1000;
/** 預覽／互動開啟時：定期心跳並再檢查，避免閒置登出（含原視窗） */
const KEEPALIVE_RECHECK_MS = 20_000;

function isTeacherOrAdminRole(role: string | string[] | undefined): boolean {
  return (
    role === 'teacher' ||
    role === 'admin' ||
    role === '老師' ||
    role === '管理員' ||
    (Array.isArray(role) && (role.includes('teacher') || role.includes('admin')))
  );
}

export default function AutoLogout() {
  const pathname = usePathname();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const performLogout = useCallback(async () => {
    if (shouldSkipIdleLogout(pathname)) {
      return;
    }

    const session = getSession();
    const redirectTo = isTeacherOrAdminRole(session?.role) ? '/panel' : '/login';

    await logoutClient();

    Swal.fire({
      title: '閒置過久',
      text: '由於您長時間未操作，系統已自動登出。',
      icon: 'info',
      confirmButtonText: '重新登入',
      confirmButtonColor: '#4f46e5',
      allowOutsideClick: false,
      allowEscapeKey: false,
    }).then(() => {
      window.location.assign(redirectTo);
    });
  }, [pathname]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (pathname === '/login') return;

    const session = getSession();
    if (!session) return;

    pulseSessionActivity();

    // 本分頁在預覽／互動，或其他分頁正開著預覽／互動：持續保活、不登出
    if (shouldSkipIdleLogout(pathname)) {
      if (isTeacherPreviewOrInteractPath(pathname)) {
        pulseInteractKeepalive();
      }
      timerRef.current = setTimeout(() => {
        resetTimer();
      }, KEEPALIVE_RECHECK_MS);
      return;
    }

    const timeout = isTeacherOrAdminRole(session.role) ? TEACHER_TIMEOUT : STUDENT_TIMEOUT;

    timerRef.current = setTimeout(() => {
      // 到期時再確認：若其他分頁剛有操作，延長本分頁計時
      if (hasRecentSessionActivity(timeout) || shouldSkipIdleLogout(pathname)) {
        resetTimer();
        return;
      }
      void performLogout();
    }, timeout);
  }, [performLogout, pathname]);

  useEffect(() => {
    resetTimer();

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click', 'input'];

    let lastResetTime = 0;
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastResetTime > 1000) {
        resetTimer();
        lastResetTime = now;
      }
    };

    const onStorage = (e: StorageEvent) => {
      if (
        e.key === TEACHER_SESSION_KEEPALIVE_STORAGE_KEY ||
        e.key === SESSION_ACTIVITY_STORAGE_KEY
      ) {
        resetTimer();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        if (isTeacherPreviewOrInteractPath(pathname)) {
          pulseInteractKeepalive();
        }
        resetTimer();
      }
    };

    const onUnload = () => {
      if (isTeacherPreviewOrInteractPath(pathname)) {
        clearInteractKeepalive();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
      if (isTeacherPreviewOrInteractPath(pathname)) {
        clearInteractKeepalive();
      }
    };
  }, [resetTimer, pathname]);

  return null;
}
