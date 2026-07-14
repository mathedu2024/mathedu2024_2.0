'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Swal from '@/utils/swalTheme';
import LoadingSpinner from './LoadingSpinner';

// --- Types & Interfaces ---

export interface AttendanceActivity {
  id: string;
  title: string;
  checkInMethod: 'numeric' | 'manual' | 'qr';
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
  /** 新建時預設模式（互動投影頁建議 instant） */
  defaultCreationMode?: CreationMode;
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
  { value: 'qr', label: 'QR點名' },
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

const methodTitlePrefix = (method: 'manual' | 'numeric' | 'qr'): string => {
  if (method === 'manual') return '手動點名';
  if (method === 'qr') return 'QR點名';
  return '數字點名';
};

const buildActivityTitle = (
  method: 'manual' | 'numeric' | 'qr',
  when: Date,
  localeOptions: Intl.DateTimeFormatOptions
): string => `${methodTitlePrefix(method)} ${when.toLocaleString('zh-TW', localeOptions)}`;

export default function CreateAttendanceActivityForm({
  courseId,
  onComplete,
  onClose,
  initialData,
  defaultCreationMode = 'scheduled',
}: CreateAttendanceActivityFormProps) {
  const isEditMode = !!initialData;

  // Initialize state from initialData if in edit mode
  const [creationMode, setCreationMode] = useState<CreationMode>(
    initialData
      ? initialData.status === 'active'
        ? 'instant'
        : 'scheduled'
      : defaultCreationMode
  );
  const [title, setTitle] = useState(initialData?.title || '');
  const [checkInMethod, setCheckInMethod] = useState<'manual' | 'numeric' | 'qr'>(initialData?.checkInMethod || 'numeric');
  const [error, setError] = useState<string | null>(null);
  
  const formatDateTimeForInput = (isoString: string | undefined) => {
    if (!isoString) return '';
    return isoString.slice(0, 16);
  };

  const [startTime, setStartTime] = useState(formatDateTimeForInput(initialData?.startTime));
  const [endTime, setEndTime] = useState(formatDateTimeForInput(initialData?.endTime));
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(initialData?.gracePeriodMinutes || 5);
  const [defaultRosterStatus, setDefaultRosterStatus] = useState<'present' | 'absent'>('absent');
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

  // 標題由系統依簽到方式自動訂定（即時／預約皆同規則，避免變成「預約點名」）
  useEffect(() => {
    if (isEditMode) return;

    if (creationMode === 'instant') {
      const now = new Date();
      setTitle(buildActivityTitle(checkInMethod, now, localeOptions));
      setStartTime(formatDateTimeLocal(now));
      setEndTime('');
      return;
    }

    if (startTime) {
      setTitle(buildActivityTitle(checkInMethod, new Date(startTime), localeOptions));
    }
  }, [creationMode, checkInMethod, startTime, isEditMode, localeOptions]);

  const handleCreationModeChange = (value: string) => {
    const mode = value as CreationMode;
    setCreationMode(mode);
    if (mode === 'scheduled') {
      setStartTime('');
      setEndTime('');
      setTitle('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    if (!title && creationMode === 'scheduled' && !startTime) {
      setError('請設定開始時間');
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

      const finalTitle = buildActivityTitle(
        checkInMethod,
        new Date(finalStartTime),
        localeOptions
      );

      const activityData = {
        courseId,
        title: finalTitle,
        checkInMethod,
        startTime: finalStartTime,
        endTime: finalEndTime,
        gracePeriodMinutes: Math.max(1, Math.floor(Number(gracePeriodMinutes) || 5)),
        status: (creationMode === 'instant' ? 'active' : 'scheduled') as AttendanceActivity['status'],
        ...(checkInMethod === 'manual' ? { defaultRosterStatus } : {}),
      };

      // Debug: 檢查送出的資料
      console.log('Submitting activity data:', activityData);

      if (isEditMode && initialData?.id) {
        const response = await fetch('/api/attendance/activities/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId,
            activityId: initialData.id,
            title: activityData.title,
            checkInMethod: activityData.checkInMethod,
            startTime: activityData.startTime,
            endTime: activityData.endTime,
            gracePeriodMinutes: activityData.gracePeriodMinutes,
            status: activityData.status,
            ...(checkInMethod === 'manual' ? { defaultRosterStatus } : {}),
          }),
        });

        if (!response.ok) {
          const responseText = await response.text();
          let errorMessage = '更新失敗，請稍後再試';
          try {
            const errorData = JSON.parse(responseText);
            if (errorData && typeof errorData === 'object') {
              errorMessage = errorData.error || errorData.message || errorMessage;
            }
          } catch {
            if (responseText && responseText.length < 200) errorMessage = responseText;
          }
          throw new Error(errorMessage);
        }

        await Swal.fire({
          icon: 'success',
          title: '活動已更新！',
          showConfirmButton: true,
          confirmButtonText: '確定',
          confirmButtonColor: '#4f46e5',
          customClass: { popup: 'rounded-2xl' },
        });

        onComplete({
          ...activityData,
          id: initialData.id,
          checkInCode: initialData.checkInCode,
        } as AttendanceActivity);
        return;
      }

      const response = await fetch('/api/attendance/activities/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activityData),
      });

