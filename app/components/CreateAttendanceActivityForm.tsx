'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Swal from 'sweetalert2';

// --- Types & Interfaces ---

export interface AttendanceActivity {
  id: string;
  title: string;
  checkInMethod: 'numeric' | 'manual';
  checkInCode?: string;
  status: 'active' | 'ended' | 'scheduled';
  startTime: string;
  endTime?: string;
  gracePeriodMinutes?: number;
}

interface CreateAttendanceActivityFormProps {
  courseId: string;
  onComplete: (activity: AttendanceActivity) => void;
  initialData?: AttendanceActivity;
  onClose: () => void;
}

type CreationMode = 'instant' | 'scheduled';

// --- Local Components ---

interface DropdownProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

const Dropdown = ({ 
  value, 
  onChange, 
  options, 
  className = "",
  placeholder = "請選擇",
  disabled = false
}: DropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`flex items-center justify-between w-full px-4 py-2.5 text-left border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm shadow-sm ${disabled ? 'opacity-60 cursor-not-allowed bg-gray-50' : 'cursor-pointer'}`}
      >
        <span className={`truncate ${selectedOption ? 'text-gray-900' : 'text-gray-500'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="w-5 h-5 text-gray-400 pointer-events-none">
          <path fillRule="evenodd" d="M10.53 3.47a.75.75 0 0 0-1.06 0L6.22 6.72a.75.75 0 0 0 1.06 1.06L10 5.06l2.72 2.72a.75.75 0 1 0 1.06-1.06l-3.25-3.25Zm-4.31 9.81 3.25 3.25a.75.75 0 0 0 1.06 0l3.25-3.25a.75.75 0 1 0-1.06-1.06L10 14.94l-2.72-2.72a.75.75 0 0 0-1.06 1.06Z" clipRule="evenodd"></path>
        </svg>
      </button>

      {isOpen && (
        <ul className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-auto focus:outline-none py-1 text-sm">
          {options.map((opt) => (
            <li
              key={opt.value}
              className={`cursor-pointer select-none relative py-2 pl-3 pr-9 hover:bg-indigo-50 transition-colors ${opt.value === value ? 'text-indigo-900 font-semibold bg-indigo-50' : 'text-gray-900'}`}
              onClick={() => handleSelect(opt.value)}
            >
              <span className="block truncate">{opt.label}</span>
              {opt.value === value && (
                <span className="absolute inset-y-0 right-0 flex items-center pr-4 text-indigo-600">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// --- Main Component ---

const checkInMethodOptions = [
  { value: 'numeric', label: '數字點名' },
  { value: 'manual', label: '手動點名' },
];

const creationModeOptions = [
  { value: 'instant', label: '即時點名' },
  { value: 'scheduled', label: '預約點名' },
];

const formatDateTimeLocal = (date: Date): string => {
  const pad = (num: number) => num.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function CreateAttendanceActivityForm({ courseId, onComplete, onClose, initialData }: CreateAttendanceActivityFormProps) {
  const isEditMode = !!initialData;

  // Initialize state from initialData if in edit mode
  const [creationMode, setCreationMode] = useState<CreationMode>(initialData?.status === 'active' ? 'instant' : 'scheduled');
  const [title, setTitle] = useState(initialData?.title || '');
  const [checkInMethod, setCheckInMethod] = useState<'manual' | 'numeric'>(initialData?.checkInMethod || 'numeric');
  const [error, setError] = useState<string | null>(null);
  
  const formatDateTimeForInput = (isoString: string | undefined) => {
    if (!isoString) return '';
    return isoString.slice(0, 16);
  };

  const [startTime, setStartTime] = useState(formatDateTimeForInput(initialData?.startTime));
  const [endTime, setEndTime] = useState(formatDateTimeForInput(initialData?.endTime));
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(initialData?.gracePeriodMinutes || 5);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!courseId || isEditMode) return;

    const fetchStudents = async () => {
      try {
      } catch (error) {
        console.error('獲取學生失敗:', error);
        setError('無法加載學生名單，請稍後再試。');
      }
    };

    fetchStudents();
  }, [courseId, isEditMode]);

  const localeOptions: Intl.DateTimeFormatOptions = useMemo(() => ({
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }), []);

  // Effect for resetting/initializing values when creation mode changes
  useEffect(() => {
    if (isEditMode) return;

    if (creationMode === 'instant') {
      const now = new Date();
      const formattedDateTime = now.toLocaleString('zh-TW', localeOptions);

      if (checkInMethod !== 'manual') {
        setTitle(`即時點名 ${formattedDateTime}`);
      } else {
        setTitle(`手動點名 ${formattedDateTime}`);
      }
      setStartTime(formatDateTimeLocal(now));
      setEndTime('');
    } else {
      // Scheduled mode: Reset fields to allow fresh input
      setTitle('');
      setStartTime('');
      setEndTime('');
    }
  }, [creationMode, checkInMethod, isEditMode, localeOptions]);

  // Effect for updating title specifically in scheduled mode when a start time is picked
  useEffect(() => {
    if (!isEditMode && creationMode === 'scheduled' && startTime && checkInMethod !== 'manual') {
      const selectedDate = new Date(startTime);
      setTitle(`預約點名 ${selectedDate.toLocaleString('zh-TW', localeOptions)}`);
    }
  }, [startTime, creationMode, checkInMethod, isEditMode, localeOptions]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!title) {
      setError('請填寫活動標題');
      setIsLoading(false);
      return;
    }
    if ((checkInMethod !== 'manual' || creationMode === 'scheduled') && !startTime) {
      setError('請設定開始時間');
      setIsLoading(false);
      return;
    }
    
    if (!courseId) {
      setError('系統錯誤：找不到課程 ID');
      setIsLoading(false);
      return;
    }

    // 驗證截止時間晚於開始時間
    if (startTime && endTime) {
      const start = new Date(startTime);
      const end = new Date(endTime);
      if (end <= start) {
        setError('截止時間必須晚於開始時間');
        setIsLoading(false);
        return;
      }
    }

    try {
      // 若是即時點名，仍以目前時間為準，但保留老師自訂的截止時間
      const finalStartTime =
        creationMode === 'instant'
          ? (startTime ? new Date(startTime).toISOString() : new Date().toISOString())
          : new Date(startTime as string).toISOString();

      const finalEndTime = endTime
        ? new Date(endTime).toISOString()
        : new Date(new Date(finalStartTime).getTime() + gracePeriodMinutes * 60 * 1000).toISOString();

      const activityData = {
        courseId,
        title,
        checkInMethod,
        startTime: finalStartTime,
        endTime: finalEndTime,
        gracePeriodMinutes: Math.max(1, Math.floor(Number(gracePeriodMinutes) || 5)),
        status: (creationMode === 'instant' ? 'active' : 'scheduled') as AttendanceActivity['status'],
      };

      // Debug: 檢查送出的資料
      console.log('Submitting activity data:', activityData);

      const response = await fetch('/api/attendance/activities/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityData),
      });

      if (!response.ok) {
        console.error('Create Activity Failed. Status:', response.status);
        const responseText = await response.text();
        console.error('Create Activity Response Text:', responseText);
        
        let errorMessage = `建立活動失敗 (${response.status})`;
        try {
          let errorData = JSON.parse(responseText);
          // 處理雙重序列化的 JSON 字串 (Handle double-encoded JSON string)
          if (typeof errorData === 'string') {
             try { errorData = JSON.parse(errorData); } catch {}
          }

          console.error('Create Activity Error Details:', errorData);
          
          if (errorData && typeof errorData === 'object') {
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else if (typeof errorData === 'string') {
            errorMessage = errorData;
          }
        } catch (e) {
          console.error('Failed to parse error response JSON:', e);
          if (responseText && responseText.length < 200) errorMessage = responseText;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      Swal.fire({
        icon: 'success',
        title: isEditMode ? '活動已更新！' : '點名活動已建立！',
        timer: 1500,
        showConfirmButton: false
      });
      onComplete({ ...activityData, id: result.activityId } as AttendanceActivity);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '發生未知錯誤';
      setError(errorMessage);
      setIsLoading(false);
    } finally {
      // Do not set isLoading to false here to allow toast to show before closing
    }
  };

  return (
    <div className="relative">
      <div className="">
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Creation Mode Dropdown */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">建立模式</label>
            <Dropdown
              value={creationMode}
              onChange={(value) => setCreationMode(value as CreationMode)}
              options={creationModeOptions}
              disabled={isEditMode}
            />
          </div>

          {/* Title Input */}
          <div>
            <label htmlFor="title" className="block text-sm font-bold text-gray-700 mb-2">活動標題</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm shadow-sm disabled:bg-gray-100 disabled:text-gray-500"
              required
              disabled={!isEditMode && creationMode === 'instant' && checkInMethod !== 'manual'}
            />
          </div>

          {/* Check-in Method */}
          <div>
            <label htmlFor="checkInMethod" className="block text-sm font-bold text-gray-700 mb-2">簽到方式</label>
            <Dropdown
              value={checkInMethod}
              onChange={(value) => setCheckInMethod(value as 'manual' | 'numeric')}
              options={checkInMethodOptions}
            />
          </div>

          {/* Start / End Time & Grace Period */}
          {(checkInMethod !== 'manual' || creationMode === 'scheduled') && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="startTime" className="block text-sm font-bold text-gray-700 mb-2">開始時間</label>
                  <input
                    type="datetime-local"
                    id="startTime"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm shadow-sm"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="endTime" className="block text-sm font-bold text-gray-700 mb-2">截止時間 (選填)</label>
                  <input
                    type="datetime-local"
                    id="endTime"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm shadow-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Grace Period */}
                <div>
                  <label htmlFor="gracePeriodMinutes" className="block text-sm font-bold text-gray-700 mb-2">寬限期 (分鐘)</label>
                  <div className="relative">
                    <input
                      type="number"
                      id="gracePeriodMinutes"
                      value={gracePeriodMinutes}
                      onChange={(e) => setGracePeriodMinutes(parseInt(e.target.value, 10) || 0)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all sm:text-sm shadow-sm"
                      min="0"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                      <span className="text-gray-400 text-sm">分鐘</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors disabled:opacity-50"
              disabled={isLoading}
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center"
              disabled={isLoading}
            >
              {isLoading && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              {isLoading ? (isEditMode ? '儲存中...' : '建立中...') : (isEditMode ? '儲存變更' : '建立活動')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}