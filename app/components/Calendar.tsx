'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import LoadingSpinner from './LoadingSpinner';
import AlertDialog from './AlertDialog';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface UserInfo {
  id: string;
  name: string;
  account: string;
  role: string;
}

interface TimeSlot {
  id: string;
  teacherId: string;
  teacherName: string;
  date: string;
  time: string;
  duration: number;
  maxStudents: number;
  currentStudents: number;
  status: 'available' | 'full' | 'cancelled';
  restrictions: string; // 限制（僅限某些課程或科目）
  notes: string; // 備註
  tutoringType: 'individual' | 'group'; // 個人輔導或團體輔導
  subjectRestriction?: string; // 科目限制
  courseRestrictions?: string[]; // 課程限制
  tutoringMethod?: 'online' | 'physical'; // 輔導方式
  location?: string; // 實體輔導地點
  createdAt: Timestamp;
}

interface CalendarProps {
  userInfo: UserInfo | null;
  viewMode: 'teacher' | 'student';
  onDateSelect?: (date: string) => void;
}

export default function Calendar({ userInfo, viewMode, onDateSelect }: CalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [allTimeSlots, setAllTimeSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  interface Course {
    id: string;
    name: string;
    code: string;
    [key: string]: unknown;
  }
  const [courses, setCourses] = useState<Course[]>([]);
  const [editingSlot, setEditingSlot] = useState<TimeSlot | null>(null);
  const [deletingSlot, setDeletingSlot] = useState<TimeSlot | null>(null);
  const [formData, setFormData] = useState({
    date: '',
    time: '09:00',
    duration: 60,
    maxStudents: 1,
    restrictions: '',
    notes: '',
    tutoringType: 'individual' as 'individual' | 'group',
    subjectRestriction: '',
    courseRestrictions: [] as string[],
    tutoringMethod: 'online' as 'online' | 'physical',
    location: ''
  });

  // 取得科目和課程資料
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [coursesRes] = await Promise.all([
          fetch('/api/courses/list', { method: 'POST' })
        ]);
        const coursesData = await coursesRes.json();
        setCourses(coursesData);
      } catch (error) {
        console.error('Error fetching subjects and courses:', error);
      }
    };
    fetchData();
  }, []);

  // 1. 將 fetchAllTimeSlots useCallback 提到所有 useEffect 之前
  const fetchAllTimeSlots = useCallback(async () => {
    if (!userInfo) return;
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const startDate = formatDate(firstDay);
      const endDate = formatDate(lastDay);
      const q = query(
        collection(db, 'time-slots'),
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        where('status', '==', 'available')
      );
      const querySnapshot = await getDocs(q);
      const slots = querySnapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(),
        currentStudents: doc.data().currentStudents || 0,
        maxStudents: doc.data().maxStudents || 1
      }));
      setAllTimeSlots(slots as TimeSlot[]);
    } catch (error) {
      console.error('Error fetching all time slots:', error);
    } finally {
      setLoading(false);
    }
  }, [userInfo, currentDate]);

  // 2. 確保 useEffect 的依賴陣列為 [fetchAllTimeSlots]
  useEffect(() => {
    fetchAllTimeSlots();
  }, [fetchAllTimeSlots]);

  // 學生模式下獲取整個月份的時段
  useEffect(() => {
    if (viewMode === 'student' && userInfo) {
      fetchAllTimeSlots();
    }
  }, [currentDate, viewMode, userInfo, fetchAllTimeSlots]);

  // 獲取當前月份的日期陣列
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // 添加上個月的日期（填充）
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, new Date(year, month, 0).getDate() - i);
      days.push({
        date: prevDate,
        isCurrentMonth: false,
        isToday: false,
        isPast: prevDate < new Date(new Date().setHours(0, 0, 0, 0))
      });
    }

    // 添加當前月份的日期
    for (let i = 1; i <= daysInMonth; i++) {
      const currentDate = new Date(year, month, i);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      days.push({
        date: currentDate,
        isCurrentMonth: true,
        isToday: currentDate.getTime() === today.getTime(),
        isPast: currentDate < today
      });
    }

    // 添加下個月的日期（填充）
    const remainingDays = 42 - days.length; // 6週 x 7天 = 42
    for (let i = 1; i <= remainingDays; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        date: nextDate,
        isCurrentMonth: false,
        isToday: false,
        isPast: nextDate < new Date(new Date().setHours(0, 0, 0, 0))
      });
    }

    return days;
  };

  // 取得時段資料
  const fetchTimeSlots = async (date: string) => {
    if (!userInfo) return;
    
    try {
      setLoading(true);
      
      // 學生模式下獲取所有老師的時段，老師模式下只獲取自己的時段
      let slots;
      if (viewMode === 'student') {
        // 學生模式：獲取所有老師的可用時段
        const q = query(
          collection(db, 'time-slots'),
          where('date', '==', date),
          where('status', '==', 'available')
        );
        const querySnapshot = await getDocs(q);
        slots = querySnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data(),
          currentStudents: doc.data().currentStudents || 0,
          maxStudents: doc.data().maxStudents || 1
        }));
      } else {
        // 老師模式：只獲取自己的時段
        slots = await fetch('/api/time-slots/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ teacherId: userInfo.id, date })
        }).then(res => res.json());
      }
      
      setTimeSlots(slots as TimeSlot[]);
    } catch (error) {
      console.error('Error fetching time slots:', error);
    } finally {
      setLoading(false);
    }
  };

  // 創建時段
  const handleCreateTimeSlot = async () => {
    if (!userInfo || !formData.date) return;

    // 驗證限制設定
    if (!formData.subjectRestriction && formData.courseRestrictions.length === 0) {
      alert('請至少選擇一個科目或課程限制');
      return;
    }

    // 驗證人數限制（僅個人輔導需要驗證）
    if (formData.tutoringType === 'individual' && formData.maxStudents > 5) {
      alert('個人輔導人數不能超過5人');
      return;
    }

    // 驗證實體輔導地點
    if (formData.tutoringMethod === 'physical' && !formData.location.trim()) {
      alert('實體輔導必須填寫輔導地點');
      return;
    }

    try {
      const timeSlotData = {
        teacherId: userInfo.id,
        teacherName: userInfo.name,
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        maxStudents: formData.tutoringType === 'individual' ? formData.maxStudents : 999,
        currentStudents: 0,
        status: 'available',
        restrictions: formData.restrictions,
        notes: formData.notes,
        tutoringType: formData.tutoringType,
        subjectRestriction: formData.subjectRestriction,
        courseRestrictions: formData.courseRestrictions,
        tutoringMethod: formData.tutoringMethod,
        location: formData.location
      };

      await fetch('/api/time-slots/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(timeSlotData)
      }).then(res => res.json());
      setShowSuccessDialog(true);
      setShowCreateModal(false);
      fetchTimeSlots(formData.date);
      
      // 重置表單
      setFormData({
        date: selectedDate || '',
        time: '09:00',
        duration: 60,
        maxStudents: 1,
        restrictions: '',
        notes: '',
        tutoringType: 'individual',
        subjectRestriction: '',
        courseRestrictions: [],
        tutoringMethod: 'online',
        location: ''
      });
    } catch (error) {
      console.error('Error creating time slot:', error);
      alert('創建時段時發生錯誤');
    }
  };

  // 處理課程選擇
  const handleCourseSelection = (courseId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      courseRestrictions: checked 
        ? [...prev.courseRestrictions, courseId]
        : prev.courseRestrictions.filter(id => id !== courseId)
    }));
  };

  // 處理科目選擇
  const handleSubjectSelection = (subject: string) => {
    setFormData(prev => ({
      ...prev,
      subjectRestriction: subject,
      courseRestrictions: [] // 清空課程選擇
    }));
  };

  // 處理輔導性質變更
  const handleTutoringTypeChange = (type: 'individual' | 'group') => {
    setFormData(prev => ({
      ...prev,
      tutoringType: type,
      // 團體輔導不需要設定人數限制
      maxStudents: type === 'individual' ? Math.min(prev.maxStudents, 5) : 1
    }));
  };

  // 開啟編輯模式
  const handleEditSlot = (slot: TimeSlot) => {
    setEditingSlot(slot);
    setFormData({
      date: slot.date,
      time: slot.time,
      duration: slot.duration,
      maxStudents: slot.maxStudents,
      restrictions: slot.restrictions,
      notes: slot.notes,
      tutoringType: slot.tutoringType,
      subjectRestriction: slot.subjectRestriction || '',
      courseRestrictions: slot.courseRestrictions || [],
      tutoringMethod: slot.tutoringMethod || 'online',
      location: slot.location || ''
    });
    setShowEditModal(true);
  };

  // 開啟刪除確認
  const handleDeleteSlot = (slot: TimeSlot) => {
    setDeletingSlot(slot);
    setShowDeleteConfirm(true);
  };

  // 更新時段
  const handleUpdateTimeSlot = async () => {
    if (!userInfo || !editingSlot || !formData.date) return;

    // 驗證限制設定
    if (!formData.subjectRestriction && formData.courseRestrictions.length === 0) {
      alert('請至少選擇一個科目或課程限制');
      return;
    }

    // 驗證人數限制（僅個人輔導需要驗證）
    if (formData.tutoringType === 'individual' && formData.maxStudents > 5) {
      alert('個人輔導人數不能超過5人');
      return;
    }

    // 驗證實體輔導地點
    if (formData.tutoringMethod === 'physical' && !formData.location.trim()) {
      alert('實體輔導必須填寫輔導地點');
      return;
    }

    try {
      const updateData = {
        date: formData.date,
        time: formData.time,
        duration: formData.duration,
        maxStudents: formData.tutoringType === 'individual' ? formData.maxStudents : 999,
        restrictions: formData.restrictions,
        notes: formData.notes,
        tutoringType: formData.tutoringType,
        subjectRestriction: formData.subjectRestriction,
        courseRestrictions: formData.courseRestrictions,
        tutoringMethod: formData.tutoringMethod,
        location: formData.location
      };

      await fetch('/api/time-slots/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: editingSlot.id, data: updateData })
      }).then(res => res.json());
      setShowSuccessDialog(true);
      setShowEditModal(false);
      setEditingSlot(null);
      fetchTimeSlots(formData.date);
      
      // 重置表單
      setFormData({
        date: selectedDate || '',
        time: '09:00',
        duration: 60,
        maxStudents: 1,
        restrictions: '',
        notes: '',
        tutoringType: 'individual',
        subjectRestriction: '',
        courseRestrictions: [],
        tutoringMethod: 'online',
        location: ''
      });
    } catch (error) {
      console.error('Error updating time slot:', error);
      alert('更新時段時發生錯誤');
    }
  };

  // 確認刪除時段
  const handleConfirmDelete = async () => {
    if (!deletingSlot) return;

    try {
      await fetch('/api/time-slots/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ id: deletingSlot.id })
      }).then(res => res.json());
      setShowSuccessDialog(true);
      setShowDeleteConfirm(false);
      setDeletingSlot(null);
      fetchTimeSlots(selectedDate || '');
    } catch (error) {
      console.error('Error deleting time slot:', error);
      alert('刪除時段時發生錯誤');
    }
  };

  // 格式化日期
  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // 檢查日期是否可選（包含當天，開放後14天）
  const isDateSelectable = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    
    // 包含當天
    if (targetDate.getTime() < today.getTime()) {
      return false;
    }
    
    // 開放後14天
    const maxDate = new Date(today);
    maxDate.setDate(today.getDate() + 14);
    
    return targetDate.getTime() <= maxDate.getTime();
  };

  const days = getDaysInMonth(currentDate);
  const monthNames = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月'
  ];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg p-6">
        {/* 月曆標題 */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            {currentDate.getFullYear()}年 {monthNames[currentDate.getMonth()]}
          </h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              今天
            </button>
            <button
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        {/* 選中日期的時段列表 - 移到頂部 */}
        {selectedDate && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                {selectedDate} 的輔導時段
              </h3>
              {viewMode === 'teacher' && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  新增時段
                </button>
              )}
            </div>

            {loading ? (
              <LoadingSpinner />
            ) : timeSlots.length === 0 ? (
              <p className="text-gray-500 text-center py-4">此日期尚無輔導時段</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {timeSlots.map((slot) => (
                  <div key={slot.id} className="bg-white p-4 rounded-lg border shadow-sm hover:shadow-md transition-shadow min-h-[200px]">
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-semibold text-lg text-gray-800">{slot.time}</span>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          slot.status === 'available' ? 'bg-green-100 text-green-800' :
                          slot.status === 'full' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {slot.status === 'available' ? '可預約' :
                           slot.status === 'full' ? '已滿' : '已取消'}
                        </span>
                        {viewMode === 'teacher' && (
                          <div className="flex space-x-1">
                            <button
                              onClick={() => handleEditSlot(slot)}
                              className="p-1 text-blue-600 hover:text-blue-800"
                              title="編輯"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteSlot(slot)}
                              className="p-1 text-red-600 hover:text-red-800"
                              title="刪除"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 text-sm text-gray-600">
                      <div className="flex items-center">
                        <span className="font-medium">時長：</span>
                        <span>{slot.duration} 分鐘</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium">名額：</span>
                        <span>{slot.tutoringType === 'individual' ? `${slot.currentStudents}/${slot.maxStudents}` : `${slot.currentStudents}/不限制`}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="font-medium">性質：</span>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          slot.tutoringType === 'individual' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'
                        }`}>
                          {slot.tutoringType === 'individual' ? '個人輔導' : '團體輔導'}
                        </span>
                      </div>
                      {slot.tutoringMethod && (
                        <div className="flex items-center">
                          <span className="font-medium">方式：</span>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            slot.tutoringMethod === 'online' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {slot.tutoringMethod === 'online' ? '線上輔導' : '實體輔導'}
                          </span>
                        </div>
                      )}
                      {slot.tutoringMethod === 'physical' && slot.location && (
                        <div className="flex items-start">
                          <span className="font-medium">地點：</span>
                          <span className="text-gray-700 text-xs ml-1 flex-1">{slot.location}</span>
                        </div>
                      )}
                      {slot.subjectRestriction && (
                        <div className="flex items-center">
                          <span className="font-medium">科目：</span>
                          <span className="text-purple-600">{slot.subjectRestriction}</span>
                        </div>
                      )}
                      {slot.courseRestrictions && slot.courseRestrictions.length > 0 && (
                        <div className="flex items-center">
                          <span className="font-medium">課程：</span>
                          <span className="text-green-600">{slot.courseRestrictions.length} 個課程</span>
                        </div>
                      )}
                      {slot.restrictions && (
                        <div className="flex items-center">
                          <span className="font-medium">限制：</span>
                          <span className="text-orange-600">{slot.restrictions}</span>
                        </div>
                      )}
                      {slot.notes && (
                        <div className="mt-2">
                          <span className="font-medium">備註：</span>
                          <p className="text-gray-500 text-xs mt-1 line-clamp-2" title={slot.notes}>
                            {slot.notes}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 星期標題 */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
            <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* 月曆格子 */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, index) => (
            <div
              key={index}
              className={`min-h-[100px] p-1 border border-gray-200 ${
                day.isCurrentMonth ? 'bg-white' : 'bg-gray-50'
              }`}
            >
              <div className="flex flex-col h-full">
                <div
                  className={`w-10 h-10 flex items-center justify-center rounded-full text-sm font-medium ${
                    !day.isCurrentMonth ? 'text-gray-300' :
                    day.isToday ? 'bg-blue-600 text-white' :
                    day.isPast ? 'text-gray-400' :
                    isDateSelectable(day.date) ? 'text-gray-700 hover:bg-gray-100 cursor-pointer' :
                    'text-gray-400'
                  }`}
                  onClick={() => {
                    if (day.isCurrentMonth && !day.isPast && isDateSelectable(day.date)) {
                      const dateString = formatDate(day.date);
                      setSelectedDate(dateString);
                      fetchTimeSlots(dateString);
                      // 自動帶入日期到表單
                      setFormData(prev => ({
                        ...prev,
                        date: dateString
                      }));
                      if (onDateSelect) {
                        onDateSelect(dateString);
                      }
                    }
                  }}
                >
                  {day.date.getDate()}
                </div>
                
                {/* 時段指示器 */}
                {day.isCurrentMonth && !day.isPast && (
                  <div className="flex-1 flex flex-col justify-end p-1">
                    {(() => {
                      const dayDate = formatDate(day.date);
                      let slotCount = 0;
                      
                      if (viewMode === 'student') {
                        // 學生模式：使用整個月份的時段資料
                        slotCount = allTimeSlots.filter(slot => slot.date === dayDate).length;
                      } else {
                        // 老師模式：使用當前選中日期的時段資料
                        slotCount = timeSlots.filter(slot => slot.date === dayDate).length;
                      }
                      
                      return slotCount > 0 ? (
                      <div className="text-xs text-blue-600 font-medium">
                          {slotCount} 個時段
                      </div>
                      ) : null;
                    })()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 新增時段對話框 */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">新增輔導時段</h3>
            <div className="space-y-4">
              {/* 日期 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  日期 *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  max={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">包含當天，開放後14天</p>
              </div>

              {/* 老師 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  老師
                </label>
                <input
                  type="text"
                  value={userInfo?.name || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">系統自動帶入</p>
              </div>

              {/* 輔導性質 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  輔導性質 *
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tutoringType"
                      value="individual"
                      checked={formData.tutoringType === 'individual'}
                      onChange={() => handleTutoringTypeChange('individual')}
                      className="mr-2"
                    />
                    <span className="text-sm">個人輔導 (1-5人)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tutoringType"
                      value="group"
                      checked={formData.tutoringType === 'group'}
                      onChange={() => handleTutoringTypeChange('group')}
                      className="mr-2"
                    />
                    <span className="text-sm">團體輔導 (不限制人數)</span>
                  </label>
                </div>
              </div>

              {/* 輔導時間 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  輔導時間 *
                </label>
                <select
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="select-unified w-full px-3 py-2 rounded-md"
                >
                  <option value="09:00">09:00</option>
                  <option value="10:00">10:00</option>
                  <option value="11:00">11:00</option>
                  <option value="14:00">14:00</option>
                  <option value="15:00">15:00</option>
                  <option value="16:00">16:00</option>
                  <option value="19:00">19:00</option>
                  <option value="20:00">20:00</option>
                </select>
              </div>
              
              {/* 時長 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  時長（分鐘） *
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  className="select-unified w-full px-3 py-2 rounded-md"
                >
                  <option value={30}>30 分鐘</option>
                  <option value={60}>60 分鐘</option>
                  <option value={90}>90 分鐘</option>
                  <option value={120}>120 分鐘</option>
                </select>
              </div>

              {/* 最大學生數 - 僅在個人輔導時顯示 */}
              {formData.tutoringType === 'individual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最大學生數 *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={formData.maxStudents}
                    onChange={(e) => setFormData({ ...formData, maxStudents: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">個人輔導：1-5人</p>
                </div>
              )}

              {/* 科目限制 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  科目限制
                </label>
                <select
                  value={formData.subjectRestriction}
                  onChange={(e) => handleSubjectSelection(e.target.value)}
                  className="select-unified w-full px-3 py-2 rounded-md"
                >
                  <option value="">請選擇科目</option>
                  <option value="數學">數學</option>
                  <option value="理化">理化</option>
                  <option value="物理">物理</option>
                  <option value="化學">化學</option>
                  <option value="生物">生物</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">選擇科目後會清空課程選擇</p>
              </div>

              {/* 課程限制 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  課程限制
                </label>
                <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                  {courses.map((course: Course) => (
                    <label key={course.id} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={formData.courseRestrictions.includes(course.id)}
                        onChange={(e) => handleCourseSelection(course.id, e.target.checked)}
                        disabled={!!formData.subjectRestriction}
                        className="mr-2"
                      />
                      <span className="text-sm">{course.name} ({course.code})</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.subjectRestriction ? '已選擇科目，課程選擇已停用' : '可多選課程'}
                </p>
              </div>

              {/* 輔導方式 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  輔導方式 *
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tutoringMethod"
                      value="online"
                      checked={formData.tutoringMethod === 'online'}
                      onChange={() => setFormData({ ...formData, tutoringMethod: 'online' })}
                      className="mr-2"
                    />
                    <span className="text-sm">線上輔導</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="tutoringMethod"
                      value="physical"
                      checked={formData.tutoringMethod === 'physical'}
                      onChange={() => setFormData({ ...formData, tutoringMethod: 'physical' })}
                      className="mr-2"
                    />
                    <span className="text-sm">實體輔導</span>
                  </label>
                </div>
              </div>

              {/* 實體輔導地點 - 僅在選擇實體輔導時顯示 */}
              {formData.tutoringMethod === 'physical' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    輔導地點 *
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="請輸入輔導地點，例如：台北市信義區信義路五段7號"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">請詳細填寫輔導地點，方便學生前往</p>
                </div>
              )}

              {/* 備註 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  備註
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="輔導內容、注意事項或其他說明..."
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setFormData({
                    date: selectedDate || '',
                    time: '09:00',
                    duration: 60,
                    maxStudents: 1,
                    restrictions: '',
                    notes: '',
                    tutoringType: 'individual',
                    subjectRestriction: '',
                    courseRestrictions: [],
                    tutoringMethod: 'online',
                    location: ''
                  });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleCreateTimeSlot}
                disabled={!formData.date || (!formData.subjectRestriction && formData.courseRestrictions.length === 0)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                新增
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 編輯時段對話框 */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">編輯輔導時段</h3>
            <div className="space-y-4">
              {/* 日期 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  日期 *
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  min={new Date().toISOString().split('T')[0]}
                  max={new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">包含當天，開放後14天</p>
              </div>

              {/* 老師 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  老師
                </label>
                <input
                  type="text"
                  value={userInfo?.name || ''}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600"
                />
                <p className="text-xs text-gray-500 mt-1">系統自動帶入</p>
              </div>

              {/* 輔導性質 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  輔導性質 *
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="editTutoringType"
                      value="individual"
                      checked={formData.tutoringType === 'individual'}
                      onChange={() => handleTutoringTypeChange('individual')}
                      className="mr-2"
                    />
                    <span className="text-sm">個人輔導 (1-5人)</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="editTutoringType"
                      value="group"
                      checked={formData.tutoringType === 'group'}
                      onChange={() => handleTutoringTypeChange('group')}
                      className="mr-2"
                    />
                    <span className="text-sm">團體輔導 (不限制人數)</span>
                  </label>
                </div>
              </div>

              {/* 輔導時間 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  輔導時間 *
                </label>
                <select
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  className="select-unified w-full px-3 py-2 rounded-md"
                >
                  <option value="09:00">09:00</option>
                  <option value="10:00">10:00</option>
                  <option value="11:00">11:00</option>
                  <option value="14:00">14:00</option>
                  <option value="15:00">15:00</option>
                  <option value="16:00">16:00</option>
                  <option value="19:00">19:00</option>
                  <option value="20:00">20:00</option>
                </select>
              </div>
              
              {/* 時長 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  時長（分鐘） *
                </label>
                <select
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  className="select-unified w-full px-3 py-2 rounded-md"
                >
                  <option value={30}>30 分鐘</option>
                  <option value={60}>60 分鐘</option>
                  <option value={90}>90 分鐘</option>
                  <option value={120}>120 分鐘</option>
                </select>
              </div>

              {/* 最大學生數 - 僅在個人輔導時顯示 */}
              {formData.tutoringType === 'individual' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    最大學生數 *
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={formData.maxStudents}
                    onChange={(e) => setFormData({ ...formData, maxStudents: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">個人輔導：1-5人</p>
                </div>
              )}

              {/* 科目限制 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  科目限制
                </label>
                <select
                  value={formData.subjectRestriction}
                  onChange={(e) => handleSubjectSelection(e.target.value)}
                  className="select-unified w-full px-3 py-2 rounded-md"
                >
                  <option value="">請選擇科目</option>
                  <option value="數學">數學</option>
                  <option value="理化">理化</option>
                  <option value="物理">物理</option>
                  <option value="化學">化學</option>
                  <option value="生物">生物</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">選擇科目後會清空課程選擇</p>
              </div>

              {/* 課程限制 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  課程限制
                </label>
                <div className="max-h-32 overflow-y-auto border border-gray-300 rounded-md p-2">
                  {courses.map((course: Course) => (
                    <label key={course.id} className="flex items-center mb-2">
                      <input
                        type="checkbox"
                        checked={formData.courseRestrictions.includes(course.id)}
                        onChange={(e) => handleCourseSelection(course.id, e.target.checked)}
                        disabled={!!formData.subjectRestriction}
                        className="mr-2"
                      />
                      <span className="text-sm">{course.name} ({course.code})</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.subjectRestriction ? '已選擇科目，課程選擇已停用' : '可多選課程'}
                </p>
              </div>

              {/* 輔導方式 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  輔導方式 *
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="editTutoringMethod"
                      value="online"
                      checked={formData.tutoringMethod === 'online'}
                      onChange={() => setFormData({ ...formData, tutoringMethod: 'online' })}
                      className="mr-2"
                    />
                    <span className="text-sm">線上輔導</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="editTutoringMethod"
                      value="physical"
                      checked={formData.tutoringMethod === 'physical'}
                      onChange={() => setFormData({ ...formData, tutoringMethod: 'physical' })}
                      className="mr-2"
                    />
                    <span className="text-sm">實體輔導</span>
                  </label>
                </div>
              </div>

              {/* 實體輔導地點 - 僅在選擇實體輔導時顯示 */}
              {formData.tutoringMethod === 'physical' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    輔導地點 *
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="請輸入輔導地點，例如：台北市信義區信義路五段7號"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">請詳細填寫輔導地點，方便學生前往</p>
                </div>
              )}

              {/* 備註 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  備註
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="輔導內容、注意事項或其他說明..."
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingSlot(null);
                  setFormData({
                    date: selectedDate || '',
                    time: '09:00',
                    duration: 60,
                    maxStudents: 1,
                    restrictions: '',
                    notes: '',
                    tutoringType: 'individual',
                    subjectRestriction: '',
                    courseRestrictions: [],
                    tutoringMethod: 'online',
                    location: ''
                  });
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleUpdateTimeSlot}
                disabled={!formData.date || (!formData.subjectRestriction && formData.courseRestrictions.length === 0)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                更新
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 刪除確認對話框 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">確認刪除</h3>
            <p className="text-gray-600 mb-6">
              您確定要刪除這個輔導時段嗎？此操作無法復原。
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletingSlot(null);
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                取消
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                確認刪除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 成功對話框 */}
      <AlertDialog
        open={showSuccessDialog}
        message="輔導時段已成功建立！"
        onClose={() => setShowSuccessDialog(false)}
        buttonText="確定"
      />
    </div>
  );
} 