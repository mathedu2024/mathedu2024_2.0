'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// UI Icons & Components
import Sidebar from '@/components/Sidebar';
import LoadingSpinner from '@/components/LoadingSpinner';
import { 
  CalendarIcon, 
  AcademicCapIcon, 
  UserGroupIcon, 
  ChartBarIcon, 
  ClockIcon,
  BeakerIcon,
  Cog6ToothIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

// Utils & Types
import { getSession, clearSession } from '@/utils/session';
import type { Course } from '@/components/TeacherCourseManager';

// ============================================================================
// 動態引入子元件 (解決 Firebase Build Error 的關鍵)
// ssr: false 確保這些元件只在瀏覽器端執行，不會在 Build 階段觸發 Firebase
// ============================================================================
const loadingFallback = { loading: () => <div className="p-8"><LoadingSpinner text="模組載入中..." /></div> };

const AnnouncementManager = dynamic(() => import('@/components/AnnouncementManager'), { ssr: false, ...loadingFallback });
const ExamDateManager = dynamic(() => import('@/components/ExamDateManager'), { ssr: false, ...loadingFallback });
const StudentManager = dynamic(() => import('@/components/StudentManager'), { ssr: false, ...loadingFallback });
const CourseManager = dynamic(() => import('@/components/CourseManager'), { ssr: false, ...loadingFallback });
const TeacherAdminManager = dynamic(() => import('@/components/TeacherAdminManager'), { ssr: false, ...loadingFallback });
const PasswordManager = dynamic(() => import('@/components/PasswordManager'), { ssr: false, ...loadingFallback });
const TeacherCourseManager = dynamic(() => import('@/components/TeacherCourseManager'), { ssr: false, ...loadingFallback });
const GradeManager = dynamic(() => import('@/components/GradeManager'), { ssr: false, ...loadingFallback });
const TutoringManager = dynamic(() => import('@/components/TutoringManager'), { ssr: false, ...loadingFallback });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AttendanceManagementComponent = dynamic<{ courses: Course[] }>(() => import('@/components/AttendanceManagementComponent') as any, { ssr: false, ...loadingFallback });

// ============================================================================
// 類型定義
// ============================================================================

type AdminTab = 'announcements' | 'exam-dates' | 'students' | 'courses' | 'admin-teachers';
type TeacherTab = 'teacher-courses' | 'teacher-grades' | 'teacher-exams' | 'tutoring' | 'teacher-attendance';
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

// ============================================================================
// 內部元件
// ============================================================================

// UI 優化：預設空白元件 (空狀態卡片風格)
function TeacherExamManager() {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] animate-fade-in">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-md">
        <div className="w-16 h-16 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
           <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
        </div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">功能開發中</h3>
        <p className="text-gray-500">「測驗管理」模組即將上線，敬請期待更強大的功能！</p>
      </div>
    </div>
  );
}

