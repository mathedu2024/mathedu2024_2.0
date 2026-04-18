'use client';

import React from 'react';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { useStudentInfo } from '../StudentInfoContext';
import StudentGradeViewer from '@/components/StudentGradeViewer';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function GradesContent() {
  const { studentInfo, loading } = useStudentInfo();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!studentInfo) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">找不到學生資料，請重新登入。</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-6 md:pt-8 pb-10 flex flex-col h-full animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <ClipboardDocumentListIcon className="h-8 w-8 text-indigo-600" />
            成績查詢
          </h1>
          <p className="text-gray-500 text-sm mt-1">查看您的各項測驗與考試成績紀錄。</p>
        </div>
      </div>
      <StudentGradeViewer studentInfo={studentInfo} />
    </div>
  );
}