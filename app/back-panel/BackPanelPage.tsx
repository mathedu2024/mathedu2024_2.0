'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// UI Icons & Components
import Sidebar from '@/components/Sidebar';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import {
  CalendarIcon,
  CalendarDaysIcon,
  AcademicCapIcon,
  UserGroupIcon,
  ChartBarIcon,
  ClockIcon,
  Cog6ToothIcon,
  UserCircleIcon,
  CloudArrowDownIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline';

// Utils & Types
import { getSession, refreshSessionCookie } from '@/utils/session';
import {
  buildBackPanelUserFromSession,
  getBackPanelRole,
} from '@/utils/backPanelSession';
import { logoutClient } from '@/utils/logoutClient';
import { useCompactNav } from '@/utils/useCompactNav';
import { getDashboardColorClasses } from '@/utils/dashboardColors';
import type { Course } from '@/components/TeacherCourseManager';
import {
  fetchTeacherProfile,
  fetchAdminStats as fetchAdminStatsApi,
  fetchAdminCoursesList,
  fetchCoursesByTeacherId,
} from '@/utils/teacherClientApi';
import CourseActivityFeed from '@/components/CourseActivityFeed';
import LiveAttendanceBanner from '@/components/LiveAttendanceBanner';

function BackPanelModulePlaceholder() {
  return (
    <div className="page-shell w-full min-w-0 py-6 space-y-4 animate-pulse" aria-hidden>
      <div className="h-8 bg-gray-200/80 rounded-lg w-48" />
      <div className="h-32 bg-gray-100 rounded-2xl border border-gray-100" />
      <div className="h-24 bg-gray-100 rounded-2xl border border-gray-100" />
    </div>
  );
}

// ============================================================================
// 動態引入子元件 (解決 Firebase Build Error 的關鍵)
// ssr: false 確保這些元件只在瀏覽器端執行，不會在 Build 階段觸發 Firebase
// ============================================================================
const loadingFallback = { loading: () => <BackPanelModulePlaceholder /> };

const AnnouncementManager = dynamic(() => import('@/components/AnnouncementManager'), { ssr: false, ...loadingFallback });
const ExamDateManager = dynamic(() => import('@/components/ExamDateManager'), { ssr: false, ...loadingFallback });
const StudentManager = dynamic(() => import('@/components/StudentManager'), { ssr: false, ...loadingFallback });
const CourseManager = dynamic(() => import('@/components/CourseManager'), { ssr: false, ...loadingFallback });
const TeacherAdminManager = dynamic(() => import('@/components/TeacherAdminManager'), { ssr: false, ...loadingFallback });
const PasswordManager = dynamic(() => import('@/components/PasswordManager'), { ssr: false, ...loadingFallback });
const TeacherCourseManager = dynamic(() => import('@/components/TeacherCourseManager'), { ssr: false, ...loadingFallback });
const ResourceManagement = dynamic(() => import('@/components/ResourceManagement'), { ssr: false, ...loadingFallback });
const TutoringManager = dynamic(() => import('@/components/TutoringManager'), { ssr: false, ...loadingFallback });
const TeacherExamManager = dynamic(() => import('@/components/TeacherExamManager'), { ssr: false, ...loadingFallback });
const TeacherSurveyManager = dynamic(() => import('@/components/TeacherSurveyManager'), { ssr: false, ...loadingFallback });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AttendanceManagementComponent = dynamic<{
  courses: Course[];
  courseCodeFromUrl?: string;
  attendanceCodeFromUrl?: string;
  embedded?: boolean;
  returnTo?: string;
  userInfo?: { id: string; name?: string; role?: string | string[] } | null;
}>(() => import('@/components/AttendanceManagementComponent') as any, { ssr: false, ...loadingFallback });

// ============================================================================
// 類型定義
// ============================================================================

type AdminTab = 'announcements' | 'exam-dates' | 'students' | 'courses' | 'admin-teachers' | 'resources';
type TeacherTab = 'teacher-courses' | 'teacher-exams' | 'teacher-surveys' | 'tutoring' | 'teacher-attendance' | 'resources';
type ExamSubView = '' | 'new' | 'builder' | 'grading' | 'analytics';
type SurveySubView = '' | 'new' | 'builder' | 'analytics';
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

type TeacherColor = 'indigo' | 'emerald' | 'orange' | 'amber' | 'purple' | 'rose';

interface MenuConfigItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactElement;
  color: TeacherColor;
  href: string;
  disabled?: boolean;
}

