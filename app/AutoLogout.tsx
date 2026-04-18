'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getSession } from '@/utils/session';
import Swal from 'sweetalert2';

const STUDENT_TIMEOUT = 3 * 60 * 60 * 1000; 
const TEACHER_TIMEOUT = 30 * 60 * 1000;     

export default function AutoLogout() {
  const router = useRouter();
  const pathname = usePathname();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const performLogout = useCallback(() => {
    localStorage.removeItem('user_session');
    sessionStorage.clear();
    
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

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

    if (pathname === '/login') return;

    const session = getSession();
    if (!session) return; 

    const role = (session as { role?: string | string[] }).role;
    let timeout = STUDENT_TIMEOUT; 

 
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
    resetTimer();

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    let lastResetTime = 0;
    const handleActivity = () => {
      const now = Date.now();
      if (now - lastResetTime > 1000) {
        resetTimer();
        lastResetTime = now;
      }
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [resetTimer]);

  return null; 
}