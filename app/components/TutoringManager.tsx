'use client';

import React, { useState, useEffect, useCallback } from 'react';
import LoadingSpinner from './LoadingSpinner';
import ConfirmDialog from './ConfirmDialog';
import Calendar from './Calendar';

interface UserInfo {
  id: string;
  name: string;
  account: string;
  role: string;
}

interface TutoringSession {
  id: string;
  studentId: string;
  studentName: string;
  studentUsername: string;
  teacherId: string;
  teacherName: string;
  subject: string;
  courseId?: string;
  courseName?: string;
  date: string;
  time: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export default function TutoringManager({ userInfo }: { userInfo: UserInfo | null }) {
  const [tutoringSessions, setTutoringSessions] = useState<TutoringSession[]>([]);
  // Removed unused timeSlots state
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState<boolean>(false);
  const [selectedSession, setSelectedSession] = useState<TutoringSession | null>(null);
  const [activeView, setActiveView] = useState<'calendar' | 'sessions'>('calendar');

  const fetchTutoringSessions = useCallback(async () => {
    if (!userInfo) return;
    try {
      setLoading(true);
      const res = await fetch('/api/tutoring-sessions/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: userInfo.id }),
      });
      const sessions = await res.json();
      setTutoringSessions(sessions);
    } catch (error) {
      console.error('Error fetching tutoring sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [userInfo]);

  const fetchTimeSlots = useCallback(async () => {
    if (!userInfo) return;
    try {
      await fetch('/api/time-slots/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: userInfo.id }),
      });
      // Removed unused variable 'result'
    } catch (error) {
      console.error('Error fetching time slots:', error);
    }
  }, [userInfo]);

  useEffect(() => {
    fetchTutoringSessions();
    fetchTimeSlots();
    // fetchTutoringSessions and fetchTimeSlots are stable (not recreated), so this is safe
  }, [userInfo, fetchTutoringSessions, fetchTimeSlots]);

  const handleStatusChange = async (sessionId: string, newStatus: TutoringSession['status']) => {
    try {
      const res = await fetch('/api/tutoring-sessions/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, newStatus }),
      });
      const updatedSession = await res.json();
      setTutoringSessions(prev => 
        prev.map(session => 
          session.id === sessionId 
            ? updatedSession
            : session
        )
      );
    } catch (error) {
      console.error('Error updating session status:', error);
    }
  };

  const handleDeleteSession = async () => {
    if (!selectedSession) return;
    
    try {
      await fetch('/api/tutoring-sessions/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: selectedSession.id }),
      });
      // Removed unused variable 'result'
      setTutoringSessions(prev => prev.filter(session => session.id !== selectedSession.id));
      setShowDeleteDialog(false);
      setSelectedSession(null);
    } catch (error) {
      console.error('Error deleting session:', error);
    }
  };

  const getStatusColor = (status: TutoringSession['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: TutoringSession['status']) => {
    switch (status) {
      case 'pending': return '待確認';
      case 'confirmed': return '已確認';
      case 'completed': return '已完成';
      case 'cancelled': return '已取消';
      default: return '未知';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-TW');
  };

  const formatTime = (timeString: string) => {
    return timeString;
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">輔導預約管理</h1>
        <div className="flex space-x-4">
          <button
            onClick={() => setActiveView('calendar')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === 'calendar' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            建立時段
          </button>
          <button
            onClick={() => setActiveView('sessions')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeView === 'sessions' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            預約記錄
          </button>
        </div>
      </div>

      {activeView === 'calendar' && (
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">建立輔導時段</h2>
            <p className="text-gray-600">點擊日期建立輔導時段，學生可以選擇您建立的時段進行預約</p>
          </div>
          <Calendar onDateSelect={() => {}} />
        </div>
      )}

      {activeView === 'sessions' && (
        <div>
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">預約記錄</h2>
            <div className="text-sm text-gray-600">
              共 {tutoringSessions.length} 筆預約記錄
            </div>
          </div>

          {/* 統計卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-yellow-600">
                {tutoringSessions.filter(s => s.status === 'pending').length}
              </div>
              <div className="text-sm text-gray-600">待確認</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-blue-600">
                {tutoringSessions.filter(s => s.status === 'confirmed').length}
              </div>
              <div className="text-sm text-gray-600">已確認</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-green-600">
                {tutoringSessions.filter(s => s.status === 'completed').length}
              </div>
              <div className="text-sm text-gray-600">已完成</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-2xl font-bold text-red-600">
                {tutoringSessions.filter(s => s.status === 'cancelled').length}
              </div>
              <div className="text-sm text-gray-600">已取消</div>
            </div>
          </div>

          {/* 預約列表 */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      學生
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      課程
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      科目
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      日期
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      時間
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      時長
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      狀態
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      備註
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tutoringSessions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                        目前沒有任何輔導預約
                      </td>
                    </tr>
                  ) : (
                    tutoringSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {session.studentName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {session.studentUsername}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {session.courseName}
                          {session.courseId ? (
                            <span className="text-xs text-gray-500 ml-1">({session.courseId})</span>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {session.subject}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(session.date)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatTime(session.time)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {session.duration} 分鐘
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(session.status)}`}>
                            {getStatusText(session.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                          {session.notes || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            {session.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleStatusChange(session.id, 'confirmed')}
                                  className="text-blue-600 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded text-xs"
                                >
                                  確認
                                </button>
                                <button
                                  onClick={() => handleStatusChange(session.id, 'cancelled')}
                                  className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2 py-1 rounded text-xs"
                                >
                                  拒絕
                                </button>
                              </>
                            )}
                            {session.status === 'confirmed' && (
                              <button
                                onClick={() => handleStatusChange(session.id, 'completed')}
                                className="text-green-600 hover:text-green-900 bg-green-50 hover:bg-green-100 px-2 py-1 rounded text-xs"
                              >
                                完成
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedSession(session);
                                setShowDeleteDialog(true);
                              }}
                              className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2 py-1 rounded text-xs"
                            >
                              刪除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 刪除確認對話框 */}
      <ConfirmDialog
        open={showDeleteDialog}
        onCancel={() => {
          setShowDeleteDialog(false);
          setSelectedSession(null);
        }}
        onConfirm={handleDeleteSession}
        message="確定要刪除此預約記錄嗎？"
        confirmText="刪除"
        cancelText="取消"
        confirmColor="red"
      />
    </div>
  );
} 