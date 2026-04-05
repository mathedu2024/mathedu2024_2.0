'use client';
import React, { Suspense, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BookOpenIcon, 
  ClipboardDocumentListIcon, 
  CheckCircleIcon, 
  PencilIcon, 
  CalendarIcon, 
  SparklesIcon,
  UserCircleIcon
} from '@heroicons/react/24/outline';

import LoadingSpinner from '@/components/LoadingSpinner';
import { useStudentInfo } from './StudentInfoContext';

interface MinimalCourse {
  name: string;
  status?: string;
  archived?: boolean | string;
}

export default function StudentPanel() {
  const router = useRouter();
  const { studentInfo, loading } = useStudentInfo();
  const [activeCourseCount, setActiveCourseCount] = useState<number | null>(null);

  // 取得並計算非封存的課程數量
  useEffect(() => {
    const fetchActiveCourses = async () => {
      if (!studentInfo?.id) return;
      try {
        // 使用 dashboard-data API，這通常包含完整的課程物件資訊，比單純的 ID 列表更準確
        const response = await fetch('/api/student/dashboard-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: studentInfo.id }),
        });

        if (response.ok) {
          const data = await response.json();
          // 嚴格過濾邏輯：排除狀態為「已封存」或標記為 archived 的課程
          const activeCourses = (data.courses || [])
            .filter((c: MinimalCourse) => c && c.status !== '已封存' && c.archived !== true && String(c.archived) !== 'true');
          setActiveCourseCount(activeCourses.length);
        }
      } catch (error) {
        console.error('無法獲取有效課程數量:', error);
      }
    };

    fetchActiveCourses();
  }, [studentInfo?.id]);

  const studentQuickActions = [
    { id: 'courses', title: '我的課程', description: '查看課程內容與進度', icon: <BookOpenIcon className="h-6 w-6" />, onClick: () => router.push('/student/courses'), disabled: false },
    { id: 'grades', title: '成績查詢', description: '查看各科成績與評量', icon: <ClipboardDocumentListIcon className="h-6 w-6" />, onClick: () => router.push('/student/grades'), disabled: false },
    { id: 'counseling', title: '輔導預約', description: '預約老師或助教的輔導時段', icon: <CalendarIcon className="h-6 w-6" />, onClick: () => router.push('/student/counseling'), disabled: false },
    { id: 'information', title: '個人資料', description: '查看個人資料與修改密碼', icon: <UserCircleIcon className="h-6 w-6" />, onClick: () => router.push('/student/information'), disabled: false },
    { id: 'attendance', title: '線上點名', description: '查看點名記錄與狀態', icon: <CheckCircleIcon className="h-6 w-6" />, onClick: () => router.push('/student/attendance'), disabled: false },
    { id: 'exam', title: '線上測驗', description: '功能暫時關閉', icon: <PencilIcon className="h-6 w-6" />, onClick: () => {}, disabled: true },
  ];

  // 修正: 只有在載入中且尚未取得資料時才顯示載入動畫，避免資料已讀取但 loading 狀態卡住導致畫面無法顯示
  if (loading && studentInfo === null) {
    return <LoadingSpinner fullScreen size={40} />;
  }
  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
      {/* 歡迎橫幅 */}
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl shadow-xl p-8 text-white mb-10 animate-fade-in relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-white opacity-10 rounded-full blur-3xl"></div>
        
        <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 flex items-center">
                歡迎回來，{studentInfo?.name}！ <span className="ml-2 text-2xl">👋</span>
            </h1>
            <div className="flex flex-col sm:flex-row gap-4 text-indigo-100">
                <p className="flex items-center"><span className="bg-indigo-500/30 px-2 py-1 rounded-md text-sm mr-2 border border-indigo-400/30">學號</span> {studentInfo?.studentId}</p>
                <p className="hidden sm:block">|</p>
                <p>{new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
            </div>
          </div>
          <div className="text-center lg:text-right bg-white/10 backdrop-blur-sm p-4 rounded-xl border border-white/20">
            <div className="flex items-center gap-3">
                 <div className="p-2 bg-indigo-500 rounded-lg"><SparklesIcon className="w-6 h-6 text-yellow-300" /></div>
                 <div className="text-left">
                     <p className="text-xs text-indigo-200 font-medium uppercase tracking-wider">今日狀態</p>
                     <p className="text-white font-bold">學習愉快！</p>
                 </div>
            </div>
          </div>
        </div>
      </div>
      {/* 統計概覽 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-bold text-gray-500 mb-1">已選課程</p>
                <p className="text-3xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                  {/* 移除對 context 原始長度的依賴，未讀取完前顯示 ... 以免顯示錯誤數字 */}
                  {activeCourseCount !== null ? activeCourseCount : '...'}
                </p>
            </div>
            <div className="p-4 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <BookOpenIcon className="h-6 w-6" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-bold text-gray-500 mb-1">成績查詢</p>
                <p className="text-3xl font-bold text-gray-900 group-hover:text-emerald-600 transition-colors">可查看</p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <ClipboardDocumentListIcon className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-bold text-gray-500 mb-1">輔導預約</p>
                <p className="text-3xl font-bold text-gray-900 group-hover:text-amber-500 transition-colors">開放中</p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                <CalendarIcon className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 border border-gray-100 hover:shadow-md transition-shadow group">
          <div className="flex items-center justify-between">
            <div>
                <p className="text-sm font-bold text-gray-500 mb-1">個人資料</p>
                <p className="text-3xl font-bold text-gray-900 group-hover:text-violet-600 transition-colors">可檢視</p>
            </div>
            <div className="p-4 rounded-xl bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-colors">
                <UserCircleIcon className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* 快速操作 Grid */}
      <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center">
            <span className="w-1.5 h-6 bg-indigo-600 rounded-full mr-3"></span>
            快速操作
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {studentQuickActions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled}
              className={`text-left p-6 rounded-2xl border transition-all duration-300 flex items-center group ${
                action.disabled
                  ? 'bg-gray-50 cursor-not-allowed opacity-60 border-gray-100'
                  : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-lg hover:-translate-y-1'
              }`}
            >
              <div className={`p-4 rounded-xl mr-5 transition-colors ${
                  action.disabled ? 'bg-gray-200 text-gray-400' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white'
              }`}>
                {action.icon}
              </div>
              <div>
                <h3 className={`text-lg font-bold ${action.disabled ? 'text-gray-500' : 'text-gray-900 group-hover:text-indigo-700'}`}>{action.title}</h3>
                <p className={`text-sm mt-1 ${action.disabled ? 'text-gray-400' : 'text-gray-500'}`}>{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center">
            <LoadingSpinner size={40} text="載入學生面板..." />
          </div>
        }
      >
      </Suspense>
    </div>
  );
}