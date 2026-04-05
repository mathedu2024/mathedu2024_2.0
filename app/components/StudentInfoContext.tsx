'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
      // TODO: 替換為實際的 API 請求
      // const response = await fetch('/api/auth/me');
      // const data = await response.json();
      
      // 模擬 API 延遲與資料
      await new Promise(resolve => setTimeout(resolve, 600));
      
      setStudentInfo({
        id: 'mock-user-001',
        name: '陳小明',
        studentId: '112305',
        class: '三年二班', // This is a class name, not a grade
        grade: '高一', // Added a valid grade for qualification checks
        email: 'student@example.edu.tw',
        enrolledCourses: ['A班', '數學班'], // 範例資料，請根據實際情況調整
        account: 'student112305',
        role: 'student'
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