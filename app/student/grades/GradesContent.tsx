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
    <div className="max-w-7xl mx-auto w-full p-4 md:p-8 animate-fade-in">
      <div className="flex items-center mb-8">
        <ClipboardDocumentListIcon className="w-8 h-8 text-indigo-600 mr-3" />
        <h2 className="text-2xl font-bold text-gray-900">成績查詢</h2>
      </div>
      <StudentGradeViewer studentInfo={studentInfo} />
    </div>
  );
}