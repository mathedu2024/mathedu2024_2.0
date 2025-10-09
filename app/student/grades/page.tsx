'use client';

import React from 'react';
import { useStudentInfo } from '../StudentInfoContext';
import StudentGradeViewer from '../../components/StudentGradeViewer';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function StudentGradesPage() {
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
    <div className="w-full p-2 md:p-8">
      <StudentGradeViewer studentInfo={studentInfo} />
    </div>
  );
}