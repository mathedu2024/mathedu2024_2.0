'use client';

import React, { useState } from 'react';
import Dropdown from './Dropdown';
import { FunnelIcon, ChevronDownIcon, MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const grades = ['國一', '國二', '國三', '高一', '高二', '高三', '職一', '職二', '職三', '大一', '進修'];
const subjects = ['數學', '理化', '物理', '化學', '生物'];
const courseNatures = ['進度課程', '升學考試複習', '檢定/考試訓練班'];
const statuses = ['未開課', '開課中', '已結束', '已封存'];

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
  onReset
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
        mt-3 md:mt-0 transition-all duration-300 ease-in-out md:overflow-visible
        ${isOpen ? 'max-h-[1000px] opacity-100 overflow-visible' : 'max-h-0 md:max-h-none opacity-0 md:opacity-100 overflow-hidden'}
      `}>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row flex-wrap gap-4 items-center">
          <div className="w-full md:w-48 flex-shrink-0">
            <Dropdown
              value={selectedGrade}
              onChange={onGradeChange}
              options={[{ value: 'all', label: '全部年級' }, ...grades.map(g => ({ value: g, label: g }))]}
              placeholder="全部年級"
              className="w-full"
            />
          </div>
          <div className="w-full md:w-48 flex-shrink-0">
            <Dropdown
              value={selectedSubject}
              onChange={onSubjectChange}
              options={[{ value: 'all', label: '全部科目' }, ...subjects.map(s => ({ value: s, label: s }))]}
              placeholder="全部科目"
              className="w-full"
            />
          </div>
          <div className="w-full md:w-48 flex-shrink-0">
            <Dropdown
              value={selectedNature}
              onChange={onNatureChange}
              options={[{ value: 'all', label: '全部性質' }, ...courseNatures.map(n => ({ value: n, label: n }))]}
              placeholder="全部性質"
              className="w-full"
            />
          </div>
          <div className="w-full md:w-48 flex-shrink-0">
            <Dropdown
              value={selectedStatus}
              onChange={onStatusChange}
              options={[{ value: 'all', label: '全部狀態' }, ...statuses.map(s => ({ value: s, label: s }))]}
              placeholder="全部狀態"
              className="w-full"
            />
          </div>
          <div className="w-full md:w-auto flex-1 relative">
            <input
              type="text"
              placeholder="搜尋課程名稱..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-sm"
            />
            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          </div>
          <button
            onClick={onReset}
            className="w-full md:w-auto px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors font-medium whitespace-nowrap flex items-center justify-center text-sm"
          >
            <ArrowPathIcon className="w-4 h-4 mr-1.5" />
            重置
          </button>
        </div>
      </div>
    </div>
  );
}