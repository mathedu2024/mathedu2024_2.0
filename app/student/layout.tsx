'use client';

import React, { useState, useEffect, useTransition, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { clearSession } from '../utils/session';
import Sidebar from '../components/Sidebar';
import LoadingSpinner from '../components/LoadingSpinner';
import { useStudentInfo, StudentInfoProvider } from './StudentInfoContext';
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
  const [sidebarOpen, setSidebarOpen] = useState(false); // Default to closed on server for safety
  const { studentInfo, loading } = useStudentInfo();
  const [isPending, startTransition] = useTransition();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
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

  // 修正: 放寬載入條件，只要有資料就先顯示，避免背景更新時畫面卡在 Loading
  if (!isMounted || (loading && !studentInfo)) {
    return <LoadingSpinner fullScreen size={40} />;
  }

  if (!studentInfo) {
    return null; // 正在導向登入頁面，不顯示錯誤訊息
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

        {/* 手機不預留側欄寬度（與 back-panel 相同），避免側欄隱藏時左側空白、內容右偏 */}
        <main
          className={`flex-1 min-w-0 transition-[padding] duration-300 relative bg-gray-50 pl-0 ${
            sidebarOpen ? 'md:pl-64' : 'md:pl-20'
          }`}
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