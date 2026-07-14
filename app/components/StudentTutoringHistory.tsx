'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { format, parseISO, isFuture } from 'date-fns';
import Swal from 'sweetalert2';
import { 
  XCircleIcon, 
  PencilIcon, 
  EyeIcon,
  CalendarIcon,
  ClockIcon,
  UserIcon,
  MapPinIcon,
  ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline';
import { Appointment } from '@/services/interfaces';
import LoadingSpinner from './LoadingSpinner';
import { tableActionStyles, tableActionRow } from './ui';

interface StudentTutoringHistoryProps {
  userInfo: {
    id: string;
    name: string;
    account: string;
    role: string;
    studentId: string;
    enrolledCourses?: string[];
  };
  dateRange: { from: string; to: string };
}

const StudentTutoringHistory: React.FC<StudentTutoringHistoryProps> = ({ userInfo, dateRange }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState({ problemDescription: '' });
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [detailsAppointment, setDetailsAppointment] = useState<Appointment | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tutoring/list-student-appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: userInfo.studentId }),
      });
      const data = await res.json();
      if (res.ok) {
        const sortedAppointments = data.appointments.sort((a: Appointment, b: Appointment) => {
          if (!a.slotDetails || !b.slotDetails) return 0;
          const dateA = parseISO(`${a.slotDetails.date}T${a.slotDetails.startTime}`);
          const dateB = parseISO(`${b.slotDetails.date}T${b.slotDetails.startTime}`);
          return dateB.getTime() - dateA.getTime(); // Show most recent first
        });
        setAppointments(sortedAppointments);
      } else {
        Swal.fire({
          title: '錯誤',
          text: data.error || '讀取預約記錄失敗',
          icon: 'error',
          confirmButtonColor: '#ef4444',
          customClass: { popup: 'rounded-2xl' }
        });
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      Swal.fire({
        title: '錯誤',
        text: '讀取預約記錄時發生錯誤',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' }
      });
    } finally {
      setLoading(false);
    }
  }, [userInfo.studentId]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const filteredAppointments = useMemo(() => {
    const { from, to } = dateRange;
    return appointments.filter((appointment) => {
      if (!appointment.slotDetails?.date) return false;
      const slotDate = appointment.slotDetails.date.split('T')[0];
      const slotDateTime = parseISO(`${slotDate}T${appointment.slotDetails.startTime || '00:00'}`);
      const isUpcoming = isFuture(slotDateTime);

      // 未來預約一律顯示，方便學生查看與管理
      if (isUpcoming) return true;

      if (from && slotDate < from) return false;
      if (to && slotDate > to) return false;
      return true;
    });
  }, [appointments, dateRange]);

  const handleCancelAppointment = async (appointment: Appointment) => {
    const result = await Swal.fire({
      title: '請確認',
      text: `確定要取消「${appointment.slotDetails?.title}」的輔導預約嗎？`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '確認取消',
      cancelButtonText: '返回',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
      customClass: {
        popup: 'rounded-2xl',
      }
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    try {
      const res = await fetch('/api/tutoring/update-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: appointment.slotId,
          studentId: appointment.studentId,
          status: 'cancelled',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire({
          title: '已取消',
          text: '您的預約已成功取消。',
          icon: 'success',
          confirmButtonColor: '#4f46e5',
          customClass: {
            popup: 'rounded-2xl',
          }
        });
        fetchAppointments();
      } else {
        Swal.fire({
          title: '錯誤',
          text: data.error || '取消預約失敗',
          icon: 'error',
          confirmButtonColor: '#ef4444',
          customClass: { popup: 'rounded-2xl' }
        });
      }
    } catch (error) {
      console.error('Cancellation error:', error);
      Swal.fire({
        title: '錯誤',
        text: '發生未知錯誤，取消預約失敗',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEditModal = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setEditForm({ problemDescription: appointment.problemDescription });
    setIsEditModalOpen(true);
  };

  const handleOpenDetailsModal = (appointment: Appointment) => {
    setDetailsAppointment(appointment);
    setIsDetailsModalOpen(true);
  };

  const handleUpdateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppointment) return;

    setLoading(true);
    try {
      const res = await fetch('/api/tutoring/update-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedAppointment.slotId,
          studentId: selectedAppointment.studentId,
          status: selectedAppointment.status,
          problemDescription: editForm.problemDescription,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Swal.fire({
          title: '已更新',
          text: '您的預約資訊已更新。',
          icon: 'success',
          confirmButtonColor: '#4f46e5',
          customClass: {
            popup: 'rounded-2xl',
          }
        });
        setIsEditModalOpen(false);
        fetchAppointments();
      } else {
        Swal.fire({
          title: '錯誤',
          text: data.error || '更新預約失敗',
          icon: 'error',
          confirmButtonColor: '#ef4444',
          customClass: { popup: 'rounded-2xl' }
        });
      }
    } catch (error) {
      console.error('Update error:', error);
      Swal.fire({
        title: '錯誤',
        text: '發生未知錯誤，更新預約失敗',
        icon: 'error',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' }
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusChip = (status: Appointment['status']) => {
    const styles = {
      confirmed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      pending: 'bg-amber-100 text-amber-800 border-amber-200',
      cancelled: 'bg-rose-100 text-rose-800 border-rose-200',
      completed: 'bg-gray-100 text-gray-600 border-gray-200',
    };
    const text = {
      confirmed: '已確認',
      pending: '待確認',
      cancelled: '已取消',
      completed: '已完成',
    };
    return (
      <span className={`px-2.5 py-0.5 inline-flex text-xs leading-5 font-bold rounded-full border ${styles[status]}`}>
        {text[status]}
      </span>
    );
  };

  return (
    <div className="flex-1 min-h-0">
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size={40} />
        </div>
      ) : appointments.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <CalendarIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">尚無預約紀錄</h3>
          <p className="text-gray-500 mt-1">您目前沒有任何輔導預約記錄。</p>
        </div>
      ) : filteredAppointments.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <CalendarIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">此日期區間無紀錄</h3>
          <p className="text-gray-500 mt-1">請調整日期篩選，或按「重設為近一個月」。</p>
        </div>
      ) : (
        <>
          {/* Mobile View: Cards */}
          <div className="md:hidden space-y-4">
            {filteredAppointments.map((appointment) => {
              const isUpcoming = appointment.slotDetails ? isFuture(parseISO(`${appointment.slotDetails.date}T${appointment.slotDetails.startTime}`)) : false;
              return (
                <div key={appointment.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 line-clamp-1">{appointment.slotDetails?.title || 'N/A'}</h3>
                      <p className="text-sm text-gray-500 mt-1 flex items-center">
                        <CalendarIcon className="w-4 h-4 mr-1" />
                        {appointment.slotDetails ? format(parseISO(appointment.slotDetails.date), 'yyyy-MM-dd') : 'N/A'}
                      </p>
                    </div>
                    {getStatusChip(appointment.status)}
                  </div>
                  
                  <div className="space-y-2 text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <div className="flex justify-between">
                      <span className="text-gray-500">時間:</span>
                      <span className="font-medium">{appointment.slotDetails ? `${appointment.slotDetails.startTime} - ${appointment.slotDetails.endTime}` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">老師:</span>
                      <span className="font-medium">{appointment.slotDetails?.teacherName || 'N/A'}</span>
                    </div>
                  </div>

                  <div className={`${tableActionRow} pt-2 border-t border-gray-100`}>
                    <button 
                      onClick={() => handleOpenDetailsModal(appointment)} 
                      className={tableActionStyles.secondary}
                    >
                      詳情
                    </button>
                    {isUpcoming && (appointment.status === 'confirmed' || appointment.status === 'pending') && (
                      <>
                        <button 
                          onClick={() => handleOpenEditModal(appointment)} 
                          className={tableActionStyles.primary}
                        >
                          編輯
                        </button>
                        <button 
                          onClick={() => handleCancelAppointment(appointment)} 
                          className={tableActionStyles.danger}
                        >
                          取消
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-4 font-bold">標題</th>
                  <th scope="col" className="px-6 py-4 font-bold">日期</th>
                  <th scope="col" className="px-6 py-4 font-bold">時間</th>
                  <th scope="col" className="px-6 py-4 font-bold">老師</th>
                  <th scope="col" className="px-6 py-4 font-bold text-center">狀態</th>
                  <th scope="col" className="px-6 py-4 font-bold text-right w-32">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAppointments.map((appointment) => {
                  const isUpcoming = appointment.slotDetails ? isFuture(parseISO(`${appointment.slotDetails.date}T${appointment.slotDetails.startTime}`)) : false;
                  return (
                    <tr key={appointment.id} className="bg-white hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-gray-900">
                        {appointment.slotDetails?.title || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        {appointment.slotDetails ? format(parseISO(appointment.slotDetails.date), 'yyyy-MM-dd') : 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-600">
                        {appointment.slotDetails ? `${appointment.slotDetails.startTime} - ${appointment.slotDetails.endTime}` : 'N/A'}
                      </td>
                      <td className="px-6 py-4">{appointment.slotDetails?.teacherName || 'N/A'}</td>
                      <td className="px-6 py-4 text-center">
                        {getStatusChip(appointment.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className={tableActionRow}>
                          <button
                            onClick={() => handleOpenDetailsModal(appointment)}
                            className={tableActionStyles.secondary}
                          >
                            詳情
                          </button>
                          {isUpcoming && (appointment.status === 'confirmed' || appointment.status === 'pending') && (
                            <>
                              <button
                                onClick={() => handleOpenEditModal(appointment)}
                                className={tableActionStyles.primary}
                              >
                                編輯
                              </button>
                              <button
                                onClick={() => handleCancelAppointment(appointment)}
                                className={tableActionStyles.danger}
                              >
                                取消
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && selectedAppointment && createPortal(
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[99999] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-full sm:max-h-[90vh] flex flex-col overflow-hidden animate-bounce-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 flex justify-between items-center text-white flex-shrink-0">
                <h3 className="font-bold flex items-center text-lg">
                    <PencilIcon className="w-5 h-5 mr-2" /> 編輯預約問題
                </h3>
                <button onClick={() => setIsEditModalOpen(false)} className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20">
                    <span className="sr-only">關閉</span>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            {/* Content & Form */}
            <form onSubmit={handleUpdateAppointment} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                <label htmlFor="problemDescription" className="block text-sm font-bold text-gray-700 mb-2">您想討論的問題或需求</label>
                <textarea
                  id="problemDescription"
                  value={editForm.problemDescription}
                  onChange={(e) => setEditForm({ problemDescription: e.target.value })}
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-shadow resize-none"
                  required
                  placeholder="請描述您想請教老師的問題..."
                ></textarea>
              </div>
              
              {/* Footer */}
              <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2 justify-end flex-shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="px-6 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-70 flex items-center" 
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner size={20} color="white" /> : '儲存變更'}
                </button>
              </div>
            </form>
          </div>
        </div>
      , document.body)}

      {/* Details Modal */}
      {isDetailsModalOpen && detailsAppointment && createPortal(
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[99999] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-full sm:max-h-[90vh] flex flex-col overflow-hidden animate-bounce-in">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 flex justify-between items-center text-white flex-shrink-0">
                <h3 className="font-bold flex items-center text-lg">
                    <EyeIcon className="w-5 h-5 mr-2" /> 預約詳情
                </h3>
                <button onClick={() => setIsDetailsModalOpen(false)} className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20">
                    <span className="sr-only">關閉</span>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            
            {/* Content */}
            <div className="p-6 space-y-4 text-sm overflow-y-auto custom-scrollbar flex-1">
              <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                <span className="text-gray-500 font-medium">預約狀態</span>
                {getStatusChip(detailsAppointment.status)}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <span className="block text-xs font-bold text-gray-400 uppercase mb-1">日期</span>
                    <p className="text-gray-900 font-medium flex items-center">
                        <CalendarIcon className="w-4 h-4 mr-1 text-indigo-500" />
                        {detailsAppointment.slotDetails ? format(parseISO(detailsAppointment.slotDetails.date), 'yyyy-MM-dd') : 'N/A'}
                    </p>
                </div>
                <div>
                    <span className="block text-xs font-bold text-gray-400 uppercase mb-1">時間</span>
                    <p className="text-gray-900 font-medium flex items-center">
                        <ClockIcon className="w-4 h-4 mr-1 text-indigo-500" />
                        {detailsAppointment.slotDetails ? `${detailsAppointment.slotDetails.startTime} - ${detailsAppointment.slotDetails.endTime}` : 'N/A'}
                    </p>
                </div>
                <div>
                    <span className="block text-xs font-bold text-gray-400 uppercase mb-1">授課老師</span>
                    <p className="text-gray-900 font-medium flex items-center">
                        <UserIcon className="w-4 h-4 mr-1 text-indigo-500" />
                        {detailsAppointment.slotDetails?.teacherName || 'N/A'}
                    </p>
                </div>
                <div>
                    <span className="block text-xs font-bold text-gray-400 uppercase mb-1">輔導模式</span>
                    <p className="text-gray-900 font-medium">
                        {detailsAppointment.slotDetails?.method || 'N/A'}
                    </p>
                </div>
              </div>

              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase mb-1">地點 / 連結</span>
                <p className="text-gray-900 font-medium bg-gray-50 p-3 rounded-lg border border-gray-100 flex items-start">
                    <MapPinIcon className="w-4 h-4 mr-2 text-indigo-500 mt-0.5 flex-shrink-0" />
                    <span className="break-all">{detailsAppointment.slotDetails?.locationDetails || '無詳細資訊'}</span>
                </p>
              </div>

              <div>
                <span className="block text-xs font-bold text-gray-400 uppercase mb-1">問題描述</span>
                <p className="text-gray-700 bg-indigo-50/50 p-3 rounded-lg border border-indigo-100 flex items-start">
                    <ChatBubbleBottomCenterTextIcon className="w-4 h-4 mr-2 text-indigo-500 mt-0.5 flex-shrink-0" />
                    {detailsAppointment.problemDescription || '無'}
                </p>
              </div>
              
              {detailsAppointment.bookingTimestamp && (
                <p className="text-xs text-gray-400 text-right pt-2 border-t border-gray-50">
                    預約時間: {new Date(detailsAppointment.bookingTimestamp).toLocaleString()}
                </p>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end flex-shrink-0">
              <button 
                type="button" 
                onClick={() => setIsDetailsModalOpen(false)} 
                className="w-full sm:w-auto px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors"
              >
                關閉
              </button>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default StudentTutoringHistory;