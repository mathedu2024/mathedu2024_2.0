'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getSession } from '@/utils/session';
import Swal from 'sweetalert2';

// 定義時間常數
const STUDENT_TIMEOUT = 3 * 60 * 60 * 1000; // 3小時
const TEACHER_TIMEOUT = 30 * 60 * 1000;     // 30分鐘

export default function AutoLogout() {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const performLogout = useCallback(() => {
    // 清除所有可能的儲存
    localStorage.removeItem('user_session');
    sessionStorage.clear();
    
    // 清除 cookie
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    // 顯示提示並導向
    Swal.fire({
      title: '閒置過久',
      text: '由於您長時間未操作，系統已自動登出。',
      icon: 'info',
      confirmButtonText: '重新登入',
      confirmButtonColor: '#4f46e5',
      allowOutsideClick: false,
      allowEscapeKey: false
    }).then(() => {
      router.push('/login');
    });
  }, [router]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // 如果在登入頁面，不執行自動登出邏輯
    if (pathname === '/login') return;

    const session = getSession();
    if (!session) return; // 未登入不需計時

    // 判斷角色
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = (session as any).role;
    let timeout = STUDENT_TIMEOUT; // 預設為學生時間

    // 檢查是否為老師或管理員
    const isTeacherOrAdmin = 
      role === 'teacher' || 
      role === 'admin' || 
      role === '老師' || 
      role === '管理員' ||
      (Array.isArray(role) && (role.includes('teacher') || role.includes('admin')));

    if (isTeacherOrAdmin) {
      timeout = TEACHER_TIMEOUT;
    }

    timerRef.current = setTimeout(() => {
      performLogout();
    }, timeout);
  }, [performLogout, pathname]);

  useEffect(() => {
    // 初始設定計時器
    resetTimer();

    // 定義活動事件
    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // 節流處理：避免過度頻繁重置
    let lastResetTime = 0;
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastResetTime > 1000) { // 每秒最多重置一次
        resetTimer();
        lastResetTime = now;
      }
    };

    // 綁定事件
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // 清理函數
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [resetTimer]);

  return null; // 此元件不渲染任何 UI
}