      if (!response.ok) {
        console.error('Create Activity Failed. Status:', response.status);
        const responseText = await response.text();
        console.error('Create Activity Response Text:', responseText);
        
        let errorMessage = `伺服器錯誤，請稍後再試`;
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
      const newActivityId = result.activityId || result.id;

      const extractCheckInCode = (data: Record<string, unknown> | null | undefined): string | undefined => {
        if (!data) return undefined;
        const code = data.checkInCode ?? data.code;
        return typeof code === 'string' && code.length > 0 ? code : undefined;
      };

      let finalCheckInCode = extractCheckInCode(result)
        ?? extractCheckInCode(result.activity as Record<string, unknown> | undefined)
        ?? extractCheckInCode(result.data as Record<string, unknown> | undefined);

      const routingCode =
        (typeof result.routingCode === 'string' && result.routingCode) || finalCheckInCode;

      const fetchCheckInCodeFromDetails = async (): Promise<string | undefined> => {
        if (!newActivityId) return undefined;
        for (let i = 0; i < 5; i++) {
          try {
            if (i > 0) await new Promise((resolve) => setTimeout(resolve, 400));
            const detailRes = await fetch(
              `/api/attendance/activity-details?courseId=${encodeURIComponent(courseId)}&id=${encodeURIComponent(newActivityId)}`
            );
            if (!detailRes.ok) continue;
            const detailData = await detailRes.json();
            const code = extractCheckInCode(detailData);
            if (code) return code;
          } catch (e) {
            console.error('無法獲取簽到碼', e);
          }
        }
        return undefined;
      };

      const createdTitle = isEditMode
        ? '活動已更新！'
        : creationMode === 'scheduled'
          ? '預約點名已建立！'
          : `${methodTitlePrefix(checkInMethod)}已建立！`;

      if (checkInMethod === 'numeric') {
        if (creationMode === 'instant') {
          if (!finalCheckInCode) {
            finalCheckInCode = await fetchCheckInCodeFromDetails();
          }

          const codeDisplayHtml = finalCheckInCode
            ? `<div class="mt-2 text-4xl font-mono font-bold text-indigo-600 tracking-[0.25em] bg-indigo-50 py-3 rounded-xl border border-indigo-100">${finalCheckInCode}</div>`
            : `<div class="mt-2 text-xl text-red-500 py-3">無法取得簽到碼，請至活動查看</div>`;

          await Swal.fire({
            icon: 'success',
            title: createdTitle,
            html: `<div class="mt-4"><span class="text-gray-500 font-medium">請將此簽到碼提供給學生：</span><br>${codeDisplayHtml}</div>`,
            showConfirmButton: true,
            confirmButtonText: '確定',
            confirmButtonColor: '#4f46e5',
            customClass: { popup: 'rounded-2xl' },
            allowOutsideClick: false,
          });
        } else {
          await Swal.fire({
            icon: 'success',
            title: createdTitle,
            html: '<p class="text-gray-600 text-sm mt-2">開始時間到後才會開放數字簽到；開始前可先登錄請假。</p>',
            showConfirmButton: true,
            confirmButtonText: '確定',
            confirmButtonColor: '#4f46e5',
            customClass: { popup: 'rounded-2xl' }
          });
        }
      } else if (checkInMethod === 'qr') {
        await Swal.fire({
          icon: 'success',
          title: createdTitle,
          html: creationMode === 'scheduled'
            ? '<p class="text-gray-600 text-sm mt-2">開始時間到後才會顯示簽到 QR；開始前可先登錄請假。</p>'
            : '<p class="text-gray-600 text-sm mt-2">進入活動後即可顯示簽到 QR Code，供學生掃描。</p>',
          showConfirmButton: true,
          confirmButtonText: '確定',
          confirmButtonColor: '#4f46e5',
          customClass: { popup: 'rounded-2xl' }
        });
      } else {
        await Swal.fire({
          icon: 'success',
          title: createdTitle,
          showConfirmButton: true,
          confirmButtonText: '確定',
          confirmButtonColor: '#4f46e5',
          customClass: { popup: 'rounded-2xl' }
        });
      }
      onComplete({
        ...activityData,
        id: newActivityId,
        checkInCode: routingCode || finalCheckInCode,
      } as AttendanceActivity);

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
              onChange={handleCreationModeChange}
              options={creationModeOptions}
              disabled={isEditMode}
            />
          </div>

          {/* Title Input（系統依簽到方式自動訂定） */}
          <div>
            <label htmlFor="title" className="block text-sm font-bold text-gray-700 mb-2">活動標題</label>
            <input
              type="text"
              id="title"
              value={title}
              readOnly
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 bg-gray-100 focus:outline-none sm:text-sm shadow-sm cursor-default"
              required
              placeholder={creationMode === 'scheduled' ? '選擇開始時間後自動產生' : ''}
            />
          </div>

          {/* Check-in Method */}
          <div>
            <label htmlFor="checkInMethod" className="block text-sm font-bold text-gray-700 mb-2">簽到方式</label>
            <Dropdown
              value={checkInMethod}
              onChange={(value) => setCheckInMethod(value as 'manual' | 'numeric' | 'qr')}
              options={checkInMethodOptions}
            />
          </div>

          {checkInMethod === 'manual' && (
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">名冊預設狀態</label>
              <Dropdown
                value={defaultRosterStatus}
                onChange={(value) => setDefaultRosterStatus(value as 'present' | 'absent')}
                options={[
                  { value: 'absent', label: '缺席' },
                  { value: 'present', label: '出席' },
                ]}
              />
            </div>
          )}

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
              {isLoading && <LoadingSpinner size={16} color="white" className="mr-2" />}
              {isLoading ? (isEditMode ? '儲存中...' : '建立中...') : (isEditMode ? '儲存變更' : '建立活動')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}