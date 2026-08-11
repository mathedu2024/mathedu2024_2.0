'use client';

import React, { useState, useEffect, useTransition, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { logoutClient } from '../utils/logoutClient';
import Sidebar from '../components/Sidebar';
import PageLoadingArea from '../components/ui/PageLoadingArea';
import StudentEmailVerifyBanner from '../components/StudentEmailVerifyBanner';
import { useStudentInfo, StudentInfoProvider } from './StudentInfoContext';
import { BookOpenIcon, ChatBubbleLeftRightIcon, UserCircleIcon, CloudArrowDownIcon } from '@heroicons/react/24/outline';
import { useCompactNav } from '../utils/useCompactNav';
import { useExamFocusMode } from '@/utils/useExamFocusMode';
import { buildStudentLoginUrl, rememberStudentLoginNext } from '@/utils/studentLoginRedirect';

const studentFeatures = [
  { id: 'courses', title: '我的課程', icon: <BookOpenIcon className="h-6 w-6" /> },
  { id: 'resources', title: '線上資源', icon: <CloudArrowDownIcon className="h-6 w-6" /> },
  { id: 'counseling', title: '輔導預約', icon: <ChatBubbleLeftRightIcon className="h-6 w-6" /> },
  { id: 'information', title: '個人資料', icon: <UserCircleIcon className="h-6 w-6" /> },
];

function StudentLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { studentInfo, loading, clearStudentInfo } = useStudentInfo();
  const [, startTransition] = useTransition();
  const isCompactNav = useCompactNav();
  const examFocusMode = useExamFocusMode();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // /student/courses/[courseCode]、課堂詳情、觀課、測驗／問卷開始頁：進入內容時收合側選單
  const isCourseContentView =
    (pathname.startsWith('/student/courses/') && pathname !== '/student/courses/') ||
    pathname.startsWith('/student/lesson-detail') ||
    pathname.startsWith('/student/watch') ||
    /^\/student\/exam\/[^/]+\/start\/?$/.test(pathname) ||
    /^\/student\/survey\/[^/]+\/start\/?$/.test(pathname);

  useEffect(() => {
    // 桌面：列表展開；進入課程內容後收合。窄螢幕維持收合。
    setSidebarOpen(!isCompactNav && !isCourseContentView);
  }, [isCompactNav, isCourseContentView]);

  useEffect(() => {
    const pathSegments = pathname.split('/').filter(Boolean);
    const currentTabFromPath = pathSegments.length > 1 ? pathSegments[1] : null;
    const currentTabFromSearch = searchParams.get('tab');
    setActiveTab(currentTabFromPath || currentTabFromSearch);
  }, [pathname, searchParams]);

  // 未登入且載入完成：導向登入，並保留目前路徑（含 QR 簽到 token）
  useEffect(() => {
    if (!loading && !studentInfo && !isLoggingOut) {
      const search = searchParams.toString();
      const nextPath = `${pathname}${search ? `?${search}` : ''}`;
      rememberStudentLoginNext(nextPath);
      router.push(buildStudentLoginUrl(nextPath));
    }
  }, [loading, studentInfo, router, isLoggingOut, pathname, searchParams]);

  const handleTabChange = (tab: string | null) => {
    setActiveTab(tab);
    startTransition(() => {
      if (tab === null) {
        router.push('/student');
      } else if (['courses', 'resources', 'counseling', 'attendance', 'information', 'exam'].includes(tab)) {
        router.push(`/student/${tab}`);
      } else {
        router.push(`/student?tab=${tab}`);
      }
    });
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    clearStudentInfo();
    await logoutClient('/login');
  };

  // 未登入且已確認無 session：導向登入（不渲染版面，避免與已登入狀態混淆）
  if (!loading && !studentInfo && !isLoggingOut) {
    return null;
  }

  return (
    <div className="flex flex-col h-full min-w-0 overflow-x-hidden">
      <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto overflow-x-hidden">
        {!examFocusMode && (
          <Sidebar
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
            userInfo={studentInfo}
            menuItems={studentFeatures}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onLogout={handleLogout}
            boldNavLabels
          />
        )}

        <main
          className={`flex-1 min-w-0 transition-[padding] duration-300 relative bg-surface pl-0 ${
            examFocusMode ? '' : isCompactNav ? '' : sidebarOpen ? 'md:pl-64' : 'md:pl-20'
          }`}
        >
          {!examFocusMode ? <StudentEmailVerifyBanner /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <StudentInfoProvider>
      <Suspense fallback={<PageLoadingArea minHeight="min-h-[50vh]" />}>
        <StudentLayoutContent>{children}</StudentLayoutContent>
      </Suspense>
    </StudentInfoProvider>
  );
}