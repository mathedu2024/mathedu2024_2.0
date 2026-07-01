'use client';

import React, { useState } from 'react';
import { format, subMonths } from 'date-fns';
import { useStudentInfo } from '../StudentInfoContext';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import { ChatBubbleLeftRightIcon, FunnelIcon } from '@heroicons/react/24/outline';
import TutoringRequest from '@/components/TutoringRequest';
import StudentTutoringHistory from '@/components/StudentTutoringHistory';

const getDefaultDateFrom = () => format(subMonths(new Date(), 1), 'yyyy-MM-dd');
const getDefaultDateTo = () => format(new Date(), 'yyyy-MM-dd');

export default function CounselingContent() {
  const { studentInfo, loading } = useStudentInfo();
  const [activeTab, setActiveTab] = useState<'request' | 'history'>('request');
  const [dateRange, setDateRange] = useState({ from: getDefaultDateFrom(), to: getDefaultDateTo() });

  if (!loading && !studentInfo) {
    return <div className="p-8 text-center text-gray-500">無法取得學生資料</div>;
  }

  return (
    <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10 flex flex-col h-full animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <ChatBubbleLeftRightIcon className="h-8 w-8 text-indigo-600" />
            輔導預約
          </h1>
          <p className="text-gray-500 text-sm mt-1">預約與查看您的課業輔導與諮詢紀錄。</p>
        </div>
      </div>

      {loading ? (
        <PageLoadingArea />
      ) : (
      <>
      {/* Tabs + 篩選器 */}
      <div className="border-b border-gray-100 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <nav className="flex space-x-1">
          <button
            type="button"
            onClick={() => setActiveTab('request')}
            className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${
              activeTab === 'request'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
            }`}
          >
            預約申請
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'
            }`}
          >
            預約紀錄
          </button>
        </nav>

        {activeTab === 'history' && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                className="border border-gray-200 rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white min-w-0"
                aria-label="起始日期"
              />
              <span className="text-gray-400 flex-shrink-0">~</span>
              <input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                className="border border-gray-200 rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white min-w-0"
                aria-label="結束日期"
              />
            </div>
            <button
              type="button"
              onClick={() => setDateRange({ from: getDefaultDateFrom(), to: getDefaultDateTo() })}
              className="text-xs font-medium text-gray-700 sm:text-gray-500 hover:text-indigo-600 px-3 py-2 sm:py-1.5 bg-gray-100 sm:bg-transparent hover:bg-gray-200 sm:hover:bg-gray-100 rounded-lg transition-colors whitespace-nowrap"
            >
              重設為近一個月
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {activeTab === 'request' ? (
        <TutoringRequest />
      ) : (
        <StudentTutoringHistory
          userInfo={{
            ...studentInfo,
            account: studentInfo.account || '',
            role: studentInfo.role || 'student',
          }}
          dateRange={dateRange}
        />
      )}
      </>
      )}
    </div>
  );
}