'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { clearSession } from '../utils/session';
import Sidebar from '../components/Sidebar';
import LoadingSpinner from '../components/LoadingSpinner';
import { StudentInfoProvider, useStudentInfo } from './StudentInfoContext';
import { BookOpenIcon, ClipboardDocumentListIcon, CheckCircleIcon, PencilIcon, CalendarIcon, KeyIcon } from '@heroicons/react/24/outline';

const studentFeatures = [
  { id: 'courses', title: '我的課程', icon: <BookOpenIcon /> },
  { id: 'grades', title: '成績查詢', icon: <ClipboardDocumentListIcon /> },
  { id: 'attendance', title: '線上點名', icon: <CheckCircleIcon /> },
  { id: 'counseling', title: '輔導預約', icon: <CalendarIcon /> },
  { id: 'change-password', title: '修改密碼', icon: <KeyIcon /> },
  { id: 'exam', title: '線上測驗', icon: <PencilIcon />, disabled: true },
];

function StudentLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { studentInfo, loading } = useStudentInfo();

  useEffect(() => {
    const pathSegments = pathname.split('/').filter(Boolean);
    const currentTabFromPath = pathSegments.length > 1 ? pathSegments[1] : null;
    const currentTabFromSearch = searchParams.get('tab');
    setActiveTab(currentTabFromPath || currentTabFromSearch);
  }, [pathname, searchParams]);

  const handleTabChange = (tab: string | null) => {
    setActiveTab(tab);
    if (tab === null) {
      router.push('/student');
    } else if (['courses', 'grades', 'counseling', 'attendance'].includes(tab)) {
      router.push(`/student/${tab}`);
    } else {
      router.push(`/student?tab=${tab}`);
    }
  };

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!studentInfo) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">無法載入學生資料，請重新登入。</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full font-sans">
      <div className="flex flex-1 min-h-0">
        <button
          className={`fixed top-20 left-4 z-50 bg-white p-2 rounded-full shadow-lg hover:bg-gray-50 transition-colors md:hidden ${sidebarOpen ? 'hidden' : 'block'}`}
          onClick={() => setSidebarOpen(true)}
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-40 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <Sidebar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          userInfo={studentInfo}
          menuItems={studentFeatures}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          isMobile={isMobile}
        />

        <main
          className="flex-1 min-w-0 transition-all duration-300 overflow-y-auto"
          style={{
            paddingTop: '1rem',
            paddingLeft: isMobile ? 0 : (sidebarOpen ? '4rem' : '16rem'),
            transition: 'padding-left 0.3s'
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudentInfoProvider>
      <Suspense fallback={<LoadingSpinner fullScreen />}>
        <StudentLayoutContent>{children}</StudentLayoutContent>
      </Suspense>
    </StudentInfoProvider>
  );
}