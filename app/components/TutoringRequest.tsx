'use client';

import React, { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';
import BookingModal from './BookingModal';
import { TutoringSlot } from '@/services/interfaces';
import { useStudentInfo } from '../student/StudentInfoContext';

const TutoringRequest: React.FC = () => {
  const { studentInfo, loading: studentInfoLoading } = useStudentInfo();
  const [slots, setSlots] = useState<TutoringSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TutoringSlot | null>(null);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tutoring/list-all-slots');
      if (!res.ok) {
        throw new Error('Failed to fetch tutoring slots');
      }
      const data = await res.json();
      setSlots(data.slots || []);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSlots().catch(error => {
      console.error('Unhandled error in fetchSlots:', error);
    });
  }, [fetchSlots]);

  const handleOpenModal = (slot: TutoringSlot) => {
    setSelectedSlot(slot);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedSlot(null);
    setIsModalOpen(false);
  };

  const handleBookingSuccess = () => {
    fetchSlots(); // Refresh the slots list
  };

  const filteredSlots = slots.filter(slot => {
    if (!studentInfo) return false; // Don't show slots if student info is not available
    // 1. 過濾掉過期的時段
    const now = new Date();
    const slotEndTime = new Date(`${slot.date}T${slot.endTime}`);
    if (slotEndTime < now) {
      return false;
    }

    // 2. 根據資格進行過濾
    const { qualifications } = slot;
    if (!qualifications || !qualifications.type) {
      return true; // 沒有設定資格限制，則顯示
    }

    const studentGrade = studentInfo?.grade;
    const studentEnrolledCourses = studentInfo?.enrolledCourses || [];

    if (qualifications.type === 'grades_subjects') {
      const { grades } = qualifications;
      if (!grades || grades.length === 0) {
        return true; // 沒有年級限制
      }
      // 學生年級符合就顯示
      return studentGrade && grades.includes(studentGrade);
    }

    if (qualifications.type === 'classes') {
      const { classes } = qualifications;
      if (!classes || classes.length === 0) {
        return true; // 沒有班級限制
      }
      // 檢查老師要求的課程名稱，是否為學生報名課程字串的「開頭部分」
      return classes.some(requiredName =>
        studentEnrolledCourses.some((studentCourse: unknown) =>
          typeof studentCourse === 'string' && studentCourse.startsWith(requiredName)
        )
      );
    }

    return true; // 未知的資格類型，預設顯示
  });

  if (loading || studentInfoLoading) {
    return <LoadingSpinner text="載入輔導時段中..." />;
  }

  if (error) {
    return (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-center mb-4">
            <i className="fas fa-exclamation-circle mr-2"></i> {error}
        </div>
    );
  }

  if (!studentInfo) {
    return (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-100 text-center mb-4">
            <i className="fas fa-exclamation-circle mr-2"></i> 無法載入學生資訊
        </div>
    );
  }

  return (
    <>
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 h-full flex flex-col">
        <h2 className="text-2xl font-bold mb-6 flex-shrink-0 text-gray-800 flex items-center">
            <i className="fas fa-calendar-check mr-3 text-indigo-600"></i>
            可預約的輔導時段
        </h2>
        
        {/* 手機端：卡片式布局 */}
        <div className="md:hidden space-y-4">
          {filteredSlots.length > 0 ? (
            filteredSlots.map((slot) => {
              const isBooked = slot.bookedStudents?.some(student => student.studentId === studentInfo.id);
              const bookedCount = slot.bookedStudents?.length || 0;
              const isFull = bookedCount >= Number(slot.participantLimit);
              const canBook = !isBooked && !isFull;

              return (
                <div key={slot.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 relative overflow-hidden transition-shadow hover:shadow-md">
                  <div className={`absolute top-0 left-0 w-1 h-full ${isBooked ? 'bg-green-500' : isFull ? 'bg-red-500' : 'bg-indigo-500'}`}></div>
                  
                  <div className="flex justify-between items-start mb-3 pl-3">
                    <h3 className="text-lg font-bold text-gray-900 flex-1 pr-2">{slot.title}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      isBooked ? 'bg-green-100 text-green-700' : 
                      isFull ? 'bg-red-100 text-red-700' : 
                      'bg-indigo-100 text-indigo-700'
                    }`}>
                      {isBooked ? '已預約' : isFull ? '已額滿' : '可預約'}
                    </span>
                  </div>
                  
                  <div className="pl-3 space-y-2 text-sm text-gray-600 mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">日期:</span>
                      <span className="font-medium text-gray-800">{slot.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">時間:</span>
                      <span className="font-medium text-gray-800">{slot.startTime} - {slot.endTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">老師:</span>
                      <span className="font-medium text-gray-800">{slot.teacherName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">模式:</span>
                      <span className="font-medium text-gray-800">{slot.locationType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">方式:</span>
                      <span className="font-medium text-gray-800">{slot.method}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">人數:</span>
                      <span className="font-medium text-gray-800">{bookedCount} / {slot.participantLimit}</span>
                    </div>
                  </div>
                  
                  <div className="pl-3 pt-3 border-t border-gray-100">
                    <button
                        onClick={() => handleOpenModal(slot)}
                        className={`w-full py-2 rounded-lg font-medium transition-colors shadow-sm ${
                            !canBook 
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                        }`}
                        disabled={!canBook}
                    >
                        {isBooked ? '您已預約' : isFull ? '名額已滿' : '立即預約'}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">
                <i className="fas fa-calendar-times text-4xl mb-3 text-gray-300"></i>
                <p>目前沒有符合您資格的輔導時段</p>
            </div>
          )}
        </div>

        {/* 桌面端：表格布局 */}
        <div className="hidden md:block overflow-hidden bg-white rounded-xl shadow-sm border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-1/4">標題</th>
                <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">日期</th>
                <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">時間</th>
                <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">老師</th>
                <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">輔導模式</th>
                <th scope="col" className="px-4 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">輔導方式</th>
                <th scope="col" className="px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">人數</th>
                <th scope="col" className="px-4 py-4 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">狀態</th>
                <th scope="col" className="px-6 py-4 text-right text-xs font-bold text-gray-500 uppercase tracking-wider w-24">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSlots.length > 0 ? (
                filteredSlots.map((slot) => {
                    const isBooked = slot.bookedStudents?.some(student => student.studentId === studentInfo.id);
                    const bookedCount = slot.bookedStudents?.length || 0;
                    const isFull = bookedCount >= Number(slot.participantLimit);
                    const canBook = !isBooked && !isFull;

                    return (
                        <tr key={slot.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 text-sm font-medium text-gray-900 truncate" title={slot.title}>{slot.title}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{slot.date}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{`${slot.startTime} - ${slot.endTime}`}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{slot.teacherName}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{slot.locationType}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{slot.method}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{`${bookedCount} / ${slot.participantLimit}`}</td>
                            <td className="px-4 py-4 whitespace-nowrap text-sm text-center">
                            {isBooked ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    已預約
                                </span>
                            ) : isFull ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    已額滿
                                </span>
                            ) : (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                                    可預約
                                </span>
                            )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                                onClick={() => handleOpenModal(slot)}
                                className={`inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm transition-all ${
                                    !canBook
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'text-white bg-indigo-600 hover:bg-indigo-700'
                                }`}
                                disabled={!canBook}
                            >
                                預約
                            </button>
                            </td>
                        </tr>
                    );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-6 py-16 text-center text-gray-400">
                    <i className="fas fa-calendar-times text-4xl mb-4 text-gray-300"></i>
                    <p>目前沒有符合您資格的輔導時段</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {isModalOpen && (
        <BookingModal 
          slot={selectedSlot}
          userInfo={studentInfo}
          onClose={handleCloseModal}
          onSuccess={handleBookingSuccess}
        />
      )}
    </>
  );
}
export default TutoringRequest;