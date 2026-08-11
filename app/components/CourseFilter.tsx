'use client';

import React, { useState } from 'react';
import { FunnelIcon, ChevronDownIcon, MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import Dropdown from './ui/Dropdown';

const grades = ['國一', '國二', '國三', '高一', '高二', '高三', '職一', '職二', '職三', '大一', '進修'];
const subjects = ['數學', '理化', '物理', '化學', '生物'];
const courseNatures = ['進度課程', '升學考試複習', '檢定/考試訓練班'];
const statuses = ['未開課', '開課中', '已結束', '已封存'];

const gradeOptions = [{ value: 'all', label: '全部年級' }, ...grades.map(g => ({ value: g, label: g }))];
const subjectOptions = [{ value: 'all', label: '全部科目' }, ...subjects.map(s => ({ value: s, label: s }))];
const natureOptions = [{ value: 'all', label: '全部性質' }, ...courseNatures.map(n => ({ value: n, label: n }))];
const statusOptions = [{ value: 'all', label: '全部狀態' }, ...statuses.map(s => ({ value: s, label: s }))];

interface CourseFilterProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedGrade: string;
  onGradeChange: (value: string) => void;
  selectedSubject: string;
  onSubjectChange: (value: string) => void;
  selectedNature: string;
  onNatureChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  onReset: () => void;
  /** 學生端僅顯示科目與狀態篩選 */
  variant?: 'teacher' | 'student';
}

export default function CourseFilter({
  searchTerm,
  onSearchChange,
  selectedGrade,
  onGradeChange,
  selectedSubject,
  onSubjectChange,
  selectedNature,
  onNatureChange,
  selectedStatus,
  onStatusChange,
  onReset,
  variant = 'teacher',
}: CourseFilterProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mb-6">
      {/* 手機版：展開/收合觸發按鈕 */}
      <div className="md:hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between bg-white px-5 py-4 rounded-xl shadow-sm border border-gray-100 transition-all active:scale-[0.99]"
        >
          <span className="font-bold text-gray-700 flex items-center text-sm">
            <FunnelIcon className="w-5 h-5 mr-2 text-indigo-500" />
            條件篩選與搜尋
          </span>
          <ChevronDownIcon 
            className={`w-5 h-5 text-gray-400 transform transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
          />
        </button>
      </div>

      {/* 篩選器內容：手機版具備收合動畫，電腦版保持顯示 */}
      <div className={`
        mt-3 md:mt-0 transition-all duration-300 ease-in-out md:overflow-visible relative z-[60]
        ${isOpen ? 'max-h-[1000px] opacity-100 overflow-visible' : 'max-h-0 md:max-h-none opacity-0 md:opacity-100 overflow-hidden'}
      `}>
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col xl:flex-row xl:items-center gap-4">
          <div className="flex flex-col sm:flex-row flex-wrap gap-4 shrink-0">
            {variant === 'teacher' && (
              <Dropdown
                value={selectedGrade}
                onChange={onGradeChange}
                options={gradeOptions}
                placeholder="全部年級"
                className="w-full sm:w-40"
              />
            )}
            <Dropdown
              value={selectedSubject}
              onChange={onSubjectChange}
              options={subjectOptions}
              placeholder="全部科目"
              className="w-full sm:w-40"
            />
            {variant === 'teacher' && (
              <Dropdown
                value={selectedNature}
                onChange={onNatureChange}
                options={natureOptions}
                placeholder="全部性質"
                className="w-full sm:w-40"
              />
            )}
            <Dropdown
              value={selectedStatus}
              onChange={onStatusChange}
              options={statusOptions}
              placeholder="全部狀態"
              className="w-full sm:w-40"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 flex-1 min-w-0 w-full">
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                placeholder="搜尋課程名稱..."
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl bg-white text-gray-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm outline-none text-sm"
              />
              <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
            <button
              onClick={onReset}
              className="w-full sm:w-auto shrink-0 px-5 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors font-medium whitespace-nowrap flex items-center justify-center text-sm shadow-sm"
            >
              <ArrowPathIcon className="w-4 h-4 mr-1.5" />
              重置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
