'use client';

import React from 'react';
import Dropdown from './ui/Dropdown';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';

interface CourseShortInfo {
  name: string;
  code: string;
  status?: string;
  archived?: boolean;
}

const isCourseArchived = (course: CourseShortInfo): boolean => course.archived === true || String(course.archived) === 'true';

interface StudentCourseSelectorProps {
  courses: CourseShortInfo[];
  selectedCourse: string;
  onChange: (value: string) => void;
  error?: string | null;
  onErrorClear?: () => void;
  label?: string;
  placeholder?: string;
}

/**
 * 學生端專用的課程選擇器模組
 * 自動過濾已封存課程，並處理錯誤訊息顯示
 */
export default function StudentCourseSelector({
  courses,
  selectedCourse,
  onChange,
  error,
  onErrorClear,
  label = "選擇課程",
  placeholder = "請選擇課程"
}: StudentCourseSelectorProps) {
  return (
    <div className="mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
      <div className="relative">
        <Dropdown
          value={selectedCourse}
          onChange={onChange}
          options={[
            { value: '', label: placeholder },
            ...courses
              .filter(course => course && course.status !== '已封存' && !isCourseArchived(course))
              .map(course => ({
                value: `${course.name}(${course.code})`,
                label: `${course.name}（${course.code}）`
              }))
          ]}
          placeholder={placeholder}
          className="w-full md:w-1/3 min-w-[280px]"
        />
      </div>
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start">
          <ExclamationCircleIcon className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-700 text-sm font-medium">{error}</p>
            {onErrorClear && (
              <button 
                onClick={onErrorClear} 
                className="mt-1 text-red-500 hover:text-red-700 text-xs font-semibold underline"
              >
                關閉訊息
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}