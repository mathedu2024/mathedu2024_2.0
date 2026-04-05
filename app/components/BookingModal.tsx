'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TutoringSlot } from '@/services/interfaces';
import LoadingSpinner from './LoadingSpinner';
import emailjs from '@emailjs/browser';
import { 
  XMarkIcon, 
  CalendarIcon, 
  ClockIcon, 
  // ... 其他 Heroicons
  UserIcon, 
  VideoCameraIcon, 
  MapPinIcon, 
  CheckCircleIcon, 
  ExclamationCircleIcon 
} from '@heroicons/react/24/outline';

import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
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
  hidden: { y: 20, opacity: 0, scale: 0.95 },
  visible: { y: 0, opacity: 1, scale: 1 },
  exit: { y: 20, opacity: 0, scale: 0.95 },
};

const BookingModal: React.FC<BookingModalProps> = ({ slot, userInfo, onClose, onSuccess }) => {
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    studentId: userInfo?.studentId || '',
    studentName: userInfo?.name || '',
    studentEmail: userInfo?.email || '',
    problemDescription: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slot) return;
    
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

      // Send email via EmailJS
      const templateParams = {
        name: formData.studentName,
        studentId: formData.studentId,
        topic: slot.title || '',
        time: `${slot.date} ${slot.startTime} - ${slot.endTime}`,
        teacher: slot.teacherName || '',
        mode: slot.locationType || '',
        format: slot.method || '',
        studentEmail: formData.studentEmail,
      };

      try {
        await emailjs.send(
            "service_4cq55em", 
            "template_r6jbq0k", 
            templateParams, 
            "Oxm7lO3VyhQ4vxUTW"
        );
      } catch (emailError) {
        console.warn("EmailJS send failed:", emailError);
        // Don't block success flow if email fails
      }

      // 使用 SweetAlert2 顯示成功訊息
      Swal.fire({
        icon: 'success',
        title: '預約成功！',
        text: '您的輔導時段已成功預約。',
        confirmButtonText: '確定',
        confirmButtonColor: '#4f46e5', // indigo-600
        customClass: { popup: 'rounded-2xl' }
      }).then(() => { onSuccess(); onClose(); });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const renderQualifications = () => {
    if (!slot?.qualifications) return '不限';
    const { type, grades, subjects, classes } = slot.qualifications;
    if (type === 'classes') return `班級: ${classes?.join(', ') || '不限'}`;
    if (type === 'grades_subjects') {
      const gradeStr = `年級: ${grades?.join(', ') || '不限'}`;
      const subjectStr = `科目: ${subjects?.join(', ') || '不限'}`;
      return `${gradeStr} / ${subjectStr}`;
    }
    return '不限';
  };

  // 不可把 createPortal 當成 AnimatePresence 的子節點：Framer Motion 不會掃描 portal 內的 motion，模態可能完全不顯示。
  // 關閉時整個元件卸載，不需 AnimatePresence 做 exit。
  if (!slot || !mounted) {
    return null;
  }

  return createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={onClose}
        />

        <motion.div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 flex-shrink-0">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <CalendarIcon className="w-6 h-6 mr-2 text-indigo-600" />
              預約輔導
            </h2>
            <button 
                onClick={onClose} 
                className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
                <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            {/* Slot Info Card */}
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 mb-6">
               <h3 className="font-bold text-indigo-900 text-lg mb-3">{slot.title}</h3>
               <div className="space-y-2 text-sm text-indigo-800">
                  <div className="flex items-center"><ClockIcon className="w-4 h-4 mr-2 opacity-70" /> {slot.date} {slot.startTime}-{slot.endTime}</div>
                  <div className="flex items-center"><UserIcon className="w-4 h-4 mr-2 opacity-70" /> {slot.teacherName}</div>
                  <div className="flex items-center">
                      {slot.locationType === '線上輔導' ? <VideoCameraIcon className="w-4 h-4 mr-2 opacity-70" /> : <MapPinIcon className="w-4 h-4 mr-2 opacity-70" />}
                      {slot.locationType} ({slot.method})
                  </div>
                  {slot.locationDetails && slot.locationType !== '線上輔導' && (
                      <div className="ml-6 text-xs text-indigo-600">地點: {slot.locationDetails}</div>
                  )}
                  <div className="flex items-center mt-2 pt-2 border-t border-indigo-100">
                     <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${slot.isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                        {slot.isFull ? <ExclamationCircleIcon className="w-3 h-3 mr-1"/> : <CheckCircleIcon className="w-3 h-3 mr-1"/>}
                        {slot.isFull ? '已額滿' : '可預約'}
                     </span>
                     <span className="ml-3 text-xs text-indigo-500">資格: {renderQualifications()}</span>
                  </div>
               </div>
            </div>

            <form id="booking-form" onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">學號</label>
                    <input type="text" name="studentId" value={formData.studentId} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm font-mono" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">姓名</label>
                    <input type="text" name="studentName" value={formData.studentName} disabled className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-gray-50 text-gray-500 text-sm" />
                  </div>
              </div>
              
              <div>
                <label htmlFor="studentEmail" className="block text-sm font-bold text-gray-700 mb-1.5">電子郵件 <span className="text-red-500">*</span></label>
                <input 
                    type="email" 
                    id="studentEmail" 
                    name="studentEmail" 
                    value={formData.studentEmail} 
                    onChange={handleChange} 
                    required 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" 
                    placeholder="請輸入接收通知的 Email"
                />
              </div>

              <div>
                <label htmlFor="problemDescription" className="block text-sm font-bold text-gray-700 mb-1.5">備註 / 問題描述</label>
                <textarea 
                    id="problemDescription" 
                    name="problemDescription" 
                    value={formData.problemDescription} 
                    onChange={handleChange} 
                    rows={4} 
                    required 
                    className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none"
                    placeholder="請簡述您想請教的內容..."
                ></textarea>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-lg text-sm text-center border border-red-100 flex items-center justify-center">
                    <ExclamationCircleIcon className="w-4 h-4 mr-2" /> {error}
                </div>
              )}
            </form>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50 flex-shrink-0">
             <button 
                type="button" 
                onClick={onClose} 
                className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                disabled={loading}
             >
               取消
             </button>
             <button 
                type="submit" 
                form="booking-form"
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm font-medium transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed"
                disabled={loading || slot.isFull}
             >
               {loading ? (
                 <>
                   <LoadingSpinner size={16} color="white" className="mr-2" />
                   預約中...
                 </>
               ) : (
                 '確認預約'
               )}
             </button>
          </div>
        </motion.div>
      </div>,
    document.body
  );
};

export default BookingModal;