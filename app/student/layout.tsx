'use client';

import React, { useState, useEffect, Suspense, useTransition } from 'react';
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
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const pathSegments = pathname.split('/').filter(Boolean);
    const currentTabFromPath = pathSegments.length > 1 ? pathSegments[1] : null;
    const currentTabFromSearch = searchParams.get('tab');
    setActiveTab(currentTabFromPath || currentTabFromSearch);
  }, [pathname, searchParams]);

  const handleTabChange = (tab: string | null) => {
    setActiveTab(tab);
    startTransition(() => {
      if (tab === null) {
        router.push('/student');
      } else if (['courses', 'grades', 'counseling', 'attendance'].includes(tab)) {
        router.push(`/student/${tab}`);
      } else {
        router.push(`/student?tab=${tab}`);
      }
    });
  };

  const handleLogout = () => {
    clearSession();
    router.push('/login');
  };

  if (loading) {
    return <LoadingSpinner fullScreen size={40} />;
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
      <div className="flex flex-1 min-h-0 overflow-y-auto">
        <Sidebar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          userInfo={studentInfo}
          menuItems={studentFeatures}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
        />

        <main
          className="flex-1 min-w-0 transition-all duration-300 relative bg-gray-100"
          style={{
            paddingLeft: sidebarOpen ? '4rem' : '16rem',
            transition: 'padding-left 0.3s'
          }}
        >
          {isPending && (
            <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center z-50">
              <LoadingSpinner size={40} />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudentInfoProvider>
      <Suspense fallback={<LoadingSpinner fullScreen size={40} />}>
        <StudentLayoutContent>{children}</StudentLayoutContent>
      </Suspense>
    </StudentInfoProvider>
  );
}