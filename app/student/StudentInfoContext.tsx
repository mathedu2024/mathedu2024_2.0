'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSession, clearSession } from '../utils/session';

interface StudentInfo {
  id: string;
  name: string;
  account: string;
  role: string;
  studentId: string;
  enrolledCourses?: string[];
  grade?: string;
}

interface StudentInfoContextType {
  studentInfo: StudentInfo | null;
  loading: boolean;
}

const StudentInfoContext = createContext<StudentInfoContextType | undefined>(undefined);

export function StudentInfoProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const session = getSession();
    if (session && session.id) {
      const fetchStudentInfo = async () => {
        try {
          const res = await fetch('/api/student/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: session.id }),
          });
          if (res.ok) {
            const info = await res.json();
            setStudentInfo(info);
          } else {
            console.error('Failed to fetch student profile, clearing session.');
            clearSession();
            router.push('/login');
          }
        } catch (error) {
          console.error("Error fetching student info:", error);
          clearSession();
          router.push('/login');
        } finally {
          setLoading(false);
        }
      };
      fetchStudentInfo();
    } else {
      console.log('No session found, redirecting to login.');
      setLoading(false);
      router.push('/login');
    }
  }, [router]);

  return (
    <StudentInfoContext.Provider value={{ studentInfo, loading }}>
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