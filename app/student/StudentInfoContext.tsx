'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { getSession, refreshSessionCookie } from '../utils/session';
import {
  buildStudentInfoFromSession,
  isStudentSession,
} from '@/utils/studentSession';
import { fetchStudentProfile, prefetchStudentDashboard, StudentApiError } from '@/utils/studentClientApi';
import { useHydrated } from '@/utils/useHydrated';

export interface StudentInfo {
  id: string;
  name: string;
  studentId: string;
  account: string;
  email?: string;
  grade?: string;
  enrolledCourses?: string[];
  attendance?: unknown[];
  role: string;
}

interface StudentContextType {
  studentInfo: StudentInfo | null;
  loading: boolean;
  clearStudentInfo: () => void;
}

const StudentContext = createContext<StudentContextType>({
  studentInfo: null,
  loading: true,
  clearStudentInfo: () => {},
});

export const useStudentInfo = () => useContext(StudentContext);

export const StudentInfoProvider = ({ children }: { children: React.ReactNode }) => {
  const hydrated = useHydrated();
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const clearStudentInfo = () => {
    setStudentInfo(null);
    setLoading(false);
  };

  const syncSessionFromStorage = useCallback(() => {
    const session = getSession();
    if (!session || !isStudentSession(session)) {
      clearStudentInfo();
      return;
    }

    setStudentInfo((prev) => {
      if (!prev || prev.id !== session.id) {
        return buildStudentInfoFromSession(session);
      }
      return prev;
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    const onAuthLogout = () => clearStudentInfo();
    window.addEventListener('auth-logout', onAuthLogout);
    return () => window.removeEventListener('auth-logout', onAuthLogout);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'user_session' || event.key === null) {
        syncSessionFromStorage();
      }
    };
    const onFocus = () => syncSessionFromStorage();
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncSessionFromStorage();
      }
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        syncSessionFromStorage();
      }
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [syncSessionFromStorage]);

  useEffect(() => {
    // 安全機制：設定 3 秒超時，避免 loading 狀態卡死導致畫面全白
    const safetyTimer = setTimeout(() => {
      setLoading(prev => {
        if (prev) console.warn('StudentInfoContext: Initialization timed out, forcing loading to false');
        return false;
      });
    }, 3000);

    const session = getSession();
    if (session && isStudentSession(session)) {
      // 重新寫入工作階段 cookie，並同步 tab 內 sessionStorage
      refreshSessionCookie(session);
      setStudentInfo(buildStudentInfoFromSession(session));
      setLoading(false);
      prefetchStudentDashboard(session.id);

      const fetchStudentData = async () => {
        try {
          const userData = await fetchStudentProfile(session.id);
          clearTimeout(safetyTimer);
          const courses = userData.enrolledCourses || userData.courses || userData.enrolled_courses || [];
          const attendance = userData.attendance || [];

          setStudentInfo({
            id: session.id,
            name: String(userData.name || session.name),
            studentId: String(userData.studentId || session.account),
            account: session.account,
            email: String(userData.email || ''),
            grade: String(userData.grade || ''),
            enrolledCourses: Array.isArray(courses) ? courses.map(String) : [],
            attendance: Array.isArray(attendance) ? attendance : [],
            role: 'student',
          });
        } catch (error) {
          if (error instanceof StudentApiError) {
            // 401/403：session 已由 notifyStudentSessionInvalid 清除，勿還原假資料
            clearTimeout(safetyTimer);
            setStudentInfo(null);
            setLoading(false);
            return;
          }
          console.warn('Error fetching student data:', error);
          // 非認證錯誤時仍顯示 session 基本資訊，避免被誤登出
          setStudentInfo({
            id: session.id,
            name: session.name,
            studentId: session.account,
            account: session.account,
            grade: '',
            email: '',
            enrolledCourses: [],
            attendance: [],
            role: 'student',
          });
        } finally {
          setLoading(false);
        }
      };
      fetchStudentData();
    } else {
      clearTimeout(safetyTimer);
      const signOutStaleFirebase = async () => {
        if (auth.currentUser) {
          try {
            await signOut(auth);
          } catch (error) {
            console.warn('Cleared stale Firebase session:', error);
          }
        }
        setStudentInfo(null);
        setLoading(false);
      };
      signOutStaleFirebase();
    }

    return () => {
      clearTimeout(safetyTimer);
    };
  }, []);

  // hydration 完成前維持 loading，避免 SSR 與 client 首屏不一致
  const contextLoading = !hydrated || loading;
  const contextStudentInfo = hydrated ? studentInfo : null;

  return (
    <StudentContext.Provider
      value={{ studentInfo: contextStudentInfo, loading: contextLoading, clearStudentInfo }}
    >
      {children}
    </StudentContext.Provider>
  );
};