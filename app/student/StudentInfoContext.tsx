'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { getSession } from '../utils/session';

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
}

const StudentContext = createContext<StudentContextType>({
  studentInfo: null,
  loading: true,
});

export const useStudentInfo = () => useContext(StudentContext);

export const StudentInfoProvider = ({ children }: { children: React.ReactNode }) => {
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    // 安全機制：設定 3 秒超時，避免 loading 狀態卡死導致畫面全白
    const safetyTimer = setTimeout(() => {
      setLoading(prev => {
        if (prev) console.warn('StudentInfoContext: Initialization timed out, forcing loading to false');
        return false;
      });
    }, 3000);

    // 1. 優先檢查本地 Session (解決登入後跳轉回 Login 的問題)
    const session = getSession();
    if (session && (session.role === 'student' || session.role === '學生')) {
      // 優化: 立即設定基本資料，讓 UI 能先行渲染，不必等待 API 回應
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
      
      // 修正: 既然已經從 Session 取得基本資料，立即關閉載入狀態，讓畫面可以渲染
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
      unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(safetyTimer); // Auth 狀態變更，清除超時設定
      if (user) {
        try {
          // 優化: 立即設定基本資料
          setStudentInfo(prev => prev || {
            id: user.uid,
            name: user.displayName || '同學',
            studentId: '',
            account: '',
            grade: '',
            email: user.email || '',
            enrolledCourses: [],
            attendance: [],
            role: 'student',
          });

          // 修正：這裡也改用 API 請求，防止 Session 失效時觸發權限錯誤
          const res = await fetch('/api/student/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: user.uid }),
          });

          if (res.ok) {
            const userData = await res.json();
            const courses = userData.enrolledCourses || userData.courses || userData.enrolled_courses || [];
            const attendance = userData.attendance || [];

            setStudentInfo({
              id: user.uid,
              name: userData.name || user.displayName || '同學',
              studentId: userData.studentId || '',
              account: userData.account || userData.studentId || '',
              email: userData.email || user.email || '',
              grade: userData.grade || '',
              enrolledCourses: Array.isArray(courses) ? courses.map(String) : [],
              attendance: Array.isArray(attendance) ? attendance : [],
              role: 'student',
            });
          } else {
            console.warn('User document not found in Firestore, using basic Auth info');
            setStudentInfo({
              id: user.uid,
              name: user.displayName || '同學',
              studentId: '',
              account: '',
              grade: '',
              email: user.email || '',
              enrolledCourses: [],
              attendance: [],
              role: '學生',
            });
          }
        } catch (error) {
          console.error('Error fetching student info:', error);
          setStudentInfo({
            id: user.uid,
            name: user.displayName || '同學',
            studentId: '',
            account: '',
            grade: '',
            email: user.email || '',
            enrolledCourses: [],
            attendance: [],
            role: '學生',
          });
        }
      } else {
        setStudentInfo(null);
      }
        setLoading(false);
    });
    }

    return () => {
      clearTimeout(safetyTimer);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <StudentContext.Provider value={{ studentInfo, loading }}>
      {children}
    </StudentContext.Provider>
  );
};