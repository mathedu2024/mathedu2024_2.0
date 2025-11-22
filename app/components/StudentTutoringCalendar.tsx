import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { confirm, showError } from '../utils/alerts';
import LoadingSpinner from './LoadingSpinner';


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
  isFull: boolean; // Add isFull property
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
        showError(data.error || '讀取輔導時段失敗');
      }
    } catch (error) {
      console.error('Error fetching all slots:', error);
      showError('讀取輔導時段時發生錯誤');
    } finally {
      setLoading(false);
    }
  }, [userInfo.id]);

  useEffect(() => {
    fetchAllSlots();
  }, [fetchAllSlots]);

  const isSlotQualified = useCallback((slot: TutoringSlot) => {
    // Defensively get student data.
    const studentGrade = userInfo?.grade;
    const studentEnrolledCourses = userInfo?.enrolledCourses || [];

    // Defensively get slot qualifications.
    const { type, grades, classes } = slot.qualifications || {};

    // If a slot has no restrictions, it's open.
    if (!type && (!grades || grades.length === 0) && (!classes || classes.length === 0)) {
      return true;
    }

    // Rule 2: Restriction by 'classes'
    if (type === 'classes') {
      if (!classes || classes.length === 0) return true;
      // This requires the student to have courses.
      return studentEnrolledCourses.some((courseName: string) => classes.includes(courseName));
    }

    // Rule 1: Restriction by 'grades_subjects'
    if (type === 'grades_subjects') {
      if (!grades || grades.length === 0) return true;
      // This requires the student to have a grade.
      return studentGrade && grades.includes(studentGrade);
    }
    
    // Default to false if the slot has some unhandled restriction type.
    return false;
  }, [userInfo]);

  const handleOpenBookingModal = (slot: TutoringSlot) => {
    setSelectedSlotToBook(slot);
    setBookingForm({
      studentName: userInfo.name || '',
      studentId: userInfo.studentId || '',
      email: userInfo.email || '',
      problemDescription: '',
    });
    setIsBookingModalOpen(true);
  };

  const handleBookAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotToBook) return;

    if (!bookingForm.studentName || !bookingForm.studentId) {
      showError('姓名和學號為必填欄位');
      return;
    }

    const isConfirmed = await confirm(`確定要預約 ${selectedSlotToBook.teacherName} 老師的 ${selectedSlotToBook.title} 輔導嗎？`);

    if (!isConfirmed) {
      return;
    }

    setLoading(true);

    try {
      const appointmentData = {
        slotId: selectedSlotToBook.id,
        studentId: userInfo.id,
        studentDisplayId: bookingForm.studentId, // This is the display ID
        studentName: bookingForm.studentName,
        studentEmail: bookingForm.email,
        problemDescription: bookingForm.problemDescription,
      };

      console.log('Sending appointment data:', appointmentData);

      const res = await fetch('/api/tutoring/book-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentData),
      });
      const data = await res.json();
      if (res.ok) {

        // Send email notification
        if (window.emailjs) {
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
          (window.emailjs as EmailJSService).send(
            "service_4cq55em", 
            "template_r6jbq0k", 
            templateParams, 
            "Oxm7lO3VyhQ4vxUTW"
          ).then((response: EmailJSResponseStatus) => {
            console.log('EmailJS SUCCESS!', response.status, response.text);
          }, (error: EmailJSResponseStatus) => {
            showError("郵件發送失敗，請稍後再試。");
            console.error('EmailJS FAILED...', JSON.stringify(error, null, 2));
          });
        } else {
          console.error("EmailJS script not loaded, skipping email notification.");
        }

        setIsBookingModalOpen(false);
        fetchAllSlots();
      } else {
        showError(data.error || '發生未知錯誤');
      }
    } catch (error) {
      console.error('Booking error:', error);
      showError('發生未知錯誤，請稍後再試');
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
    <>
      <h2 className="text-2xl font-bold mb-6">可預約輔導時段</h2>
      {loading ? (
        <div className="flex justify-center items-center h-64"><LoadingSpinner size={40} /></div>
      ) : filteredAndSortedSlots.length === 0 ? (
        <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm text-center text-gray-500 py-10">
          目前沒有可預約的輔導時段
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時間</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">老師</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">主題</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">模式</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">資格</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">預約</span></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedSlots.map(slot => {
                const isAvailable = !slot.isFull;
                const qualified = isSlotQualified(slot);
                const canBook = isAvailable && qualified;

                return (
                  <tr key={slot.id} className={!canBook ? 'bg-gray-50 text-gray-400' : ''}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">{format(parseISO(slot.date), 'yyyy-MM-dd EEEE', { locale: zhTW })}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{slot.startTime} - {slot.endTime}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{slot.teacherName || '未知老師'}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{slot.title}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">{slot.method}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {slot.qualifications.type === 'classes' ? (
                        <div className="text-xs">
                          <p><b>要求班級:</b> {JSON.stringify(slot.qualifications.classes)}</p>
                          <p className="text-blue-600"><b>學生擁有:</b> {JSON.stringify(userInfo?.enrolledCourses)}</p>
                          <p className={qualified ? 'text-green-600 font-bold' : 'text-red-600 font-bold'}>
                            <b>資格: {qualified ? '符合' : '不符合'}</b>
                          </p>
                        </div>
                      ) : (
                        slot.qualifications.classes && slot.qualifications.classes.length > 0 
                          ? `限: ${slot.qualifications.classes.join(', ')}`
                          : `限: ${slot.qualifications.grades.join(', ') || '不限年級'}`
                      )}
                    </td>                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${!slot.isFull ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {!slot.isFull ? '可預約' : '已額滿'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => handleOpenBookingModal(slot)}
                        className="btn-primary btn-sm"
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
      )}

      {isBookingModalOpen && selectedSlotToBook && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-4">預約輔導時段</h2>
            <form onSubmit={handleBookAppointment} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="studentName" className="block text-sm font-medium text-gray-700">姓名</label>
                  <input type="text" id="studentName" value={bookingForm.studentName} onChange={(e) => setBookingForm({...bookingForm, studentName: e.target.value})} className="input-unified mt-1" required />
                </div>
                <div>
                  <label htmlFor="studentId" className="block text-sm font-medium text-gray-700">學號</label>
                  <input type="text" id="studentId" value={bookingForm.studentId} onChange={(e) => setBookingForm({...bookingForm, studentId: e.target.value})} className="input-unified mt-1" required />
                </div>
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">電子郵件</label>
                <input type="email" id="email" value={bookingForm.email} onChange={(e) => setBookingForm({...bookingForm, email: e.target.value})} className="input-unified mt-1" />
              </div>
              {selectedSlotToBook.method === '個別輔導' && (
                <div>
                  <label htmlFor="problemDescription" className="block text-sm font-medium text-gray-700">您想討論的問題或需求</label>
                  <textarea
                    id="problemDescription"
                    value={bookingForm.problemDescription}
                    onChange={(e) => setBookingForm({...bookingForm, problemDescription: e.target.value})}
                    rows={4}
                    className="input-unified mt-1"
                    placeholder="請簡要說明您希望輔導的內容或遇到的問題"
                    required
                  ></textarea>
                </div>
              )}
              <div className="flex justify-end space-x-3 pt-4">
                <button type="button" onClick={() => setIsBookingModalOpen(false)} className="btn-primary">取消</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <LoadingSpinner size={40} color="white" /> : '確認預約'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default StudentTutoringCalendar;