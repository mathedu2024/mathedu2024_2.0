'use client';

import React, { useState, useEffect, useCallback } from 'react';
import PageLoadingArea from './ui/PageLoadingArea';
import { tableActionStyles } from './ui';
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
    return <PageLoadingArea minHeight="min-h-[12rem]" />;
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
      <div className="flex-1 min-h-0">
        {/* 手機端：卡片式布局 */}
        <div className="md:hidden space-y-4">
          {filteredSlots.length > 0 ? (
            filteredSlots.map((slot) => {
              const isBooked = slot.bookedStudents?.some(student => student.studentId === studentInfo.id);
              const bookedCount = slot.bookedStudents?.length || 0;
              const isFull = bookedCount >= Number(slot.participantLimit);
              const canBook = !isBooked && !isFull;

              return (
                <div key={slot.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 relative overflow-hidden transition-shadow hover:shadow-md">
                  <div className={`absolute top-0 left-0 w-1 h-full ${isBooked ? 'bg-green-500' : isFull ? 'bg-red-500' : 'bg-primary'}`}></div>
                  
                  <div className="flex justify-between items-start mb-3 pl-3">
                    <h3 className="text-lg font-bold text-gray-900 flex-1 pr-2">{slot.title}</h3>
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                      isBooked ? 'bg-green-100 text-green-700' : 
                      isFull ? 'bg-red-100 text-red-700' : 
                      'bg-primary/10 text-primary'
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
                  
                  <div className="pt-3 border-t border-gray-100">
                    <button
                        onClick={() => handleOpenModal(slot)}
                        className={`w-full ${!canBook ? tableActionStyles.disabled : tableActionStyles.primary}`}
                        disabled={!canBook}
                    >
                        {isBooked ? '您已預約' : isFull ? '名額已滿' : '立即預約'}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                <i className="fas fa-calendar-times text-4xl mb-4 text-gray-300"></i>
                <h3 className="text-lg font-medium text-gray-900">尚無可預約時段</h3>
                <p className="text-gray-500 mt-1">目前沒有符合您資格的輔導時段。</p>
            </div>
          )}
        </div>

        {/* 桌面端：表格布局 */}
        {filteredSlots.length > 0 ? (
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-4 font-bold">標題</th>
                  <th scope="col" className="px-6 py-4 font-bold">日期</th>
                  <th scope="col" className="px-6 py-4 font-bold">時間</th>
                  <th scope="col" className="px-6 py-4 font-bold">老師</th>
                  <th scope="col" className="px-6 py-4 font-bold">輔導模式</th>
                  <th scope="col" className="px-6 py-4 font-bold">輔導方式</th>
                  <th scope="col" className="px-6 py-4 font-bold text-center">人數</th>
                  <th scope="col" className="px-6 py-4 font-bold text-center">狀態</th>
                  <th scope="col" className="px-6 py-4 font-bold text-right w-24">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSlots.map((slot) => {
                  const isBooked = slot.bookedStudents?.some(student => student.studentId === studentInfo.id);
                  const bookedCount = slot.bookedStudents?.length || 0;
                  const isFull = bookedCount >= Number(slot.participantLimit);
                  const canBook = !isBooked && !isFull;

                  return (
                    <tr key={slot.id} className="bg-white hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-gray-900 truncate" title={slot.title}>{slot.title}</td>
                      <td className="px-6 py-4">{slot.date}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-600">{`${slot.startTime} - ${slot.endTime}`}</td>
                      <td className="px-6 py-4">{slot.teacherName}</td>
                      <td className="px-6 py-4">{slot.locationType}</td>
                      <td className="px-6 py-4">{slot.method}</td>
                      <td className="px-6 py-4 text-center">{`${bookedCount} / ${slot.participantLimit}`}</td>
                      <td className="px-6 py-4 text-center">
                        {isBooked ? (
                          <span className="px-2 py-1 text-xs rounded-full font-medium bg-green-100 text-green-700">已預約</span>
                        ) : isFull ? (
                          <span className="px-2 py-1 text-xs rounded-full font-medium bg-red-100 text-red-700">已額滿</span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full font-medium bg-primary/10 text-primary">可預約</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenModal(slot)}
                          className={!canBook ? tableActionStyles.disabled : tableActionStyles.primary}
                          disabled={!canBook}
                        >
                          預約
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="hidden md:block text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <i className="fas fa-calendar-times text-4xl mb-4 text-gray-300"></i>
            <h3 className="text-lg font-medium text-gray-900">尚無可預約時段</h3>
            <p className="text-gray-500 mt-1">目前沒有符合您資格的輔導時段。</p>
          </div>
        )}
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