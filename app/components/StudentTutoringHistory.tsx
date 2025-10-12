import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO, isFuture } from 'date-fns';

import MoonLoader from './MoonLoader';
import Swal from 'sweetalert2';
import { XCircleIcon, PencilIcon } from '@heroicons/react/24/outline';
import { Appointment } from '@/services/interfaces'; // Import Appointment interface
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
        console.log('Fetched and sorted appointments:', sortedAppointments);
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
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
    });

    if (!result.isConfirmed) return;

    setLoading(true);
    console.log('Cancelling appointment with data:', appointment);
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
    console.log('Updating appointment with data:', selectedAppointment);
    try {
      const res = await fetch('/api/tutoring/update-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId: selectedAppointment.slotId,
          studentId: selectedAppointment.studentId,
          status: selectedAppointment.status, // Add status field
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
      confirmed: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-red-100 text-red-800',
      completed: 'bg-gray-200 text-gray-800',
    };
    const text = {
      confirmed: '已確認',
      pending: '待確認',
      cancelled: '已取消',
      completed: '已完成',
    };
    return <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${styles[status]}`}>{text[status]}</span>;
  };

  return (
    <>
      <h2 className="text-2xl font-bold mb-6">我的輔導紀錄</h2>
      {loading ? (
        <div className="flex justify-center items-center h-64"><MoonLoader /></div>
      ) : appointments.length === 0 ? (
        <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm text-center text-gray-500 py-10">
            您沒有任何輔導預約記錄。
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500 table-fixed">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 w-1/3">標題</th>
                <th scope="col" className="px-6 py-3">日期</th>
                <th scope="col" className="px-6 py-3">時間</th>
                <th scope="col" className="px-6 py-3">老師</th>
                <th scope="col" className="px-6 py-3 w-1/4">操作</th>
              </tr>
            </thead>
            <tbody>
              {appointments.map(appointment => {
                const isUpcoming = appointment.slotDetails ? isFuture(parseISO(`${appointment.slotDetails.date}T${appointment.slotDetails.startTime}`)) : false;
                return (
                  <tr key={appointment.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4">{appointment.slotDetails?.title || 'N/A'}</td>
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                      {appointment.slotDetails ? format(parseISO(appointment.slotDetails.date), 'yyyy-MM-dd') : 'N/A'}
                    </td>
                    <td className="px-6 py-4">{appointment.slotDetails ? `${appointment.slotDetails.startTime} - ${appointment.slotDetails.endTime}` : 'N/A'}</td>
                    <td className="px-6 py-4">{appointment.slotDetails?.teacherName || 'N/A'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        <button onClick={() => handleOpenDetailsModal(appointment)} className="text-gray-600 hover:text-gray-800 font-medium transition-colors flex items-center">
                          查看詳情
                        </button>
                        {isUpcoming && (appointment.status === 'confirmed' || appointment.status === 'pending') && (
                          <>
                            <button onClick={() => handleOpenEditModal(appointment)} className="text-blue-600 hover:text-blue-800 font-medium transition-colors flex items-center">
                              <PencilIcon className="w-4 h-4 mr-1" /> 編輯
                            </button>
                            <button onClick={() => handleCancelAppointment(appointment)} className="text-red-600 hover:text-red-800 font-medium transition-colors flex items-center">
                              <XCircleIcon className="w-4 h-4 mr-1" /> 取消
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
      )}

      {isEditModalOpen && selectedAppointment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-4">編輯預約問題</h2>
            <form onSubmit={handleUpdateAppointment}>
              <div className="mb-4">
                <label htmlFor="problemDescription" className="block text-sm font-medium text-gray-700">您想討論的問題或需求</label>
                <textarea
                  id="problemDescription"
                  value={editForm.problemDescription}
                  onChange={(e) => setEditForm({ problemDescription: e.target.value })}
                  rows={5}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                  required
                ></textarea>
              </div>
              <div className="flex justify-end space-x-3">
                <button type="button" onClick={() => setIsEditModalOpen(false)} className="btn-secondary">取消</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? <LoadingSpinner size={20} color="white" /> : '儲存變更'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isDetailsModalOpen && detailsAppointment && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg">
            <h2 className="text-2xl font-bold mb-4">預約詳情</h2>
            <div className="space-y-2 text-gray-700">
              <p><strong>狀態:</strong> {getStatusChip(detailsAppointment.status)}</p>
              <p><strong>日期:</strong> {detailsAppointment.slotDetails ? format(parseISO(detailsAppointment.slotDetails.date), 'yyyy-MM-dd') : 'N/A'}</p>
              <p><strong>時間:</strong> {detailsAppointment.slotDetails ? `${detailsAppointment.slotDetails.startTime} - ${detailsAppointment.slotDetails.endTime}` : 'N/A'}</p>
              <p><strong>老師:</strong> {detailsAppointment.slotDetails?.teacherName || 'N/A'}</p>
              <p><strong>主題:</strong> {detailsAppointment.slotDetails?.title || 'N/A'}</p>
              <p><strong>輔導模式:</strong> {detailsAppointment.slotDetails?.method || 'N/A'}</p>
              <p><strong>地點/連結:</strong> {detailsAppointment.slotDetails?.locationDetails || 'N/A'}</p>
              <p><strong>問題描述:</strong> {detailsAppointment.problemDescription || '無'}</p>
              {detailsAppointment.bookingTimestamp && <p><strong>預約時間:</strong> {new Date(detailsAppointment.bookingTimestamp).toLocaleString()}</p>}
            </div>
            <div className="flex justify-end mt-6">
              <button type="button" onClick={() => setIsDetailsModalOpen(false)} className="btn-secondary">關閉</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StudentTutoringHistory;
