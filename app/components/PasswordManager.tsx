'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Swal from 'sweetalert2';
import { KeyIcon, LockClosedIcon, CheckCircleIcon, IdentificationIcon, UserCircleIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from './LoadingSpinner';
import { isCourseArchived } from './StudentCourseSelector';

const formSchema = z.object({
  currentPassword: z.string().min(1, '請輸入目前密碼'),
  newPassword: z.string().min(6, '新密碼至少需要6個字元'),
  confirmNewPassword: z.string().min(6, '請確認新密碼'),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: '新密碼與確認密碼不符',
  path: ['confirmNewPassword'],
});

interface MinimalCourse {
  name: string;
  status?: string;
  archived?: boolean | string;
}

type PasswordManagerProps = {
  onPasswordChangeSuccess?: () => void;
  apiEndpoint?: string;
  userInfo?: {
    name?: string;
    account?: string;
    role?: string;
  };
};

function PasswordManager({ onPasswordChangeSuccess, apiEndpoint = '/api/student/change-password', userInfo }: PasswordManagerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [userCourses, setUserCourses] = useState<MinimalCourse[]>([]);
  const [showPassword, setShowPassword] = useState<{ current: boolean; new: boolean; confirm: boolean }>({
    current: false,
    new: false,
    confirm: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: '',
    },
  });

  const toggleShowPassword = (field: 'current' | 'new' | 'confirm') => {
    setShowPassword(prev => ({ ...prev, [field]: !prev[field] }));
  };

  useEffect(() => {
    const fetchUserCourses = async () => {
      if (userInfo?.role === '學生') {
        try {
          const response = await fetch('/api/student/courses/list');
          if (response.ok) {
            const data = await response.json();
            // 隱藏已封存課程，但保留已結束課程供回顧歷史選修紀錄
            const filtered = (Array.isArray(data) ? data : [])
              .filter((c: MinimalCourse) => c && !isCourseArchived(c));
            setUserCourses(filtered);
          }
        } catch (error) {
          console.error('無法獲取使用者課程:', error);
        }
      }
    };
    fetchUserCourses();
  }, [userInfo?.role]);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (response.ok) {
        Swal.fire({
          title: '成功!',
          text: '密碼修改成功',
          icon: 'success',
          confirmButtonText: '好',
          confirmButtonColor: '#4f46e5', // indigo-600
        });
        reset();
        onPasswordChangeSuccess?.();
      } else {
        Swal.fire({
          title: '錯誤',
          text: data.message || '請檢查您輸入的密碼是否正確。',
          icon: 'error',
          confirmButtonText: '好',
          confirmButtonColor: '#ef4444', // red-500
        });
      }
    } catch (error) {
      console.error('密碼修改錯誤:', error);
      Swal.fire({
        title: '錯誤',
        text: '修改密碼時發生錯誤，請稍後再試。',
        icon: 'error',
        confirmButtonText: '好',
        confirmButtonColor: '#ef4444',
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-6 md:pt-8 pb-10 flex flex-col h-full animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <UserCircleIcon className="w-8 h-8 text-indigo-600" />
            個人資料
          </h1>
          <p className="text-gray-500 text-sm mt-1">檢視帳號資訊與修改登入密碼</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Basic Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center">
              <IdentificationIcon className="w-5 h-5 text-gray-500 mr-2" />
              <h3 className="text-lg font-bold text-gray-800">基本資料</h3>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    姓名
                  </label>
                  <div className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-700 font-medium">
                    <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mr-3 text-sm font-bold">
                      {userInfo?.name?.[0] || '使'}
                    </span>
                    {userInfo?.name || '—'}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    身分
                  </label>
                  <div className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-700 font-medium">
                    <UserCircleIcon className="w-5 h-5 text-gray-400 mr-3" />
                    <span className="mr-2">{userInfo?.role || '—'}</span>
                    {userInfo?.role && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${
                        userInfo.role === '管理員'
                          ? 'bg-purple-50 text-purple-700 border-purple-200'
                          : 'bg-blue-50 text-blue-700 border-blue-200'
                      }`}>
                        {userInfo.role}
                      </span>
                    )}
                  </div>
                </div>

                {userInfo?.role === '學生' && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex justify-between items-center">
                      <span>目前選修課程</span>
                      {userCourses.length > 0 && (
                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-indigo-100">
                          共 {userCourses.length} 門
                        </span>
                      )}
                    </label>
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-200 min-h-[46px]">
                      {userCourses.length > 0 ? (
                        userCourses.map((course, idx) => (
                          <span key={idx} className="px-3 py-1 bg-white border border-indigo-100 text-indigo-700 text-xs font-bold rounded-lg shadow-sm">
                            {course.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 text-sm italic">尚無有效選修中的課程</span>
                      )}
                    </div>
                  </div>
                )}

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    帳號
                  </label>
                  <div className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-700 font-medium font-mono">
                    <IdentificationIcon className="w-5 h-5 text-gray-400 mr-3" />
                    {userInfo?.account || '—'}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-3 bg-yellow-50 border-t border-yellow-100 text-xs text-yellow-700 flex items-start">
              <ShieldCheckIcon className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" />
              <p>
                {userInfo?.role === '管理員'
                  ? '建議定期更新密碼，並避免與其他系統共用密碼。'
                  : '請妥善保管您的帳號密碼，避免外流。'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Change Password */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-8">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center">
              <KeyIcon className="w-5 h-5 text-gray-500 mr-2" />
              <h3 className="text-lg font-bold text-gray-800">修改密碼</h3>
            </div>

            <div className="p-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">目前密碼</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LockClosedIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword.current ? 'text' : 'password'}
                  {...register('currentPassword')}
                  className={`w-full pl-10 pr-10 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-all ${errors.currentPassword ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : 'border-gray-200'}`}
                  placeholder="請輸入目前使用的密碼"
                />
                <button
                  type="button"
                  onClick={() => toggleShowPassword('current')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-indigo-600 focus:outline-none"
                >
                  {showPassword.current ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12.001C3.226 16.273 7.24 19.5 12 19.5c1.658 0 3.237-.336 4.646-.94M21 12.001c-.362-1.007-.893-1.957-1.573-2.803M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.currentPassword && <p className="text-red-500 text-xs mt-1 ml-1">{errors.currentPassword.message}</p>}
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">新密碼</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword.new ? 'text' : 'password'}
                  {...register('newPassword')}
                  className={`w-full pl-10 pr-10 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-all ${errors.newPassword ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : 'border-gray-200'}`}
                  placeholder="至少 6 個字元"
                />
                <button
                  type="button"
                  onClick={() => toggleShowPassword('new')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-indigo-600 focus:outline-none"
                >
                  {showPassword.new ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12.001C3.226 16.273 7.24 19.5 12 19.5c1.658 0 3.237-.336 4.646-.94M21 12.001c-.362-1.007-.893-1.957-1.573-2.803M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.newPassword && <p className="text-red-500 text-xs mt-1 ml-1">{errors.newPassword.message}</p>}
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">確認新密碼</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CheckCircleIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword.confirm ? 'text' : 'password'}
                  {...register('confirmNewPassword')}
                  className={`w-full pl-10 pr-10 py-2 rounded-xl border focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 transition-all ${errors.confirmNewPassword ? 'border-red-300 focus:ring-red-200 focus:border-red-400' : 'border-gray-200'}`}
                  placeholder="請再次輸入新密碼"
                />
                <button
                  type="button"
                  onClick={() => toggleShowPassword('confirm')}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-indigo-600 focus:outline-none"
                >
                  {showPassword.confirm ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12.001C3.226 16.273 7.24 19.5 12 19.5c1.658 0 3.237-.336 4.646-.94M21 12.001c-.362-1.007-.893-1.957-1.573-2.803M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
              {errors.confirmNewPassword && <p className="text-red-500 text-xs mt-1 ml-1">{errors.confirmNewPassword.message}</p>}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 disabled:bg-gray-300 disabled:shadow-none mt-2 flex items-center justify-center"
            >
              {isLoading ? (
                <>
                  <LoadingSpinner size={20} color="white" />
                  <span className="ml-2">處理中...</span>
                </>
              ) : (
                '確認修改'
              )}
            </button>
          </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PasswordManager;