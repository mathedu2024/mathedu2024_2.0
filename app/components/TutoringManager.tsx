import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, UserGroupIcon, UserIcon, MapPinIcon, ClockIcon, TagIcon, ChatBubbleLeftRightIcon, EnvelopeIcon, ClipboardIcon } from '@heroicons/react/24/outline';
import { format, startOfWeek, addDays, isSameDay, parseISO, isPast, addWeeks, subWeeks } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import MultiSelectDropdown from './MultiSelectDropdown';
import Dropdown from './ui/Dropdown';
import AlertDialog from './AlertDialog';
import ConfirmDialog from './ConfirmDialog';
import type { Course } from '../components/TeacherCourseManager';
import { TutoringSlot, BookedStudent } from '@/services/interfaces';
import LoadingSpinner from './LoadingSpinner';
import 'react-toastify/dist/ReactToastify.css';

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

const TutoringManager: React.FC<TutoringManagerProps> = ({ userInfo, courses }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), { locale: zhTW }));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [slots, setSlots] = useState<TutoringSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [studentToCancel, setStudentToCancel] = useState<BookedStudent | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TutoringSlot | null>(null);
  const [form, setForm] = useState<TutoringSlot>({
    teacherId: userInfo.id,
    date: '',
    startTime: '',
    endTime: '',
    participantLimit: 1,
    available: true,
    title: '',
    method: 'online',
    locationType: 'google_meet',
    locationDetails: '',
    qualifications: { type: 'grades_subjects', grades: [], subjects: [], classes: [] },
    remarks: '',
    mode: 'one-on-one',
  });
  const [showBookingsModal, setShowBookingsModal] = useState(false);
  const [currentBookedStudents, setCurrentBookedStudents] = useState<BookedStudent[]>([]);
  const [currentSlotTitle, setCurrentSlotTitle] = useState('');
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' | null }>({ message: '', type: null });

  const dynamicClassOptions = useMemo(() => {
    const classes = new Set<string>();
    courses.forEach(course => classes.add(course.name));
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
        setSlots(data.slots);
        console.log('Fetched slots for teacher:', data.slots);
      } else {
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
      method: 'online',
      locationType: 'google_meet',
      locationDetails: '',
      qualifications: { type: 'grades_subjects', grades: [], subjects: [], classes: [] },
      remarks: '',
      mode: 'one-on-one',
    });
    setSelectedSlot(null);
  };

  const openCreateModal = (date: Date) => {
    if (isPast(date) && !isSameDay(date, new Date())) {
      setAlert({ message: '無法在過去的日期新增輔導時段', type: 'warning' });
      return;
    }
    resetForm();
    setForm(prev => ({
      ...prev,
      date: format(date, 'yyyy-MM-dd'),
    }));
    setIsModalOpen(true);
  };

  const openEditModal = (slot: TutoringSlot) => {
    setSelectedSlot(slot);
    setForm({
      teacherId: userInfo.id,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      participantLimit: slot.participantLimit,
      available: slot.available,
      title: slot.title,
      method: slot.method,
      locationType: slot.locationType,
      locationDetails: slot.locationDetails || '',
      qualifications: {
        type: slot.qualifications.classes && slot.qualifications.classes.length > 0 ? 'classes' : 'grades_subjects',
        grades: slot.qualifications.grades || [],
        subjects: slot.qualifications.subjects || [],
        classes: slot.qualifications.classes || [],
      },
      remarks: slot.remarks || '',
      mode: slot.mode,
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
    setAlert({ message: '', type: null });

    const payload = {
      ...form,
      teacherId: userInfo.id,
      participantLimit: Number(form.participantLimit),
    };

    if (isTimeConflict(payload, slots)) {
      setAlert({ message: '新增或編輯的時段與現有時段有時間衝突，請檢查。', type: 'error' });
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
        setAlert({ message: data.message, type: 'success' });
        setIsModalOpen(false);
        fetchSlots();
      } else {
        setAlert({ message: data.error || 'Operation failed', type: 'error' });
      }
    } catch (error) {
      console.error('Submission error:', error);
      setAlert({ message: 'An unexpected error occurred', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedSlot) return;

    if (selectedSlot.bookedStudents && selectedSlot.bookedStudents.length > 0) {
      setAlert({ message: '此時段已有學生預約，無法刪除。', type: 'error' });
      setIsConfirmOpen(false);
      return;
    }

    setLoading(true);
    setAlert({ message: '', type: null });

    try {
      const res = await fetch('/api/tutoring/delete-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selectedSlot.id, teacherId: userInfo.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setAlert({ message: data.message, type: 'success' });
        setIsConfirmOpen(false);
        fetchSlots();
      } else {
        setAlert({ message: data.error || 'Deletion failed', type: 'error' });
      }
    } catch (error) {
      console.error('Deletion error:', error);
      setAlert({ message: 'An unexpected error occurred', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCancelAppointment = async () => {
    if (!studentToCancel || !selectedSlot) {
      setAlert({ message: '無法取消預約，缺少必要資訊。', type: 'error' });
      return;
    }

    setLoading(true);
    setAlert({ message: '', type: null });

    try {
      const res = await fetch('/api/tutoring/cancel-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selectedSlot.id, studentId: studentToCancel.studentId }),
      });
      const data = await res.json();
      if (res.ok) {
        setAlert({ message: '預約已成功取消', type: 'success' });
        
        const updatedBookedStudents = currentBookedStudents.filter(s => s.studentId !== studentToCancel.studentId);
        setCurrentBookedStudents(updatedBookedStudents);

        if (updatedBookedStudents.length === 0) {
            setShowBookingsModal(false);
        }

        fetchSlots();
      } else {
        setAlert({ message: data.error || '取消預約失敗', type: 'error' });
      }
    } catch (error) {
      console.error('Cancellation error:', error);
      setAlert({ message: '發生未知錯誤，取消預約失敗', type: 'error' });
    } finally {
      setLoading(false);
      setIsCancelConfirmOpen(false);
      setStudentToCancel(null);
    }
  };

  const renderHeader = () => (
    <div className="flex justify-between items-center mb-4">
      <button onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))} className="p-2 rounded-full hover:bg-gray-200">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
      </button>
      <h2 className="text-xl font-semibold">
        {format(currentWeekStart, 'yyyy年 M月 d日', { locale: zhTW })} - {format(addDays(currentWeekStart, 6), 'yyyy年 M月 d日', { locale: zhTW })}
      </h2>
      <button onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))} className="p-2 rounded-full hover:bg-gray-200">
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
          className={`p-2 h-48 border rounded-lg flex flex-col overflow-hidden transition-colors ${
            isSameDay(day, selectedDate) ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-200'
          } ${
            isSameDay(day, new Date()) ? 'font-bold text-blue-600' : ''
          }`}
          key={day.toISOString()}
          onClick={() => setSelectedDate(day)}
        >
          <span className={`text-sm ${isSameDay(day, new Date()) ? 'text-blue-600' : ''}`}>{format(day, 'd')}</span>
          <div className="flex-1 overflow-y-auto mt-1 space-y-1 scrollbar-hide">
            {daySlots.map(slot => (
              <div
                key={slot.id}
                className={`text-xs p-1 rounded-md cursor-pointer ${
                  slot.bookedCount === slot.participantLimit ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  openEditModal(slot);
                }}
              >
                {slot.title} ({slot.bookedCount}/{slot.participantLimit})
                <br />
                {slot.startTime} - {slot.endTime}
              </div>
            ))}
          </div>
          {(!isPast(day) || isSameDay(day, new Date())) && (
            <button
              className="mt-1 text-blue-500 hover:text-blue-700 text-xs flex items-center justify-center"
              onClick={(e) => {
                e.stopPropagation();
                openCreateModal(day);
              }}
            >
              <PlusIcon className="w-3 h-3 mr-1" />新增
            </button>
          )}
        </div>
      );
    }
    return <div className="grid grid-cols-7 gap-1">{days}</div>;
  };

  const filteredSlots = useMemo(() => {
    return slots.filter(slot => isSameDay(parseISO(slot.date), selectedDate));
  }, [slots, selectedDate]);

  return (
    <div className="p-2 md:p-4 bg-gray-100">
      <div className="max-w-6xl mx-auto w-full px-2 sm:px-4 md:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">課程輔導管理</h1>

      {alert.message && (
        <AlertDialog
          message={alert.message}
          type={alert.type!}
          onClose={() => setAlert({ message: '', type: null })}
        />
      )}

      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-gray-700">輔導時段日曆</h2>
          <button
            onClick={() => openCreateModal(selectedDate)}
            className="btn-primary mt-4 md:mt-0 flex items-center"
          >
            <PlusIcon className="w-5 h-5 mr-2" />新增輔導時段
          </button>
        </div>
        {renderHeader()}
        {renderDays()}
      </div>

      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">{format(selectedDate, 'yyyy年 M月 d日', { locale: zhTW })} 的輔導時段</h2>
        {loading ? (
          <div className="flex justify-center items-center h-32"><LoadingSpinner size={40} /></div>
        ) : filteredSlots.length === 0 ? (
          <p className="text-gray-500 text-center">本日無輔導時段</p>
        ) : (
          <div className="space-y-4">
            {filteredSlots.map(slot => (
              <div key={slot.id} className="border border-gray-200 rounded-lg p-4 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold text-gray-800">{slot.title}</h3>
                  <div className="flex space-x-2">
                    <button onClick={() => openEditModal(slot)} className="p-1 rounded-full hover:bg-blue-100 text-blue-600">
                      <PencilIcon className="w-5 h-5" />
                    </button>
                    <button onClick={() => { setSelectedSlot(slot); setIsConfirmOpen(true); }} className="p-1 rounded-full hover:bg-red-100 text-red-600">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <p className="text-gray-600 mb-1"><ClockIcon className="w-4 h-4 inline-block mr-1" />{slot.startTime} - {slot.endTime}</p>
                <p className="text-gray-600 mb-1"><UserGroupIcon className="w-4 h-4 inline-block mr-1" />{slot.bookedCount}/{slot.participantLimit} 人</p>
                <p className="text-gray-600 mb-1"><ChatBubbleLeftRightIcon className="w-4 h-4 inline-block mr-1" />{slot.method}</p>
                <p className="text-gray-600 mb-1"><MapPinIcon className="w-4 h-4 inline-block mr-1" />{slot.locationType}: {slot.locationDetails || '-'}</p>
                <p className="text-gray-600 mb-1"><TagIcon className="w-4 h-4 inline-block mr-1" />資格: {
                  slot.qualifications.type === 'grades_subjects'
                    ? `${slot.qualifications.grades.join(', ')} / ${slot.qualifications.subjects.join(', ')}`
                    : slot.qualifications.type === 'classes'
                      ? `限班級: ${slot.qualifications.classes.join(', ')}`
                      : '未設定'
                }</p>

                <div className="flex justify-between items-center mt-4">
                  <button
                    onClick={() => openEditModal(slot)}
                    className="btn-primary btn-sm"
                  >
                    編輯時段
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSlot(slot);
                      setCurrentBookedStudents(slot.bookedStudents || []);
                      setCurrentSlotTitle(slot.title || '預約學生');
                      setShowBookingsModal(true);
                    }}
                    className="btn-primary btn-sm"
                    disabled={!slot.bookedStudents || slot.bookedStudents.length === 0}
                  >
                    查看預約 ({slot.bookedStudents?.length || 0})
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showBookingsModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">{`${currentSlotTitle} - 預約學生列表`}</h2>
              <button onClick={() => setShowBookingsModal(false)} className="text-gray-400 hover:text-gray-800 text-2xl font-bold">&times;</button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {currentBookedStudents.length > 0 ? (
                <div className="space-y-4">
                  {currentBookedStudents.map((student, index) => (
                    <div key={index} className="p-4 border rounded-md shadow-sm flex justify-between items-center">
                      <div>
                        <p className="font-semibold flex items-center"><UserIcon className="w-4 h-4 mr-2" />{student.studentName} ({student.studentDisplayId})</p>
                        <p className="text-sm text-gray-600 flex items-center"><EnvelopeIcon className="w-4 h-4 mr-2" />{student.studentEmail}</p>
                        <p className="text-sm text-gray-600 flex items-center"><ClipboardIcon className="w-4 h-4 mr-2" />問題描述: {student.problemDescription || '無'}</p>
                        {student.bookingTimestamp && <p className="text-xs text-gray-500 mt-1">預約時間: {new Date(student.bookingTimestamp).toLocaleString()}</p>}
                      </div>
                      <button
                        onClick={() => {
                          setStudentToCancel(student);
                          setIsCancelConfirmOpen(true);
                        }}
                        className="btn-primary btn-sm"
                      >
                        取消預約
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p>目前沒有學生預約此時段。</p>
              )}
            </div>
            <div className="flex justify-end mt-6">
              <button className="btn-primary">
                關閉
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">{selectedSlot ? '編輯輔導時段' : '新增輔導時段'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">標題</label>
                <input type="text" id="title" name="title" value={form.title} onChange={handleFormChange} required className="input-unified" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="date" className="block text-sm font-medium text-gray-700">日期</label>
                  <input type="date" id="date" name="date" value={form.date} onChange={handleFormChange} required className="input-unified" />
                </div>
                <div>
                  <label htmlFor="startTime" className="block text-sm font-medium text-gray-700">開始時間</label>
                  <input type="time" id="startTime" name="startTime" value={form.startTime} onChange={handleFormChange} required className="input-unified" />
                </div>
                <div>
                  <label htmlFor="endTime" className="block text-sm font-medium text-gray-700">結束時間</label>
                  <input type="time" id="endTime" name="endTime" value={form.endTime} onChange={handleFormChange} required className="input-unified" />
                </div>
                <div>
                  <label htmlFor="method" className="block text-sm font-medium text-gray-700">輔導模式</label>
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
                      { value: '', label: '請選擇' },
                      { value: '個別輔導', label: '個別輔導' },
                      { value: '團體輔導', label: '團體輔導' },
                    ]}
                    placeholder="請選擇"
                    className="mt-1 block w-full"
                  />
                </div>
                {form.method === '團體輔導' && (
                  <div>
                    <label htmlFor="participantLimit" className="block text-sm font-medium text-gray-700">參與人數上限</label>
                    <input
                      type="number"
                      id="participantLimit"
                      name="participantLimit"
                      value={form.participantLimit}
                      onChange={handleFormChange}
                      required
                      min="1"
                      className="input-unified"
                    />
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="locationType" className="block text-sm font-medium text-gray-700">輔導形式</label>
                <Dropdown
                  value={form.locationType}
                  onChange={(value) => handleFormChange({ target: { name: 'locationType', value } } as React.ChangeEvent<HTMLSelectElement>)}
                  options={[
                    { value: '實體輔導', label: '實體輔導' },
                    { value: '線上輔導', label: '線上輔導' },
                    { value: '與老師討論', label: '與老師討論' },
                  ]}
                  placeholder="請選擇"
                  className="mt-1 block w-full"
                />
              </div>
              {form.locationType === '實體輔導' && (
                <div>
                  <label htmlFor="locationDetails" className="block text-sm font-medium text-gray-700">輔導地點 (地址/教室)</label>
                  <input type="text" id="locationDetails" name="locationDetails" value={form.locationDetails} onChange={handleFormChange} className="input-unified" />
                </div>
              )}
              {form.locationType === '線上輔導' && (
                <div>
                  <label htmlFor="locationDetails" className="block text-sm font-medium text-gray-700">會議室網址</label>
                  <input type="text" id="locationDetails" name="locationDetails" value={form.locationDetails} onChange={handleFormChange} className="input-unified" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">資格限制類型</label>
                <div className="mt-1 flex space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio"
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
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio"
                      name="qualificationType"
                      value="classes"
                      checked={form.qualifications.type === 'classes'}
                      onChange={() => setForm(prev => ({
                        ...prev,
                        qualifications: { ...prev.qualifications, type: 'classes', grades: [], subjects: [] },
                      }))}
                    />
                    <span className="ml-2 text-gray-700">班級</span>
                  </label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-1">
                {form.qualifications.type === 'grades_subjects' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">年級</label>
                      <MultiSelectDropdown
                        options={gradeOptions}
                        selectedOptions={form.qualifications.grades}
                        onChange={(selectedValues) => setForm(prev => ({
                          ...prev,
                          qualifications: { ...prev.qualifications, grades: selectedValues },
                        }))}
                        placeholder="選擇年級"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">科目</label>
                      <MultiSelectDropdown
                        options={subjectOptions}
                        selectedOptions={form.qualifications.subjects}
                        onChange={(selectedValues) => setForm(prev => ({
                          ...prev,
                          qualifications: { ...prev.qualifications, subjects: selectedValues },
                        }))}
                        placeholder="選擇科目"
                      />
                    </div>
                  </>
                )}
                {form.qualifications.type === 'classes' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">班級</label>
                    <MultiSelectDropdown
                      options={dynamicClassOptions}
                      selectedOptions={form.qualifications.classes}
                      onChange={(selectedValues) => setForm(prev => ({
                        ...prev,
                        qualifications: { ...prev.qualifications, classes: selectedValues },
                      }))}
                      placeholder="選擇班級"
                    />
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-2">
                {form.qualifications.type === 'grades_subjects' && (
                  `已設定年級: ${form.qualifications.grades.join(', ')}, 科目: ${form.qualifications.subjects.join(', ')}`
                )}
                {form.qualifications.type === 'classes' && (
                  `已設定班級: ${form.qualifications.classes.length > 0 ? form.qualifications.classes.join(', ') : '不限'}`
                )}
                {!form.qualifications.type && '未設定任何資格限制'}
              </p>
              <div>
                <label htmlFor="remarks" className="block text-sm font-medium text-gray-700">備註</label>
                <textarea id="remarks" name="remarks" value={form.remarks} onChange={handleFormChange} rows={3} className="input-unified"></textarea>
              </div>
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn-primary">取消</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <LoadingSpinner size={40} color="white" /> : (selectedSlot ? '儲存變更' : '新增時段')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isConfirmOpen && selectedSlot && (
        <ConfirmDialog
          open={isConfirmOpen}
          message={`確定要刪除輔導時段「${selectedSlot.title}」嗎？此操作將同時刪除所有相關預約。`}
          onConfirm={handleDelete}
          onCancel={() => setIsConfirmOpen(false)}
          confirmText="刪除"
          cancelText="取消"
        />
      )}

      {isCancelConfirmOpen && studentToCancel && selectedSlot && (
        <ConfirmDialog
          open={isCancelConfirmOpen}
          message={`確定要取消學生 ${studentToCancel.studentName} (${studentToCancel.studentDisplayId}) 在「${selectedSlot.title}」的預約嗎？`}
          onConfirm={handleConfirmCancelAppointment}
          onCancel={() => {
            setIsCancelConfirmOpen(false);
            setStudentToCancel(null);
          }}
          confirmText="確定取消"
          cancelText="關閉"
        />
      )}
    </div>
    </div>
  );
};

export default TutoringManager;
