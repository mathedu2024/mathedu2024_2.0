'use client';

import React, { useState } from 'react';
import { useStudentInfo } from '../StudentInfoContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline';
import TutoringRequest from '@/components/TutoringRequest';
import StudentTutoringHistory from '@/components/StudentTutoringHistory';

export default function CounselingContent() {
  const { studentInfo, loading } = useStudentInfo();
  const [activeTab, setActiveTab] = useState<'request' | 'history'>('request');

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!studentInfo) {
    return <div className="p-8 text-center text-gray-500">無法取得學生資料</div>;
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-6 md:pt-8 pb-10 flex flex-col h-full animate-fade-in">
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

      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        <button
          onClick={() => setActiveTab('request')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'request'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          預約申請
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
            activeTab === 'history'
              ? 'bg-white text-indigo-600 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          預約紀錄
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        {activeTab === 'request' ? (
          <TutoringRequest />
        ) : (
          <StudentTutoringHistory userInfo={{
            ...studentInfo, 
            account: studentInfo.account || '',
            role: studentInfo.role || 'student'
          }} />
        )}
      </div>
    </div>
  );
}