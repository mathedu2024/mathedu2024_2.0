'use client';

import React, { useState, useEffect } from 'react';
import { useStudentInfo } from '../StudentInfoContext';
import LoadingSpinner from '@/components/LoadingSpinner';
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
import Swal from 'sweetalert2';

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
  const { studentInfo: rawStudentInfo, loading } = useStudentInfo();
  const [apiData, setApiData] = useState<Partial<ExtendedStudentInfo>>({});
  const [userCourses, setUserCourses] = useState<MinimalCourse[]>([]);
  
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
    // 當取得學生 ID 後，直接向後端請求完整資料，繞過 Context 可能的過濾
    const fetchFullProfile = async () => {
      if (rawStudentInfo?.id) {
        try {
          const res = await fetch('/api/student/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: rawStudentInfo.id }),
          });
          if (res.ok) {
            const data = await res.json();
            setApiData(data);
            // 同步更新編輯欄位
            setEmail(data.email || '');
            setAddress(data.address || '');
            setPhone(data.phone || '');
          }
        } catch (error) {
          console.error('無法載入完整個人資料', error);
        }
      }
    };

    const fetchUserCourses = async () => {
      if (!rawStudentInfo?.id) return;
      try {
        // 改用 dashboard-data API，這通常包含完整的課程物件資訊，且能確保與首頁計數邏輯同步
        const response = await fetch('/api/student/dashboard-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: rawStudentInfo.id }),
        });

        if (response.ok) {
          const data = await response.json();
          // 從回傳的 courses 屬性中提取並進行嚴格過濾
          const filtered = (data.courses || [])
            .filter((c: MinimalCourse) => c && c.status !== '已封存' && c.archived !== true && String(c.archived) !== 'true');
          setUserCourses(filtered);
        }
      } catch (error) {
        console.error('無法獲取選修課程清單', error);
      }
    };

    if (rawStudentInfo?.id) {
      fetchFullProfile();
      fetchUserCourses();
    }
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
        Swal.fire({ icon: 'success', title: '更新成功', text: '個人資料已儲存', timer: 1500, showConfirmButton: false });
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
          confirmButtonColor: '#4f46e5',
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

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!studentInfo) {
    return (
        <div className="min-h-screen flex items-center justify-center">
            <p className="text-gray-500">無法載入學生資料</p>
        </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-8 animate-fade-in">
      {/* Header - 樣式與其他頁面一致 */}
      <div className="flex items-center mb-8">
        <UserCircleIcon className="w-8 h-8 text-indigo-600 mr-3" />
        <h2 className="text-2xl font-bold text-gray-900">個人資料</h2>
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
              <form onSubmit={handleUpdateProfile}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            姓名
                        </label>
                        <div className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-700 font-medium">
                            <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center mr-3 text-sm font-bold">
                                {studentInfo.name?.[0] || '生'}
                            </span>
                            {studentInfo.name}
                        </div>
                    </div>

                    {/* Gender */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            性別
                        </label>
                        <div className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-700 font-medium">
                            <UserCircleIcon className="w-5 h-5 text-gray-400 mr-3" />
                        {formatGender(studentInfo.gender)}
                        </div>
                    </div>

                    {/* Student ID / Account */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            學號
                        </label>
                        <div className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-700 font-medium font-mono">
                            <IdentificationIcon className="w-5 h-5 text-gray-400 mr-3" />
                        {studentInfo.studentId || studentInfo.account || studentInfo.id}
                        </div>
                    </div>

                    {/* Grade */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            年級
                        </label>
                        <div className="flex items-center p-3 bg-gray-50 rounded-xl border border-gray-200 text-gray-700 font-medium">
                            <AcademicCapIcon className="w-5 h-5 text-gray-400 mr-3" />
                        {studentInfo.grade || '未填寫'}
                        </div>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            手機號碼 <span className="text-indigo-500 text-[10px] ml-1">(可修改)</span>
                        </label>
                        <div className="relative">
                            <PhoneIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                            <input 
                                type="tel" 
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                placeholder="請輸入手機號碼"
                            />
                        </div>
                    </div>

                    {/* Email (Editable) */}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            電子郵件 <span className="text-indigo-500 text-[10px] ml-1">(可修改)</span>
                        </label>
                        <div className="relative">
                            <EnvelopeIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                            <input 
                                type="email" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                placeholder="請輸入電子郵件"
                            />
                        </div>
                    </div>

                    {/* Address (Editable) */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            住址 <span className="text-indigo-500 text-[10px] ml-1">(可修改)</span>
                        </label>
                        <div className="relative">
                            <HomeIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
                            <input 
                                type="text" 
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                placeholder="請輸入通訊地址"
                            />
                        </div>
                    </div>

                    {/* Enrolled Courses */}
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex justify-between items-center">
                            <span>報名課程</span>
                        </label>
                        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                        {/* 改用經過狀態過濾的 userCourses 確保不顯示已封存課程 */}
                        {userCourses.length > 0 ? (
                                <div className="flex flex-col gap-2">
                                {userCourses.map((course, index) => (
                                    <div key={index} className="flex items-center px-3 py-2 rounded-lg text-sm font-medium bg-white border border-indigo-100 text-indigo-700 shadow-sm">
                                        <BookOpenIcon className="w-4 h-4 mr-1.5" />
                                        {course.name || course.title || '未知課程'}
                                    </div>
                                ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-sm italic">目前無報名課程</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button 
                        type="submit" 
                        disabled={isUpdatingProfile}
                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 disabled:bg-gray-300 disabled:shadow-none"
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-8">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center">
                    <KeyIcon className="w-5 h-5 text-gray-500 mr-2" />
                    <h3 className="text-lg font-bold text-gray-800">修改密碼</h3>
                </div>
                <div className="p-6">
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">目前密碼</label>
                            <input 
                                type="password" 
                                required
                                value={currentPassword}
                                onChange={(e) => setCurrentPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                placeholder="請輸入目前密碼"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">新密碼</label>
                            <input 
                                type="password" 
                                required
                                minLength={6}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                placeholder="請輸入新密碼"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">確認新密碼</label>
                            <input 
                                type="password" 
                                required
                                minLength={6}
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                                placeholder="再次輸入新密碼"
                            />
                        </div>
                        
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-200 disabled:bg-gray-300 disabled:shadow-none mt-2"
                        >
                            {isSubmitting ? '更新中...' : '確認修改'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}