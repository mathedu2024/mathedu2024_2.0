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
    fetchSlots();
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
        <h2 className="text-xl text-gray-800 mb-4">可預約的輔導時段</h2>
        <div className="overflow-x-auto">
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