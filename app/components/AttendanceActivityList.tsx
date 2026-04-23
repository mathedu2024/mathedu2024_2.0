'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import LoadingSpinner from '@/components/LoadingSpinner';
import CreateAttendanceActivityForm, { AttendanceActivity as BaseAttendanceActivity } from './CreateAttendanceActivityForm';
import { PlusIcon, CalendarDaysIcon, ChevronLeftIcon, TrashIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import Swal from 'sweetalert2';

interface AttendanceActivityListProps {
  courseId: string;
  courseName: string;
  onBack: () => void;
  onSelectActivity: (activityId: string) => void;
}

// 擴充介面以包含統計數據
interface AttendanceActivity extends BaseAttendanceActivity {
  present?: number;
  absent?: number;
  leave?: number;
  late?: number;
}

export default function AttendanceActivityList({ courseId, courseName, onBack, onSelectActivity }: AttendanceActivityListProps) {
  const [activities, setActivities] = useState<AttendanceActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchActivities = async () => {
      setLoading(true);
      console.log('[Frontend] 開始讀取點名紀錄, CourseId:', courseId);
      
      try {
        const response = await fetch('/api/attendance/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId }),
        });

        console.log('[Frontend] API 回應狀態:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[Frontend] 取得資料:', data);
          
          // 依時間倒序排列 (最新的在最上面)
          const sortedData = Array.isArray(data) 
            ? data.sort((a: AttendanceActivity, b: AttendanceActivity) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()) 
            : [];
          setActivities(sortedData);
        } else {
          const errorText = await response.text();
          console.error('[Frontend] 讀取失敗，伺服器回應:', errorText);
        }
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [courseId]);

  const handleDelete = async (e: React.MouseEvent, activityId: string) => {
    e.stopPropagation(); // 防止觸發進入點名頁面

    const result = await Swal.fire({
      title: '確定要刪除此點名紀錄嗎？',
      text: "此動作無法復原。",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: '是的，刪除它！',
      cancelButtonText: '取消'
    });

    if (!result.isConfirmed) return;

    try {
      const response = await fetch('/api/attendance/activities/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityId, courseId }),
      });

      if (response.ok) {
        setActivities(prev => prev.filter(a => a.id !== activityId));
        Swal.fire(
          '已刪除！',
          '點名紀錄已成功刪除。',
          'success'
        );
      } else {
        Swal.fire('錯誤', '刪除失敗', 'error');
      }
    } catch (error) {
      console.error('Delete failed', error);
      Swal.fire('錯誤', '刪除失敗', 'error');
    }
  };

  const handleCreateActivity = (newActivity: BaseAttendanceActivity) => {
    setShowCreateForm(false);
    // 重新整理列表或將新活動加入列表 (這裡選擇簡單地將新活動加入 state)
    setActivities(prev => [newActivity as AttendanceActivity, ...prev]);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">進行中</span>;
      case 'scheduled':
        return <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">預約</span>;
      default:
        return <span className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-full">已結束</span>;
    }
  };

  return (
    <>
      <div className="max-w-7xl mx-auto w-full bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col h-full animate-fade-in">
      {/* Header */}
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <ChevronLeftIcon className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h2 className="text-xl font-bold text-gray-800">點名紀錄</h2>
            <p className="text-sm text-gray-500">{courseName}</p>
          </div>
        </div>
        <button 
          onClick={() => setShowCreateForm(true)}
          className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
        >
          <PlusIcon className="w-5 h-5 mr-2" />
          新增點名
        </button>
      </div>

      {/* List */}
      <div className="flex-grow overflow-y-auto p-6">
        {loading ? (
          <LoadingSpinner text="載入紀錄中..." />
        ) : activities.length === 0 ? (
          <div className="text-center py-12 text-gray-400 flex flex-col items-center">
            <CalendarDaysIcon className="w-12 h-12 mb-3 opacity-50" />
            <p>尚無點名紀錄，請點擊右上角新增。</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">標題</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時間</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">點名方式</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">點名代碼</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">應到</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">實到</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">遲到</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">請假</th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">曠課</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activities.map((activity) => (
                  <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="font-medium text-gray-900 mr-2">{activity.title}</span>
                        {getStatusBadge(activity.status)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(activity.startTime).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(activity.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {activity.checkInMethod === 'numeric' ? '數字點名' : '手動點名'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-indigo-600 font-bold">
                      {activity.checkInMethod === 'numeric' ? (activity.checkInCode || '-') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-gray-500">{(activity.present || 0) + (activity.late || 0) + (activity.leave || 0) + (activity.absent || 0) || '-'}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-emerald-600 font-medium">{activity.present || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-amber-600 font-medium">{activity.late || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-yellow-600 font-medium">{activity.leave || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-center text-red-600 font-medium">{activity.absent || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onSelectActivity(activity.id)}
                          className="text-indigo-600 hover:text-indigo-900 p-1"
                          title="編輯/管理名單"
                        >
                          <PencilSquareIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(e, activity.id)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="刪除"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>

      {showCreateForm && mounted && createPortal(
        <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-[9999]">
          <div className="max-w-md w-full">
            <CreateAttendanceActivityForm 
              courseId={courseId} 
              onClose={() => setShowCreateForm(false)} 
              onComplete={handleCreateActivity} 
            />
          </div>
        </div>,
        document.body
      )}
    </>
  );
}