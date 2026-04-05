'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import alerts from '@/utils/alerts';
import LoadingSpinner from './LoadingSpinner';
import { 
  CalendarIcon, 
  ClockIcon, 
  UserIcon, 
  ChatBubbleLeftRightIcon, 
  TagIcon, 
} from '@heroicons/react/24/outline';
import emailjs from '@emailjs/browser';
import Swal from 'sweetalert2';

interface TutoringSlot {
  id: string;
  teacherId: string;
  teacherName?: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  method: string;
  locationType: string;
  locationDetails: string | null;
  participantLimit: number;
  bookedCount: number;
  isFull: boolean;
  qualifications: {
    type?: 'grades_subjects' | 'classes';
    grades: string[];
    subjects: string[];
    classes: string[];
  };
  remarks: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface StudentTutoringCalendarProps {
  userInfo: {
    id: string;
    name: string;
    account: string;
    role: string;
    studentId: string;
    enrolledCourses?: string[];
    grade?: string;
    email?: string;
  };
}

const StudentTutoringCalendar: React.FC<StudentTutoringCalendarProps> = ({ userInfo }) => {
  const [slots, setSlots] = useState<TutoringSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [selectedSlotToBook, setSelectedSlotToBook] = useState<TutoringSlot | null>(null);
  const [bookingForm, setBookingForm] = useState({
    studentName: '',
    studentId: '',
    email: '',
    problemDescription: '',
  });

  const fetchAllSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tutoring/list-all-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: userInfo.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setSlots(data.slots);
      } else {
        alerts.showError(data.error || '讀取輔導時段失敗');
      }
    } catch (error) {
      console.error('Error fetching all slots:', error);
      alerts.showError('讀取輔導時段時發生錯誤');
    } finally {
      setLoading(false);
    }
  }, [userInfo.id]);

  useEffect(() => {
    fetchAllSlots();
  }, [fetchAllSlots]);

  // 當瀏覽器分頁重新獲得焦點時，重新載入輔導時段列表，確保資料為最新
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchAllSlots();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchAllSlots]);

  const isSlotQualified = useCallback((slot: TutoringSlot) => {
    console.log(`[isSlotQualified] Checking qualification for slot: ${slot.title} (ID: ${slot.id})`);
    const studentGrade = userInfo?.grade;
    const studentEnrolledCourses = userInfo?.enrolledCourses || [];
    const { type, grades, classes } = slot.qualifications || {};

    if (!type && (!grades || grades.length === 0) && (!classes || classes.length === 0)) {
      return true;
    }

    console.log(`  Slot qualification type: ${type}`);
    console.log(`  Student Grade: ${studentGrade}`);
    console.log(`  Student Enrolled Courses: ${studentEnrolledCourses}`);

    if (type === 'classes') {
      if (!classes || classes.length === 0) return true;
      const result = studentEnrolledCourses.some((courseName: string) => classes.includes(courseName));
      console.log(`  Classes qualification result: ${result}`);
      return result;
    }

    if (type === 'grades_subjects') {
      if (!grades || grades.length === 0) return true;
      const result = studentGrade && grades.includes(studentGrade);
      console.log(`  Grades/Subjects qualification result: ${result}`);
      return result;
    }
    console.log(`  Unknown qualification type or no match, returning false.`);
    return false; // Default to false if no specific qualification type matches
  }, [userInfo]);

  const handleOpenBookingModal = (slot: TutoringSlot) => {
    setSelectedSlotToBook(slot);
    setBookingForm({
      studentName: userInfo.name || '',
      studentId: userInfo.studentId || '',
      email: userInfo.email || '',
      problemDescription: '',
    });
    console.log(`[handleOpenBookingModal] Opening booking modal for slot: ${slot.title} (ID: ${slot.id})`);
    setIsBookingModalOpen(true);
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotToBook) return;

    if (!bookingForm.studentName || !bookingForm.studentId) {
      alerts.showError('姓名和學號為必填欄位');
      return;
    }

    const isConfirmed = await Swal.fire({
      title: '確認預約',
      text: `確定要預約 ${selectedSlotToBook.teacherName} 老師的 ${selectedSlotToBook.title} 輔導嗎？`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '確認預約',
      cancelButtonText: '取消'
    });

    if (!isConfirmed.isConfirmed) return;

    setLoading(true);

    try {
      const appointmentData = {
        slotId: selectedSlotToBook.id,
        studentId: userInfo.id,
        studentDisplayId: bookingForm.studentId,
        studentName: bookingForm.studentName,
        studentEmail: bookingForm.email,
        problemDescription: bookingForm.problemDescription,
      };

      const res = await fetch('/api/tutoring/book-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentData),
      });
      const data = await res.json();
      if (res.ok) {
        // Send email notification
        // Note: window.emailjs logic from original snippet is adapted here
        // Assuming emailjs is initialized globally in layout or similar
        // For type safety, we're using the imported emailjs package if available, 
        // or falling back to window.emailjs with type assertion
        
        const templateParams = {
            name: bookingForm.studentName,
            studentId: bookingForm.studentId,
            topic: selectedSlotToBook.title || '',
            time: `${selectedSlotToBook.date} ${selectedSlotToBook.startTime} - ${selectedSlotToBook.endTime}`,
            teacher: selectedSlotToBook.teacherName || '',
            mode: selectedSlotToBook.locationType || '',
            format: selectedSlotToBook.method || '',
            studentEmail: bookingForm.email,
        };

        // Try using the imported module first if configured, else fallback to window
        try {
             await emailjs.send(
                "service_4cq55em", 
                "template_r6jbq0k", 
                templateParams, 
                "Oxm7lO3VyhQ4vxUTW"
            );
            console.log('EmailJS sent successfully');
        } catch (emailError) {
             console.warn('EmailJS send failed, but booking succeeded:', emailError);
             // We don't block success message for email failure, but could notify user
        }

        alerts.showSuccess('預約成功！');
        setIsBookingModalOpen(false);
        fetchAllSlots();
      } else {
        alerts.showError(data.error || '發生未知錯誤');
      }
    } catch (error) {
      console.error('Booking error:', error);
      alerts.showError('發生未知錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const filteredAndSortedSlots = useMemo(() => {
    return slots
      .filter(slot => {
        const isFutureSlot = parseISO(slot.date) >= new Date();
        return isFutureSlot;
      })
      .sort((a, b) => {
        const dateA = parseISO(a.date).getTime();
        const dateB = parseISO(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return a.startTime.localeCompare(b.startTime);
      });
  }, [slots]);

  return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
        <CalendarIcon className="w-8 h-8 mr-3 text-indigo-600" />
        可預約輔導時段
      </h2>
      
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size={40} />
        </div>
      ) : filteredAndSortedSlots.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 rounded-2xl shadow-sm text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <ClockIcon className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">目前沒有可預約的時段</h3>
          <p className="text-gray-500 mt-1">請稍後再回來查看。</p>
        </div>
      ) : (
        <>
          {/* Mobile View: Cards */}
          <div className="md:hidden space-y-4">
            {filteredAndSortedSlots.map(slot => {
              const isAvailable = !slot.isFull;
              const qualified = isSlotQualified(slot);
              console.log(`[Slot Render] Slot: ${slot.title}, isAvailable: ${isAvailable}, qualified: ${qualified}, canBook: ${isAvailable && qualified}`);
              const canBook = isAvailable && qualified;

              return (
                <div key={slot.id} className={`bg-white border rounded-xl shadow-sm p-5 relative overflow-hidden transition-shadow ${!canBook ? 'border-gray-100 bg-gray-50 opacity-80' : 'border-gray-200'}`}>
                  <div className={`absolute top-0 left-0 w-1 h-full ${!isAvailable ? 'bg-red-500' : !qualified ? 'bg-amber-500' : 'bg-green-500'}`}></div>
                  
                  <div className="flex justify-between items-start mb-3 pl-3">
                    <div>
                        <h3 className="font-bold text-lg text-gray-900 line-clamp-1">{slot.title}</h3>
                        <p className="text-sm text-gray-500 mt-1 flex items-center font-medium">
                            <CalendarIcon className="w-4 h-4 mr-1" />
                            {format(parseISO(slot.date), 'yyyy-MM-dd (EEE)', { locale: zhTW })}
                        </p>
                    </div>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                        !isAvailable ? 'bg-red-100 text-red-700' : 
                        !qualified ? 'bg-amber-100 text-amber-700' : 
                        'bg-green-100 text-green-700'
                    }`}>
                        {!isAvailable ? '已額滿' : !qualified ? '資格不符' : '可預約'}
                    </span>
                  </div>

                  <div className="pl-3 space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex items-center"><ClockIcon className="w-4 h-4 mr-2 text-indigo-400" /> {slot.startTime} - {slot.endTime}</div>
                    <div className="flex items-center"><UserIcon className="w-4 h-4 mr-2 text-indigo-400" /> {slot.teacherName || '未知老師'}</div>
                    <div className="flex items-center"><ChatBubbleLeftRightIcon className="w-4 h-4 mr-2 text-indigo-400" /> {slot.method} ({slot.locationType})</div>
                    <div className="flex items-start">
                        <TagIcon className="w-4 h-4 mr-2 text-indigo-400 mt-0.5 flex-shrink-0" />
                        <span className="line-clamp-2">
                            {slot.qualifications.type === 'classes' ? (
                                <>限班級: {slot.qualifications.classes.join(', ')}</>
                            ) : (
                                <>{slot.qualifications.grades.join(', ') || '不限'} / {slot.qualifications.subjects.join(', ') || '不限'}</>
                            )}
                        </span>
                    </div>
                  </div>

                  <div className="pl-3 pt-3 border-t border-gray-100">
                    <button
                        onClick={() => handleOpenBookingModal(slot)}
                        className={`w-full py-2 rounded-xl font-medium transition-colors shadow-sm flex justify-center items-center ${
                            !canBook 
                            ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                        disabled={!canBook}
                    >
                        {canBook ? '立即預約' : '無法預約'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-6 py-4 font-bold">日期</th>
                  <th scope="col" className="px-6 py-4 font-bold">時間</th>
                  <th scope="col" className="px-6 py-4 font-bold">老師</th>
                  <th scope="col" className="px-6 py-4 font-bold">主題</th>
                  <th scope="col" className="px-6 py-4 font-bold">模式</th>
                  <th scope="col" className="px-6 py-4 font-bold">資格限制</th>
                  <th scope="col" className="px-6 py-4 font-bold text-center">狀態</th>
                  <th scope="col" className="px-6 py-4 font-bold text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAndSortedSlots.map(slot => {
                  const isAvailable = !slot.isFull;
                  const qualified = isSlotQualified(slot);
                  const canBook = isAvailable && qualified;

                  return (
                    <tr key={slot.id} className={`hover:bg-gray-50 transition-colors ${!canBook ? 'bg-gray-50/50' : 'bg-white'}`}>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {format(parseISO(slot.date), 'yyyy-MM-dd (EEE)', { locale: zhTW })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 font-mono">
                        {slot.startTime} - {slot.endTime}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                            <div className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-xs mr-2 font-bold">
                                {slot.teacherName?.[0] || 'T'}
                            </div>
                            {slot.teacherName || '未知老師'}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-800">{slot.title}</td>
                      <td className="px-6 py-4 text-gray-600">{slot.method}</td>
                      <td className="px-6 py-4 max-w-xs">
                        <div className="text-xs text-gray-500">
                            {slot.qualifications.type === 'classes' ? (
                                <div className="flex flex-col">
                                    <span className="font-medium">限班級:</span>
                                    <span className="truncate" title={slot.qualifications.classes.join(', ')}>{slot.qualifications.classes.join(', ')}</span>
                                    <span className={qualified ? 'text-green-600 font-bold mt-1' : 'text-red-500 font-bold mt-1'}>
                                        {qualified ? '符合' : '不符合'}
                                    </span>
                                </div>
                            ) : (
                                <div className="flex flex-col">
                                    <span className="font-medium">限: {slot.qualifications.grades.join(', ') || '不限'}</span>
                                    <span className={qualified ? 'text-green-600 font-bold mt-1' : 'text-red-500 font-bold mt-1'}>
                                        {qualified ? '符合' : '不符合'}
                                    </span>
                                </div>
                            )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full ${
                            !isAvailable ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                        }`}>
                            {!isAvailable ? '已額滿' : '可預約'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => handleOpenBookingModal(slot)}
                          className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-lg shadow-sm transition-all ${
                            !canBook
                              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                              : 'text-white bg-indigo-600 hover:bg-indigo-700'
                          }`}
                          disabled={!canBook}
                        >
                          {canBook ? '預約' : '無法預約'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {isBookingModalOpen && selectedSlotToBook && (
        createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[9999] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-gray-100 animate-bounce-in">
            <h2 className="text-xl font-bold mb-4 text-gray-800 border-l-4 border-indigo-500 pl-3">預約輔導時段</h2>
            
            <div className="mb-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                <h3 className="font-bold text-indigo-900 mb-2">{selectedSlotToBook.title}</h3>
                <div className="text-sm text-indigo-700 space-y-1">
                    <p>時間：{format(parseISO(selectedSlotToBook.date), 'yyyy-MM-dd')} {selectedSlotToBook.startTime}-{selectedSlotToBook.endTime}</p>
                    <p>老師：{selectedSlotToBook.teacherName}</p>
                    <p>模式：{selectedSlotToBook.locationType} ({selectedSlotToBook.method})</p>
                </div>
            </div>

            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="studentName" className="block text-sm font-bold text-gray-700 mb-1">姓名 <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    id="studentName" 
                    value={bookingForm.studentName} 
                    onChange={(e) => setBookingForm({...bookingForm, studentName: e.target.value})} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-gray-50" 
                    required 
                    readOnly 
                  />
                </div>
                <div>
                  <label htmlFor="studentId" className="block text-sm font-bold text-gray-700 mb-1">學號 <span className="text-red-500">*</span></label>
                  <input 
                    type="text" 
                    id="studentId" 
                    value={bookingForm.studentId} 
                    onChange={(e) => setBookingForm({...bookingForm, studentId: e.target.value})} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all bg-gray-50" 
                    required 
                    readOnly 
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-bold text-gray-700 mb-1">電子郵件</label>
                <input 
                    type="email" 
                    id="email" 
                    value={bookingForm.email} 
                    onChange={(e) => setBookingForm({...bookingForm, email: e.target.value})} 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" 
                    placeholder="接收預約通知用 (選填)"
                />
              </div>

              {selectedSlotToBook.method === '個別輔導' && (
                <div>
                  <label htmlFor="problemDescription" className="block text-sm font-bold text-gray-700 mb-1">問題描述 / 備註</label>
                  <textarea
                    id="problemDescription"
                    value={bookingForm.problemDescription}
                    onChange={(e) => setBookingForm({...bookingForm, problemDescription: e.target.value})}
                    rows={4}
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                    placeholder="請簡要說明您希望輔導的內容或遇到的問題..."
                    required
                  ></textarea>
                </div>
              )}
              
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button 
                    type="button" 
                    onClick={() => setIsBookingModalOpen(false)} 
                    className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                >
                    取消
                </button>
                <button 
                    type="submit" 
                    className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm font-medium transition-colors disabled:opacity-70 flex items-center" 
                    disabled={loading}
                >
                  {loading ? (
                    <>
                        <LoadingSpinner size={16} color="white" />
                        <span className="ml-2">處理中...</span>
                    </>
                  ) : '確認預約'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body)
      )}
    </div>
  );
};

export default StudentTutoringCalendar;