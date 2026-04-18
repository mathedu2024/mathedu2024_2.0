'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { PlusIcon, PencilIcon, TrashIcon, UserIcon, MapPinIcon, ClockIcon, TagIcon, ChatBubbleLeftRightIcon, EnvelopeIcon, ClipboardIcon, ChevronDownIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { format as formatFns, startOfWeek, addDays, isSameDay, parseISO, isPast, addWeeks, subWeeks, type Locale } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import alerts from '@/utils/alerts';
import type { Course } from '@/components/TeacherCourseManager';
import { TutoringSlot, BookedStudent } from '@/services/interfaces';
import Swal from 'sweetalert2';

interface UserInfo {
  id: string;
  name: string;
  account: string;
  role: '管理員' | '老師' | '學生';
  currentRole?: string;
}

interface TutoringManagerProps {
  userInfo: UserInfo;
  courses: Course[];
}

const gradeOptions = [
  { label: '國一', value: '國一' },
  { label: '國二', value: '國二' },
  { label: '國三', value: '國三' },
  { label: '高一', value: '高一' },
  { label: '高二', value: '高二' },
  { label: '高三', value: '高三' },
  { label: '職一', value: '職一' },
  { label: '職二', value: '職二' },
  { label: '職三', value: '職三' },
  { label: '大一', value: '大一' },
  { label: '進修', value: '進修' },
];

const subjectOptions = [
  { label: '數學', value: '數學' },
  { label: '理化', value: '理化' },
  { label: '物理', value: '物理' },
  { label: '化學', value: '化學' },
  { label: '生物', value: '生物' },
];

