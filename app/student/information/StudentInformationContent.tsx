'use client';

import React, { useState, useEffect } from 'react';
import { useStudentInfo } from '../StudentInfoContext';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import { 
  UserCircleIcon, 
  KeyIcon, 
  IdentificationIcon, 
  AcademicCapIcon,
  EnvelopeIcon,
  ShieldCheckIcon,
  PhoneIcon,
  HomeIcon,
  BookOpenIcon
} from '@heroicons/react/24/outline';
import Swal from '@/utils/swalTheme';
import {
  fetchStudentProfile,
  fetchStudentDashboardData,
  invalidateStudentClientCache,
} from '@/utils/studentClientApi';

// 定義符合您要求的資料介面，確保讀取時格式正確
interface ExtendedStudentInfo {
  id: string;
  name: string;
  studentId?: string; // 學號
  account?: string;   // 舊有欄位相容
  gender?: string;    // 性別
  grade?: string;     // 年級
  phone?: string;     // 手機號碼
  email?: string;     // 電子郵件
  address?: string;   // 住址
  enrolledCourses?: Array<string | { id?: string; name?: string; title?: string }>; // 報名課程 (可能是字串ID或物件)
}

interface MinimalCourse {
  name?: string;
  title?: string;
  status?: string;
  archived?: boolean | string;
}

