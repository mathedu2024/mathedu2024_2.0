'use client';

import React from 'react';
import { ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import { useStudentInfo } from '../StudentInfoContext';
import StudentGradeViewer from '@/components/StudentGradeViewer';
import PageLoadingArea from '@/components/ui/PageLoadingArea';

interface GradesContentProps {
  courseCodeFromUrl?: string;
}

export default function GradesContent({ courseCodeFromUrl = '' }: GradesContentProps) {
  const { studentInfo, loading } = useStudentInfo();

  if (!loading && !studentInfo) {
    return (
      <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-16 flex flex-col min-h-full animate-fade-in">
        <div className="flex items-center justify-center py-16">
          <div className="text-gray-500">找不到學生資料，請重新登入。</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-16 flex flex-col min-h-full animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
            <ClipboardDocumentListIcon className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-600 shrink-0" />
            成績查詢
          </h1>
          <p className="text-gray-500 text-sm mt-1">查看您的各項測驗與考試成績紀錄。</p>
        </div>
      </div>

      {loading || !studentInfo ? (
        <PageLoadingArea />
      ) : (
        <StudentGradeViewer
          studentInfo={studentInfo}
          courseCodeFromUrl={courseCodeFromUrl}
        />
      )}
    </div>
  );
}
