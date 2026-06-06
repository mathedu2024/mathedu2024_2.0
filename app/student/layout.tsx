'use client';

import React, { useState, useEffect, useTransition, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { logoutClient } from '../utils/logoutClient';
import Sidebar from '../components/Sidebar';
import { useStudentInfo, StudentInfoProvider } from './StudentInfoContext';
import { BookOpenIcon, ClipboardDocumentListIcon, CheckCircleIcon, PencilIcon, CalendarIcon, KeyIcon, CloudArrowDownIcon } from '@heroicons/react/24/outline';

const studentFeatures = [
  { id: 'courses', title: '我的課程', icon: <BookOpenIcon /> },
  { id: 'resources', title: '線上資源', icon: <CloudArrowDownIcon /> },
  { id: 'grades', title: '成績查詢', icon: <ClipboardDocumentListIcon /> },
  { id: 'attendance', title: '線上點名', icon: <CheckCircleIcon /> },
  { id: 'counseling', title: '輔導預約', icon: <CalendarIcon /> },
  { id: 'exam', title: '線上測驗', icon: <PencilIcon />, disabled: true },
  { id: 'change-password', title: '修改密碼', icon: <KeyIcon /> },
];

function StudentLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { studentInfo, loading, clearStudentInfo } = useStudentInfo();
  const [, startTransition] = useTransition();

  useEffect(() => {
    setSidebarOpen(window.innerWidth >= 768);
  }, []);

  useEffect(() => {
    const pathSegments = pathname.split('/').filter(Boolean);
    const currentTabFromPath = pathSegments.length > 1 ? pathSegments[1] : null;
    const currentTabFromSearch = searchParams.get('tab');
    setActiveTab(currentTabFromPath || currentTabFromSearch);
  }, [pathname, searchParams]);

  // 新增：如果未登入且載入完成，自動導向登入頁面
  useEffect(() => {
    // 加入延遲檢查，避免在狀態切換瞬間誤判
    if (!loading && !studentInfo) {
      router.push('/login');
    }
  }, [loading, studentInfo, router]);

  const handleTabChange = (tab: string | null) => {
    setActiveTab(tab);
    startTransition(() => {
      if (tab === null) {
        router.push('/student');
      } else if (['courses', 'resources', 'grades', 'counseling', 'attendance', 'information'].includes(tab)) {
        router.push(`/student/${tab}`);
      } else {
        router.push(`/student?tab=${tab}`);
      }
    });
  };

  const handleLogout = async () => {
    clearStudentInfo();
    await logoutClient('/login');
  };

  // 未登入且已確認無 session：導向登入（不渲染版面，避免與已登入狀態混淆）
  if (!loading && !studentInfo) {
    return null;
  }

  return (
    <div className="flex flex-col h-full min-w-0 font-sans overflow-x-hidden">
      <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
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
          className={`flex-1 min-w-0 transition-[padding] duration-300 relative bg-gray-50 pl-0 ${
            sidebarOpen ? 'md:pl-64' : 'md:pl-20'
          }`}
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
      <Suspense fallback={null}>
        <StudentLayoutContent>{children}</StudentLayoutContent>
      </Suspense>
    </StudentInfoProvider>
  );
}