'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// UI Icons & Components
import Sidebar from '@/components/Sidebar';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import { dashboardSectionTitle } from '@/components/ui/dashboardChrome';
import AdminDashboard from '@/components/admin/AdminDashboard';
import AdminSystemSettings from '@/components/admin/AdminSystemSettings';
import TeacherDashboard from '@/components/teacher/TeacherDashboard';
import ConsoleContainer from '@/components/console/ConsoleContainer';
import type { AdminStatsPayload } from '@/utils/adminStatsTypes';
import { EMPTY_ADMIN_STATS } from '@/utils/adminStatsTypes';
import {
  CalendarIcon,
  CalendarDaysIcon,
  UserGroupIcon,
  ClockIcon,
  UserCircleIcon,
  CloudArrowDownIcon,
  MegaphoneIcon,
  ShieldCheckIcon,
  BookOpenIcon,
  DocumentTextIcon,
  TagIcon,
  ChatBubbleLeftRightIcon,
  Cog6ToothIcon,
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
import { parseTeacherCourseTab, parseCourseCodeFromReturnTo } from '@/utils/teacherCourseHub';
import type { CourseWorkspaceSidebar } from '@/components/Sidebar';

function BackPanelModulePlaceholder() {
  return (
    <div className="page-shell w-full min-w-0 py-6 space-y-4 animate-pulse" aria-hidden>
      <div className="h-8 bg-surface-containerHigh/80 rounded-lg w-48" />
      <div className="h-32 bg-surface-container rounded-2xl border border-outline-variant/40" />
      <div className="h-24 bg-surface-container rounded-2xl border border-outline-variant/40" />
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
const BlogPostManager = dynamic(() => import('@/components/BlogPostManager'), { ssr: false, ...loadingFallback });
const BlogCategoryManager = dynamic(() => import('@/components/BlogCategoryManager'), { ssr: false, ...loadingFallback });
const BlogCommentManager = dynamic(() => import('@/components/BlogCommentManager'), { ssr: false, ...loadingFallback });
 
const AttendanceManagementComponent = dynamic<{
  courses: Course[];
  courseCodeFromUrl?: string;
  attendanceCodeFromUrl?: string;
  embedded?: boolean;
  returnTo?: string;
  userInfo?: { id: string; name?: string; role?: string | string[] } | null;
}>(() => import('@/components/AttendanceManagementComponent') as Promise<{
  default: React.ComponentType<{
    courses: Course[];
    courseCodeFromUrl?: string;
    attendanceCodeFromUrl?: string;
    embedded?: boolean;
    returnTo?: string;
    userInfo?: { id: string; name?: string; role?: string | string[] } | null;
  }>;
}>, { ssr: false, ...loadingFallback });

// ============================================================================
// 類型定義
// ============================================================================

type AdminTab =
  | 'announcements'
  | 'exam-dates'
  | 'students'
  | 'courses'
  | 'admin-teachers'
  | 'system-settings'
  | 'resources';
type TeacherTab = 'teacher-courses' | 'teacher-exams' | 'teacher-surveys' | 'tutoring' | 'teacher-attendance' | 'resources';
type AuthorTab = 'blog' | 'blog-categories' | 'blog-comments';
type ExamSubView = '' | 'new' | 'builder' | 'grading' | 'analytics';
type SurveySubView = '' | 'new' | 'builder' | 'analytics';
type CommonTab = 'password';
type Tab = AdminTab | TeacherTab | AuthorTab | CommonTab | null;
/** 傳給既有老師元件的角色型別（作者儀表板另用 isAuthor） */
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
  { id: 'admin-teachers', title: '用戶與權限', description: '教師、管理員與作者帳號', icon: <ShieldCheckIcon className="h-6 w-6" />, color: 'orange', href: '/back-panel/admin-teachers' },
  { id: 'system-settings', title: '系統設定', description: 'SEO、金鑰與全站公告文字', icon: <Cog6ToothIcon className="h-6 w-6" />, color: 'rose', href: '/back-panel/system-settings' },
  { id: 'password', title: '個人設定', description: '檢視與修改個人資料與密碼', icon: <UserCircleIcon className="h-6 w-6" />, color: 'rose', href: '/back-panel/password' },
];

const TEACHER_MENU_CONFIG: MenuConfigItem[] = [
  { id: 'teacher-courses', title: '授課管理', description: '管理您的授課課程、學生與內容', icon: <BookOpenIcon className="h-6 w-6" />, color: 'indigo', href: '/back-panel/teacher-courses' },
  { id: 'resources', title: '線上資源管理', description: '管理教學影片連結、PDF 教材與外部網頁', icon: <CloudArrowDownIcon className="h-6 w-6" />, color: 'indigo', href: '/back-panel/resources' },
  { id: 'tutoring', title: '課程輔導', description: '管理老師與學生的輔導排程', icon: <CalendarIcon className="h-6 w-6" />, color: 'purple', href: '/back-panel/tutoring' },
  { id: 'password', title: '個人設定', description: '檢視與修改個人資料與密碼', icon: <UserCircleIcon className="h-6 w-6" />, color: 'rose', href: '/back-panel/password' },
];

const AUTHOR_MENU_CONFIG: MenuConfigItem[] = [
  { id: 'blog', title: '我的文章', description: '撰寫、排程與發佈線上文章', icon: <DocumentTextIcon className="h-6 w-6" />, color: 'indigo', href: '/back-panel/blog' },
  { id: 'blog-categories', title: '主題管理', description: '新增與管理文章主題', icon: <TagIcon className="h-6 w-6" />, color: 'purple', href: '/back-panel/blog-categories' },
  { id: 'blog-comments', title: '留言審核', description: '審核與回覆文章留言', icon: <ChatBubbleLeftRightIcon className="h-6 w-6" />, color: 'amber', href: '/back-panel/blog-comments' },
  { id: 'password', title: '個人設定', description: '檢視與修改個人資料與密碼', icon: <UserCircleIcon className="h-6 w-6" />, color: 'rose', href: '/back-panel/password' },
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
  const [adminStats, setAdminStats] = useState<AdminStatsPayload>(EMPTY_ADMIN_STATS);
  const [teacherCourseSearch, setTeacherCourseSearch] = useState('');
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
    await logoutClient('/login');
  }, []);

  useEffect(() => {
    setError(null);
    const session = getSession();
    if (!session) {
      if (!isLoggingOut && !authRedirectRef.current) {
        authRedirectRef.current = true;
        router.replace('/login');
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

    const fetchStaffProfile = async () => {
      try {
        const data = await fetchTeacherProfile(session.account);
        setUserInfo({
          id: String(data.id),
          name: String(data.name || session.name || ''),
          account: session.account,
          role: getBackPanelRole(session),
        });
      } catch (err) {
        console.error('Error fetching staff profile:', err);
        setError('連線發生錯誤，請檢查網路連線。');
      }
    };

    if (userRole === '老師' || userRole === '作者') {
      void fetchStaffProfile();
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
  const isAuthor = useMemo(() => {
    if (!userInfo) return false;
    // 以目前登入身分為準（老師／管理員即使兼有 author 也不算作者工作台）
    if (userInfo.role === '作者' || userInfo.role === 'author') return true;
    const session = getSession();
    if (session?.currentRole === 'author') return true;
    return false;
  }, [userInfo]);

  const processedQuickActions = useMemo(() => {
    if (!userInfo) return [];

    let config: MenuConfigItem[] = [];
    if (isAdmin) {
      // 管理員不承擔線上文章業務
      config = ADMIN_MENU_CONFIG;
    } else if (isTeacher) {
      // 老師不承擔線上文章業務；即使兼有 author，老師身分也不顯示線上文章選單
      config = TEACHER_MENU_CONFIG;
    } else if (isAuthor) {
      config = AUTHOR_MENU_CONFIG;
    }

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
  }, [isAdmin, isAuthor, isTeacher, userInfo]);
  const teacherCoursesCourseCode = useMemo(() => {
    if (pathSegments[0] !== 'teacher-courses' || !pathSegments[1]) return '';
    const codeSeg = decodeURIComponent(pathSegments[1]);
    if (codeSeg === 'preview' || codeSeg === 'interact') return '';
    return codeSeg;
  }, [pathSegments]);

  const teacherCoursesTab = useMemo(() => {
    if (pathSegments[0] !== 'teacher-courses') return '';
    // 課堂／公告編輯深連結時不套用 hub tab
    if (pathSegments[2] === 'lessons' || pathSegments[2] === 'announcements') return '';
    return searchParams.get('tab') || '';
  }, [pathSegments, searchParams]);

  // 進入單一課程後（含測驗／問卷／點名深頁）：側欄改為課程管理選單
  const isTeacherCourseWorkspace = useMemo(() => {
    const [root, seg1, seg2] = pathSegments;
    if (root === 'teacher-courses' && seg1 && seg1 !== 'preview' && seg1 !== 'interact') return true;
    if (root === 'teacher-exams' && seg1 && seg1 !== 'preview') return true;
    if (root === 'teacher-surveys' && seg1 && seg1 !== 'preview') return true;
    if (root === 'teacher-attendance' && seg1 && seg2) return true;
    return false;
  }, [pathSegments]);

  const workspaceCourseCode = useMemo(() => {
    if (teacherCoursesCourseCode) return teacherCoursesCourseCode;

    const fromReturnTo = parseCourseCodeFromReturnTo(searchParams.get('returnTo'));
    if (fromReturnTo) return fromReturnTo;

    if (pathSegments[0] === 'teacher-exams') {
      const courseId = searchParams.get('courseId') || '';
      if (courseId) {
        const matched = courses.find((c) => c.id === courseId);
        if (matched?.code) return matched.code;
      }
    }
    if (pathSegments[0] === 'teacher-surveys') {
      const courseId = searchParams.get('courseId') || '';
      if (courseId) {
        const matched = courses.find((c) => c.id === courseId);
        if (matched?.code) return matched.code;
      }
    }
    if (pathSegments[0] === 'teacher-attendance' && pathSegments[1]) {
      return decodeURIComponent(pathSegments[1]);
    }
    return '';
  }, [teacherCoursesCourseCode, searchParams, pathSegments, courses]);

  const courseWorkspace = useMemo((): CourseWorkspaceSidebar | null => {
    if (!workspaceCourseCode) return null;
    const course =
      courses.find(
        (c) => c.code === workspaceCourseCode || c.id === workspaceCourseCode
      ) ?? null;

    let activeTab = parseTeacherCourseTab(teacherCoursesTab);
    if (pathSegments[0] === 'teacher-courses') {
      if (pathSegments[2] === 'lessons') activeTab = 'lessons';
      if (pathSegments[2] === 'announcements') activeTab = 'announcements';
    } else if (pathSegments[0] === 'teacher-exams') {
      activeTab = 'exams';
    } else if (pathSegments[0] === 'teacher-surveys') {
      activeTab = 'surveys';
    } else if (pathSegments[0] === 'teacher-attendance') {
      activeTab = 'attendance';
    }

    return {
      courseCode: course?.code || workspaceCourseCode,
      courseName: course?.name || workspaceCourseCode,
      subjectLabel: course?.subjectTag || course?.code || workspaceCourseCode,
      activeTab,
    };
  }, [workspaceCourseCode, teacherCoursesTab, courses, pathSegments]);

  useEffect(() => {
    if (isCompactNav) {
      setSidebarOpen(false);
      return;
    }
    // 課程 Hub（含測驗／問卷編輯深頁）：側欄展開並換成課程選單
    if (courseWorkspace) {
      setSidebarOpen(true);
      return;
    }
    setSidebarOpen(!isTeacherCourseWorkspace);
  }, [isCompactNav, isTeacherCourseWorkspace, courseWorkspace]);

  const teacherLessonIdFromUrl = useMemo(() => {
    if (pathSegments[0] !== 'teacher-courses') return '';
    if (pathSegments[2] !== 'lessons' || !pathSegments[3]) return '';
    return decodeURIComponent(pathSegments[3]);
  }, [pathSegments]);

  const teacherAnnouncementIdFromUrl = useMemo(() => {
    if (pathSegments[0] !== 'teacher-courses') return '';
    if (pathSegments[2] !== 'announcements' || !pathSegments[3]) return '';
    return decodeURIComponent(pathSegments[3]);
  }, [pathSegments]);

  const teacherCourseDeepReturnTo = useMemo(() => {
    if (!teacherLessonIdFromUrl && !teacherAnnouncementIdFromUrl) return '';
    return searchParams.get('returnTo') || '';
  }, [teacherLessonIdFromUrl, teacherAnnouncementIdFromUrl, searchParams]);

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
        setAdminStats(EMPTY_ADMIN_STATS);
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

  const renderDashboard = () => {
    if (isAdmin) {
      return (
        <AdminDashboard
          stats={adminStats}
          activeCourseCount={adminStats.activeCourseCount}
          userName={userInfo?.name}
        />
      );
    }

    if (isTeacher) {
      return (
        <TeacherDashboard
          userName={userInfo?.name}
          courses={courses}
        />
      );
    }

    if (isAuthor) {
      const statsCards = [
        { title: '作者工作台', value: '文章／留言', color: 'indigo', icon: <DocumentTextIcon className="h-6 w-6 text-primary" /> },
        { title: '知識庫', value: '可發佈', color: 'purple', icon: <BookOpenIcon className="h-6 w-6 text-tertiary" /> },
        { title: '主題管理', value: '可編輯', color: 'amber', icon: <TagIcon className="h-6 w-6 text-amber-600" /> },
      ];

      const roleLabel = '作者';

      return (
        <div className="page-shell w-full min-w-0 mt-6 animate-fade-in">
          <div className="bg-gradient-to-br from-primary to-tertiary rounded-2xl shadow-elevate p-6 md:p-8 text-white mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-white opacity-10 blur-xl"></div>
            
            <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex-1">
                <h1 className="font-display text-2xl md:text-3xl font-extrabold mb-2 tracking-tight">
                    你好，{userInfo && userInfo.name} {roleLabel}
                </h1>
                <p className="text-primary-fixed text-sm md:text-base font-medium">
                    帳號：{userInfo && userInfo.account}
                </p>
                <p className="text-primary-fixed mt-4 text-sm font-light flex items-center">
                    <CalendarIcon className="w-4 h-4 mr-1" />
                    {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:gap-4 md:gap-6 mb-8 sm:mb-10 grid-cols-3">
            {statsCards.map(card => {
                const colors = getDashboardColorClasses(card.color);
                return (
                  <div key={card.title} className="bg-surface-containerLowest rounded-xl shadow-sm border border-outline-variant/40 p-2.5 sm:p-4 md:p-6 flex flex-col sm:flex-row sm:items-center hover:shadow-md transition-shadow min-w-0">
                    <div className={`hidden sm:flex p-2.5 md:p-3 rounded-lg ${colors.iconBg} sm:mr-4 flex-shrink-0`}>
                        {card.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] sm:text-sm font-medium text-on-surfaceVariant mb-0.5 sm:mb-1 leading-tight">{card.title}</p>
                      <p className="text-base sm:text-2xl font-bold text-on-surface truncate tabular-nums">{card.value}</p>
                    </div>
                  </div>
                );
            })}
          </div>

          <div>
            <h2 className={dashboardSectionTitle}>快速操作</h2>

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
                        ? 'bg-surface-containerLow cursor-not-allowed opacity-60 border-outline-variant/40'
                        : isActive
                          ? action.activeCard
                          : `bg-surface-containerLowest border-outline-variant/40 ${action.cardHover} hover:shadow-lg hover:-translate-y-1 cursor-pointer`
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
    } else if (rawRole === '作者') {
      // 作者不進入授課元件；此映射僅滿足共用 UserInfo 型別
      mappedRole = '老師';
    } else if (Array.isArray(rawRole)) {
      // 陣列情況，判斷是否包含英文 role
      if (rawRole.map(r => r.toLowerCase()).includes('admin')) {
        mappedRole = '管理員';
      } else if (rawRole.map(r => r.toLowerCase()).includes('teacher')) {
        mappedRole = '老師';
      } else if (rawRole.map(r => r.toLowerCase()).includes('author')) {
        mappedRole = '老師';
      } else {
        mappedRole = '學生';
      }
    } else {
      // 英文單一字串情況
      const lower = rawRole?.toLowerCase();
      if (lower === 'admin') mappedRole = '管理員';
      else if (lower === 'teacher') mappedRole = '老師';
      else if (lower === 'author') mappedRole = '老師';
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
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-hover transition-colors"
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
        case 'system-settings':
          return <AdminSystemSettings />;
        case 'password':
          return (
            <PasswordManager
              apiEndpoint="/api/auth/change-password"
              userInfo={
                userInfo
                  ? {
                      id: userInfo.id,
                      name: userInfo.name,
                      account: userInfo.account,
                      role: Array.isArray(userInfo.role)
                        ? getBackPanelRole({
                            id: userInfo.id,
                            account: userInfo.account,
                            name: userInfo.name || '',
                            role: userInfo.role,
                            currentRole: userInfo.currentRole,
                          })
                        : String(userInfo.role),
                    }
                  : undefined
              }
            />
          );
        case 'teacher-courses':
          return (
            <TeacherCourseManager
              userInfo={normalizedUserInfo}
              courses={courses}
              courseCodeFromUrl={teacherCoursesCourseCode}
              tabFromUrl={teacherCoursesTab}
              lessonIdFromUrl={teacherLessonIdFromUrl}
              announcementIdFromUrl={teacherAnnouncementIdFromUrl}
              returnToFromUrl={teacherCourseDeepReturnTo}
              listSearchTerm={teacherCourseSearch}
              onListSearchChange={setTeacherCourseSearch}
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
        case 'blog':
          return isAuthor || isAdmin ? <BlogPostManager /> : null;
        case 'blog-categories':
          return isAuthor || isAdmin ? <BlogCategoryManager /> : null;
        case 'blog-comments':
          return isAuthor || isAdmin ? <BlogCommentManager /> : null;
        default: return null;
      }
    })();

    return (
      <div className="animate-fade-in flex flex-col min-w-0">
        <div className="flex flex-col gap-6">{componentToRender}</div>
      </div>
    );
  };

  const consoleMeta = useMemo(() => {
    const roleLabel = isAdmin ? '管理員' : isTeacher ? '老師' : isAuthor ? '作者' : '後台';
    // 管理員／老師儀表板自帶標題，避免雙重標題
    if (!activeTab && isAdmin) {
      return {
        title: '營運總覽',
        breadcrumbs: [roleLabel, '營運總覽'] as string[],
        hideTopBar: true,
      };
    }
    if (!activeTab && isTeacher) {
      return {
        title: '教學總覽',
        breadcrumbs: [roleLabel, '教學總覽'] as string[],
        hideTopBar: false,
      };
    }
    if (!activeTab) {
      return {
        title: isAuthor ? '創作中心' : '儀表板',
        breadcrumbs: [roleLabel, '儀表板'] as string[],
        hideTopBar: false,
      };
    }
    const item = processedQuickActions.find((a) => a.id === activeTab);
    const title = item?.title || '功能頁';
    return {
      title,
      breadcrumbs: [roleLabel, title] as string[],
      hideTopBar: false,
    };
  }, [activeTab, isAdmin, isTeacher, isAuthor, processedQuickActions]);

  const handleTeacherCourseSearch = useCallback(
    (value: string) => {
      setTeacherCourseSearch(value);
      if (activeTab !== 'teacher-courses' && value.trim()) {
        router.push('/back-panel/teacher-courses');
      }
    },
    [activeTab, router]
  );

  const allSidebarMenuItems = useMemo(() => {
    return processedQuickActions.map(({ id, title, icon, disabled, href }) => ({ id, title, icon, disabled: !!disabled, href }));
  }, [processedQuickActions]);

  return (
    <div className="flex h-full min-w-0 bg-surface overflow-x-hidden">
      <Sidebar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={onToggleSidebar}
        userInfo={userInfo}
        menuItems={allSidebarMenuItems}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        onLogout={handleLogout}
        dashboardHref="/back-panel"
        courseWorkspace={courseWorkspace}
      />

      <div
        className={`flex-1 flex flex-col min-h-0 min-w-0 bg-surface transition-[padding] duration-300 ease-in-out pl-0 ${
          isCompactNav ? '' : sidebarOpen ? 'md:pl-64' : 'md:pl-20'
        }`}
      >
        <ConsoleContainer
          title={consoleMeta.title}
          breadcrumbs={consoleMeta.breadcrumbs}
          hideTopBar={consoleMeta.hideTopBar}
          variant={isTeacher ? 'teacher' : 'default'}
          searchValue={teacherCourseSearch}
          onSearchChange={isTeacher ? handleTeacherCourseSearch : undefined}
          searchPlaceholder="搜尋課程..."
          userName={userInfo?.name}
          userAccount={userInfo?.account}
          userRole="老師"
          onLogout={handleLogout}
          contentMaxWidthClassName={courseWorkspace ? 'max-w-[1600px]' : 'max-w-[1280px]'}
        >
          {renderContent()}
        </ConsoleContainer>
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
