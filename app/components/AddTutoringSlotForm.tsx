'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import MultiSelectDropdown from './MultiSelectDropdown';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { isCourseArchived } from './StudentCourseSelector';

interface Course {
  name: string;
  status?: string;
  archived?: boolean | string;
}

interface AddTutoringSlotFormProps {
  onClose: () => void;
  onSave: (data: { grades: string[]; subjects: string[]; classes: string[] }) => void;
  courses: Course[];
}

const gradeOptions = [
  { label: '國一', value: '國一' },
  { label: '國二', value: '國二' },
  { label: '國三', value: '國三' },
  { label: '高一', value: '高一' },
  { label: '高二', value: '高二' },
  { label: '高三', value: '高三' },
];

const subjectOptions = [
  { label: '數學', value: '數學' },
  { label: '英文', value: '英文' },
  { label: '物理', value: '物理' },
  { label: '化學', value: '化學' },
  { label: '生物', value: '生物' },
  { label: '國文', value: '國文' },
];

const AddTutoringSlotForm: React.FC<AddTutoringSlotFormProps> = ({ onClose, onSave, courses }) => {
  const [mounted, setMounted] = useState(false);
  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);

    // 開啟時鎖定背景滾動
    document.body.style.overflow = 'hidden';

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);

    return () => {
      setMounted(false);
      // 關閉時恢復背景滾動
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // 動態生成班級選項，排除已封存的課程
  const classOptions = useMemo(() => {
    return (courses || [])
      .filter(course => course && !isCourseArchived(course))
      .map(course => ({
        label: course.name,
        value: course.name
      }));
  }, [courses]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedGrades.length === 0 || selectedSubjects.length === 0 || selectedClasses.length === 0) return;
    onSave({ grades: selectedGrades, subjects: selectedSubjects, classes: selectedClasses });
  };

  const isFormValid = selectedGrades.length > 0 && selectedSubjects.length > 0 && selectedClasses.length > 0;

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {/* 半透明深色背景遮罩 */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity animate-fade-in" 
        onClick={onClose}
      />
      
      {/* 表單主體容器 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden animate-bounce-in transform scale-100">
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 flex justify-between items-center text-white flex-shrink-0">
          <h2 className="text-xl font-bold flex items-center">新增輔導時段</h2>
          <button 
            onClick={onClose} 
            className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">年級</label>
              <MultiSelectDropdown
                  options={gradeOptions}
                  selectedOptions={selectedGrades}
                  onChange={setSelectedGrades}
                  placeholder="選擇年級"
                  className="w-full"
              />
            </div>
          <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">科目</label>
              <MultiSelectDropdown
                  options={subjectOptions}
                  selectedOptions={selectedSubjects}
                  onChange={setSelectedSubjects}
                  placeholder="選擇科目"
                  className="w-full"
              />
          </div>
          <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">班級</label>
              <MultiSelectDropdown
                  options={classOptions}
                  selectedOptions={selectedClasses}
                  onChange={setSelectedClasses}
                  placeholder="選擇班級"
                  className="w-full"
              />
            </div>
          </div>
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2 flex-shrink-0">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              取消
            </button>
            <button 
              type="submit" 
              disabled={!isFormValid}
              className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              儲存
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default AddTutoringSlotForm;