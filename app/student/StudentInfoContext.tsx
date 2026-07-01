'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { getSession } from '../utils/session';
import {
  buildStudentInfoFromSession,
  isStudentSession,
} from '@/utils/studentSession';

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
  const [mounted, setMounted] = useState(false);
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const clearStudentInfo = () => {
    setStudentInfo(null);
    setLoading(false);
  };

  useEffect(() => {
    const onAuthLogout = () => clearStudentInfo();
    window.addEventListener('auth-logout', onAuthLogout);
    return () => window.removeEventListener('auth-logout', onAuthLogout);
  }, []);

  useEffect(() => {
    setMounted(true);

    // 安全機制：設定 3 秒超時，避免 loading 狀態卡死導致畫面全白
    const safetyTimer = setTimeout(() => {
      setLoading(prev => {
        if (prev) console.warn('StudentInfoContext: Initialization timed out, forcing loading to false');
        return false;
      });
    }, 3000);

    const session = getSession();
    if (session && isStudentSession(session)) {
      setStudentInfo(buildStudentInfoFromSession(session));
      setLoading(false);

      const fetchStudentData = async () => {
        try {
          // 改用 API 請求，避免 Client 端權限不足 (Missing or insufficient permissions)
          const res = await fetch('/api/student/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: session.id }),
          });

          clearTimeout(safetyTimer); // API 成功回應，清除超時設定
          if (res.ok) {
            const userData = await res.json();
            console.log('Student data fetched:', userData); // Debug: 檢查 API 回傳的資料結構
            // 相容性處理：嘗試讀取 enrolledCourses 或 courses，並確保它是陣列
            const courses = userData.enrolledCourses || userData.courses || userData.enrolled_courses || [];
            const attendance = userData.attendance || [];

            setStudentInfo({
              id: session.id,
              name: userData.name || session.name,
              studentId: userData.studentId || session.account,
              account: session.account,
              email: userData.email || '',
              grade: userData.grade || '',
              enrolledCourses: Array.isArray(courses) ? courses.map(String) : [],
              attendance: Array.isArray(attendance) ? attendance : [],
              role: 'student',
            });
          } else {
            // 若找不到資料，回退顯示基本 Session 資訊
            console.warn('Failed to fetch student profile via API, using session data.');
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
          }
        } catch (error) {
          console.error('Error fetching student data:', error);
          // 發生錯誤時（如權限問題），仍顯示基本資訊以免被登出
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
          // 確保 API 請求結束後 loading 保持為 false
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

  // Keep loading true until after mount so SSR HTML matches the first client render.
  const contextLoading = !mounted || loading;

  return (
    <StudentContext.Provider value={{ studentInfo, loading: contextLoading, clearStudentInfo }}>
      {children}
    </StudentContext.Provider>
  );
};