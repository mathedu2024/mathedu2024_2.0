'use client';

import React from 'react';
import Dropdown from './Dropdown';

const grades = ['國一', '國二', '國三', '高一', '高二', '高三', '職一', '職二', '職三', '大一', '進修'];
const subjects = ['數學', '理化', '物理', '化學', '生物'];
const courseNatures = ['進度課程', '升學考試複習', '檢定/考試訓練班'];
const statuses = ['未開課', '報名中', '開課中', '已額滿', '已結束', '已封存', '資料建置中...'];

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
  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row flex-wrap gap-4 items-center">
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
      <div className="w-full md:w-auto flex-1">
        <input
          type="text"
          placeholder="搜尋課程名稱..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
        />
      </div>
      <button
        onClick={onReset}
        className="w-full md:w-auto px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl hover:bg-gray-200 transition-colors font-medium whitespace-nowrap"
      >
        重置
      </button>
    </div>
  );
}