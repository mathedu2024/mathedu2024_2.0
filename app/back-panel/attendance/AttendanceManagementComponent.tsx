'use client';

import React, { useState, useEffect } from 'react';
import type { Course } from '@/components/TeacherCourseManager';
import LoadingSpinner from '@/components/LoadingSpinner';
// import Dropdown from '@/components/ui/Dropdown'; // Using the custom Dropdown
import CreateAttendanceActivityForm from '@/components/CreateAttendanceActivityForm'; // Form for creating activities
import AttendanceRosterManager from '@/components/AttendanceRosterManager'; // Component to manage attendance roster
import alerts from '@/utils/alerts'; // For confirmation and notifications
import { useInterval } from '@/utils/hooks';
import ExcelJS from 'exceljs';

// This type definition is moved here from the service to avoid server-side imports.
export interface AttendanceActivity {
    id: string;
    title: string;
    startTime: string;
    endTime: string;
    status: 'scheduled' | 'active' | 'completed';
    checkInMethod: 'manual' | 'numeric';
    checkInCode?: string | null;
    expected: number;
    present: number;
    absent: number;
    leave: number;
    gracePeriodMinutes?: number;
}

interface AttendanceManagementProps {
  courses: Course[];
}

// Generic Modal Component
const Modal = ({ children, onClose: _onClose }: { children: React.ReactNode, onClose: () => void }) => (
  <div className="fixed inset-0 bg-gray-500 bg-opacity-75 z-50 flex justify-center items-start p-4 pt-10">
    <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
      {children}
    </div>
  </div>
);