// ============================================================================
// 內部元件
// ============================================================================

// 標準化選單配置
const ADMIN_MENU_CONFIG: MenuConfigItem[] = [
  { id: 'announcements', title: '公告管理', description: '發布與管理最新公告', icon: <MegaphoneIcon className="h-6 w-6" />, color: 'indigo', href: '/back-panel/announcements' },
  { id: 'courses', title: '課程管理', description: '新增、編輯、管理所有課程', icon: <UserGroupIcon className="h-6 w-6" />, color: 'purple', href: '/back-panel/courses' },
  { id: 'students', title: '學生管理', description: '管理學生資訊與註冊狀態', icon: <UserGroupIcon className="h-6 w-6" />, color: 'amber', href: '/back-panel/students' },
  { id: 'exam-dates', title: '考試日期管理', description: '管理考試時程與重要日期', icon: <CalendarDaysIcon className="h-6 w-6" />, color: 'emerald', href: '/back-panel/exam-dates' },
  { id: 'resources', title: '線上資源管理', description: '管理教學影片連結、PDF 教材與外部網頁', icon: <CloudArrowDownIcon className="h-6 w-6" />, color: 'indigo', href: '/back-panel/resources' },
  { id: 'admin-teachers', title: '老師/管理員管理', description: '管理教師與管理員帳號', icon: <ShieldCheckIcon className="h-6 w-6" />, color: 'orange', href: '/back-panel/admin-teachers' },
  { id: 'password', title: '個人資料', description: '檢視與修改個人資料與密碼', icon: <UserCircleIcon className="h-6 w-6" />, color: 'rose', href: '/back-panel/password' },
];

const TEACHER_MENU_CONFIG: MenuConfigItem[] = [
  { id: 'teacher-courses', title: '授課管理', description: '管理您的授課課程、學生與內容', icon: <BookOpenIcon className="h-6 w-6" />, color: 'indigo', href: '/back-panel/teacher-courses' },
  { id: 'resources', title: '線上資源管理', description: '管理教學影片連結、PDF 教材與外部網頁', icon: <CloudArrowDownIcon className="h-6 w-6" />, color: 'indigo', href: '/back-panel/resources' },
  { id: 'tutoring', title: '課程輔導', description: '管理老師與學生的輔導排程', icon: <CalendarIcon className="h-6 w-6" />, color: 'purple', href: '/back-panel/tutoring' },
  { id: 'password', title: '個人資料', description: '檢視與修改個人資料與密碼', icon: <UserCircleIcon className="h-6 w-6" />, color: 'rose', href: '/back-panel/password' },
];

function getBackPanelSegments(pathname: string): string[] {
  return pathname.replace(/^\/back-panel\/?/, '').split('/').filter(Boolean);
}

function BackPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathSegments = useMemo(() => getBackPanelSegments(pathname), [pathname]);
  // 1. 狀態 hooks 命名與學生端一致
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>(null);
  const [userInfo, setUserInfo] = useState<BackPanelUserInfo | null>(null);
  const authRedirectRef = useRef(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [adminStats, setAdminStats] = useState({ studentCount: 0, teacherCount: 0, courseCount: 0 });
  const [error, setError] = useState<string | null>(null);
  const isCompactNav = useCompactNav();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // CourseManager 仍會回報處理中狀態；閒置登出改由 AutoLogout 統一處理
  const handleProcessingStateChange = useCallback((_isProcessing: boolean) => {}, []);

  const onToggleSidebar = useCallback(() => {
    setSidebarOpen(prev => !prev);
  }, []);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    await logoutClient('/panel');
  }, []);

  useEffect(() => {
    setError(null);
    const session = getSession();
    if (!session) {
      if (!isLoggingOut && !authRedirectRef.current) {
        authRedirectRef.current = true;
        router.replace('/panel');
      }
      return;
    }
    authRedirectRef.current = false;
    const userRole = getBackPanelRole(session);
    // 重寫精簡 session cookie（避免舊版把 token 寫入 cookie 導致解析失敗）
    refreshSessionCookie(session);

    if (userRole === '學生') {
      void handleLogout();
      return;
    }

    setUserInfo(buildBackPanelUserFromSession(session));

    const fetchTeacher = async () => {
      try {
        const data = await fetchTeacherProfile(session.account);
        setUserInfo({
          id: String(data.id),
          name: String(data.name || session.name || ''),
          account: session.account,
          role: '老師',
        });
      } catch (err) {
        console.error('Error fetching teacher profile:', err);
        setError('連線發生錯誤，請檢查網路連線。');
      }
    };

    if (userRole === '老師') {
      void fetchTeacher();
    }
  }, [handleLogout, isLoggingOut, router]);

  // 初始化 activeTab 根據網址 path
  useEffect(() => {
    const tab = pathSegments[0];
    if (tab) setActiveTab(tab as Tab);
    else setActiveTab(null);
  }, [pathSegments]);

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

  const teacherCoursesCourseCode = useMemo(() => {
    if (pathSegments[0] !== 'teacher-courses' || !pathSegments[1]) return '';
    const codeSeg = decodeURIComponent(pathSegments[1]);
    if (codeSeg === 'preview' || codeSeg === 'interact') return '';
    return codeSeg;
  }, [pathSegments]);

  // 進入單一課程後：課程 Hub、測驗／問卷編輯、點名明細都收合側選單
  const isTeacherCourseWorkspace = useMemo(() => {
    const [root, seg1, seg2] = pathSegments;
    if (root === 'teacher-courses' && seg1 && seg1 !== 'preview' && seg1 !== 'interact') return true;
    if (root === 'teacher-exams' && seg1) return true;
    if (root === 'teacher-surveys' && seg1) return true;
    if (root === 'teacher-attendance' && seg1 && seg2) return true;
    return false;
  }, [pathSegments]);

  useEffect(() => {
    // 桌面：列表展開；進入課程相關頁面後收合。窄螢幕維持收合。
    setSidebarOpen(!isCompactNav && !isTeacherCourseWorkspace);
  }, [isCompactNav, isTeacherCourseWorkspace]);

  const teacherCoursesTab = useMemo(() => {
    if (pathSegments[0] !== 'teacher-courses') return '';
    return searchParams.get('tab') || '';
  }, [pathSegments, searchParams]);

  const teacherExamInitialCourseId = useMemo(() => {
    if (pathSegments[0] !== 'teacher-exams') return '';
    return searchParams.get('courseId') || '';
  }, [pathSegments, searchParams]);

  const teacherSurveyInitialCourseId = useMemo(() => {
    if (pathSegments[0] !== 'teacher-surveys') return '';
    return searchParams.get('courseId') || '';
  }, [pathSegments, searchParams]);

  const teacherAttendanceReturnTo = useMemo(() => {
    if (pathSegments[0] !== 'teacher-attendance') return '';
    return searchParams.get('returnTo') || '';
  }, [pathSegments, searchParams]);

  const teacherAttendanceRoute = useMemo(() => {
    if (pathSegments[0] !== 'teacher-attendance') {
      return { courseCode: '', attendanceCode: '' };
    }
    return {
      courseCode: pathSegments[1] ? decodeURIComponent(pathSegments[1]) : '',
      attendanceCode: pathSegments[2] ? decodeURIComponent(pathSegments[2]) : '',
    };
  }, [pathSegments]);

  const teacherExamRoute = useMemo((): { quizCode: string; subView: ExamSubView } => {
    if (pathSegments[0] !== 'teacher-exams') {
      return { quizCode: '', subView: '' };
    }
    const codeSeg = pathSegments[1] ? decodeURIComponent(pathSegments[1]) : '';
    if (!codeSeg || codeSeg === 'preview') {
      return { quizCode: '', subView: '' };
    }
    if (codeSeg === 'new') {
      return { quizCode: 'new', subView: 'new' };
    }
    const action = pathSegments[2];
    if (action === 'grading' || action === 'analytics') {
      return { quizCode: codeSeg, subView: action };
    }
    return { quizCode: codeSeg, subView: 'builder' };
  }, [pathSegments]);

  const teacherSurveyRoute = useMemo((): { surveyCode: string; subView: SurveySubView } => {
    if (pathSegments[0] !== 'teacher-surveys') {
      return { surveyCode: '', subView: '' };
    }
    const codeSeg = pathSegments[1] ? decodeURIComponent(pathSegments[1]) : '';
    if (!codeSeg || codeSeg === 'preview') {
      return { surveyCode: '', subView: '' };
    }
    if (codeSeg === 'new') {
      return { surveyCode: 'new', subView: 'new' };
    }
    const action = pathSegments[2];
    if (action === 'analytics') {
      return { surveyCode: codeSeg, subView: 'analytics' };
    }
    return { surveyCode: codeSeg, subView: 'builder' };
  }, [pathSegments]);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchAdminStats = async () => {
      try {
        const stats = await fetchAdminStatsApi();
        setAdminStats(stats);
      } catch (error) {
        setAdminStats({ studentCount: 0, teacherCount: 0, courseCount: 0 });
        // 權限／session 問題時不洗版；其餘才留下診斷訊息
        const message = error instanceof Error ? error.message : String(error);
        if (!message.includes('(401)') && !message.includes('(403)')) {
          console.warn('Error fetching admin stats:', error);
        }
      }
    };
    void fetchAdminStats();
  }, [isAdmin]);

  const fetchAdminCourses = useCallback(async () => {
    try {
      const allCourses = await fetchAdminCoursesList<Course>();
      setCourses(allCourses);
    } catch (e) {
      console.error('Error fetching admin courses:', e);
      setCourses([]);
    }
  }, []);

  useEffect(() => {
    if (userInfo?.role === '老師' && userInfo.id) {
      (async () => {
        try {
          const allCourses = await fetchCoursesByTeacherId<Course>(userInfo.id);
          setCourses(allCourses);
        } catch (err) {
          console.error('Error fetching teacher courses:', err);
        }
      })();
    } else if (userInfo?.role === '管理員') {
      fetchAdminCourses();
    }
  }, [userInfo?.id, userInfo?.role, fetchAdminCourses]);

  const processedQuickActions = useMemo(() => {
    if (!userInfo) return [];
    const config = isAdmin ? ADMIN_MENU_CONFIG : TEACHER_MENU_CONFIG;

    return config.map(item => {
      const style = getDashboardColorClasses(item.color);
      let iconEl = item.icon;
      if (React.isValidElement(item.icon)) {
        iconEl = React.cloneElement(item.icon as React.ReactElement<React.SVGProps<SVGSVGElement>>, {
          className: 'h-6 w-6',
        });
      }
      return { ...item, ...style, icon: iconEl };
    });
  }, [isAdmin, userInfo]);

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
        { title: '輔導預約', value: '可預約', color: 'amber', icon: <ClockIcon className="h-6 w-6 text-amber-600" /> },
        { title: '線上資源', value: '可管理', color: 'purple', icon: <CloudArrowDownIcon className="h-6 w-6 text-purple-600" /> },
      ];

      return (
        <div className="page-shell w-full min-w-0 mt-6 animate-fade-in">
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

          {/* 統計卡片：固定列數（管理員 1×4／教師 1×3），不隨視窗改列 */}
          <div className={`grid gap-2 sm:gap-4 md:gap-6 mb-8 sm:mb-10 ${isAdminPanel ? 'grid-cols-4' : 'grid-cols-3'}`}>
            {statsCards.map(card => {
                const colors = getDashboardColorClasses(card.color);
                return (
                  <div key={card.title} className="bg-white rounded-xl shadow-sm border border-gray-100 p-2.5 sm:p-4 md:p-6 flex flex-col sm:flex-row sm:items-center hover:shadow-md transition-shadow min-w-0">
                    <div className={`hidden sm:flex p-2.5 md:p-3 rounded-lg ${colors.iconBg} sm:mr-4 flex-shrink-0`}>
                        {card.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] sm:text-sm font-medium text-gray-500 mb-0.5 sm:mb-1 leading-tight">{card.title}</p>
                      <p className="text-base sm:text-2xl font-bold text-gray-800 truncate tabular-nums">{card.value}</p>
                    </div>
                  </div>
                );
            })}
          </div>

          {/* 快速操作 — 彩色卡片（側選單與功能頁標題維持 indigo 統一） */}
          <div>
            <h2 className="text-xl font-bold text-gray-800 border-l-4 border-indigo-500 pl-4 mb-6">快速操作</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {processedQuickActions.map(action => {
                const isActive = activeTab === action.id;
                const Component = action.disabled ? 'button' : Link;
                return (
                  <Component
                    key={action.id}
                    disabled={action.disabled}
                    className={`
                      text-left p-6 rounded-2xl border transition-all duration-300 flex items-center group
                      ${action.disabled
                        ? 'bg-gray-50 cursor-not-allowed opacity-60 border-gray-100'
                        : isActive
                          ? action.activeCard
                          : `bg-white border-gray-200 ${action.cardHover} hover:shadow-lg hover:-translate-y-1 cursor-pointer`
                      }
                    `}
                    href={action.href}
                  >
                    <div className={`p-4 rounded-xl mr-5 flex-shrink-0 relative z-10 transition-colors [&_svg]:text-current ${
                      action.disabled
                        ? 'bg-gray-200 text-gray-400'
                        : `${action.iconBg} ${action.iconText} ${action.iconHover}`
                    }`}>
                      {action.icon}
                    </div>
                    <div className="min-w-0">
                      <h3 className={`text-lg font-bold ${
                        action.disabled ? 'text-gray-500' : `text-gray-900 ${action.titleHover}`
                      }`}>
                        {action.title}
                      </h3>
                      <p className={`text-sm mt-1 ${action.disabled ? 'text-gray-400' : 'text-gray-500'}`}>
                        {action.description}
                      </p>
                    </div>
                  </Component>
                );
              })}
            </div>
          </div>

          <div className="mt-8 sm:mt-10">
            {!isAdminPanel && <LiveAttendanceBanner audience="teacher" />}
            <CourseActivityFeed audience={isAdminPanel ? 'admin' : 'teacher'} />
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
        
    // 儀表板需等 userInfo；分頁則直接渲染子元件（標題由子元件負責，避免雙標題與版面位移）
    if (!userInfo && !activeTab) {
      return (
        <div className="flex items-center justify-center h-full p-4 md:p-6">
          <PageLoadingArea minHeight="min-h-[50vh]" />
        </div>
      );
    }
        
    if (!activeTab) {
      if (!userInfo) return null;
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
        case 'teacher-courses':
          return (
            <TeacherCourseManager
              userInfo={normalizedUserInfo}
              courses={courses}
              courseCodeFromUrl={teacherCoursesCourseCode}
              tabFromUrl={teacherCoursesTab}
            />
          );
        case 'teacher-exams':
          // 僅保留建立／編輯／批改／分析；列表已併入授課管理
          if (!teacherExamRoute.quizCode) return null;
          return (
            <TeacherExamManager
              userInfo={normalizedUserInfo}
              courses={courses}
              quizCodeFromUrl={teacherExamRoute.quizCode}
              examSubView={teacherExamRoute.subView}
              initialCourseId={teacherExamInitialCourseId}
            />
          );
        case 'teacher-surveys':
          if (!teacherSurveyRoute.surveyCode) return null;
          return (
            <TeacherSurveyManager
              userInfo={normalizedUserInfo}
              courses={courses}
              surveyCodeFromUrl={teacherSurveyRoute.surveyCode}
              surveySubView={teacherSurveyRoute.subView}
              initialCourseId={teacherSurveyInitialCourseId}
            />
          );
        case 'tutoring': return <TutoringManager userInfo={normalizedUserInfo} courses={courses} />;
        case 'teacher-attendance':
          // 僅保留單一點名活動深連結；列表／課程層已併入授課管理
          if (!teacherAttendanceRoute.attendanceCode) return null;
          return (
            <AttendanceManagementComponent
              courses={courses}
              courseCodeFromUrl={teacherAttendanceRoute.courseCode}
              attendanceCodeFromUrl={teacherAttendanceRoute.attendanceCode}
              returnTo={teacherAttendanceReturnTo}
            />
          );
        case 'resources': return <ResourceManagement />;
        default: return null;
      }
    })();

    return (
      <div className="animate-fade-in flex flex-col bg-gray-50/50 p-3 sm:p-4 md:p-6 min-w-0">
        <div className="flex flex-col gap-6">
          {componentToRender}
        </div>
      </div>
    );
  };

  const allSidebarMenuItems = useMemo(() => {
    return processedQuickActions.map(({ id, title, icon, disabled, href }) => ({ id, title, icon, disabled: !!disabled, href }));
  }, [processedQuickActions]);

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
          isCompactNav ? '' : sidebarOpen ? 'md:pl-64' : 'md:pl-20'
        }`}
      >
        {renderContent()}
      </div>
    </div>
  );
}

export default function BackPanelPage() {
  return (
    <Suspense fallback={<PageLoadingArea minHeight="min-h-[50vh]" />}>
      <BackPanel />
    </Suspense>
  );
}
