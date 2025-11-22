'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import alerts from '../utils/alerts';
import type { AttendanceActivity } from '@/back-panel/attendance/AttendanceManagementComponent';
import Dropdown from '@/components/ui/Dropdown';


// The form now accepts initialData for editing, and the callback is renamed.
interface CreateAttendanceActivityFormProps {
  courseId: string;
  onComplete: () => void; // Callback for both create and update
  initialData?: AttendanceActivity;
}

type CreationMode = 'instant' | 'scheduled';

interface Student {
  id: string;
  name: string;
  email: string;
  status: 'present' | 'absent' | 'late';
}

const checkInMethodOptions = [
  { value: 'numeric', label: '數字點名' },
  { value: 'manual', label: '手動點名' },
];

export default function CreateAttendanceActivityForm({ courseId, onComplete, initialData }: CreateAttendanceActivityFormProps) {
  const router = useRouter();
  const isEditMode = !!initialData;

  // Initialize state from initialData if in edit mode
  const [creationMode, setCreationMode] = useState<CreationMode>(initialData?.status === 'active' ? 'instant' : 'scheduled');
  const [title, setTitle] = useState(initialData?.title || '');
  const [checkInMethod, setCheckInMethod] = useState<'manual' | 'numeric'>(initialData?.checkInMethod || 'numeric');
  const [roster, setRoster] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const formatDateTimeForInput = (isoString: string | undefined) => {
    if (!isoString) return '';
    // The input type='datetime-local' requires 'YYYY-MM-DDTHH:mm' format.
    return isoString.slice(0, 16);
  };

  const [startTime, setStartTime] = useState(formatDateTimeForInput(initialData?.startTime));
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(initialData?.gracePeriodMinutes || 5);
  const [isLoading, setIsLoading] = useState(false);




  useEffect(() => {
    if (!courseId || isEditMode) return;

    const fetchStudents = async () => {
      try {
        const response = await fetch(`/api/course-student-list/list?courseId=${courseId}`);
        if (!response.ok) {
          throw new Error('無法獲取學生列表');
        }
        const students = await response.json();
        // Initialize roster with default status
        const initialRoster = students.map((student: Student) => ({ ...student, status: 'absent' }));
        setRoster(initialRoster);
      } catch (error) {
        console.error('獲取學生失敗:', error);
        setError('無法加載學生名單，請稍後再試。');
      }
    };

    fetchStudents();
  }, [courseId, isEditMode]);

  const formatDateTimeLocal = (date: Date): string => {
    const pad = (num: number) => num.toString().padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const localeOptions: Intl.DateTimeFormatOptions = useMemo(() => ({
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }), []);

  // Effect for mode switching (only in create mode)
  useEffect(() => {
    if (isEditMode) return;

    if (creationMode === 'instant') {
      const now = new Date();
      const formattedDateTime = now.toLocaleString('zh-TW', localeOptions);
      if (checkInMethod !== 'manual') {
        setTitle(`即時點名 ${formattedDateTime}`);
        setStartTime(formatDateTimeLocal(now));
      } else {
        setTitle(`手動點名 ${formattedDateTime}`);
        setStartTime(formatDateTimeLocal(now)); // Still set start time for manual, but it's not displayed
      }
    } else {
      setTitle('');
      setStartTime('');
    }
  }, [creationMode, checkInMethod, isEditMode, localeOptions]);

  // Effect for updating title in scheduled mode (only in create mode)
  useEffect(() => {
    if (isEditMode) return;

    if (creationMode === 'scheduled' && startTime && checkInMethod !== 'manual') {
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
    if (checkInMethod !== 'manual' && !startTime) {
      setError('請為此簽到方式設定開始時間');
      setIsLoading(false);
      return;
    }

    let finalStartTime: Date;
    let finalEndTime: Date;

    if (checkInMethod === 'manual') {
      finalStartTime = new Date();
      finalEndTime = new Date();
    } else {
      finalStartTime = new Date(startTime);
      finalEndTime = new Date(finalStartTime.getTime() + gracePeriodMinutes * 60 * 1000);
    }

    const submissionBody = {
      courseId,
      title,
      checkInMethod,
      startTime: finalStartTime.toISOString(),
      endTime: finalEndTime.toISOString(),
      gracePeriodMinutes: checkInMethod === 'manual' ? 0 : gracePeriodMinutes,
      creationMode, // Pass creationMode for create logic
      roster: isEditMode ? undefined : roster, // Only include roster on create
    };

    const apiEndpoint = isEditMode ? '/api/attendance/activities/update' : '/api/attendance/activities/create';
    const bodyPayload = isEditMode ? { ...submissionBody, activityId: initialData.id } : submissionBody;

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || (isEditMode ? '更新活動失敗' : '建立活動失敗'));
      }

      const data = await response.json();
      const successMessage = isEditMode ? '活動已更新！' : (data.checkInCode ? `活動已建立！簽到碼: ${data.checkInCode}` : '點名活動已建立！');
      
      alerts.showSuccess(successMessage);
      onComplete();
      router.refresh();

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '發生未知錯誤';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // const chevronDownIcon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>';
  // const encodedChevron = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0iY3VycmVudENvbG9yIj48cGF0aCBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik01LjI5MyA3LjI5M2ExIDEgMCAwMTEuNDE0IDBMMTAgMTAuNTg2bDMuMjkzLTMuMjkzYTEgMSAwIDExMS40MTQgMS40MTRsLTQgNGExIDEgMCAwMS0xLjQxNCAwbC00LTRhMSAxIDAgMDE0LTEuNDE0eiIgY2xpcC1ydWxlPSJldmVub2RkIiAvPjwvc3ZnPg==`;


  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6 bg-white rounded-lg mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">{isEditMode ? '編輯點名活動' : '建立新的點名活動'}</h2>

      {/* Creation Mode Selection - Disabled in edit mode */}
      <div className="flex items-center space-x-4 mb-6">
        <label className="block text-sm font-medium text-gray-700">建立模式</label>
        <div className="flex items-center">
          <input 
            type="radio" 
            id="instant-mode" 
            name="creationMode" 
            value="instant" 
            checked={creationMode === 'instant'} 
            onChange={() => setCreationMode('instant')}
            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 disabled:bg-gray-200"
            disabled={isEditMode}
          />
          <label htmlFor="instant-mode" className="ml-2 block text-sm text-gray-900">即時點名</label>
        </div>
        <div className="flex items-center">
          <input 
            type="radio" 
            id="scheduled-mode" 
            name="creationMode" 
            value="scheduled" 
            checked={creationMode === 'scheduled'} 
            onChange={() => setCreationMode('scheduled')}
            className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 disabled:bg-gray-200"
            disabled={isEditMode}
          />
          <label htmlFor="scheduled-mode" className="ml-2 block text-sm text-gray-900">預約點名</label>
        </div>
      </div>
      
      {/* Title Input */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">活動標題</label>
        <input
          type="text"
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          required
          disabled={!isEditMode && creationMode === 'instant' && checkInMethod !== 'manual'}
        />
      </div>

      {/* Check-in Method */}
      <div>
        <label htmlFor="checkInMethod" className="block text-sm font-medium text-gray-700 mb-1">簽到方式</label>
        <Dropdown
          value={checkInMethod}
          onChange={(value) => setCheckInMethod(value as 'manual' | 'numeric')}
          options={checkInMethodOptions}
          className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Start Time */}
      {checkInMethod !== 'manual' && (
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">開始時間</label>
          <input
            type="datetime-local"
            id="startTime"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            required
            disabled={!isEditMode && creationMode === 'instant'}
          />
        </div>
      )}

      {/* Grace Period */}
      {checkInMethod !== 'manual' && (
        <div>
          <label htmlFor="gracePeriodMinutes" className="block text-sm font-medium text-gray-700 mb-1">寬限期 (分鐘)</label>
          <input
            type="number"
            id="gracePeriodMinutes"
            value={gracePeriodMinutes}
            onChange={(e) => setGracePeriodMinutes(parseInt(e.target.value, 10) || 0)}
            className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0"
            required
          />
        </div>
      )}

      {error && <p className="text-sm text-red-600 mt-4 text-center">{error}</p>}

      {/* Action Buttons */}
      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-4 pt-4">
        <button
          type="submit"
          className="w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:bg-blue-400 transition-colors"
          disabled={isLoading}
        >
          {isLoading ? (isEditMode ? '儲存中...' : '建立中...') : (isEditMode ? '儲存變更' : '建立活動')}
        </button>
        <button
          type="button"
          onClick={onComplete}
          className="w-full sm:w-auto px-4 py-2 sm:px-6 sm:py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 disabled:opacity-50 transition-colors"
          disabled={isLoading}
        >
          取消
        </button>
      </div>
    </form>
  );
}
