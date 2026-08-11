'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BookOpenIcon, 
  ChatBubbleLeftRightIcon,
  SparklesIcon,
  UserCircleIcon,
  CloudArrowDownIcon
} from '@heroicons/react/24/outline';

import PageLoadingArea from '../components/ui/PageLoadingArea';
import CourseActivityFeed from '../components/CourseActivityFeed';
import LiveAttendanceBanner from '../components/LiveAttendanceBanner';
import DashboardTodoSummary from '../components/DashboardTodoSummary';
import { useStudentInfo } from './StudentInfoContext';
import { fetchStudentDashboardData } from '@/utils/studentClientApi';
import { getDashboardColorClasses, type DashboardColor } from '@/utils/dashboardColors';
import { useHydrated } from '@/utils/useHydrated';
import { dashboardSectionTitle } from '@/components/ui/dashboardChrome';

interface MinimalCourse {
  name: string;
  status?: string;
  archived?: boolean | string;
}

export default function StudentPanel() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { studentInfo, loading } = useStudentInfo();
  const [activeCourseCount, setActiveCourseCount] = useState<number | null>(null);
  const [todayLabel, setTodayLabel] = useState('');

  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      })
    );
  }, []);

  useEffect(() => {
    const studentId = studentInfo?.id;
    if (!studentId) return;

    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchStudentDashboardData(studentId, { coursesOnly: true });
        if (cancelled) return;
        const activeCourses = (data.courses || [])
          .filter((c: MinimalCourse) => c && c.status !== '已封存' && c.archived !== true && String(c.archived) !== 'true');
        setActiveCourseCount(activeCourses.length);
      } catch (error) {
        console.error('無法獲取有效課程數量:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [studentInfo?.id]);

  const studentQuickActions = useMemo(() => {
    const items: {
      id: string;
      title: string;
      description: string;
      icon: React.ReactElement;
      color: DashboardColor;
      onClick: () => void;
      disabled: boolean;
    }[] = [
      { id: 'courses', title: '我的課程', description: '查看課程內容與進度', icon: <BookOpenIcon className="h-6 w-6" />, color: 'indigo', onClick: () => router.push('/student/courses'), disabled: false },
      { id: 'resources', title: '線上資源', description: '搜尋與下載教學資源', icon: <CloudArrowDownIcon className="h-6 w-6" />, color: 'purple', onClick: () => router.push('/student/resources'), disabled: false },
      { id: 'counseling', title: '輔導預約', description: '預約老師或助教的輔導時段', icon: <ChatBubbleLeftRightIcon className="h-6 w-6" />, color: 'amber', onClick: () => router.push('/student/counseling'), disabled: false },
      { id: 'information', title: '個人資料', description: '查看個人資料與修改密碼', icon: <UserCircleIcon className="h-6 w-6" />, color: 'violet', onClick: () => router.push('/student/information'), disabled: false },
    ];

    return items.map(item => {
      const style = getDashboardColorClasses(item.color);
      const icon = React.isValidElement(item.icon)
        ? React.cloneElement(item.icon as React.ReactElement<React.SVGProps<SVGSVGElement>>, {
            className: 'h-6 w-6',
          })
        : item.icon;
      return { ...item, ...style, icon };
    });
  }, [router]);

  if (!hydrated || loading || !studentInfo) {
    return (
      <div className="page-shell w-full min-w-0 py-4 sm:py-6 md:py-8">
        <PageLoadingArea minHeight="min-h-[50vh]" />
      </div>
    );
  }

  return (
    <div className="page-shell w-full min-w-0 py-4 sm:py-6 md:py-8">
      {/* 歡迎橫幅 */}
      <div className="bg-gradient-to-br from-primary to-tertiary rounded-2xl shadow-xl p-5 sm:p-8 text-white mb-6 sm:mb-10 animate-fade-in relative overflow-hidden min-w-0">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
        
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex-1">
            <h1 className="font-display text-xl sm:text-2xl md:text-4xl font-extrabold mb-3 flex flex-wrap items-center gap-1 sm:gap-2 tracking-tight">
                歡迎回來，{studentInfo?.name}！
            </h1>
            <div className="flex flex-col sm:flex-row gap-4 text-primary-fixed">
                <p className="flex items-center"><span className="bg-white/20 px-2 py-1 rounded-md text-sm mr-2 border border-white/30 font-mono">學號</span> {studentInfo?.studentId}</p>
                <p className="hidden sm:block opacity-60">|</p>
                <p>{todayLabel || '\u00A0'}</p>
            </div>
          </div>
          <div className="text-center lg:text-right bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
            <div className="flex items-center gap-3">
                 <div className="p-2 bg-white/20 rounded-lg"><SparklesIcon className="w-6 h-6 text-yellow-300" /></div>
                 <div className="text-left">
                     <p className="text-xs text-primary-fixed font-mono font-semibold uppercase tracking-wider">今日狀態</p>
                     <p className="text-white font-bold">學習愉快！</p>
                 </div>
            </div>
          </div>
        </div>
      </div>
      {/* 統計概覽：固定 1×3，不隨視窗改列 */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4 md:gap-6 mb-8 sm:mb-10 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-3 sm:p-6 border border-outline-variant/40 hover:shadow-md transition-shadow group min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
                <p className="text-[10px] sm:text-sm font-bold text-on-surfaceVariant mb-0.5 sm:mb-1">已選課程</p>
                <p className="text-xl sm:text-3xl font-bold text-on-surface group-hover:text-primary transition-colors tabular-nums">
                  {activeCourseCount !== null ? activeCourseCount : '...'}
                </p>
            </div>
            <div className="hidden sm:block p-4 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                <BookOpenIcon className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-3 sm:p-6 border border-outline-variant/40 hover:shadow-md transition-shadow group min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
                <p className="text-[10px] sm:text-sm font-bold text-on-surfaceVariant mb-0.5 sm:mb-1">輔導預約</p>
                <p className="text-xl sm:text-3xl font-bold text-on-surface group-hover:text-primary transition-colors">開放中</p>
            </div>
            <div className="hidden sm:block p-4 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                <ChatBubbleLeftRightIcon className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm p-3 sm:p-6 border border-outline-variant/40 hover:shadow-md transition-shadow group min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="min-w-0">
                <p className="text-[10px] sm:text-sm font-bold text-on-surfaceVariant mb-0.5 sm:mb-1">個人資料</p>
                <p className="text-xl sm:text-3xl font-bold text-on-surface group-hover:text-primary transition-colors">可檢視</p>
            </div>
            <div className="hidden sm:block p-4 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors shrink-0">
                <UserCircleIcon className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* 快速操作 Grid */}
      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <h2 className={dashboardSectionTitle}>快速操作</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {studentQuickActions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled}
              className={`text-left p-6 rounded-2xl border transition-all duration-300 flex items-center group ${
                action.disabled
                  ? 'bg-surface cursor-not-allowed opacity-60 border-outline-variant/40'
                  : `bg-white border-outline-variant/40 ${action.cardHover} hover:shadow-lg hover:-translate-y-1`
              }`}
            >
              <div className={`p-4 rounded-xl mr-5 flex-shrink-0 relative z-10 transition-colors [&_svg]:text-current ${
                  action.disabled ? 'bg-surface-containerHigh text-on-surfaceVariant' : `${action.iconBg} ${action.iconText} ${action.iconHover}`
              }`}>
                {action.icon}
              </div>
              <div className="min-w-0">
                <h3 className={`text-lg font-bold ${action.disabled ? 'text-on-surfaceVariant' : `text-on-surface ${action.titleHover}`}`}>{action.title}</h3>
                <p className={`text-sm mt-1 ${action.disabled ? 'text-on-surfaceVariant' : 'text-on-surfaceVariant'}`}>{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 sm:mt-10">
        <DashboardTodoSummary audience="student" />
        <LiveAttendanceBanner audience="student" />
        <CourseActivityFeed audience="student" />
      </div>

    </div>
  );
}