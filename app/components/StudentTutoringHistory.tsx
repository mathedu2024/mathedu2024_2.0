'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
  ChatBubbleBottomCenterTextIcon
} from '@heroicons/react/24/outline';
import { Appointment } from '@/services/interfaces';
import LoadingSpinner from './LoadingSpinner';

interface StudentTutoringHistoryProps {
  userInfo: {
    id: string;
    name: string;
    account: string;
    role: string;
    studentId: string;
    enrolledCourses?: string[];
  };
}

const StudentTutoringHistory: React.FC<StudentTutoringHistoryProps> = ({ userInfo }) => {
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
        Swal.fire('錯誤', data.error || '讀取預約記錄失敗', 'error');
      }
    } catch (error) {
      console.error('Error fetching appointments:', error);
      Swal.fire('錯誤', '讀取預約記錄時發生錯誤', 'error');
    } finally {
      setLoading(false);
    }
  }, [userInfo.studentId]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

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
        Swal.fire('已取消', '您的預約已成功取消。', 'success');
        fetchAppointments();
      } else {
        Swal.fire('錯誤', data.error || '取消預約失敗', 'error');
      }
    } catch (error) {
      console.error('Cancellation error:', error);
      Swal.fire('錯誤', '發生未知錯誤，取消預約失敗', 'error');
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
        Swal.fire('已更新', '您的預約資訊已更新。', 'success');
        setIsEditModalOpen(false);
        fetchAppointments();
      } else {
        Swal.fire('錯誤', data.error || '更新預約失敗', 'error');
      }
    } catch (error) {
      console.error('Update error:', error);
      Swal.fire('錯誤', '發生未知錯誤，更新預約失敗', 'error');
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
    <div className="max-w-7xl mx-auto w-full p-4 md:p-6">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
        <ClockIcon className="w-8 h-8 mr-3 text-indigo-600" />
        我的輔導紀錄
      </h2>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size={40} />
        </div>
      ) : appointments.length === 0 ? (
        <div className="bg-white border border-gray-200 p-12 rounded-2xl shadow-sm text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <CalendarIcon className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">尚無預約紀錄</h3>
          <p className="text-gray-500 mt-1">您目前沒有任何輔導預約記錄。</p>
        </div>
      ) : (
        <>
          {/* Mobile View: Cards */}
          <div className="md:hidden space-y-4">
            {appointments.map((appointment) => {
              const isUpcoming = appointment.slotDetails ? isFuture(parseISO(`${appointment.slotDetails.date}T${appointment.slotDetails.startTime}`)) : false;
              return (
                <div key={appointment.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 relative overflow-hidden">
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

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                    <button 
                      onClick={() => handleOpenDetailsModal(appointment)} 
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="詳情"
                    >
                      <EyeIcon className="w-5 h-5" />
                    </button>
                    {isUpcoming && (appointment.status === 'confirmed' || appointment.status === 'pending') && (
                      <>
                        <button 
                          onClick={() => handleOpenEditModal(appointment)} 
                          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="編輯"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleCancelAppointment(appointment)} 
                          className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                          title="取消"
                        >
                          <XCircleIcon className="w-5 h-5" />
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
              <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-6 py-4 font-bold w-1/4">標題</th>
                  <th scope="col" className="px-6 py-4 font-bold">日期</th>
                  <th scope="col" className="px-6 py-4 font-bold">時間</th>
                  <th scope="col" className="px-6 py-4 font-bold">老師</th>
                  <th scope="col" className="px-6 py-4 font-bold text-center">狀態</th>
                  <th scope="col" className="px-6 py-4 font-bold text-right w-48">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments.map((appointment) => {
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
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-6 h-6 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center text-xs mr-2 font-bold">
                            {appointment.slotDetails?.teacherName?.[0] || 'T'}
                          </div>
                          {appointment.slotDetails?.teacherName || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getStatusChip(appointment.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenDetailsModal(appointment)} 
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                            title="查看詳情"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>
                          {isUpcoming && (appointment.status === 'confirmed' || appointment.status === 'pending') && (
                            <>
                              <button 
                                onClick={() => handleOpenEditModal(appointment)} 
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100"
                                title="編輯問題"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleCancelAppointment(appointment)} 
                                className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                                title="取消預約"
                              >
                                <XCircleIcon className="w-4 h-4" />
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[99999] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-gray-100 animate-bounce-in">
            <h2 className="text-xl font-bold mb-4 text-gray-800 border-l-4 border-indigo-500 pl-3">編輯預約問題</h2>
            <form onSubmit={handleUpdateAppointment}>
              <div className="mb-6">
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
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)} 
                  className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                >
                  取消
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm font-medium transition-colors disabled:opacity-70" 
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-[99999] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg border border-gray-100 animate-bounce-in">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-100">
                <h2 className="text-xl font-bold text-gray-800">預約詳情</h2>
                <button onClick={() => setIsDetailsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                    <span className="sr-only">關閉</span>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            
            <div className="space-y-4 text-sm">
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
            
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-100">
              <button 
                type="button" 
                onClick={() => setIsDetailsModalOpen(false)} 
                className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium transition-colors shadow-sm"
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