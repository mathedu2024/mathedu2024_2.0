'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStudentInfo } from './StudentInfoContext';
import { BookOpenIcon, ClipboardDocumentListIcon, CheckCircleIcon, PencilIcon, CalendarIcon, KeyIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';
import PasswordManager from '../components/PasswordManager';

export default function StudentPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { studentInfo, loading } = useStudentInfo();
  const activeTab = searchParams.get('tab');

  const studentQuickActions = [
    { id: 'courses', title: '我的課程', description: '查看課程內容與進度', icon: <BookOpenIcon className="h-8 w-8" />, onClick: () => router.push('/student/courses'), disabled: false },
    { id: 'grades', title: '成績查詢', description: '查看各科成績與評量', icon: <ClipboardDocumentListIcon className="h-8 w-8" />, onClick: () => router.push('/student/grades'), disabled: false },
    { id: 'counseling', title: '輔導預約', description: '預約老師或助教的輔導時段', icon: <CalendarIcon className="h-8 w-8" />, onClick: () => router.push('/student/counseling'), disabled: false },
    { id: 'change-password', title: '修改密碼', description: '更新您的登入密碼', icon: <KeyIcon className="h-8 w-8" />, onClick: () => router.push('/student?tab=change-password'), disabled: false },
    { id: 'attendance', title: '線上點名', description: '功能暫時關閉', icon: <CheckCircleIcon className="h-8 w-8" />, onClick: () => {}, disabled: true },
    { id: 'exam', title: '線上測驗', description: '功能暫時關閉', icon: <PencilIcon className="h-8 w-8" />, onClick: () => {}, disabled: true },
  ];

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (activeTab === 'change-password') {
    return <PasswordManager />;
  }

  return (
    <div className="max-w-7xl mx-auto w-full p-2 md:p-8 px-2 sm:px-4 md:px-6 lg:px-8">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-4 md:p-6 text-white mb-4 md:mb-8 animate-fade-in">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl md:text-4xl font-bold mb-2">歡迎回來，{studentInfo?.name}！</h1>
            <p className="text-blue-100 text-base md:text-lg">學號：{studentInfo?.studentId}</p>
            <p className="text-blue-100 mt-2 text-sm md:text-base">今天是 {new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</p>
          </div>
          <div className="text-center lg:text-right">
            <div className="text-4xl mb-2">📚</div>
            <p className="text-blue-100 text-sm md:text-base">學習愉快！</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600"><BookOpenIcon className="h-8 w-8" /></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">已選課程</p>
              <p className="text-2xl font-bold text-gray-900">{studentInfo?.enrolledCourses?.length || 0}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600"><ClipboardDocumentListIcon className="h-8 w-8" /></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">成績查詢</p>
              <p className="text-2xl font-bold text-gray-900">可查看</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600"><CalendarIcon className="h-8 w-8" /></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">輔導預約</p>
              <p className="text-2xl font-bold text-gray-900">開放中</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-100 text-purple-600"><KeyIcon className="h-8 w-8" /></div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">帳戶設定</p>
              <p className="text-2xl font-bold text-gray-900">可修改</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <h2 className="text-2xl font-bold text-gray-800 mb-6">快速操作</h2>
        <div className="card-list">
          {studentQuickActions.map((action) => (
            <button
              key={action.id}
              onClick={action.onClick}
              disabled={action.disabled}
              className={`min-w-[260px] sm:min-w-0 text-left p-6 rounded-2xl transition-colors,transition-shadow,transform duration-300 ease-in-out flex items-center border ${
                action.disabled
                  ? 'bg-gray-100 cursor-not-allowed opacity-60 border-gray-200'
                  : 'bg-white hover:bg-gray-50 border-gray-200 hover:shadow-xl md:hover:-translate-y-1'
              }`}
            >
              <div className={`p-4 rounded-xl mr-4 ${action.disabled ? 'bg-gray-200' : 'bg-blue-100'}`}>
                {action.icon}
              </div>
              <div>
                <h3 className={`text-xl font-bold ${action.disabled ? 'text-gray-500' : 'text-gray-800'}`}>{action.title}</h3>
                <p className={`text-base mt-1 ${action.disabled ? 'text-gray-400' : 'text-gray-600'}`}>{action.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}