function BackPanel() {
  const router = useRouter();
  const params = useParams();
  // 1. 狀態 hooks 命名與學生端一致
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(null);
  const [userInfo, setUserInfo] = useState<BackPanelUserInfo | null>(null);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const [isChildProcessing, setIsChildProcessing] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [adminStats, setAdminStats] = useState({ studentCount: 0, teacherCount: 0, courseCount: 0 });
  const [_loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSidebarOpen(window.innerWidth >= 768);
    }
  }, []);

  const handleActivity = useCallback(() => setLastActivity(Date.now()), []);

  const handleProcessingStateChange = useCallback((isProcessing: boolean) => {
    setIsChildProcessing(isProcessing);
    if (!isProcessing) setLastActivity(Date.now());
  }, []);

  const onToggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
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
    setError(null);
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
      try {
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
        } else {
          console.error('Failed to fetch teacher profile:', res.status);
          setError('無法取得老師資料，請稍後再試。');
        }
      } catch (err) {
        console.error('Error fetching teacher profile:', err);
        setError('連線發生錯誤，請檢查網路連線。');
      } finally {
        setLoading(false);
        console.timeEnd('back-panel-load');
      }
    };

    if (userRole === '老師') {
      fetchTeacher();
    } else {
      const adminUserInfo = { ...session, name: session.name, account: session.account, id: session.id, role: userRole };
      console.log('Back Panel - Setting admin userInfo:', adminUserInfo);
      setUserInfo(adminUserInfo);
      setLoading(false);
      console.timeEnd('back-panel-load');
    }
  }, [router, handleLogout]);

  // 初始化 activeTab 根據網址 params
  useEffect(() => {
    const p = params?.tab;
    const tab = Array.isArray(p) ? p[0] : p;
    if (tab) setActiveTab(tab as Tab);
    else setActiveTab(null);
  }, [params]);

  // 切換分頁時，更新網址 path
  const handleTabChange = useCallback((tab: Tab | null) => {
    setActiveTab(tab);
    if (tab) {
      router.push(`/back-panel/${tab}`);
    } else {
      router.push('/back-panel');
    }
  }, [router]);

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
          }
        } catch (error) {
          setAdminStats({ studentCount: 0, teacherCount: 0, courseCount: 0 });
          console.error("Error fetching admin stats:", error);
        }
      };
      fetchAdminStats();
    }
  }, [isAdmin]);

  const fetchAdminCourses = useCallback(async () => {
    try {
      const res = await fetch('/api/courses/list', { method: 'GET' });
      if (res.ok) {
        const allCourses: Course[] = await res.json();
        console.log('Fetched admin courses:', allCourses);
        setCourses(allCourses);
      } else {
        const errorMsg = await res.text().catch(() => '');
        console.error(`Failed to fetch admin courses: ${res.status} ${res.statusText}`, errorMsg);
        setCourses([]);
      }
    } catch (e) {
      console.error('Error fetching admin courses:', e);
      setCourses([]);
    }
  }, []);

  useEffect(() => {
    if (userInfo?.role === '老師' && userInfo.account) {
      (async () => {
        try {
          const res = await fetch('/api/teacher/courses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ account: userInfo.account }),
          });
          let courseNames: string[] = [];
          if (res.ok) {
            const data = await res.json();
            courseNames = (data.courses || []).map((str: string) => {
              const match = str.match(/(.+?)\(([^)]*\))$/);
              return match ? match[1] : str;
            });
          }
          const res2 = await fetch('/api/courses/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId: userInfo.id }),
          });
          let fullCourses: Course[] = [];
          if (res2.ok) {
            const allCourses: Course[] = await res2.json();
            fullCourses = allCourses.filter((c: Course) => courseNames.includes(c.name));
          }
          setCourses(fullCourses as Course[]);
        } catch (err) {
          console.error('Error fetching teacher courses:', err);
        }
      })();
    } else if (userInfo?.role === '管理員') {
      fetchAdminCourses();
    }
  }, [userInfo?.account, userInfo?.id, userInfo?.role, fetchAdminCourses]);

  const sidebarMenuItems: { [K in '管理員' | '老師']: { id: string; title: string; icon: React.JSX.Element }[] } = {
    '管理員': [
      { id: 'announcements', title: '公告管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.354a1.76 1.76 0 013.417-.592z" /></svg> },
      { id: 'exam-dates', title: '考試日期管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
      { id: 'students', title: '學生管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg> },
      { id: 'courses', title: '課程管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v11.494m-9-5.747h18" /></svg> },
      { id: 'admin-teachers', title: '老師/管理員管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> },
      { id: 'password', title: '個人資料', icon: <UserCircleIcon className="h-6 w-6" /> },
    ],
    '老師': [
      { id: 'teacher-courses', title: '授課管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12V6a2 2 0 00-2-2H6a2 2 0 00-2 2v6" /></svg> },
      { id: 'teacher-grades', title: '成績管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg> },
      { id: 'teacher-exams', title: '測驗管理', icon: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h.01" /></svg> },
      { id: 'tutoring', title: '課程輔導', icon: <CalendarIcon /> },
      { id: 'password', title: '個人資料', icon: <UserCircleIcon className="h-6 w-6" /> },
    ],
  };

  type TeacherColor = 'indigo' | 'emerald' | 'orange' | 'amber' | 'purple' | 'rose';
  
  // 老師端側邊選單與快速操作順序與顏色 (對應模板顏色)
  const teacherSidebarMenu: { id: string; title: string; icon: React.ReactElement; color: TeacherColor; disabled?: boolean; href: string }[] = [
    { id: 'teacher-courses', title: '授課管理', icon: <AcademicCapIcon />, color: 'indigo', href: '/back-panel/teacher-courses' },
    { id: 'teacher-grades', title: '成績管理', icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>, color: 'emerald', href: '/back-panel/teacher-grades' },
    { id: 'teacher-attendance', title: '點名管理', icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>, color: 'orange', href: '/back-panel/teacher-attendance' },
    { id: 'teacher-exams', title: '測驗管理', icon: <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, color: 'amber', disabled: true, href: '/back-panel/teacher-exams' },
    { id: 'tutoring', title: '課程輔導', icon: <CalendarIcon />, color: 'purple', disabled: false, href: '/back-panel/tutoring' },
    { id: 'password', title: '個人資料', icon: <UserCircleIcon />, color: 'rose', href: '/back-panel/password' },
  ];

  // UI 設計系統配色對照
  const getColorClasses = (color: string) => {
    switch(color) {
      case 'indigo': return { border: 'border-indigo-100', iconBg: 'bg-indigo-50', iconText: 'text-indigo-600', ring: 'ring-indigo-200' };
      case 'emerald': return { border: 'border-emerald-100', iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', ring: 'ring-emerald-200' };
      case 'orange': return { border: 'border-orange-100', iconBg: 'bg-orange-50', iconText: 'text-orange-500', ring: 'ring-orange-200' };
      case 'amber': return { border: 'border-amber-100', iconBg: 'bg-amber-50', iconText: 'text-amber-500', ring: 'ring-amber-200' };
      case 'purple': return { border: 'border-purple-100', iconBg: 'bg-purple-50', iconText: 'text-purple-600', ring: 'ring-purple-200' };
      case 'rose': return { border: 'border-rose-100', iconBg: 'bg-rose-50', iconText: 'text-rose-600', ring: 'ring-rose-200' };
      default: return { border: 'border-gray-100', iconBg: 'bg-gray-50', iconText: 'text-gray-600', ring: 'ring-gray-200' };
    }
  };

  const teacherQuickActions = teacherSidebarMenu.map(item => {
    const c = getColorClasses(item.color);
    let iconEl = item.icon;
    if (React.isValidElement(item.icon)) {
      iconEl = React.cloneElement(item.icon as React.ReactElement<React.SVGProps<SVGSVGElement>>, { className: `h-6 w-6 ${c.iconText}` });
    }
    return {
      id: item.id,
      title: item.title,
      description: item.id === 'teacher-courses' ? '管理您的授課課程、學生與內容'
        : item.id === 'teacher-grades' ? '上傳、查詢、與分析學生成績'
        : item.id === 'teacher-attendance' ? '管理課堂點名紀錄'
        : item.id === 'teacher-exams' ? '建立、管理與查詢課堂測驗'
        : item.id === 'tutoring' ? '管理老師與學生的輔導排程'
        : item.id === 'password' ? '檢視與修改個人資料與密碼'
        : '',
      icon: iconEl,
      ...c,
      disabled: item.disabled,
      href: item.href,
    };
  });

  const adminQuickActions = [
    { id: 'announcements', title: '公告管理', description: '發布與管理最新公告', icon: <svg className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.354a1.76 1.76 0 013.417-.592z" /></svg>, color: 'indigo', href: '/back-panel/announcements' },
    { id: 'exam-dates', title: '考試日期管理', description: '管理考試時程與重要日期', icon: <svg className="h-6 w-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>, color: 'emerald', href: '/back-panel/exam-dates' },
    { id: 'students', title: '學生管理', description: '管理學生資訊與註冊狀態', icon: <svg className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>, color: 'amber', href: '/back-panel/students' },
    { id: 'courses', title: '課程管理', description: '新增、編輯、管理所有課程', icon: <svg className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v11.494m-9-5.747h18" /></svg>, color: 'purple', href: '/back-panel/courses' },
    { id: 'admin-teachers', title: '老師/管理員管理', description: '管理教師與管理員帳號', icon: <svg className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>, color: 'orange', href: '/back-panel/admin-teachers' },
    { id: 'password', title: '個人資料', description: '檢視與修改個人資料與密碼', icon: <UserCircleIcon className="h-6 w-6 text-rose-600" />, color: 'rose', href: '/back-panel/password' },
  ].map(item => ({...item, ...getColorClasses(item.color), href: item.href}));

  const renderDashboard = () => {
    if (isAdmin || isTeacher) {
      const isAdminPanel = isAdmin;
      
      const statsCards = isAdminPanel ? [
        { title: '學生總數', value: adminStats.studentCount, color: 'indigo', icon: <UserGroupIcon className="h-6 w-6 text-indigo-600" /> },
        { title: '教師總數', value: adminStats.teacherCount, color: 'emerald', icon: <AcademicCapIcon className="h-6 w-6 text-emerald-600" /> },
        { title: '開設課程', value: courses.filter(c => !c.archived && c.status !== '已封存').length || adminStats.courseCount, color: 'amber', icon: <ChartBarIcon className="h-6 w-6 text-amber-600" /> },
        { title: '系統設定', value: '可修改', color: 'purple', icon: <Cog6ToothIcon className="h-6 w-6 text-purple-600" /> },
      ] : [
        { title: '授課課程', value: courses.filter(c => !c.archived && c.status !== '已封存').length, color: 'indigo', icon: <AcademicCapIcon className="h-6 w-6 text-indigo-600" /> },
        { title: '成績管理', value: '可管理', color: 'emerald', icon: <ChartBarIcon className="h-6 w-6 text-emerald-600" /> },
        { title: '輔導預約', value: '可預約', color: 'amber', icon: <ClockIcon className="h-6 w-6 text-amber-600" /> },
        { title: '測驗模組', value: '開發中', color: 'purple', icon: <BeakerIcon className="h-6 w-6 text-purple-600" /> },
      ];

      return (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 mt-6 animate-fade-in">
          {/* 歡迎區塊 - 升級為 Indigo 漸層與圓角 */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl shadow-lg p-6 md:p-8 text-white mb-8 relative overflow-hidden">
            {/* 裝飾性背景圓 */}
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-10 blur-xl"></div>
            
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                </div>
                <h1 className="text-2xl md:text-3xl font-bold mb-2 tracking-tight">
                    你好，{userInfo && userInfo.name} {isAdminPanel ? '管理員' : '老師'}
                </h1>
                <p className="text-indigo-100 text-sm md:text-base font-medium">
                    帳號：{userInfo && userInfo.account}
                </p>
                <p className="text-indigo-200 mt-4 text-sm font-light flex items-center">
                    <CalendarIcon className="w-4 h-4 mr-1" />
                    {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                </p>
              </div>
            </div>
          </div>

          {/* 統計卡片 - 升級為懸浮卡片風格 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {statsCards.map(card => {
                const colors = getColorClasses(card.color);
                return (
                  <div key={card.title} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center hover:shadow-md transition-shadow">
                    <div className={`p-3 rounded-lg ${colors.iconBg} mr-4 flex-shrink-0`}>
                        {card.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-500 mb-1">{card.title}</p>
                      <p className="text-2xl font-bold text-gray-800 truncate">{card.value}</p>
                    </div>
                  </div>
                );
            })}
          </div>

          {/* 快速操作 - 升級為 Grid Layout 與 Card 樣式 */}
          <div>
            <div className="flex items-center mb-6">
                <h2 className="text-xl font-bold text-gray-800 border-l-4 border-indigo-500 pl-3">快速操作</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(isAdmin ? adminQuickActions : (isTeacher ? teacherQuickActions : [])).map(action => {
                const isActive = activeTab === action.id;
                const Component = action.disabled ? 'button' : Link;
                return (
                  <Component
                    key={action.id}
                    disabled={action.disabled}
                    className={`
                        relative overflow-hidden text-left p-6 rounded-2xl border bg-white transition-all duration-300 group
                        ${isActive ? `ring-2 ${action.ring} border-transparent` : `border-gray-100 hover:border-transparent hover:shadow-md hover:-translate-y-1`}
                        ${action.disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}
                    `}
                    href={action.href}
                  >
                    <div className="flex items-start">
                        <div className={`p-3 rounded-xl mr-4 ${action.iconBg} group-hover:scale-110 transition-transform duration-300`}>
                            {action.icon}
                        </div>
                        <div className="flex-1">
                            <h3 className={`text-lg font-bold ${action.disabled ? 'text-gray-400' : 'text-gray-800'}`}>
                                {action.title}
                            </h3>
                            <p className={`text-sm mt-1 leading-relaxed ${action.disabled ? 'text-gray-400' : 'text-gray-500'}`}>
                                {action.description}
                            </p>
                        </div>
                    </div>
                    {!action.disabled && (
                        <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500">
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </div>
                    )}
                  </Component>
                );
              })}
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  const normalizedUserInfo = useMemo(() => {
    if (!userInfo) return null;

    const rawRole = userInfo.role;

    let mappedRole: UserRole;

    // 已經是中文角色就直接使用
    if (rawRole === '管理員' || rawRole === '老師' || rawRole === '學生') {
      mappedRole = rawRole;
    } else if (Array.isArray(rawRole)) {
      // 陣列情況，判斷是否包含英文 role
      if (rawRole.map(r => r.toLowerCase()).includes('admin')) {
        mappedRole = '管理員';
      } else if (rawRole.map(r => r.toLowerCase()).includes('teacher')) {
        mappedRole = '老師';
      } else {
        mappedRole = '學生';
      }
    } else {
      // 英文單一字串情況
      const lower = rawRole?.toLowerCase();
      if (lower === 'admin') mappedRole = '管理員';
      else if (lower === 'teacher') mappedRole = '老師';
      else mappedRole = '學生';
    }

    return {
      ...userInfo,
      role: mappedRole,
    } as BackPanelUserInfo & { role: UserRole };
  }, [userInfo]);

  const renderContent = () => {
    console.log('renderContent - activeTab:', activeTab, 'userInfo:', !!userInfo);
    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-600">
          <div className="text-xl mb-4 text-red-500">{error}</div>
          <button 
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors"
          >
            重新整理
          </button>
        </div>
      );
    }
    if (!userInfo) {
      return (
        <div className="flex items-center justify-center h-full">
            <div className="text-center">
                <LoadingSpinner />
                <p className="mt-4 text-gray-500">正在讀取使用者資訊...</p>
            </div>
        </div>
      );
    }
    if (!activeTab) {
      return renderDashboard();
    }
    

    const componentToRender = (() => {
      switch (activeTab) {
        case 'announcements': return <AnnouncementManager />;
        case 'exam-dates': return <ExamDateManager />;
        case 'students': return <StudentManager />;
        case 'courses': return <CourseManager onProcessingStateChange={handleProcessingStateChange} />;
        case 'admin-teachers': return <TeacherAdminManager />;
        case 'password': return <PasswordManager apiEndpoint='/api/auth/change-password' userInfo={normalizedUserInfo || undefined} />;
        case 'teacher-courses': return <TeacherCourseManager userInfo={normalizedUserInfo} courses={courses} />;
        case 'teacher-grades': return <GradeManager userInfo={normalizedUserInfo} />;
        case 'teacher-exams': return <TeacherExamManager />;
        case 'tutoring': return <TutoringManager userInfo={normalizedUserInfo} courses={courses} />;
        case 'teacher-attendance':
          return <AttendanceManagementComponent courses={courses} />;
        default: return null;
      }
    })();

    // For placeholder pages like 'teacher-exams', render without the standard header.
    if (activeTab === 'teacher-exams') {
      return (
        <div className="animate-fade-in h-full flex flex-col bg-gray-50/50 p-4 md:p-6 overflow-y-auto">
          {componentToRender}
        </div>
      );
    }

    return (
      <div className="animate-fade-in h-full flex flex-col bg-gray-50/50 p-4 md:p-6 overflow-y-auto">
        <div className="flex flex-col gap-6">
          {componentToRender}
        </div>
      </div>
    );
  };

  let currentMenuItems: { id: string; title: string; icon: React.JSX.Element; disabled?: boolean; href?: string }[] = [];
  if (isAdmin) {
    currentMenuItems = sidebarMenuItems['管理員'].map(item => ({ ...item, href: `/back-panel/${item.id}` }));
  } else if (isTeacher) {
    currentMenuItems = teacherSidebarMenu;
  }
  
  const allSidebarMenuItems = currentMenuItems.map(item => ({
    ...item,
    disabled: item.disabled || false,
  }));

  return (
    <div className="flex h-full min-w-0 bg-gray-50 overflow-x-hidden">
      <Sidebar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
        userInfo={userInfo}
        menuItems={allSidebarMenuItems}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogout={handleLogout}
        dashboardHref="/back-panel"
      />

      {/* 手機版不預留側欄寬度（避免 SSR/hydration 誤判寬度造成左側空白、內容右移）；md 以上再隨收合狀態留白 */}
      <div
        className={`flex-1 flex flex-col min-h-0 min-w-0 bg-gray-50 transition-[padding] duration-300 ease-in-out pl-0 ${
          sidebarOpen ? 'md:pl-64' : 'md:pl-20'
        }`}
      >
        {renderContent()}
      </div>
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