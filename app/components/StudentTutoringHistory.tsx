'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../services/firebase';
import LoadingSpinner from './LoadingSpinner';

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
  date: string;
  time: string;
  duration: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  notes: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export default function StudentTutoringHistory({ userInfo }: { userInfo: UserInfo | null }) {
  const [tutoringSessions, setTutoringSessions] = useState<TutoringSession[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTutoringSessions = useCallback(async () => {
    if (!userInfo) return;
    
    try {
      setLoading(true);
      const q = query(
        collection(db, 'tutoring-sessions'),
        where('studentId', '==', userInfo.id),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      const sessions: TutoringSession[] = [];
      
      querySnapshot.forEach((doc) => {
        sessions.push({ id: doc.id, ...doc.data() } as TutoringSession);
      });
      
      setTutoringSessions(sessions);
    } catch (error) {
      console.error('Error fetching tutoring sessions:', error);
    } finally {
      setLoading(false);
    }
  }, [userInfo]);

  useEffect(() => {
    fetchTutoringSessions();
  }, [fetchTutoringSessions]);

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
        <h1 className="text-2xl font-bold text-gray-800">我的輔導預約記錄</h1>
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
                  老師
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
                  預約時間
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {tutoringSessions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                    目前沒有任何輔導預約記錄
                  </td>
                </tr>
              ) : (
                tutoringSessions.map((session) => (
                  <tr key={session.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {session.teacherName}
                      </div>
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
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {session.createdAt.toDate().toLocaleString('zh-TW')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 狀態說明 */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-800 mb-2">狀態說明：</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 mr-2">待確認</span>
            <span>老師尚未回覆您的預約申請</span>
          </div>
          <div>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 mr-2">已確認</span>
            <span>老師已確認您的預約申請</span>
          </div>
          <div>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800 mr-2">已完成</span>
            <span>輔導課程已完成</span>
          </div>
          <div>
            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 mr-2">已取消</span>
            <span>預約已被取消</span>
          </div>
        </div>
      </div>
    </div>
  );
} 