export default function StudentInformationContent() {
  const { studentInfo: rawStudentInfo } = useStudentInfo();
  const [apiData, setApiData] = useState<Partial<ExtendedStudentInfo>>({});
  const [userCourses, setUserCourses] = useState<MinimalCourse[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  
  // 合併 Context 資料與 API 直接抓取的完整資料 (API 資料優先)
  const studentInfo = { ...rawStudentInfo, ...apiData } as unknown as ExtendedStudentInfo;

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Profile Edit State
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // 性別顯示轉換函式
  const formatGender = (gender?: string) => {
    if (!gender) return '未填寫';
    const g = gender.toLowerCase().trim();
    if (g === 'male' || g === 'm') return '男';
    if (g === 'female' || g === 'f') return '女';
    return gender; // 如果是其他值（如已經是中文），則直接顯示
  };

  useEffect(() => {
    if (!rawStudentInfo?.id) {
      setDataLoading(false);
      return;
    }

    let cancelled = false;

    const loadPageData = async () => {
      setDataLoading(true);
      try {
        const studentId = rawStudentInfo.id;
        const [profileData, dashboardData] = await Promise.all([
          fetchStudentProfile(studentId),
          fetchStudentDashboardData(studentId, { coursesOnly: true }),
        ]);

        if (cancelled) return;

        setApiData(profileData as Partial<ExtendedStudentInfo>);
        setEmail(String(profileData.email || ''));
        setAddress(String(profileData.address || ''));
        setPhone(String(profileData.phone || ''));

        const filtered = (dashboardData.courses || []).filter(
          (c) => c && c.status !== '已封存' && c.archived !== true && String(c.archived) !== 'true'
        );
        setUserCourses(filtered);
      } catch (error) {
        console.error('無法載入個人資料頁面資料', error);
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    };

    loadPageData();

    return () => {
      cancelled = true;
    };
  }, [rawStudentInfo?.id]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingProfile(true);

    try {
      // 這裡假設有一個 API 端點用於更新學生資料
      // 如果後端尚未實作，這裡可能會報錯或 404
      const res = await fetch('/api/student/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentInfo?.id,
          email,
          address,
          phone
        }),
      });

      if (res.ok) {
        invalidateStudentClientCache(studentInfo?.id);
        Swal.fire({ icon: 'success', title: '更新成功', text: '個人資料已儲存', confirmButtonColor: '#2D6DF6' });
      } else {
        throw new Error('更新失敗'); 
      }
    } catch {
      Swal.fire({ icon: 'error', title: '更新失敗', text: '無法更新資料，請稍後再試。' });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      Swal.fire({
        icon: 'error',
        title: '密碼不符',
        text: '新密碼與確認密碼不一致，請重新輸入。',
      });
      return;
    }

    if (newPassword.length < 6) {
       Swal.fire({
        icon: 'warning',
        title: '密碼強度不足',
        text: '新密碼長度至少需為 6 個字元。',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/student/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: studentInfo?.id,
          currentPassword,
          newPassword
        }),
      });

      const data = await res.json();

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: '修改成功',
          text: '您的密碼已更新，下次登入請使用新密碼。',
          confirmButtonColor: '#2D6DF6',
        });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        throw new Error(data.error || '修改失敗');
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '修改失敗',
        text: error instanceof Error ? error.message : '發生未知錯誤，請稍後再試。',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!studentInfo) {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <p className="text-on-surfaceVariant">無法載入學生資料</p>
        </div>
    );
  }

  return (
    <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10 min-h-full flex flex-col animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="border-l-4 border-primary pl-4">
          <h1 className="font-display text-2xl font-extrabold text-on-surface flex items-center gap-3">
            <UserCircleIcon className="w-8 h-8 text-primary" />
            個人資料
          </h1>
          <p className="text-on-surfaceVariant text-sm mt-1">查看個人資料與修改密碼</p>
        </div>
      </div>

      {dataLoading || !studentInfo ? (
        <PageLoadingArea />
      ) : (
      <>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Basic Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-outline-variant/40 overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant/40 bg-surface/50 flex items-center">
                <IdentificationIcon className="w-5 h-5 text-on-surfaceVariant mr-2" />
                <h3 className="text-lg font-bold text-on-surface">基本資料</h3>
            </div>
            
            <div className="p-6">
              <form onSubmit={handleUpdateProfile}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-bold text-on-surfaceVariant uppercase tracking-wider mb-2">
                            姓名
                        </label>
                        <div className="flex items-center p-3 bg-surface rounded-xl border border-outline-variant/40 text-on-surface font-medium">
                            <span className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-3 text-sm font-bold">
                                {studentInfo.name?.[0] || '生'}
                            </span>
                            {studentInfo.name}
                        </div>
                    </div>

                    {/* Gender */}
                    <div>
                        <label className="block text-xs font-bold text-on-surfaceVariant uppercase tracking-wider mb-2">
                            性別
                        </label>
                        <div className="flex items-center p-3 bg-surface rounded-xl border border-outline-variant/40 text-on-surface font-medium">
                            <UserCircleIcon className="w-5 h-5 text-on-surfaceVariant mr-3" />
                        {formatGender(studentInfo.gender)}
                        </div>
                    </div>

                    {/* Student ID / Account */}
                    <div>
                        <label className="block text-xs font-bold text-on-surfaceVariant uppercase tracking-wider mb-2">
                            學號
                        </label>
                        <div className="flex items-center p-3 bg-surface rounded-xl border border-outline-variant/40 text-on-surface font-medium font-mono">
                            <IdentificationIcon className="w-5 h-5 text-on-surfaceVariant mr-3" />
                        {studentInfo.studentId || studentInfo.account || studentInfo.id}
                        </div>
                    </div>

                    {/* Grade */}
                    <div>
                        <label className="block text-xs font-bold text-on-surfaceVariant uppercase tracking-wider mb-2">
                            年級
                        </label>
                        <div className="flex items-center p-3 bg-surface rounded-xl border border-outline-variant/40 text-on-surface font-medium">
                            <AcademicCapIcon className="w-5 h-5 text-on-surfaceVariant mr-3" />
                        {studentInfo.grade || '未填寫'}
                        </div>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-xs font-bold text-on-surfaceVariant uppercase tracking-wider mb-2">
                            手機號碼 <span className="text-primary text-[10px] ml-1">(可修改)</span>
                        </label>
                        <div className="relative">
                            <PhoneIcon className="w-5 h-5 text-on-surfaceVariant absolute left-3 top-1/2 transform -translate-y-1/2" />
                            <input 
                                type="tel" 
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                                placeholder="請輸入手機號碼"
                            />
                        </div>
                    </div>

                    {/* Email (Editable) */}
                    <div>
                        <label className="block text-xs font-bold text-on-surfaceVariant uppercase tracking-wider mb-2">
                            電子郵件 <span className="text-primary text-[10px] ml-1">(可修改)</span>
                        </label>
                        <div className="relative">
                            <EnvelopeIcon className="w-5 h-5 text-on-surfaceVariant absolute left-3 top-1/2 transform -translate-y-1/2" />
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                                placeholder="請輸入電子郵件"
                            />
                        </div>
                    </div>

                    {/* Address (Editable) */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-on-surfaceVariant uppercase tracking-wider mb-2">
                            住址 <span className="text-primary text-[10px] ml-1">(可修改)</span>
                        </label>
                        <div className="relative">
                            <HomeIcon className="w-5 h-5 text-on-surfaceVariant absolute left-3 top-1/2 transform -translate-y-1/2" />
                            <input 
                                type="text" 
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                                placeholder="請輸入通訊地址"
                            />
                        </div>
                    </div>

                    {/* Enrolled Courses */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-on-surfaceVariant uppercase tracking-wider mb-3 flex justify-between items-center">
                            <span>報名課程</span>
                        </label>
                        <div className="bg-surface rounded-xl border border-outline-variant/40 p-4">
                        {/* 改用經過狀態過濾的 userCourses 確保不顯示已封存課程 */}
                        {userCourses.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                {userCourses.map((course, index) => (
                                    <div key={index} className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-white border border-primary/20 text-primary shadow-sm">
                                        <BookOpenIcon className="w-4 h-4 mr-1.5" />
                                        {course.name || course.title || '未知課程'}
                                    </div>
                                ))}
                                </div>
                            ) : (
                                <p className="text-on-surfaceVariant text-sm italic">目前無報名課程</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button 
                        type="submit" 
                        disabled={isUpdatingProfile}
                        className="bg-primary text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-hover transition-colors shadow-sm shadow-primary/20 disabled:bg-outline disabled:shadow-none"
                    >
                        {isUpdatingProfile ? '儲存中...' : '儲存變更'}
                    </button>
                </div>
              </form>
            </div>

            <div className="px-6 py-3 bg-yellow-50 border-t border-yellow-100 text-xs text-yellow-700 flex items-start">
                <ShieldCheckIcon className="w-4 h-4 mr-1.5 mt-0.5 flex-shrink-0" />
                <p>部分基本資料由管理員統一管理，若有錯誤請洽系統管理員。</p>
            </div>
          </div>
        </div>

        {/* Right Column: Change Password */}
        <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl shadow-sm border border-outline-variant/40 overflow-hidden md:sticky md:top-8">
                <div className="px-6 py-4 border-b border-outline-variant/40 bg-surface/50 flex items-center">
                    <KeyIcon className="w-5 h-5 text-on-surfaceVariant mr-2" />
                    <h3 className="text-lg font-bold text-on-surface">修改密碼</h3>
                </div>
                <div className="p-6">
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-on-surface mb-1">目前密碼</label>
                            <input 
                                type="password" 
                                required
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                                placeholder="請輸入目前密碼"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface mb-1">新密碼</label>
                            <input 
                                type="password" 
                                required
                                minLength={6}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                                placeholder="請輸入新密碼"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-on-surface mb-1">確認新密碼</label>
                            <input 
                                type="password" 
                                required
                                minLength={6}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none transition-all"
                                placeholder="再次輸入新密碼"
                            />
                        </div>
                        
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="w-full bg-primary text-white font-bold py-2.5 rounded-xl hover:bg-primary-hover transition-colors shadow-sm shadow-primary/20 disabled:bg-outline disabled:shadow-none mt-2"
                        >
                            {isSubmitting ? '更新中...' : '確認修改'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}