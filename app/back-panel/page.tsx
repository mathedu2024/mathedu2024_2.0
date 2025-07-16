'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AnnouncementManager from '../components/AnnouncementManager';
import ExamDateManager from '../components/ExamDateManager';
import StudentManager from '../components/StudentManager';
import CourseManager from '../components/CourseManager';
import TeacherAdminManager from '../components/TeacherAdminManager';
import PasswordManager from '../components/PasswordManager';
import TeacherCourseManager from '../components/TeacherCourseManager';
import GradeManager from '../components/GradeManager';
import { getSession, clearSession } from '../utils/session';
import type { Course } from '../components/TeacherCourseManager';

type AdminTab = 'announcements' | 'exam-dates' | 'students' | 'courses' | 'admin-teachers';
type TeacherTab = 'teacher-courses' | 'teacher-grades' | 'teacher-exams' | 'tutoring';
type CommonTab = 'password';
type Tab = AdminTab | TeacherTab | CommonTab | null;
type UserRole = '管理員' | '老師' | '學生';

interface BackPanelUserInfo {
  id: string;
  name: string;
  account: string;
  role: string | string[];
  currentRole?: string;
}

function BackPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 1. 狀態 hooks 命名與學生端一致
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 768 : false);
  const [activeTab, setActiveTab] = useState<Tab>(null);
  const [userInfo, setUserInfo] = useState<BackPanelUserInfo | null>(null);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [isChildProcessing, setIsChildProcessing] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [adminStats, setAdminStats] = useState({ studentCount: 0, teacherCount: 0, courseCount: 0 });
  const [loading, setLoading] = useState(true);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const handleActivity = useCallback(() => setLastActivity(Date.now()), []);

  const handleProcessingStateChange = useCallback((isProcessing: boolean) => {
    setIsChildProcessing(isProcessing);
    if (!isProcessing) setLastActivity(Date.now());
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    router.push('/panel');
  }, [router]);

  useEffect(() => {
    const checkActivity = () => {
      if (isChildProcessing) return;
      if (Date.now() - lastActivity > 3 * 60 * 1000) {
        clearSession();
        router.push('/panel');
      }
    };
    const interval = setInterval(checkActivity, 30000);
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, handleActivity));

    return () => {
      clearInterval(interval);
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [isChildProcessing, lastActivity, router, handleActivity]);

  useEffect(() => {
    console.time('back-panel-load');
    setLoading(true);
    const session = getSession();
    console.log('Back Panel - Session:', session);
    if (!session) {
      console.log('Back Panel - No session, redirecting to /panel');
      router.push('/panel');
      setLoading(false);
      console.timeEnd('back-panel-load');
      return;
    }
    const getRole = (role: string | string[], currentRole?: string): UserRole => {
      if (currentRole) {
        if (currentRole === 'admin') return '管理員';
        if (currentRole === 'teacher') return '老師';
      }
      if (Array.isArray(role)) {
        if (role.map(r => r.toLowerCase()).includes('admin')) return '管理員';
        if (role.map(r => r.toLowerCase()).includes('teacher')) return '老師';
        return '學生';
      }
      if (role?.toLowerCase() === 'admin') return '管理員';
      if (role?.toLowerCase() === 'teacher') return '老師';
      return '學生';
    };
    const userRole = getRole(session.role, session.currentRole);
    console.log('Back Panel - User Role:', userRole);

    if (userRole === '學生') {
      console.log('Back Panel - Student role, logging out');
      handleLogout();
      setLoading(false);
      console.timeEnd('back-panel-load');
      return;
    }

    const fetchTeacher = async () => {
      console.log('Back Panel - Fetching teacher data for account:', session.account);
      const res = await fetch('/api/teacher/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: session.account }),
      });
      if (res.ok) {
        const data = await res.json();
        const userInfoData = {
          id: data.id,
          name: data.name || '',
          account: session.account,
          role: '老師',
        };
        setUserInfo(userInfoData);
      }
      setLoading(false);
      console.timeEnd('back-panel-load');
    };

    if (userRole === '老師') {
      fetchTeacher();
    } else {
      const adminUserInfo = { ...session, name: session.name, account: session.account, id: session.id, role: session.role };
      console.log('Back Panel - Setting admin userInfo:', adminUserInfo);
      setUserInfo(adminUserInfo);
      setLoading(false);
      console.timeEnd('back-panel-load');
    }
  }, [router, handleLogout]);

  // 初始化 activeTab 根據網址 query
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab as Tab);
  }, [searchParams]);

  // 切換分頁時，更新網址 query
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab) {
      url.searchParams.set('tab', tab);
    } else {
      url.searchParams.delete('tab');
    }
    window.history.replaceState({}, '', url.toString());
  };

  // 判斷是否為管理員
  const isAdmin = useMemo(() => {
    if (!userInfo) return false;
    if (Array.isArray(userInfo.role)) return userInfo.role.includes('admin') || userInfo.role.includes('管理員');
    return userInfo.role === 'admin' || userInfo.role === '管理員';
  }, [userInfo]);
  // 判斷是否為老師
  const isTeacher = useMemo(() => {
    if (!userInfo) return false;
    if (Array.isArray(userInfo.role)) return userInfo.role.includes('teacher') || userInfo.role.includes('老師');
    return userInfo.role === 'teacher' || userInfo.role === '老師';
  }, [userInfo]);

  useEffect(() => {
    if (isAdmin) {
      const fetchAdminStats = async () => {
        try {
          const res = await fetch('/api/admin/stats');
          if (res.ok) {
            const stats = await res.json();
            setAdminStats(stats);
          } else {
            setAdminStats({ studentCount: 0, teacherCount: 0, courseCount: 0 });
            // 可選：顯示錯誤訊息
          }
        } catch (error) {
          setAdminStats({ studentCount: 0, teacherCount: 0, courseCount: 0 });
          console.error("Error fetching admin stats:", error);
        }
      };
      fetchAdminStats();
    }
  }, [isAdmin]); // Only depend on isAdmin to prevent infinite loops

  useEffect(() => {
    if (userInfo?.role === '老師' && userInfo.account) {

      (async () => {
        // 先取得老師授課課程的名稱
        const res = await fetch('/api/teacher/courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account: userInfo.account }),
        });
        let courseNames: string[] = [];
        if (res.ok) {
          const data = await res.json();
          courseNames = (data.courses || []).map((str: string) => {
            const match = str.match(/(.+?)\([^)]*\)$/);
            return match ? match[1] : str;
          });
        }
        // 再呼叫 /api/courses/list 拿完整課程資料
        const res2 = await fetch('/api/courses/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teacherId: userInfo.id }),
        });
        let fullCourses: Course[] = [];
        if (res2.ok) {
          const allCourses: Course[] = await res2.json();
          // 只保留老師授課的課程（用 name 過濾）
          fullCourses = allCourses.filter((c: Course) => courseNames.includes(c.name));
        }
        setCourses(fullCourses as Course[]);
      })();
    } else if (userInfo?.role === '管理員') {
      // 管理員載入全部課程
      (async () => {
        const res = await fetch('/api/courses/list', { method: 'GET' });
        if (res.ok) {
          const allCourses: Course[] = await res.json();
          setCourses(allCourses);
        } else {
          setCourses([]);
        }
      })();
    }
  }, [userInfo?.account, userInfo?.id, userInfo?.role]);

  const sidebarMenuItems: { [K in '管理員' | '老師']: { id: string; title: string; icon: React.JSX.Element }[] } = {
    '管理員': [
      { id: 'announcements', title: '公告管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.354a1.76 1.76 0 013.417-.592z" /></svg> },
      { id: 'exam-dates', title: '考試日期管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
      { id: 'students', title: '學生管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
      { id: 'courses', title: '課程管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v11.494m-9-5.747h18" /></svg> },
      { id: 'admin-teachers', title: '老師/管理員管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> },
      { id: 'password', title: '修改密碼', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg> },
    ],
    '老師': [
      { id: 'teacher-courses', title: '授課課程管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12V6a2 2 0 00-2-2H6a2 2 0 00-2 2v6" /></svg> },
      { id: 'teacher-grades', title: '成績管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> },
      { id: 'teacher-exams', title: '測驗管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h.01" /></svg> },
      { id: 'tutoring', title: '課程輔導', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
      { id: 'password', title: '修改密碼', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg> },
    ],
  };

  // 老師端側邊選單與快速操作順序與顏色（全部用 Tailwind 標準色）
  type TeacherColor = 'blue' | 'green' | 'orange' | 'yellow' | 'purple' | 'red';
  const teacherSidebarMenu: { id: string; title: string; icon: React.ReactElement; color: TeacherColor; disabled?: boolean }[] = [
    { id: 'teacher-courses', title: '授課課程管理', icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12V6a2 2 0 00-2-2H6a2 2 0 00-2 2v6" /></svg>, color: 'blue' },
    { id: 'teacher-grades', title: '成績管理', icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>, color: 'green' },
    { id: 'teacher-attendance', title: '點名管理', icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>, color: 'orange', disabled: true },
    { id: 'teacher-exams', title: '測驗管理', icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, color: 'yellow', disabled: true },
    { id: 'tutoring', title: '課程輔導', icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>, color: 'purple', disabled: true },
    { id: 'password', title: '修改密碼', icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>, color: 'red' },
  ];

  // 老師端快速操作卡片（順序與 sidebar 一致，顏色唯一，全部用 Tailwind 標準色）
  const teacherQuickActions = teacherSidebarMenu.map(item => {
    const colorMap = {
      blue: { border: 'border-blue-500', iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
      green: { border: 'border-green-500', iconBg: 'bg-green-100', iconText: 'text-green-600' },
      orange: { border: 'border-orange-500', iconBg: 'bg-orange-100', iconText: 'text-orange-500' },
      yellow: { border: 'border-yellow-500', iconBg: 'bg-yellow-100', iconText: 'text-yellow-500' },
      purple: { border: 'border-purple-500', iconBg: 'bg-purple-100', iconText: 'text-purple-500' },
      red: { border: 'border-red-500', iconBg: 'bg-red-100', iconText: 'text-red-500' },
    };
    const c = colorMap[item.color];
    // 直接給 icon SVG className
    let iconEl = item.icon;
    if (React.isValidElement(item.icon)) {
      iconEl = React.cloneElement(item.icon as React.ReactElement<React.SVGProps<SVGSVGElement>>, { className: `h-8 w-8 ${c.iconText}` });
    }
    return {
      id: item.id,
      title: item.title,
      description: item.id === 'teacher-courses' ? '管理您的授課課程、學生與內容'
        : item.id === 'teacher-grades' ? '上傳、查詢、與分析學生成績'
        : item.id === 'teacher-attendance' ? '管理課堂點名紀錄'
        : item.id === 'teacher-exams' ? '建立、管理與查詢課堂測驗'
        : item.id === 'tutoring' ? '管理老師與學生的輔導排程'
        : item.id === 'password' ? '修改您的登入密碼'
        : '',
      icon: iconEl,
      borderColor: c.border,
      iconBg: c.iconBg,
      iconText: c.iconText,
      disabled: item.disabled,
    };
  });

  // 管理員快速操作卡片（順序與 sidebarMenuItems['管理員'] 一致）
  const adminQuickActions = [
    { id: 'announcements', title: '公告管理', description: '發布與管理最新公告', icon: <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.354a1.76 1.76 0 013.417-.592z" /></svg>, borderColor: 'border-blue-500', iconBg: 'bg-blue-100', iconText: 'text-blue-600' },
    { id: 'exam-dates', title: '考試日期管理', description: '管理考試時程與重要日期', icon: <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, borderColor: 'border-green-500', iconBg: 'bg-green-100', iconText: 'text-green-600' },
    { id: 'students', title: '學生管理', description: '管理學生資訊與註冊狀態', icon: <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>, borderColor: 'border-yellow-500', iconBg: 'bg-yellow-100', iconText: 'text-yellow-500' },
    { id: 'courses', title: '課程管理', description: '新增、編輯、管理所有課程', icon: <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v11.494m-9-5.747h18" /></svg>, borderColor: 'border-purple-500', iconBg: 'bg-purple-100', iconText: 'text-purple-500' },
    { id: 'admin-teachers', title: '老師/管理員管理', description: '管理教師與管理員帳號', icon: <svg className="h-8 w-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>, borderColor: 'border-orange-500', iconBg: 'bg-orange-100', iconText: 'text-orange-500' },
    { id: 'password', title: '修改密碼', description: '修改您的登入密碼', icon: <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>, borderColor: 'border-red-500', iconBg: 'bg-red-100', iconText: 'text-red-500' },
  ];

  const renderDashboard = () => {
    if (isAdmin || isTeacher) {
      const isAdminPanel = isAdmin;
      // 管理員/老師端快速操作卡片（原 quickActions，移到這裡）
      // const quickActions: { id: string; title: string; description: string; disabled?: boolean }[] = isAdminPanel
      //   ? [
      //       { id: 'announcements', title: '公告管理', description: '發布與管理最新公告' },
      //       { id: 'exam-dates', title: '考試日期管理', description: '管理考試時程與重要日期' },
      //       { id: 'students', title: '學生管理', description: '管理學生資訊與註冊狀態' },
      //       { id: 'courses', title: '課程管理', description: '新增、編輯、管理所有課程' },
      //       { id: 'admin-teachers', title: '老師/管理員管理', description: '管理教師與管理員帳號' },
      //       { id: 'password', title: '修改密碼', description: '修改您的登入密碼' },
      //     ]
      //   : [
      //       { id: 'teacher-courses', title: '授課課程管理', description: '管理您的授課課程、學生與內容' },
      //       { id: 'teacher-grades', title: '成績管理', description: '上傳、查詢、與分析學生成績' },
      //       { id: 'teacher-exams', title: '測驗管理', description: '建立、管理與查詢課堂測驗', disabled: true },
      //       { id: 'tutoring', title: '課程輔導', description: '管理老師與學生的輔導排程', disabled: true },
      //       { id: 'password', title: '修改密碼', description: '修改您的登入密碼' },
      //     ];
      // 修正：分別取用 adminStats 或 teacherStats
      const statsCards = isAdminPanel ? [
        { title: '學生數', value: adminStats.studentCount, color: 'blue', icon: <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
        { title: '老師數', value: adminStats.teacherCount, color: 'green', icon: <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg> },
        { title: '課程數', value: adminStats.courseCount, color: 'yellow', icon: <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12V6a2 2 0 00-2-2H6a2 2 0 00-2 2v6" /></svg> },
        { title: '帳戶設定', value: '可修改', color: 'purple', icon: <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg> },
      ] : [
        { title: '授課課程', value: courses.length, color: 'blue', icon: <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12V6a2 2 0 00-2-2H6a2 2 0 00-2 2v6" /></svg> },
        { title: '成績管理', value: '可管理', color: 'green', icon: <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> },
        { title: '輔導預約', value: '未開放', color: 'yellow', icon: <svg className="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
        { title: '帳戶設定', value: '可修改', color: 'purple', icon: <svg className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg> },
      ];
      return (
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          {/* 歡迎區塊 */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-4 md:p-6 text-white mb-4 md:mb-8">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex-1">
                <h1 className="text-2xl md:text-4xl font-bold mb-2">歡迎回來，{userInfo && userInfo.name}{isAdminPanel ? '管理員' : '老師'}！</h1>
                <p className="text-blue-100 text-base md:text-lg">帳號：{userInfo && userInfo.account}</p>
                <p className="text-blue-100 mt-2 text-sm md:text-base">今天是 {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
              </div>
              {/* 右側 icon 與歡迎使用 */}
              <div className="text-center lg:text-right">
                <div className="text-4xl mb-2">📚</div>
                <p className="text-blue-100 text-sm md:text-base">歡迎使用</p>
              </div>
            </div>
          </div>
          {/* 統計卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-4 md:mb-8">
            {statsCards.map(card => (
              <div key={card.title} className={`bg-white rounded-lg shadow-md p-4 md:p-6 border-l-4 ${card.color === 'blue' ? 'border-blue-500' : card.color === 'green' ? 'border-green-500' : card.color === 'yellow' ? 'border-yellow-500' : 'border-purple-500'}`}>
                <div className="flex items-center">
                  <div className={`p-3 rounded-full ${card.color === 'blue' ? 'bg-blue-100 text-blue-600' : card.color === 'green' ? 'bg-green-100 text-green-600' : card.color === 'yellow' ? 'bg-yellow-100 text-yellow-600' : 'bg-purple-100 text-purple-600'}`}>{card.icon}</div>
                  <div className="ml-4 min-w-0 flex-1">
                    <p className="text-sm md:text-base font-medium text-gray-600">{card.title}</p>
                    <p className="text-xl md:text-3xl font-bold text-gray-900 truncate">{card.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* 快速操作 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">快速操作</h2>
            <div className="card-list">
              {isAdmin
                ? adminQuickActions.map(action => {
                    const isActive = activeTab === action.id;
                    const ringColor =
                      action.borderColor === 'border-blue-500' ? 'ring-blue-500'
                      : action.borderColor === 'border-green-500' ? 'ring-green-500'
                      : action.borderColor === 'border-yellow-500' ? 'ring-yellow-500'
                      : action.borderColor === 'border-purple-500' ? 'ring-purple-500'
                      : action.borderColor === 'border-orange-500' ? 'ring-orange-500'
                      : action.borderColor === 'border-red-500' ? 'ring-red-500'
                      : '';
                    let iconEl = action.icon;
                    if (React.isValidElement(action.icon)) {
                      iconEl = React.cloneElement(action.icon as React.ReactElement<React.SVGProps<SVGSVGElement>>, { className: `h-8 w-8 ${action.iconText}` });
                    }
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleTabChange(action.id as Tab)}
                        className={`min-w-[260px] sm:min-w-0 text-left p-6 rounded-2xl shadow-md transition-all duration-300 flex items-center border-l-4 ${action.borderColor} bg-white hover:bg-gray-50 hover:-translate-y-1 ${
                          isActive ? `ring-2 ${ringColor}` : ''
                        }`}
                      >
                        <div className={`p-4 rounded-xl mr-4 ${action.iconBg}`}>{iconEl}</div>
                        <div>
                          <h3 className={`text-xl font-bold text-gray-800`}>{action.title}</h3>
                          <p className={`text-base mt-1 text-gray-600`}>{action.description}</p>
                        </div>
                      </button>
                    );
                  })
                : isTeacher
                ? teacherQuickActions.map(action => {
                    const isActive = activeTab === action.id;
                    const ringColor =
                      action.borderColor.includes('blue') ? 'ring-blue-500'
                      : action.borderColor.includes('green') ? 'ring-green-500'
                      : action.borderColor.includes('orange') ? 'ring-orange-500'
                      : action.borderColor.includes('yellow') ? 'ring-yellow-500'
                      : action.borderColor.includes('purple') ? 'ring-purple-500'
                      : action.borderColor.includes('red') ? 'ring-red-500'
                      : '';
                    return (
                      <button
                        key={action.id}
                        onClick={() => !action.disabled && handleTabChange(action.id as Tab)}
                        disabled={action.disabled}
                        className={`min-w-[260px] sm:min-w-0 text-left p-6 rounded-2xl shadow-md transition-all duration-300 flex items-center border-l-4 ${action.borderColor} bg-white hover:bg-gray-50 hover:-translate-y-1 ${
                          isActive ? `ring-2 ${ringColor}` : ''
                        } ${action.disabled ? 'bg-gray-100 cursor-not-allowed opacity-60 ring-0' : ''}`}
                      >
                        <div className={`p-4 rounded-xl mr-4 ${action.iconBg} ${action.iconText}`}>{action.icon}</div>
                        <div>
                          <h3 className={`text-xl font-bold ${action.disabled ? 'text-gray-500' : 'text-gray-800'}`}>{action.title}</h3>
                          <p className={`text-base mt-1 ${action.disabled ? 'text-gray-400' : 'text-gray-600'}`}>{action.description}</p>
                        </div>
                      </button>
                    );
                  })
                : null}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // 傳遞給子元件時，將 role 正規化為 '管理員' | '老師' | '學生'
  const normalizedUserInfo = userInfo
    ? {
        ...userInfo,
        role: (Array.isArray(userInfo.role)
          ? (userInfo.role.includes('admin') ? '管理員' : userInfo.role.includes('teacher') ? '老師' : '學生')
          : userInfo.role === 'admin' ? '管理員' : userInfo.role === 'teacher' ? '老師' : '學生') as '管理員' | '老師' | '學生',
      }
    : null;

  const renderContent = () => {
    console.log('renderContent - activeTab:', activeTab, 'userInfo:', !!userInfo);
    if (!userInfo) {
      return <div style={{ color: 'red', fontSize: 24 }}>尚未取得使用者資訊，請稍候...</div>;
    }
    if (!activeTab) {
      console.log('Rendering dashboard');
      return renderDashboard();
    }
    // 根據 activeTab 顯示對應內容
    console.log('Rendering content for activeTab:', activeTab);
    switch (activeTab) {
      case 'announcements':
        return <AnnouncementManager />;
      case 'exam-dates':
        return <ExamDateManager />;
      case 'students':
        return <StudentManager />;
      case 'courses':
        console.log('Rendering CourseManager');
        return <CourseManager onProcessingStateChange={handleProcessingStateChange} userInfo={userInfo} />;
      case 'admin-teachers':
        return <TeacherAdminManager />;
      case 'password':
        return <PasswordManager />;
      case 'teacher-courses':
        console.log('Rendering TeacherCourseManager with userInfo:', normalizedUserInfo, 'courses:', courses);
        return <TeacherCourseManager userInfo={normalizedUserInfo} courses={courses} />;
      case 'teacher-grades':
        return <GradeManager userInfo={normalizedUserInfo} />;
      case 'teacher-exams':
        return <TeacherExamManager />;
      // case 'tutoring': // 不可點擊
      default:
        console.log('No matching case for activeTab:', activeTab);
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4 md:p-8 h-screen bg-gray-100">
        <div className="loading-spinner h-16 w-16"></div>
        <span className="ml-4 text-blue-600 text-lg md:text-2xl font-semibold">後台資料載入中，請稍候...</span>
      </div>
    );
  }

  // 取代原本 allSidebarMenuItems 的老師端部分，直接用 teacherSidebarMenu
  let currentMenuItems: { id: string; title: string; icon: React.JSX.Element; disabled?: boolean }[] = [];
  if (isAdmin) {
    currentMenuItems = sidebarMenuItems['管理員'];
  } else if (isTeacher) {
    currentMenuItems = teacherSidebarMenu;
  }
  // 決定哪些 sidebar 功能要 disabled
  const allSidebarMenuItems = currentMenuItems.map(item => ({
    ...item,
    disabled: item.disabled || (item.id === 'tutoring' || item.id === 'teacher-exams' ? true : false),
  }));

  // 新增預設空白元件
  function TeacherExamManager() {
    return <div style={{padding:40, fontSize:22, color:'#666'}}>「測驗管理」功能開發中，敬請期待！</div>;
  }

  // 修正重複渲染：分離 mainItems 與 accountItems
  // const sidebarAccordionGroups = [
  //   {
  //     id: 'main',
  //     title: isAdmin ? '管理功能' : '教師功能',
  //     content: (
  //       <div className="flex flex-col gap-2">
  //         {mainItems.map(item => (
  //           <button
  //             key={item.id}
  //             onClick={() => {
  //               if (isMobile) setSidebarOpen(false);
  //               if (!item.disabled) handleTabChange(item.id as Tab);
  //             }}
  //             disabled={item.disabled}
  //             className={`w-full flex items-baseline leading-none p-2 rounded-lg transition-colors select-none
  //               ${activeTab === item.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}
  //               ${item.disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60 pointer-events-none' : ''}`}
  //           >
  //             <span className="flex items-baseline w-8 h-8">
  //               {React.cloneElement(item.icon, { className: 'h-[22px] w-[22px] flex-shrink-0 block align-middle ' + (item.disabled ? 'text-gray-400' : 'text-blue-600') })}
  //             </span>
  //             <span className="ml-3 text-sm md:text-base truncate align-middle">{item.title}</span>
  //           </button>
  //         ))}
  //       </div>
  //     ),
  //   },
  //   {
  //     id: 'account',
  //     title: '帳戶功能',
  //     content: (
  //       <div className="flex flex-col gap-2">
  //         {accountItems.map(item => (
  //           <button
  //             key={item.id}
  //             onClick={() => {
  //               if (isMobile) setSidebarOpen(false);
  //               if (!item.disabled) handleTabChange(item.id as Tab);
  //             }}
  //             disabled={item.disabled}
  //             className={`w-full flex items-baseline leading-none p-2 rounded-lg transition-colors select-none
  //               ${activeTab === item.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}
  //               ${item.disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60 pointer-events-none' : ''}`}
  //           >
  //             <span className="flex items-baseline w-8 h-8">
  //               {React.cloneElement(item.icon, { className: 'h-[22px] w-[22px] flex-shrink-0 block align-middle ' + (item.disabled ? 'text-gray-400' : 'text-blue-600') })}
  //             </span>
  //             <span className="ml-3 text-sm md:text-base truncate align-middle">{item.title}</span>
  //           </button>
  //         ))}
  //       </div>
  //     ),
  //   },
  // ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* 漢堡按鈕（僅手機顯示，sidebar 關閉時顯示） */}
      {isMobile && !sidebarOpen && (
        <button className="fixed top-16 left-4 z-40 bg-white p-2 rounded-full shadow-lg md:hidden hover:bg-gray-50 transition-colors" onClick={() => setSidebarOpen(true)}>
          <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}
      {/* 側邊欄 */}
      <aside className={`hidden md:flex flex-col z-40 transition-all duration-300 bg-white border-r fixed left-0 top-16 bottom-0 ${isSidebarCollapsed ? 'w-16' : 'w-64'}`}
        style={{height: 'calc(100vh - 64px)'}}>
        {/* 頂部：用戶資料、登出、收合/展開按鈕 */}
        <div className="border-b pt-4 pb-2">
          <div className="px-2">
            {userInfo && (
              <>
                <div className="flex items-center gap-2 pb-2">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    {userInfo.name?.[0] || '?'}
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="ml-2">
                      <div className="font-semibold text-base">{userInfo.name} ({isAdmin ? '管理員' : '老師'})</div>
                      <div className="text-xs text-gray-500">帳號：{userInfo.account}</div>
                    </div>
                  )}
                </div>
                <div className="pb-2">
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full h-12 px-3 py-2 rounded-lg transition-colors text-red-600 hover:bg-red-50"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    {!isSidebarCollapsed && <span className="ml-3">登出</span>}
                  </button>
                </div>
              </>
            )}
          </div>
          <div className="px-2 pb-2">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="flex items-center w-full h-12 px-3 py-2 rounded-lg transition-colors hover:bg-gray-100 text-gray-700"
            >
              <span className="flex items-center justify-center w-8 h-8">
                {isSidebarCollapsed ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                )}
              </span>
              {!isSidebarCollapsed && <span className="ml-3 text-base">{isSidebarCollapsed ? '展開選單' : '收合選單'}</span>}
            </button>
          </div>
        </div>
        {/* 功能選單 */}
        <nav className="flex-1 py-4 flex flex-col gap-2 px-2 overflow-y-auto">
          {/* 儀表板按鈕 */}
          <button
            onClick={() => handleTabChange(null)}
            className={`w-full flex items-center p-2 rounded-lg transition-colors select-none ${activeTab === null ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}`}
          >
            <span className="flex items-center justify-center w-8 h-8">
              {/* HomeIcon (heroicons/outline) */}
              <svg className="h-6 w-6 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4.5 10.5V21a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0011.25 21V15h1.5v6a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0019.5 21V10.5" />
              </svg>
            </span>
            {!isSidebarCollapsed && <span className="ml-3 text-base truncate">儀表板</span>}
          </button>
          {allSidebarMenuItems.map(item => (
            <button
              key={item.id}
              onClick={() => !item.disabled && handleTabChange(item.id as Tab)}
              disabled={item.disabled}
              className={`flex items-center w-full h-12 px-3 py-2 rounded-lg transition-colors select-none
                ${activeTab === item.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}
                ${item.disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60 pointer-events-none' : ''}`}
            >
              <span className="flex items-center justify-center w-8 h-8">
                {React.cloneElement(item.icon, { className: 'h-6 w-6 flex-shrink-0 ' + (item.disabled ? 'text-gray-400' : 'text-blue-600') })}
              </span>
              {!isSidebarCollapsed && (
                <span className="ml-3 text-base truncate">{item.title}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-2 md:p-8 ml-0 md:ml-64 overflow-y-auto" style={{height: '100vh'}}>
          {renderContent()}
      </main>
    </div>
  );
}

export default function BackPanelWrapper() {
  return (
    <Suspense>
      <BackPanel />
    </Suspense>
  );
}
