'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getSession } from '@/utils/session';

// 定義學生資訊介面
export interface StudentInfo {
  id: string;
  name: string;
  studentId: string;
  email?: string;
  class?: string;
  grade?: string;
  account: string;
  enrolledCourses?: string[]; // 新增：學生選修的課程列表
  role: string;
}

interface StudentInfoContextType {
  studentInfo: StudentInfo | null;
  loading: boolean;
  refreshStudentInfo: () => Promise<void>;
}

const StudentInfoContext = createContext<StudentInfoContextType | undefined>(undefined);

export function StudentInfoProvider({ children }: { children: ReactNode }) {
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStudentInfo = async () => {
    setLoading(true);
    try {
      // 從系統 Session 獲取真實登入的使用者資料
      interface SessionUser {
        id?: string; uid?: string; userId?: string;
        name?: string; studentId?: string; account?: string;
        class?: string; grade?: string; email?: string;
        enrolledCourses?: string[]; currentRole?: string; role?: string;
      }
      const session = getSession() as ({ user?: SessionUser } & SessionUser) | null;
      
      if (!session) {
        setStudentInfo(null);
        return;
      }

      const user = session.user || session;

      setStudentInfo({
        id: user.id || user.uid || user.userId || '',
        name: user.name || '未知使用者',
        studentId: user.studentId || user.account || '',
        class: user.class || '', 
        grade: user.grade || '', 
        email: user.email || '',
        enrolledCourses: user.enrolledCourses || [], 
        account: user.account || '',
        role: user.currentRole || user.role || 'student'
      });
    } catch (error) {
      console.error('Failed to fetch student info:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshStudentInfo();
  }, []);

  return (
    <StudentInfoContext.Provider value={{ studentInfo, loading, refreshStudentInfo }}>
      {children}
    </StudentInfoContext.Provider>
  );
}

export function useStudentInfo() {
  const context = useContext(StudentInfoContext);
  if (context === undefined) {
    throw new Error('useStudentInfo must be used within a StudentInfoProvider');
  }
  return context;
}