const LoadingSpinner = ({ size = 20, color = 'text-indigo-600' }: { size?: number, color?: string }) => (
  <svg className={`animate-spin ${color === 'white' ? 'text-white' : 'text-indigo-600'}`} width={size} height={size} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const Dropdown = ({ value, onChange, options, placeholder, className }: { 
  value: string; 
  onChange: (val: string) => void; 
  options: { value: string; label: string }[]; 
  placeholder?: string; 
  className?: string; 
}) => {
  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white appearance-none"
      >
        {placeholder && <option value="" disabled>{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
        <ChevronDownIcon className="w-4 h-4 text-gray-500" />
      </div>
    </div>
  );
};

// Simple MultiSelectDropdown Component
const MultiSelectDropdown = ({ options, selectedOptions, onChange, placeholder }: { 
  options: { label: string; value: string }[], 
  selectedOptions: string[], 
  onChange: (values: string[]) => void, 
  placeholder: string 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = (value: string) => {
    if (selectedOptions.includes(value)) {
      onChange(selectedOptions.filter(item => item !== value));
    } else {
      onChange([...selectedOptions, value]);
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div 
        className="w-full px-4 py-2 bg-white border border-gray-300 rounded-xl cursor-pointer flex justify-between items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`block truncate ${selectedOptions.length === 0 ? 'text-gray-400' : 'text-gray-900'}`}>
          {selectedOptions.length === 0 ? placeholder : `${selectedOptions.length} 個已選擇`}
        </span>
        <ChevronDownIcon className="w-4 h-4 text-gray-500" />
      </div>
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-auto">
          {options.map((option) => (
            <div 
              key={option.value} 
              className="px-4 py-2 hover:bg-indigo-50 cursor-pointer flex items-center"
              onClick={() => handleToggle(option.value)}
            >
              <input 
                type="checkbox" 
                checked={selectedOptions.includes(option.value)} 
                readOnly 
                className="mr-2 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <span className="text-gray-700">{option.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 修正：重新命名為 safeFormat 並放寬型別檢查，確保徹底解決參數錯誤
const safeFormat = (date: Date | number, formatStr: string, options?: { locale?: Locale }) => {
  try {
    return formatFns(date, formatStr, options);
  } catch (error) {
    console.error('Date formatting error', error);
    return '';
  }
};

export function TutoringManager({ userInfo, courses }: TutoringManagerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { locale: zhTW }));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState<TutoringSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TutoringSlot | null>(null);
  const [form, setForm] = useState<TutoringSlot>({
    teacherId: userInfo.id,
    date: '',
    startTime: '',
    endTime: '',
    participantLimit: 1,
    available: true,
    title: '',
    method: '個別輔導',
    locationType: '實體輔導',
    locationDetails: '',
    qualifications: { type: 'grades_subjects', grades: [], subjects: [], classes: [] },
    remarks: '',
    mode: 'one-on-one',
  });
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [currentBookedStudents, setCurrentBookedStudents] = useState<BookedStudent[]>([]);
  const [currentSlotTitle, setCurrentSlotTitle] = useState('');

  // 當 Modal 開啟時鎖定背景滾動，避免背景內容跟著滑動
  useEffect(() => {
    if (isModalOpen || showBookingsModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isModalOpen, showBookingsModal]);

  const dynamicClassOptions = useMemo(() => {
    const classes = new Set<string>();
    (courses || [])
      .filter(course => course && course.status !== '已封存' && course.archived !== true && String(course.archived) !== 'true')
      .forEach(course => classes.add(course.name));
    return Array.from(classes).map(_class => ({ label: _class, value: _class }));
  }, [courses]);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tutoring/list-teacher-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: userInfo.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setSlots(data.slots || []);
      } else {
        console.error('Failed to fetch slots');
      }
    } catch (error) {
      console.error('Error fetching slots:', error);
    } finally {
      setLoading(false);
    }
  }, [userInfo.id]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: value,
      ...(name === 'method' && value === '個別輔導' && { participantLimit: 1 }),
    }));
  };

  const resetForm = () => {
    setForm({
      teacherId: userInfo.id,
      date: '',
      startTime: '',
      endTime: '',
      participantLimit: 1,
      available: true,
      title: '',
      method: '個別輔導',
      locationType: '實體輔導',
      locationDetails: '',
      qualifications: { type: 'grades_subjects', grades: [], subjects: [], classes: [] },
      remarks: '',
      mode: 'one-on-one',
    });
    setSelectedSlot(null);
  };

  const openCreateModal = (date: Date) => {
    if (isPast(date) && !isSameDay(date, new Date())) {
      alerts.showWarning('無法在過去的日期新增輔導時段');
      return;
    }
    resetForm();
    setForm(prev => ({
      ...prev,
      // 這裡也使用 safeFormat
      date: safeFormat(date, 'yyyy-MM-dd'),
    }));
    setIsModalOpen(true);
  };

  const openEditModal = (slot: TutoringSlot) => {
    setSelectedSlot(slot);
    setForm({
      ...slot,
      locationDetails: slot.locationDetails || '',
      qualifications: {
        type: slot.qualifications?.type || 'grades_subjects',
        grades: slot.qualifications?.grades || [],
        subjects: slot.qualifications?.subjects || [],
        classes: slot.qualifications?.classes || [],
      },
      remarks: slot.remarks || '',
    });
    setIsModalOpen(true);
  };

  const isTimeConflict = (newSlot: { date: string; startTime: string; endTime: string }, existingSlots: TutoringSlot[]): boolean => {
    const newStart = parseISO(`${newSlot.date}T${newSlot.startTime}`);
    const newEnd = parseISO(`${newSlot.date}T${newSlot.endTime}`);

    for (const existingSlot of existingSlots) {
      if (selectedSlot && existingSlot.id === selectedSlot.id) continue;

      const existingStart = parseISO(`${existingSlot.date}T${existingSlot.startTime}`);
      const existingEnd = parseISO(`${existingSlot.date}T${existingSlot.endTime}`);

      if (newStart < existingEnd && newEnd > existingStart) {
        return true;
      }
    }
    return false;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const payload = {
      ...form,
      teacherId: userInfo.id,
      participantLimit: Number(form.participantLimit),
    };

    if (isTimeConflict(payload, slots)) {
      alerts.showError('新增或編輯的時段與現有時段有時間衝突，請檢查。');
      setLoading(false);
      return;
    }

    try {
      const url = selectedSlot ? '/api/tutoring/update-slot' : '/api/tutoring/create-slot';
      const method = 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedSlot ? { ...payload, id: selectedSlot.id } : payload),
      });
      const data = await res.json();
      if (res.ok) {
        alerts.showSuccess(data.message);
        Swal.fire({
          icon: 'success',
          title: '建立成功！',
          text: '輔導時段已成功建立。',
          confirmButtonText: '確定',
          confirmButtonColor: '#4f46e5', // indigo-600
          customClass: { popup: 'rounded-2xl' }
        });
        setIsModalOpen(false);
        fetchSlots();
      } else {
        alerts.showError(data.error || '操作失敗');
      }
    } catch (error) {
      console.error('Submission error:', error);
      alerts.showError('發生未預期的錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSlot) return;

    if (selectedSlot.bookedStudents && selectedSlot.bookedStudents.length > 0) {
      alerts.showError('此時段已有學生預約，無法刪除。');
      return;
    }

    const confirmed = await alerts.confirm(`確定要刪除輔導時段「${selectedSlot.title}」嗎？`);
    if (!confirmed) return;

    setLoading(true);

    try {
      const res = await fetch('/api/tutoring/delete-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selectedSlot.id, teacherId: userInfo.id }),
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: '刪除成功！',
          text: '輔導時段已成功移除。',
          confirmButtonText: '確定',
          confirmButtonColor: '#4f46e5', // indigo-600
          customClass: { popup: 'rounded-2xl' }
        });
        fetchSlots();
      } else {
        alerts.showError(data.error || '刪除失敗');
      }
    } catch (error) {
      console.error('Deletion error:', error);
      alerts.showError('發生未預期的錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCancelAppointment = async (studentId: string, studentName: string) => {
    if (!selectedSlot) return;

    const confirmed = await alerts.confirm(`確定要取消學生 ${studentName} 在「${selectedSlot.title}」的預約嗎？`);
    if (!confirmed) return;

    setLoading(true);

    try {
      const res = await fetch('/api/tutoring/cancel-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selectedSlot.id, studentId: studentId }),
      });
      const data = await res.json();
      if (res.ok) {
        alerts.showSuccess('預約已成功取消');
        
        const updatedBookedStudents = currentBookedStudents.filter(s => s.studentId !== studentId);
        setCurrentBookedStudents(updatedBookedStudents);

        if (updatedBookedStudents.length === 0) {
            setShowBookingsModal(false);
        }

        fetchSlots();
      } else {
        alerts.showError(data.error || '取消預約失敗');
      }
    } catch (error) {
      console.error('Cancellation error:', error);
      alerts.showError('發生未知錯誤，取消預約失敗');
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = () => (
    <div className="flex justify-between items-center mb-4">
      <button onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
      </button>
      <h2 className="text-xl font-bold text-gray-800">
        {/* 使用 safeFormat */}
        {safeFormat(currentWeekStart, 'yyyy年 M月 d日', { locale: zhTW })} - {safeFormat(addDays(currentWeekStart, 6), 'yyyy年 M月 d日', { locale: zhTW })}
      </h2>
      <button onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
  );

  const renderDays = () => {
    const days = [];
    const startDate = currentWeekStart;

    for (let i = 0; i < 7; i++) {
      const day = addDays(startDate, i);
      const daySlots = slots.filter(slot => isSameDay(parseISO(slot.date), day))
                              .sort((a, b) => a.startTime.localeCompare(b.startTime));

      days.push(
        <div
          className={`p-2 h-48 border rounded-xl flex flex-col overflow-hidden transition-all cursor-pointer ${
            isSameDay(day, selectedDate) ? 'border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50/30' : 'border-gray-200 hover:border-indigo-300'
          }`}
          key={day.toISOString()}
          onClick={() => setSelectedDate(day)}
        >
          <div className="flex justify-between items-center mb-1">
             <span className={`text-sm font-medium ${isSameDay(day, new Date()) ? 'text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full' : 'text-gray-500'}`}>
                {/* 使用 safeFormat */}
                {safeFormat(day, 'd日 (EEE)', { locale: zhTW })}
             </span>
             {(!isPast(day) || isSameDay(day, new Date())) && (
                <button
                  className="text-indigo-600 hover:bg-indigo-100 rounded-full p-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    openCreateModal(day);
                  }}
                  title="新增時段"
                >
                  <PlusIcon className="w-4 h-4" />
                </button>
             )}
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
            {daySlots.map(slot => (
              <div
                key={slot.id}
                className={`text-xs p-1.5 rounded-lg border cursor-pointer transition-colors ${
                  slot.bookedCount === slot.participantLimit 
                    ? 'bg-red-50 text-red-700 border-red-100 hover:bg-red-100' 
                    : 'bg-white text-indigo-700 border-indigo-100 hover:bg-indigo-50 hover:border-indigo-200 shadow-sm'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(slot);
                }}
              >
                <div className="font-bold truncate">{slot.title}</div>
                <div className="flex justify-between mt-0.5 opacity-80">
                    <span>{slot.startTime}-{slot.endTime}</span>
                    <span>{slot.bookedCount}/{slot.participantLimit}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
    return <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">{days}</div>;
  };

  const filteredSlots = useMemo(() => {
    return slots.filter(slot => isSameDay(parseISO(slot.date), selectedDate));
  }, [slots, selectedDate]);

  if (!mounted) return <div className="p-20 flex justify-center"><LoadingSpinner size={40} /></div>;

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 flex flex-col h-full animate-fade-in">
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
          <div className="border-l-4 border-indigo-500 pl-4">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
              <CalendarIcon className="h-8 w-8 text-indigo-600" />
              課程輔導
            </h1>
            <p className="text-gray-500 text-sm mt-1">安排您的輔導時段並查看學生的預約名單。</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
                <CalendarIcon className="w-6 h-6 mr-2 text-indigo-500" /> 輔導時段日曆
            </h2>
            <button
              onClick={() => openCreateModal(selectedDate)}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm font-medium mt-4 md:mt-0"
            >
              <PlusIcon className="w-5 h-5 mr-2" />新增輔導時段
            </button>
          </div>
          {renderHeader()}
          {renderDays()}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4 border-l-4 border-indigo-500 pl-3">
            {/* 使用 safeFormat */}
            {safeFormat(selectedDate, 'yyyy年 M月 d日', { locale: zhTW })} 的輔導時段
          </h2>
          
          {loading ? (
            <div className="flex justify-center items-center h-32"><LoadingSpinner size={40} /></div>
          ) : filteredSlots.length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <ClockIcon className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p>本日尚無安排輔導時段</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSlots.map(slot => (
                <div key={slot.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow relative group">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="text-lg font-bold text-gray-800 line-clamp-1">{slot.title}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        slot.bookedCount >= Number(slot.participantLimit) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}>
                        {slot.bookedCount}/{slot.participantLimit} 人
                    </span>
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600 mb-4">
                    <p className="flex items-center"><ClockIcon className="w-4 h-4 mr-2 text-indigo-400" />{slot.startTime} - {slot.endTime}</p>
                    <p className="flex items-center"><ChatBubbleLeftRightIcon className="w-4 h-4 mr-2 text-indigo-400" />{slot.method}</p>
                    <p className="flex items-center"><MapPinIcon className="w-4 h-4 mr-2 text-indigo-400" />{slot.locationType}: {slot.locationDetails || '-'}</p>
                    <p className="flex items-start">
                        <TagIcon className="w-4 h-4 mr-2 text-indigo-400 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">
                            {slot.qualifications.type === 'grades_subjects'
                                ? `${slot.qualifications.grades.join(', ')} / ${slot.qualifications.subjects.join(', ')}`
                                : `限班級: ${slot.qualifications.classes.join(', ')}`}
                        </span>
                    </p>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-gray-100 gap-2">
                    <button
                        onClick={() => {
                            setSelectedSlot(slot);
                            setCurrentBookedStudents(slot.bookedStudents || []);
                            setCurrentSlotTitle(slot.title || '預約學生');
                            setShowBookingsModal(true);
                        }}
                        className="flex-1 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                        disabled={!slot.bookedStudents || slot.bookedStudents.length === 0}
                    >
                        名單 ({slot.bookedStudents?.length || 0})
                    </button>
                    <div className="flex space-x-1">
                        <button onClick={() => openEditModal(slot)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded-lg transition-colors">
                            <PencilIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => { setSelectedSlot(slot); handleDelete(); }} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {showBookingsModal && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[9999] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl animate-bounce-in border border-gray-100">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-800">{currentSlotTitle} - 預約名單</h2>
              <button onClick={() => setShowBookingsModal(false)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 flex items-center justify-center transition-colors">
                  &times;
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar">
              {currentBookedStudents.length > 0 ? (
                <div className="space-y-3">
                  {currentBookedStudents.map((student, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 flex items-center">
                            <UserIcon className="w-4 h-4 mr-2 text-indigo-500" />
                            {student.studentName} <span className="text-gray-500 font-normal ml-2 text-sm">({student.studentDisplayId})</span>
                        </p>
                        <p className="text-sm text-gray-600 flex items-center mt-1">
                            <EnvelopeIcon className="w-4 h-4 mr-2 text-gray-400" />{student.studentEmail}
                        </p>
                        {student.problemDescription && (
                            <p className="text-sm text-gray-600 flex items-start mt-2 bg-white p-2 rounded-lg border border-gray-200">
                                <ClipboardIcon className="w-4 h-4 mr-2 text-gray-400 mt-0.5 flex-shrink-0" />
                                {student.problemDescription}
                            </p>
                        )}
                        {student.bookingTimestamp && (
                            <p className="text-xs text-gray-400 mt-2 text-right">
                                預約時間: {new Date(student.bookingTimestamp).toLocaleString()}
                            </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleConfirmCancelAppointment(student.studentId, student.studentName)}
                        className="px-3 py-1.5 bg-white border border-red-200 text-red-600 rounded-lg text-sm hover:bg-red-50 transition-colors shadow-sm whitespace-nowrap"
                      >
                        取消預約
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">目前沒有學生預約此時段。</div>
              )}
            </div>
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
              <button className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm transition-colors" onClick={() => setShowBookingsModal(false)}>
                關閉
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {isModalOpen && createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[9999] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-bounce-in border border-gray-100">
            <h2 className="text-xl font-bold mb-6 text-gray-800 border-l-4 border-indigo-500 pl-3">
                {selectedSlot ? '編輯輔導時段' : '新增輔導時段'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="title" className="block text-sm font-bold text-gray-700 mb-1">標題</label>
                <input type="text" id="title" name="title" value={form.title} onChange={handleFormChange} required 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow" 
                    placeholder="例如：數學輔導"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="date" className="block text-sm font-bold text-gray-700 mb-1">日期</label>
                  <input type="date" id="date" name="date" value={form.date} onChange={handleFormChange} required 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
                    max="9999-12-31"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                    <div>
                        <label htmlFor="startTime" className="block text-sm font-bold text-gray-700 mb-1">開始</label>
                        <input type="time" id="startTime" name="startTime" value={form.startTime} onChange={handleFormChange} required 
                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
                        />
                    </div>
                    <div>
                        <label htmlFor="endTime" className="block text-sm font-bold text-gray-700 mb-1">結束</label>
                        <input type="time" id="endTime" name="endTime" value={form.endTime} onChange={handleFormChange} required 
                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
                        />
                    </div>
                </div>
                <div>
                  <label htmlFor="method" className="block text-sm font-bold text-gray-700 mb-1">輔導模式</label>
                  <Dropdown
                    value={form.method}
                    onChange={(value) => {
                      const newMode = value === '個別輔導' ? 'one-on-one' : 'group';
                      setForm(prev => ({
                        ...prev,
                        method: value,
                        mode: newMode,
                        ...(value === '個別輔導' && { participantLimit: 1 }),
                      }));
                    }}
                    options={[
                      { value: '個別輔導', label: '個別輔導' },
                      { value: '團體輔導', label: '團體輔導' },
                    ]}
                    placeholder="請選擇"
                    className="w-full"
                  />
                </div>
                {form.method === '團體輔導' && (
                  <div>
                    <label htmlFor="participantLimit" className="block text-sm font-bold text-gray-700 mb-1">人數上限</label>
                    <input
                      type="number"
                      id="participantLimit"
                      name="participantLimit"
                      value={form.participantLimit}
                      onChange={handleFormChange}
                      required
                      min="1"
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="locationType" className="block text-sm font-bold text-gray-700 mb-1">輔導形式</label>
                    <Dropdown
                        value={form.locationType}
                        onChange={(value) => handleFormChange({ target: { name: 'locationType', value } } as React.ChangeEvent<HTMLSelectElement>)}
                        options={[
                        { value: '實體輔導', label: '實體輔導' },
                        { value: '線上輔導', label: '線上輔導' },
                        { value: '與老師討論', label: '與老師討論' },
                        ]}
                        placeholder="請選擇"
                        className="w-full"
                    />
                  </div>
                  {(form.locationType === '實體輔導' || form.locationType === '線上輔導') && (
                    <div>
                        <label htmlFor="locationDetails" className="block text-sm font-bold text-gray-700 mb-1">
                            {form.locationType === '實體輔導' ? '地點 (地址/教室)' : '會議室網址'}
                        </label>
                        <input type="text" id="locationDetails" name="locationDetails" value={form.locationDetails} onChange={handleFormChange} 
                            className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
                        />
                    </div>
                  )}
              </div>

              <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                <label className="block text-sm font-bold text-gray-700 mb-3">資格限制</label>
                <div className="flex space-x-6 mb-4">
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      className="form-radio text-indigo-600 focus:ring-indigo-500"
                      name="qualificationType"
                      value="grades_subjects"
                      checked={form.qualifications.type === 'grades_subjects'}
                      onChange={() => setForm(prev => ({
                        ...prev,
                        qualifications: { ...prev.qualifications, type: 'grades_subjects', classes: [] },
                      }))}
                    />
                    <span className="ml-2 text-gray-700">年級 + 科目</span>
                  </label>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      className="form-radio text-indigo-600 focus:ring-indigo-500"
                      name="qualificationType"
                      value="classes"
                      checked={form.qualifications.type === 'classes'}
                      onChange={() => setForm(prev => ({
                        ...prev,
                        qualifications: { ...prev.qualifications, type: 'classes', grades: [], subjects: [] },
                      }))}
                    />
                    <span className="ml-2 text-gray-700">指定班級</span>
                  </label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {form.qualifications.type === 'grades_subjects' && (
                    <>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">年級</label>
                        <MultiSelectDropdown
                          options={gradeOptions}
                          selectedOptions={form.qualifications.grades}
                          onChange={(selectedValues) => setForm(prev => ({
                            ...prev,
                            qualifications: { ...prev.qualifications, grades: selectedValues },
                          }))}
                          placeholder="選擇年級 (可多選)"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">科目</label>
                        <MultiSelectDropdown
                          options={subjectOptions}
                          selectedOptions={form.qualifications.subjects}
                          onChange={(selectedValues) => setForm(prev => ({
                            ...prev,
                            qualifications: { ...prev.qualifications, subjects: selectedValues },
                          }))}
                          placeholder="選擇科目 (可多選)"
                        />
                      </div>
                    </>
                  )}
                  {form.qualifications.type === 'classes' && (
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">班級</label>
                      <MultiSelectDropdown
                        options={dynamicClassOptions}
                        selectedOptions={form.qualifications.classes}
                        onChange={(selectedValues) => setForm(prev => ({
                          ...prev,
                          qualifications: { ...prev.qualifications, classes: selectedValues },
                        }))}
                        placeholder="選擇班級 (可多選)"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="remarks" className="block text-sm font-bold text-gray-700 mb-1">備註說明</label>
                <textarea id="remarks" name="remarks" value={form.remarks} onChange={handleFormChange} rows={3} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="選填，提供更多資訊..."
                ></textarea>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors">
                    取消
                </button>
                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm font-medium transition-colors disabled:opacity-70 disabled:cursor-not-allowed" disabled={loading}>
                  {loading ? <LoadingSpinner size={20} color="white" /> : (selectedSlot ? '儲存變更' : '新增時段')}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default TutoringManager;