export default function AttendanceManagementComponent({ courses }: AttendanceManagementProps) {
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [activities, setActivities] = useState<AttendanceActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [rosterActivity, setRosterActivity] = useState<AttendanceActivity | null>(null);
  const [editingActivity, setEditingActivity] = useState<AttendanceActivity | null>(null);
  const [isExporting, setIsExporting] = useState(false);



  useEffect(() => {
    if (isCreateModalOpen || editingActivity || rosterActivity) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isCreateModalOpen, editingActivity, rosterActivity]);

  const fetchActivities = async (courseId: string, showLoading = true) => {
      if (!courseId) return;
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      try {
        const response = await fetch('/api/attendance/activities/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ courseId }),
        });

        if (!response.ok) {
          let serverMessage = '';
          try {
            const data = await response.json();
            serverMessage = data?.error || '';
          } catch {}
          throw new Error(`Failed to fetch activities (${response.status})${serverMessage ? `: ${serverMessage}` : ''}`);
        }

        const fetchedActivities = await response.json();
        const sortedActivities = fetchedActivities.sort((a: AttendanceActivity, b: AttendanceActivity) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
        setActivities(sortedActivities);
      } catch (err) {
        setError('無法載入點名活動資料。');
        console.error('fetchActivities error:', err);
      } finally {
        if (showLoading) {
          setLoading(false);
        }
      }
    };

  useEffect(() => {
    fetchActivities(selectedCourseId);
  }, [selectedCourseId]);

  useInterval(() => {
    if (selectedCourseId) {
      fetchActivities(selectedCourseId, false);
    }
  }, 10000);

  const handleFormComplete = () => {
    setIsCreateModalOpen(false);
    setEditingActivity(null);
    fetchActivities(selectedCourseId); // Refresh the list
  };

  const handleDelete = async (activityId: string) => {
    const isConfirmed = await alerts.confirm('確定要刪除此點名活動嗎？此操作將無法復原。');
    if (!isConfirmed) return;

    try {
      const response = await fetch('/api/attendance/activities/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: selectedCourseId, activityId }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || '刪除失敗');
      }

      alerts.showSuccess('活動已成功刪除');
      setActivities(prev => prev.filter(a => a.id !== activityId));

    } catch (err) {
      const message = err instanceof Error ? err.message : '刪除時發生錯誤';
      alerts.showError(message);
    }
  };

  const handleExportSummary = async () => {
    if (!selectedCourseId) return;
    setIsExporting(true);
    try {
      const response = await fetch('/api/attendance/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ courseId: selectedCourseId }),
      });

      if (!response.ok) {
        let serverMessage = '';
        try {
          const data = await response.json();
          serverMessage = data?.error || '';
        } catch {}
        throw new Error(`無法獲取課程總表資料 (${response.status})${serverMessage ? `: ${serverMessage}` : ''}`);
      }

      const summaryData = await response.json();
      const { students, activities, summary } = summaryData;

      const workbook = new ExcelJS.Workbook();
      const sanitizedCourseName = selectedCourseName.replace(/[*?:\\/\[\]]/g, ' ');
      const worksheet = workbook.addWorksheet(`${sanitizedCourseName} 點名總表`);

      // Setup header row
      const headerRow = ['學號', '姓名'];
      activities.forEach((activity: { title: string; date: string }) => {
        headerRow.push(`${activity.title} (${activity.date})`);
      });
      worksheet.addRow(headerRow);

      // Add student rows
      students.forEach((student: { id: string; studentId: string; name: string }) => {
        const row = [student.studentId, student.name];
        activities.forEach((activity: { id: string; title: string; date: string }) => {
          const statusRecord = summary[student.id]?.[activity.id];
          row.push(statusRecord?.status || '-');
        });
        worksheet.addRow(row);
      });

      // Add summary row
      const summaryRow = ['總計', ''];
      activities.forEach((activity: { presentCount: number; absentCount: number; leaveCount: number }) => {
        summaryRow.push(`出席: ${activity.presentCount}, 缺席: ${activity.absentCount}, 請假: ${activity.leaveCount}`);
      });
      worksheet.addRow(summaryRow);

      // Style and generate file
      worksheet.getRow(1).font = { bold: true };
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${sanitizedCourseName}-點名總表.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);

    } catch (err) {
      const message = err instanceof Error ? err.message : '匯出失敗';
      alerts.showError(message);
    } finally {
      setIsExporting(false);
    }
  };

  const getCheckInMethodName = (method: string) => {
    switch (method) {
      case 'numeric': return '數字點名';
      
      case 'manual': return '手動點名';
      default: return '未知';
    }
  };

  const renderCheckInCode = (activity: AttendanceActivity) => {
    switch (activity.checkInMethod) {
      case 'numeric':
        return activity.checkInCode ? <span className="font-mono text-lg tracking-widest">{activity.checkInCode}</span> : '-';
      
      case 'manual':
        return '無';
      default:
        return '-';
    }
  };

  const selectedCourseName = courses.find(c => c.id === selectedCourseId)?.name || '';

  return (
    <div className="max-w-6xl mx-auto w-full p-4 h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-6 flex-shrink-0">點名管理</h2>
      
      {!selectedCourseId ? (
        <>
          {/* Card view for mobile */}
          <div className="md:hidden">
            {courses.map(course => (
              <div key={course.id} className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4 p-4">
                <div className="font-medium text-gray-900 mb-2">{course.name}</div>
                <div className="text-sm text-gray-500 mb-4">{course.code}</div>
                <div className="flex justify-end">
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setSelectedCourseId(course.id);
                    }}
                  >
                    管理點名
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* Table view for desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">課程</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {courses.map(course => (
                  <tr key={course.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium">{course.name}</div>
                      <div className="text-sm text-gray-500">{course.code}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        className="btn-primary"
                        onClick={() => {
                          setSelectedCourseId(course.id);
                        }}
                      >
                        管理點名
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6 gap-4">
            <div>
              <button
                className="btn-secondary mb-4"
                onClick={() => {
                  setSelectedCourseId('');
                  setActivities([]);
                }}
              >
                返回課程列表
              </button>
              <h3 className="text-xl font-bold text-gray-800">{selectedCourseName}</h3>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button 
                onClick={handleExportSummary}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-400"
                disabled={!selectedCourseId || activities.length === 0 || isExporting}
              >
                {isExporting ? '匯出中...' : '匯出課程總表'}
              </button>
              <button 
                onClick={() => setIsCreateModalOpen(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:bg-gray-400"
                disabled={!selectedCourseId}
              >
                建立新活動
              </button>
            </div>
          </div>

          {loading && <LoadingSpinner text="載入活動中..." />}
          {error && <p className="text-red-500 text-center">{error}</p>}

          {!loading && !error && (
            <>
              {/* Card view for mobile */}
              <div className="md:hidden">
                {activities.length > 0 ? (
                  activities.map((activity, index) => (
                    <div key={activity.id} className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4 p-4">
                      <div className="font-medium text-gray-900 mb-2">活動 {index + 1}: {activity.title}</div>
                      <div className="text-sm text-gray-500 mb-2">
                        <span className="font-medium text-gray-700">點名方式:</span> {getCheckInMethodName(activity.checkInMethod)}
                      </div>
                      <div className="text-sm text-gray-500 mb-2">
                        <span className="font-medium text-gray-700">點名代碼:</span> {renderCheckInCode(activity)}
                      </div>
                      {activity.status !== 'scheduled' && (
                        <>
                          <div className="text-sm text-gray-500 mb-2">
                            <span className="font-medium text-gray-700">應到:</span> {activity.expected}
                          </div>
                          <div className="text-sm text-green-600 mb-2">
                            <span className="font-medium text-gray-700">實到:</span> {activity.present}
                          </div>
                          <div className="text-sm text-red-600 mb-2">
                            <span className="font-medium text-gray-700">未到:</span> {activity.absent}
                          </div>
                          <div className="text-sm text-yellow-600 mb-4">
                            <span className="font-medium text-gray-700">請假:</span> {activity.leave}
                          </div>
                        </>
                      )}
                      <div className="flex justify-end gap-3">
                        <button onClick={() => setEditingActivity(activity)} className="text-blue-600 hover:text-blue-900">修改活動</button>
                        <button onClick={() => setRosterActivity(activity)} className="text-green-600 hover:text-green-900">點名資料</button>
                        <button onClick={() => handleDelete(activity.id)} className="text-red-600 hover:text-red-900">刪除</button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 text-sm text-gray-500">此課程尚無點名活動。</div>
                )}
              </div>

              {/* Table view for desktop */}
              <div className="hidden md:block flex-1 overflow-x-auto">
                <div className="min-w-full inline-block align-middle">
                  <div className="overflow-hidden border border-gray-200 rounded-lg shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">序號</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">標題</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">點名方式</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">點名代碼</th>
                          <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">應到</th>
                          <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">實到</th>
                          <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">未到</th>
                          <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">請假</th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {activities.length > 0 ? (
                          activities.map((activity, index) => (
                            <tr key={activity.id} className="hover:bg-gray-50">
                              <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{index + 1}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{activity.title}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{getCheckInMethodName(activity.checkInMethod)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{renderCheckInCode(activity)}</td>
                              {activity.status === 'scheduled' ? (
                                <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-400">-</td>
                              ) : (
                                <>
                                  <td className="px-3 py-4 text-center text-sm text-gray-800">{activity.expected}</td>
                                  <td className="px-3 py-4 text-center text-sm text-green-600 font-semibold">{activity.present}</td>
                                  <td className="px-3 py-4 text-center text-sm text-red-600 font-semibold">{activity.absent}</td>
                                  <td className="px-3 py-4 text-center text-sm text-yellow-600 font-semibold">{activity.leave}</td>
                                </>
                              )}
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                <div className="flex items-center space-x-4">
                                  <button onClick={() => setEditingActivity(activity)} className="text-blue-600 hover:text-blue-900">修改活動</button>
                                  <button onClick={() => setRosterActivity(activity)} className="text-green-600 hover:text-green-900">點名資料</button>
                                  <button onClick={() => handleDelete(activity.id)} className="text-red-600 hover:text-red-900">刪除</button>
                                </div>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={9} className="px-6 py-12 text-center text-sm text-gray-500">此課程尚無點名活動。</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}
      {isCreateModalOpen && (
        <Modal onClose={() => setIsCreateModalOpen(false)}>
          <CreateAttendanceActivityForm 
            courseId={selectedCourseId} 
            onComplete={handleFormComplete} 
          />
        </Modal>
      )}
      {editingActivity && (
        <Modal onClose={() => setEditingActivity(null)}>
          <CreateAttendanceActivityForm 
            courseId={selectedCourseId} 
            onComplete={handleFormComplete} 
            initialData={editingActivity}
          />
        </Modal>
      )}
      {rosterActivity && (
        <AttendanceRosterManager 
          activityId={rosterActivity.id}
          courseId={selectedCourseId}
          courseName={selectedCourseName}
          onClose={() => {
            setRosterActivity(null);
            fetchActivities(selectedCourseId);
          }}
        />
      )}
    </div>
  );
}