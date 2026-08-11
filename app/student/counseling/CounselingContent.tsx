'use client';

import React, { useState } from 'react';
import { format, subMonths } from 'date-fns';
import { useStudentInfo } from '../StudentInfoContext';
import { ChatBubbleLeftRightIcon, FunnelIcon } from '@heroicons/react/24/outline';
import TutoringRequest from '@/components/TutoringRequest';
import StudentTutoringHistory from '@/components/StudentTutoringHistory';
import { TabNav, btnSmall } from '@/components/ui';

const RETENTION_MONTHS = 3;

const getDefaultDateFrom = () => format(subMonths(new Date(), 1), 'yyyy-MM-dd');
const getDefaultDateTo = () => format(new Date(), 'yyyy-MM-dd');
const getMinDateFrom = () => format(subMonths(new Date(), RETENTION_MONTHS), 'yyyy-MM-dd');

export default function CounselingContent() {
  const { studentInfo } = useStudentInfo();
  const [activeTab, setActiveTab] = useState<'request' | 'history'>('request');
  const [dateRange, setDateRange] = useState({ from: getDefaultDateFrom(), to: getDefaultDateTo() });

  if (!studentInfo) {
    return <div className="p-8 text-center text-on-surfaceVariant">無法取得學生資料</div>;
  }

  return (
    <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10 flex flex-col h-full animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="border-l-4 border-primary pl-4">
          <h1 className="font-display text-2xl font-extrabold text-on-surface flex items-center gap-3">
            <ChatBubbleLeftRightIcon className="h-8 w-8 text-primary" />
            輔導預約
          </h1>
          <p className="text-on-surfaceVariant text-sm mt-1">
            預約老師或助教的輔導時段
          </p>
        </div>
      </div>

      <TabNav
        items={[
          { id: 'request', label: '預約申請' },
          { id: 'history', label: '預約紀錄' },
        ]}
        activeId={activeTab}
        onChange={(id) => setActiveTab(id as 'request' | 'history')}
        trailing={
          activeTab === 'history' ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <FunnelIcon className="w-4 h-4 text-on-surfaceVariant flex-shrink-0" />
                <input
                  type="date"
                  value={dateRange.from}
                  min={getMinDateFrom()}
                  max={dateRange.to}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, from: e.target.value }))}
                  className="border border-outline-variant/40 rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-white min-w-0"
                  aria-label="起始日期"
                />
                <span className="text-on-surfaceVariant flex-shrink-0">~</span>
                <input
                  type="date"
                  value={dateRange.to}
                  min={dateRange.from}
                  max={getDefaultDateTo()}
                  onChange={(e) => setDateRange((prev) => ({ ...prev, to: e.target.value }))}
                  className="border border-outline-variant/40 rounded-lg px-2 sm:px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary focus:border-transparent bg-white min-w-0"
                  aria-label="結束日期"
                />
              </div>
              <button
                type="button"
                onClick={() => setDateRange({ from: getDefaultDateFrom(), to: getDefaultDateTo() })}
                className={btnSmall.ghost}
              >
                重設為近一個月
              </button>
            </div>
          ) : undefined
        }
      />

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
    </div>
  );
}