'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import alerts from '@/utils/alerts';

interface RosterManagerProps {
  activityId: string;
  courseId: string;
  courseName: string;
  onClose: () => void;
}

export interface RosterStudent {
  id: string;
  name: string;
  studentId: string; // 學號
  status: 'present' | 'absent' | 'leave';
  leaveType?: '事假' | '病假' | '公假' | '喪假' | '身心調適假' | '生理假' | '其他';
  remarks?: string;
}

const leaveTypes: RosterStudent['leaveType'][] = ['事假', '病假', '公假', '喪假', '身心調適假', '生理假', '其他'];

export default function AttendanceRosterManager({ activityId, courseId, courseName, onClose }: RosterManagerProps) {
  const router = useRouter();
  const [roster, setRoster] = useState<RosterStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRoster = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/attendance/roster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activityId, courseId }),
        });
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to fetch roster');
        }
        const data = await response.json();
        setRoster(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '無法載入學生名單');
      } finally {
        setLoading(false);
      }
    };

    fetchRoster();
  }, [activityId, courseId]);

  const handleStatusChange = (studentId: string, newStatus: RosterStudent['status']) => {
    setRoster(prevRoster => 
      prevRoster.map(student => 
        student.id === studentId ? { ...student, status: newStatus, leaveType: newStatus === 'leave' ? student.leaveType || '事假' : undefined } : student
      )
    );
  };

  const handleLeaveTypeChange = (studentId: string, newLeaveType: RosterStudent['leaveType']) => {
    setRoster(prevRoster => 
      prevRoster.map(student => 
        student.id === studentId ? { ...student, leaveType: newLeaveType } : student
      )
    );
  };

  const handleRemarksChange = (studentId: string, remarks: string) => {
    setRoster(prevRoster => 
      prevRoster.map(student => 
        student.id === studentId ? { ...student, remarks } : student
      )
    );
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/attendance/update-roster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, roster, courseId }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to save changes');
      }

      alerts.showSuccess('點名資料已儲存！');
      onClose(); // Close the modal on success
      router.refresh();

    } catch (err) {
      const message = err instanceof Error ? err.message : '儲存失敗，請稍後再試';
      alerts.showError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b flex justify-between items-center bg-gray-50">
        <div>
          <h2 className="text-xl font-bold text-gray-800">點名資料管理</h2>
          <p className="text-sm text-gray-500">{courseName}</p>
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200" aria-label="關閉">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-grow min-h-0 overflow-y-auto p-6">
       <div className="max-w-7xl mx-auto w-full">
        {loading ? (
          <LoadingSpinner text="正在載入學生名單..." />
        ) : error ? (
          <div className="text-center text-red-500 p-8">{error}</div>
        ) : (
          <div>
            {/* Mobile Card View */}
            <div className="md:hidden space-y-4">
              {roster.map(student => (
                <div key={student.id} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-lg text-gray-900">{student.name}</h3>
                    <p className="text-sm text-gray-500">{student.studentId}</p>
                  </div>
                  
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-gray-700">狀態</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      <div className="flex items-center">
                        <input id={`present-mobile-${student.id}`} name={`status-mobile-${student.id}`} type="radio" checked={student.status === 'present'} onChange={() => handleStatusChange(student.id, 'present')} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                        <label htmlFor={`present-mobile-${student.id}`} className="ml-2 block text-sm text-gray-900">出席</label>
                      </div>
                      <div className="flex items-center">
                        <input id={`absent-mobile-${student.id}`} name={`status-mobile-${student.id}`} type="radio" checked={student.status === 'absent'} onChange={() => handleStatusChange(student.id, 'absent')} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                        <label htmlFor={`absent-mobile-${student.id}`} className="ml-2 block text-sm text-gray-900">曠課</label>
                      </div>
                      <div className="flex items-center">
                        <input id={`leave-mobile-${student.id}`} name={`status-mobile-${student.id}`} type="radio" checked={student.status === 'leave'} onChange={() => handleStatusChange(student.id, 'leave')} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                        <label htmlFor={`leave-mobile-${student.id}`} className="ml-2 block text-sm text-gray-900">請假</label>
                      </div>
                    </div>
                    
                    {student.status === 'leave' && (
                      <div className="pl-2">
                        <label htmlFor={`leaveType-mobile-${student.id}`} className="text-sm font-medium text-gray-700 sr-only">請假類別</label>
                        <select 
                          id={`leaveType-mobile-${student.id}`}
                          value={student.leaveType || '事假'} 
                          onChange={(e) => handleLeaveTypeChange(student.id, e.target.value as RosterStudent['leaveType'])}
                          className="w-full p-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          {leaveTypes.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <label htmlFor={`remarks-mobile-${student.id}`} className="text-sm font-medium text-gray-700">備註</label>
                    <input 
                      id={`remarks-mobile-${student.id}`}
                      type="text" 
                      value={student.remarks || ''} 
                      onChange={(e) => handleRemarksChange(student.id, e.target.value)}
                      className="mt-1 w-full p-2 border border-gray-300 rounded-md text-sm"
                      placeholder="新增備註..."
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100 sticky top-0 z-10">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">學號</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">狀態</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">備註</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {roster.map(student => (
                    <tr key={student.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{student.studentId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{student.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="flex items-center gap-4">
                          <div className="flex items-center">
                            <input id={`present-${student.id}`} name={`status-${student.id}`} type="radio" checked={student.status === 'present'} onChange={() => handleStatusChange(student.id, 'present')} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                            <label htmlFor={`present-${student.id}`} className="ml-2 block text-sm text-gray-900">出席</label>
                          </div>
                          <div className="flex items-center">
                            <input id={`absent-${student.id}`} name={`status-${student.id}`} type="radio" checked={student.status === 'absent'} onChange={() => handleStatusChange(student.id, 'absent')} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                            <label htmlFor={`absent-${student.id}`} className="ml-2 block text-sm text-gray-900">曠課</label>
                          </div>
                          <div className="flex items-center">
                            <input id={`leave-${student.id}`} name={`status-${student.id}`} type="radio" checked={student.status === 'leave'} onChange={() => handleStatusChange(student.id, 'leave')} className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500" />
                            <label htmlFor={`leave-${student.id}`} className="ml-2 block text-sm text-gray-900">請假</label>
                          </div>
                          <select 
                            value={student.leaveType || '事假'} 
                            onChange={(e) => handleLeaveTypeChange(student.id, e.target.value as RosterStudent['leaveType'])}
                            className="ml-2 p-1 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            style={{ visibility: student.status === 'leave' ? 'visible' : 'hidden' }}
                          >
                            {leaveTypes.map(type => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <input 
                          type="text" 
                          value={student.remarks || ''} 
                          onChange={(e) => handleRemarksChange(student.id, e.target.value)}
                          className="w-full p-1 border border-gray-300 rounded-md text-sm"
                          placeholder="新增備註..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </div>
      </div>

       {/* Footer */}
      <div className="flex-shrink-0 p-4 bg-gray-50 border-t flex justify-end gap-4">
        <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300" disabled={isSaving}>
          關閉
        </button>
        <button type="button" onClick={handleSaveChanges} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed" disabled={isSaving}>
          {isSaving ? '儲存中...' : '儲存變更'}
        </button>
      </div>
    </div>
  );
}