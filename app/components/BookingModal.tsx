'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TutoringSlot } from '@/services/interfaces';
import LoadingSpinner from './LoadingSpinner';

interface BookingModalProps {
  slot: TutoringSlot | null;
  userInfo: {
    id: string;
    name: string;
    account: string;
    role: string;
    studentId: string;
    enrolledCourses?: string[];
    email?: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

const overlayVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

const modalVariants = {
  hidden: { y: -50, opacity: 0 },
  visible: { y: 0, opacity: 1 },
  exit: { y: 50, opacity: 0 },
};

const BookingModal: React.FC<BookingModalProps> = ({ slot, userInfo, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    studentId: userInfo?.studentId || '',
    studentName: userInfo?.name || '',
    studentEmail: userInfo?.email || '',
    problemDescription: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/tutoring/book-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          slotId: slot.id, 
          studentId: userInfo.id, 
          ...formData 
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to book appointment');
      }

      if (window.emailjs) {
        (window.emailjs as EmailJSService).send("service_4cq55em", "template_r6jbq0k", {            name: formData.studentName,
            studentId: formData.studentId,
            topic: slot.title || '',
            time: `${slot.date} ${slot.startTime} - ${slot.endTime}`,
            teacher: slot.teacherName || '',
            mode: slot.locationType || '',
            format: slot.method || '',
            studentEmail: formData.studentEmail,
        }, "Oxm7lO3VyhQ4vxUTW").then((response: EmailJSResponseStatus) => {
          console.log('EmailJS SUCCESS!', response.status, response.text);
        }, (error: EmailJSResponseStatus) => {
          alert("郵件發送失敗，請稍後再試。");
          console.error('EmailJS FAILED...', JSON.stringify(error, null, 2));
        });
      } else {
        console.error("EmailJS script not loaded, skipping email notification.");
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderQualifications = () => {
    if (!slot.qualifications) return '不限';

    const { type, grades, subjects, classes } = slot.qualifications;

    if (type === 'classes') {
      return `班級: ${classes?.join(', ') || '不限'}`;
    }

    if (type === 'grades_subjects') {
      const gradeStr = `年級: ${grades?.join(', ') || '不限'}`;
      const subjectStr = `科目: ${subjects?.join(', ') || '不限'}`;
      return `${gradeStr} / ${subjectStr}`;
    }

    return '不限';
  };

  return (
    <AnimatePresence>
      {slot && (
        <motion.div 
          className="fixed inset-0 bg-gray-600 bg-opacity-50 flex justify-center items-center z-50 p-4"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <motion.div 
            className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            variants={modalVariants}
          >
            <h2 className="text-2xl font-bold mb-4">預約輔導</h2>
            
            <div className="mb-6 border-b pb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">輔導資訊</h3>
              <p>標題: {slot.title}</p>
              <p>日期: {slot.date}</p>
              <p>時間: {`${slot.startTime} - ${slot.endTime}`}</p>
              <p>老師: {slot.teacherName}</p>
              <p>輔導模式: {slot.locationType}</p>
              <p>輔導方式: {slot.method}</p>
              {slot.locationType !== '線上輔導' && <p>地點: {slot.locationDetails}</p>}
              <p>狀態: {slot.isFull ? '已額滿' : '可預約'}</p>
              <p>預約資格: {renderQualifications()}</p>
              {slot.remarks && <p>備註: {slot.remarks}</p>}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="studentId" className="block text-sm font-medium text-gray-700">學號</label>
                <input type="text" id="studentId" name="studentId" value={formData.studentId} disabled className="input-unified bg-gray-100" />
              </div>
              <div>
                <label htmlFor="studentName" className="block text-sm font-medium text-gray-700">姓名</label>
                <input type="text" id="studentName" name="studentName" value={formData.studentName} disabled className="input-unified bg-gray-100" />
              </div>
              <div>
                <label htmlFor="studentEmail" className="block text-sm font-medium text-gray-700">電子郵件</label>
                <input type="email" id="studentEmail" name="studentEmail" value={formData.studentEmail} onChange={handleChange} required className="input-unified" />
              </div>
              <div>
                <label htmlFor="problemDescription" className="block text-sm font-medium text-gray-700">備註 (想問的題目或事項)</label>
                <textarea id="problemDescription" name="problemDescription" value={formData.problemDescription} onChange={handleChange} rows={4} required className="input-unified"></textarea>
              </div>

              {error && <p className="text-red-500">{error}</p>}

              <div className="flex justify-end items-center space-x-3">
                {slot.isFull && <p className="text-red-500 font-bold">此時段名額已滿</p>}
                <button type="button" onClick={onClose} className="btn-secondary">取消</button>
                <button type="submit" className="btn-primary" disabled={loading || slot.isFull}>
                  {loading ? <LoadingSpinner size={40} /> : '確認預約'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BookingModal;
