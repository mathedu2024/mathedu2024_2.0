'use client';

import React, { useEffect, useMemo } from 'react';
import Dropdown from './ui/Dropdown';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { isCourseArchived, type ArchivableCourse } from '@/services/courseArchive';

export { isCourseArchived };

export interface CourseShortInfo extends ArchivableCourse {
  id?: string;
  name: string;
  code: string;
}

/** 學生端課程選項的統一 key，與成績、點名等模組一致 */
export const getCourseDisplayKey = (course: { name: string; code: string }): string =>
  `${course.name}(${course.code})`;

export function formatCourseDisplayLabel(key: string): string {
  const match = key.match(/^(.+)\(([^()]+)\)$/);
  if (match) return `${match[1]}（${match[2]}）`;
  return key;
}

export function dedupeCoursesByDisplayKey<T extends CourseShortInfo>(courses: T[]): T[] {
  const seen = new Set<string>();
  return courses.filter((course) => {
    const key = getCourseDisplayKey(course);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

interface StudentCourseSelectorProps {
  courses: CourseShortInfo[];
  selectedCourse: string;
  onChange: (value: string) => void;
  error?: string | null;
  onErrorClear?: () => void;
  label?: string;
  placeholder?: string;
  /** 課程列表載入中時保留已選課程，避免選項暫空導致選取被清掉 */
  loadingCourses?: boolean;
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
  placeholder = "請選擇課程",
  loadingCourses = false,
}: StudentCourseSelectorProps) {
  const activeCourses = useMemo(
    () => dedupeCoursesByDisplayKey(courses).filter((c) => !isCourseArchived(c)),
    [courses]
  );

  const selectorOptions = useMemo(() => {
    const courseOptions = activeCourses.map((course) => ({
      value: getCourseDisplayKey(course),
      label: `${course.name}（${course.code}）`,
    }));

    const extras: { value: string; label: string }[] = [];
    if (selectedCourse && !courseOptions.some((o) => o.value === selectedCourse)) {
      extras.push({
        value: selectedCourse,
        label: formatCourseDisplayLabel(selectedCourse),
      });
    }

    return [{ value: '', label: placeholder }, ...extras, ...courseOptions];
  }, [activeCourses, selectedCourse, placeholder]);

  useEffect(() => {
    if (!selectedCourse || loadingCourses) return;
    const stillActive = activeCourses.some((c) => getCourseDisplayKey(c) === selectedCourse);
    if (!stillActive) onChange('');
  }, [activeCourses, selectedCourse, onChange, loadingCourses]);

  return (
    <div className="mb-6 sm:mb-8 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-100 min-w-0">
      <label className="block text-sm font-bold text-gray-700 mb-2">{label}</label>
      <div className="relative min-w-0">
        <Dropdown
          value={selectedCourse}
          onChange={onChange}
          options={selectorOptions}
          placeholder={placeholder}
          className="w-full md:w-1/3 min-w-0"
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
