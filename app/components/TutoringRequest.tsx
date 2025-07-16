'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Timestamp } from 'firebase/firestore';
import LoadingSpinner from './LoadingSpinner';
import Calendar from './Calendar';

interface UserInfo {
  id: string;
  name: string;
  account: string;
  role: string;
}

interface StudentCourse {
  id: string;
  name: string;
  code?: string;
  subject: string;
  grade: string;
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
  restrictions: string;
  notes: string;
  tutoringType: 'individual' | 'group';
  subjectRestriction?: string;
  courseRestrictions?: string[];
  tutoringMethod?: 'online' | 'physical';
  location?: string;
  createdAt: Timestamp;
}

interface TutoringRequestForm {
  teacherId: string;
  courseId: string;
  timeSlotId: string;
  notes: string;
  email: string;
}

export default function TutoringRequest({ userInfo }: { userInfo: UserInfo | null }) {
  // Removed unused teachers state
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [studentCourses, setStudentCourses] = useState<StudentCourse[]>([]);
  const [loading, setLoading] = useState(true);
  // Removed unused submitting state
  // Removed unused showSuccessDialog state
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [formData, setFormData] = useState<TutoringRequestForm>({
    teacherId: '',
    courseId: '',
    timeSlotId: '',
    notes: '',
    email: ''
  });

  const fetchTeachers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/teacher/list');
      await res.json();
      // Removed unused teachers state
    } catch (error) {
      console.error('Error fetching teachers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeSlots = async (date?: string) => {
    try {
      const res = await fetch('/api/time-slots/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      });
      const slots = await res.json();
      setTimeSlots(slots);
    } catch (error) {
      console.error('Error fetching time slots:', error);
    }
  };

  const getStudentEmail = useCallback(async () => {
    if (!userInfo) return '';
    try {
      const res = await fetch('/api/student/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: userInfo.account }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.email || '';
      }
    } catch (error) {
      console.error('Error fetching student email:', error);
    }
    return '';
  }, [userInfo]);

  const fetchStudentCourses = useCallback(async () => {
    if (!userInfo) return;
    try {
      // 先查 /api/student/profile 取得 enrolledCourses
      const resProfile = await fetch('/api/student/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: userInfo.id }),
      });
      if (!resProfile.ok) {
        setStudentCourses([]);
        return;
      }
      const studentData = await resProfile.json();
      if (studentData.enrolledCourses && Array.isArray(studentData.enrolledCourses)) {
        // 再查 /api/courses/list 過濾
        const resCourses = await fetch('/api/courses/list');
        if (resCourses.ok) {
          const allCourses = await resCourses.json();
          const validCourses = allCourses.filter((c: { id: string }) => studentData.enrolledCourses.includes(c.id)).map((c: { id: string; name?: string; code?: string; subject?: string; grade?: string }) => ({
            id: c.id,
            name: c.name || c.code || '未命名課程',
            code: c.code || '',
            subject: c.subject || '未分類',
            grade: c.grade || ''
          }));
          setStudentCourses(validCourses);
        } else {
          setStudentCourses([]);
        }
      } else {
        setStudentCourses([]);
      }
    } catch (error) {
      console.error('獲取學生課程時發生錯誤:', error);
      setStudentCourses([]);
    }
  }, [userInfo]);

  // 檢查學生是否符合時段資格
  const checkStudentEligibility = (timeSlot: TimeSlot): boolean => {
    console.log('=== 資格檢查開始 ===');
    console.log('時段ID:', timeSlot.id);
    console.log('時段時間:', timeSlot.time);
    console.log('學生課程數量:', studentCourses.length);
    console.log('學生課程:', studentCourses.map(c => ({ id: c.id, name: c.name, subject: c.subject })));
    console.log('時段限制:', {
      subjectRestriction: timeSlot.subjectRestriction,
      courseRestrictions: timeSlot.courseRestrictions
    });

    // 如果學生沒有課程，則不符合任何限制
    if (studentCourses.length === 0) {
      console.log('學生沒有課程，不符合資格');
      console.log('=== 資格檢查結束：無課程 ===');
      return false;
    }

    // 第一種限制：課程限制 - 學生必須有選修指定的課程
    if (timeSlot.courseRestrictions && timeSlot.courseRestrictions.length > 0) {
      console.log('檢查課程限制...');
      console.log('時段課程限制:', timeSlot.courseRestrictions);
      console.log('學生課程ID:', studentCourses.map(c => c.id));
      
      const hasEligibleCourse = timeSlot.courseRestrictions.some(courseId => 
        studentCourses.some(course => course.id === courseId)
      );
      
      console.log('課程限制檢查結果:', {
        courseRestrictions: timeSlot.courseRestrictions,
        studentCourseIds: studentCourses.map(c => c.id),
        hasEligibleCourse
      });
      
      if (!hasEligibleCourse) {
        console.log('學生沒有選修指定的課程');
      }
      
      console.log('=== 資格檢查結束：課程限制 ===');
      return hasEligibleCourse;
    }
    
    // 第二種限制：科目限制 - 學生必須有該科目的課程
    if (timeSlot.subjectRestriction) {
      console.log('檢查科目限制...');
      console.log('時段科目限制:', timeSlot.subjectRestriction);
      console.log('學生科目:', studentCourses.map(c => c.subject));
      
      const hasEligibleSubject = studentCourses.some(course => course.subject === timeSlot.subjectRestriction);
      
      console.log('科目限制檢查結果:', {
        subjectRestriction: timeSlot.subjectRestriction,
        studentSubjects: studentCourses.map(c => c.subject),
        hasEligibleSubject
      });
      
      if (!hasEligibleSubject) {
        console.log('學生沒有該科目的課程');
      }
      
      console.log('=== 資格檢查結束：科目限制 ===');
      return hasEligibleSubject;
    }
    
    // 如果沒有限制，則符合資格
    console.log('無限制，符合資格');
    console.log('=== 資格檢查結束：無限制 ===');
    return true;
  };

  // 獲取符合時段要求的課程
  const getEligibleCourses = (timeSlot: TimeSlot): StudentCourse[] => {
    console.log('=== 獲取符合課程開始 ===');
    console.log('時段限制:', {
      subjectRestriction: timeSlot.subjectRestriction,
      courseRestrictions: timeSlot.courseRestrictions
    });
    console.log('學生課程:', studentCourses);
    
    // 如果學生沒有課程，返回空陣列
    if (studentCourses.length === 0) {
      console.log('學生沒有課程，返回空陣列');
      console.log('=== 獲取符合課程結束：無課程 ===');
      return [];
    }
    
    // 第一種限制：課程限制 - 返回指定的課程
    if (timeSlot.courseRestrictions && timeSlot.courseRestrictions.length > 0) {
      const eligibleCourses = studentCourses.filter(course => 
        timeSlot.courseRestrictions!.includes(course.id)
      );
      console.log('課程限制 - 符合課程:', eligibleCourses);
      console.log('=== 獲取符合課程結束：課程限制 ===');
      return eligibleCourses;
    }
    
    // 第二種限制：科目限制 - 返回該科目的所有課程
    if (timeSlot.subjectRestriction) {
      const eligibleCourses = studentCourses.filter(course => course.subject === timeSlot.subjectRestriction);
      console.log('科目限制 - 符合課程:', eligibleCourses);
      console.log('=== 獲取符合課程結束：科目限制 ===');
      return eligibleCourses;
    }
    
    // 如果沒有限制，返回所有課程
    console.log('無限制 - 所有課程:', studentCourses);
    console.log('=== 獲取符合課程結束：無限制 ===');
    return studentCourses;
  };

  useEffect(() => {
    const initializeForm = async () => {
      const email = await getStudentEmail();
      setFormData(prev => ({ ...prev, email }));
    };
    
    fetchTeachers();
    fetchTimeSlots();
    fetchStudentCourses();
    initializeForm();
  }, [userInfo, getStudentEmail, fetchStudentCourses]);

  // Removed unused handleSubmit

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    fetchTimeSlots(date);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  const availableTimeSlots = timeSlots.filter(slot => {
    const dateMatch = slot.date === selectedDate;
    const statusMatch = slot.status === 'available';
    const capacityMatch = slot.currentStudents < slot.maxStudents;
    const eligibilityMatch = checkStudentEligibility(slot);
    
    console.log('Slot filter:', {
      slotId: slot.id,
      slotTime: slot.time,
      date: slot.date,
      selectedDate,
      dateMatch,
      status: slot.status,
      statusMatch,
      currentStudents: slot.currentStudents,
      maxStudents: slot.maxStudents,
      capacityMatch,
      eligibilityMatch,
      subjectRestriction: slot.subjectRestriction,
      courseRestrictions: slot.courseRestrictions,
      isAvailable: dateMatch && statusMatch && capacityMatch && eligibilityMatch
    });
    
    // 如果時段不可用，記錄原因
    if (!dateMatch) console.log(`時段 ${slot.id} 被過濾：日期不匹配`);
    if (!statusMatch) console.log(`時段 ${slot.id} 被過濾：狀態不是 available`);
    if (!capacityMatch) console.log(`時段 ${slot.id} 被過濾：已滿員 (${slot.currentStudents}/${slot.maxStudents})`);
    if (!eligibilityMatch) console.log(`時段 ${slot.id} 被過濾：資格不符合`);
    
    return dateMatch && statusMatch && capacityMatch && eligibilityMatch;
  });

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">選擇輔導時段</h2>
        <p className="text-gray-600">請選擇老師建立的輔導時段進行預約</p>
      </div>

      {/* 調試信息 */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-4 bg-gray-100 rounded-lg text-sm">
          <h3 className="font-semibold mb-2">調試信息：</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p>總時段數：{timeSlots.length}</p>
              <p>學生課程數：{studentCourses.length}</p>
              <p>選中日期：{selectedDate || '未選擇'}</p>
              <p>學生ID：{userInfo?.id}</p>
              <p>學生姓名：{userInfo?.name}</p>
              <p>學生帳號：{userInfo?.account}</p>
            </div>
            <div>
              <p>可用時段數：{availableTimeSlots.length}</p>
              <p>學生課程：</p>
              <ul className="list-disc list-inside ml-2">
                {studentCourses.map((course, index) => (
                  <li key={index}>
                    {course.name} ({course.subject}) - ID: {course.id}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {studentCourses.length === 0 && (
            <div className="mt-2 p-2 bg-yellow-100 rounded">
              <p className="text-yellow-800 text-xs">
                注意：您目前沒有選修任何課程
              </p>
            </div>
          )}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4">
              <h4 className="font-semibold mb-2">時段資格檢查：</h4>
              <div className="space-y-2">
                {timeSlots.slice(0, 5).map((slot) => {
                  const isEligible = checkStudentEligibility(slot);
                  const eligibleCourses = getEligibleCourses(slot);
                  const dateMatch = slot.date === selectedDate;
                  const statusMatch = slot.status === 'available';
                  const capacityMatch = slot.currentStudents < slot.maxStudents;
                  const isAvailable = dateMatch && statusMatch && capacityMatch && isEligible;
                  
                  return (
                    <div key={slot.id} className="border-l-4 border-blue-500 pl-2">
                      <p><strong>時段 {slot.time} ({slot.date}):</strong></p>
                      <p>科目限制: {slot.subjectRestriction || '無'}</p>
                      <p>課程限制: {slot.courseRestrictions?.join(', ') || '無'}</p>
                      <p>資格符合: <span className={isEligible ? 'text-green-600' : 'text-red-600'}>{isEligible ? '是' : '否'}</span></p>
                      <p>符合課程數: {eligibleCourses.length}</p>
                      <p>日期匹配: <span className={dateMatch ? 'text-green-600' : 'text-red-600'}>{dateMatch ? '是' : '否'}</span></p>
                      <p>狀態可用: <span className={statusMatch ? 'text-green-600' : 'text-red-600'}>{statusMatch ? '是' : '否'}</span></p>
                      <p>名額充足: <span className={capacityMatch ? 'text-green-600' : 'text-red-600'}>{capacityMatch ? '是' : '否'} ({slot.currentStudents}/{slot.maxStudents})</span></p>
                      <p>最終可用: <span className={isAvailable ? 'text-green-600' : 'text-red-600'}>{isAvailable ? '是' : '否'}</span></p>
                      {eligibleCourses.length > 0 && (
                        <ul className="list-disc list-inside ml-2 text-xs">
                          {eligibleCourses.map((course, index) => (
                            <li key={index}>{course.name} ({course.subject})</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 月曆選擇 */}
      {!formData.timeSlotId && (
        <div className="mb-8">
          <Calendar 
            userInfo={userInfo} 
            viewMode="student" 
            onDateSelect={handleDateSelect}
          />
        </div>
      )}

      {/* 時段列表 */}
      {!formData.timeSlotId && selectedDate && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            {new Date(selectedDate).toLocaleDateString('zh-TW')} 的可用時段
          </h3>

          {availableTimeSlots.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 mb-4">此日期沒有可用的輔導時段</p>
              <p className="text-sm text-gray-400">請選擇其他日期或聯繫老師建立新的時段</p>
            </div>
          ) : (
            <div className="space-y-4">
              {availableTimeSlots.map((slot) => {
                const eligibleCourses = getEligibleCourses(slot);
                return (
                  <div key={slot.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-lg text-gray-800">
                          {slot.time} - {slot.teacherName}
                        </h4>
                        <p className="text-sm text-gray-600">
                          時長：{slot.duration} 分鐘 | 
                          名額：{slot.tutoringType === 'individual' ? `${slot.currentStudents}/${slot.maxStudents}` : `${slot.currentStudents}/不限制`} |
                          性質：{slot.tutoringType === 'individual' ? '個人輔導' : '團體輔導'}
                        </p>
                        {slot.tutoringMethod && (
                          <p className="text-sm text-gray-600">
                            方式：{slot.tutoringMethod === 'online' ? '線上輔導' : '實體輔導'}
                            {slot.tutoringMethod === 'physical' && slot.location && ` | 地點：${slot.location}`}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setFormData({
                            ...formData,
                            teacherId: slot.teacherId,
                            timeSlotId: slot.id,
                            courseId: '' // 清空課程選擇
                          });
                        }}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        選擇此時段
                      </button>
                    </div>
                    {eligibleCourses.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-gray-700 mb-2">可預約的課程：</p>
                        <div className="flex flex-wrap gap-2">
                          {eligibleCourses.map((course, index) => (
                            <button
                              key={index}
                              onClick={() => {
                                setFormData({
                                  ...formData,
                                  teacherId: slot.teacherId,
                                  timeSlotId: slot.id,
                                  courseId: course.id
                                });
                              }}
                              className={`px-3 py-1 text-sm rounded-full border transition-colors ${
                                formData.timeSlotId === slot.id && formData.courseId === course.id
                                  ? 'bg-blue-600 text-white border-blue-600'
                                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {course.name} {course.code ? `(${course.code})` : `(${course.subject})`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}