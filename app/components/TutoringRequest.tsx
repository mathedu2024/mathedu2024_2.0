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
      setError(err.message);
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
        studentEnrolledCourses.some(studentCourse =>
          studentCourse.startsWith(requiredName)
        )
      );
    }

    return true; // 未知的資格類型，預設顯示
  });

  if (loading || studentInfoLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <div className="text-red-500">Error: {error}</div>;
  }

  if (!studentInfo) {
    return <div className="text-red-500">Error: Could not load student information.</div>;
  }

  return (
    <>
      <div className="">
        <h2 className="text-lg md:text-xl text-gray-800 mb-4">可預約的輔導時段</h2>
        {/* 手機端：卡片式布局 */}
        <div className="md:hidden space-y-4">
          {filteredSlots.length > 0 ? (
            filteredSlots.map((slot) => {
              const isBooked = slot.bookedStudents?.some(student => student.studentId === studentInfo.id);
              const bookedCount = slot.bookedStudents?.length || 0;
              const isFull = bookedCount >= Number(slot.participantLimit);
              const canBook = !isBooked && !isFull;

              return (
                <div key={slot.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <h3 className="text-base font-semibold text-gray-900 flex-1 pr-2">{slot.title}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      isBooked ? 'bg-green-100 text-green-800' : 
                      isFull ? 'bg-red-100 text-red-800' : 
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {isBooked ? '已預約' : isFull ? '已額滿' : '可預約'}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm text-gray-600">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-20">日期：</span>
                      <span>{slot.date}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-20">時間：</span>
                      <span>{slot.startTime} - {slot.endTime}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-20">老師：</span>
                      <span>{slot.teacherName}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-20">模式：</span>
                      <span>{slot.locationType}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-20">方式：</span>
                      <span>{slot.method}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-20">人數：</span>
                      <span>{bookedCount} / {slot.participantLimit}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenModal(slot)}
                    className="w-full btn-primary text-sm py-2"
                    disabled={!canBook}
                  >
                    預約
                  </button>
                </div>
              );
            })
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6 text-center text-gray-500">
              <p>目前沒有符合您資格的輔導時段</p>
            </div>
          )}
        </div>

        {/* 桌面端：表格布局 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">標題</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時間</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">老師</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">輔導模式</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">輔導方式</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">人數限制</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                <th scope="col" className="relative px-6 py-3 w-auto">
                  <span className="sr-only">Request</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredSlots.length > 0 ? (
                filteredSlots.map((slot) => (
                  <tr key={slot.id}>
                    <td className="px-6 py-4 text-sm font-medium text-gray-900 truncate">{slot.title}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{slot.date}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{`${slot.startTime} - ${slot.endTime}`}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{slot.teacherName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{slot.locationType}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{slot.method}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{`${slot.bookedStudents?.length || 0} / ${slot.participantLimit}`}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {(() => {
                        const isBooked = slot.bookedStudents?.some(student => student.studentId === studentInfo.id);
                        const bookedCount = slot.bookedStudents?.length || 0;
                        const isFull = bookedCount >= Number(slot.participantLimit);

                        if (isBooked) {
                          return <span className="text-green-500">已預約</span>;
                        }
                        if (isFull) {
                          return <span className="text-red-500">已額滿</span>;
                        }
                        return <span className="text-blue-500">可預約</span>;
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleOpenModal(slot)}
                        className="btn-primary text-sm px-3 py-1"
                        disabled={slot.bookedStudents?.some(student => student.studentId === studentInfo.id) || (slot.bookedStudents?.length || 0) >= Number(slot.participantLimit)}
                      >
                        預約
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-8">
                    <p className="text-gray-500">目前沒有符合您資格的輔導時段</p>
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