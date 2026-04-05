'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { getSession } from '@/utils/session';
import { useSearchParams, useRouter } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useInterval } from '@/utils/hooks';
import Swal from 'sweetalert2';
import StudentCourseSelector from '@/components/StudentCourseSelector';
import { ClockIcon } from '@heroicons/react/24/outline';

// ====================================================================
// 1. Interfaces
// ====================================================================

interface Activity {
  id: string;
  courseId: string;
  firestoreCourseId: string;
  title: string;
  courseName: string;
  startTime: string;
  endTime: string;
  status: 'upcoming' | 'active' | 'past';
  studentStatus?: string;
}

interface EnrolledCourse {
  id: string;
  name: string;
  code: string;
  status?: string;
  archived?: boolean;
}

interface ActivityDetails extends Activity {
  checkInMethod: 'numeric' | 'manual';
}

// Helper to group activities by course name
const groupActivitiesByCourse = (activities: Activity[]) => {
  return activities.reduce((groups, activity) => {
    const courseName = activity.courseName || '未分類課程';
    if (!groups[courseName]) {
      groups[courseName] = [];
    }
    groups[courseName].push(activity);
    return groups;
  }, {} as Record<string, Activity[]>);
};

// ====================================================================
// 2. Components: Header Icon & Activity Card
// ====================================================================


const ActivityCard = ({ activity }: { activity: Activity }) => {
  const router = useRouter();

  const getStatusBadge = (status: Activity['status']) => {
    switch (status) {
      case 'upcoming':
        return <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md">即將開始</span>;
      case 'active':
        return <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-md animate-pulse">進行中</span>;
      case 'past':
        return <span className="px-2 py-1 text-xs font-medium text-gray-500 bg-gray-100 rounded-md">已結束</span>;
    }
  };

  const getAttendanceStatusPill = (status: string | undefined) => {
    if (!status) return <span className="text-xs text-gray-400">未記錄</span>;
    
    const statusMap: Record<string, { text: string; styles: string }> = {
      present: { text: '出席', styles: 'text-green-700 bg-green-100 border-green-200' },
      late: { text: '遲到', styles: 'text-yellow-700 bg-yellow-100 border-yellow-200' },
      absent: { text: '曠課', styles: 'text-red-700 bg-red-100 border-red-200' },
      leave: { text: '請假', styles: 'text-purple-700 bg-purple-100 border-purple-200' },
    };

    const config = statusMap[status] || { text: status, styles: 'text-gray-700 bg-gray-100' };

    return (
      <span className={`px-3 py-1 text-xs font-bold border rounded-full ${config.styles}`}>
        {config.text}
      </span>
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {/* 標題與時間 (前方無圖示) */}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-bold text-gray-800 text-lg">{activity.title}</h4>
          {getStatusBadge(activity.status)}
        </div>
        <div className="text-sm text-gray-500 flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {new Date(activity.startTime).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 
          {' ~ '} 
          {new Date(activity.endTime).toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* 操作區 */}
      <div className="flex items-center justify-end gap-3">
        {activity.status === 'past' ? (
          getAttendanceStatusPill(activity.studentStatus)
        ) : activity.status === 'active' ? (
          <button
            onClick={() => router.push(`/student/attendance?courseId=${activity.firestoreCourseId}&activity=${activity.id}`)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2 px-5 rounded-lg shadow-sm transition-colors flex items-center"
          >
            <span>簽到</span>
            <svg className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        ) : (
          <span className="text-sm text-gray-400 italic">尚未開始</span>
        )}
      </div>
    </div>
  );
};

// 課程分組顯示元件
const CourseGroupedList = ({ activities, emptyText }: { activities: Activity[], emptyText: string }) => {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-300">
        <svg className="w-12 h-12 mb-2 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
        <p>{emptyText}</p>
      </div>
    );
  }

  const grouped = groupActivitiesByCourse(activities);

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([courseName, courseActivities]) => (
        <div key={courseName} className="animate-fade-in-up">
          {/* 課程標題 */}
          <div className="flex items-center gap-2 mb-3 pl-1">
            <span className="w-1 h-6 bg-indigo-500 rounded-full"></span>
            <h3 className="text-lg font-bold text-gray-700">{courseName}</h3>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {courseActivities.length}
            </span>
          </div>
          
          {/* 該課程的活動列表 */}
          <div className="grid gap-3">
            {courseActivities.map(activity => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

// ====================================================================
// 3. Check-in View (大部分邏輯維持不變，僅微調樣式)
// ====================================================================

function CheckInView({ firestoreCourseId, activityId }: { firestoreCourseId: string, activityId: string }) {
  const router = useRouter();
  const [activity, setActivity] = useState<ActivityDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkInCode, setCheckInCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCheckedIn, _setHasCheckedIn] = useState(false);
  const [finalStatus, _setFinalStatus] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivityDetails = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/attendance/activity-details?courseId=${firestoreCourseId}&id=${activityId}`);
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '無法獲取點名活動資訊。');
        }
        const data: ActivityDetails = await response.json();
        setActivity(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '發生未知錯誤。');
      } finally {
        setIsLoading(false);
      }
    };
    fetchActivityDetails();
  }, [firestoreCourseId, activityId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const session = getSession();
    if (!session || !session.id) {
      Swal.fire({ icon: 'error', title: '錯誤', text: '無法驗證您的身份，請重新登入。' });
      setIsSubmitting(false);
      return;
    }

    try {
      if (!checkInCode) {
        Swal.fire({ icon: 'error', title: '錯誤', text: '簽到碼遺失。' });
        setIsSubmitting(false);
        return;
      }

      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: firestoreCourseId,
          activityId,
          studentId: session.id,
          checkInCode: checkInCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '簽到失敗。');
      }

      const statusText = data.status === 'present' ? '出席' : '遲到';
      Swal.fire({
        icon: 'success',
        title: '簽到成功！',
        text: `狀態：${statusText}`,
        confirmButtonColor: '#4f46e5'
      }).then(() => {
        router.push('/student/attendance');
      });

    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: '簽到失敗',
        text: err instanceof Error ? err.message : '簽到時發生錯誤。',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <LoadingSpinner text="載入點名活動中..." />;
  if (error) return <div className="p-8 text-center text-red-500 bg-red-50 rounded-lg">{error}</div>;
  if (!activity) return <div className="p-8 text-center text-gray-500">找不到點名活動。</div>;

  return (
    <div className="max-w-md mx-auto mt-8 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-lg border border-indigo-100 overflow-hidden">
        {/* Header */}
        <div className="bg-indigo-600 px-6 py-4 text-white text-center">
          <h3 className="text-xl font-bold">{activity.title}</h3>
          <p className="text-indigo-100 text-sm mt-1">{activity.courseName}</p>
        </div>

        {/* Body */}
        <div className="p-8">
          <div className="flex justify-center mb-6 text-gray-500 text-sm bg-gray-50 py-2 rounded-lg">
             <span>{new Date(activity.startTime).toLocaleString('zh-TW')}</span>
             <span className="mx-2">➔</span>
             <span>{new Date(activity.endTime).toLocaleString('zh-TW')}</span>
          </div>

          {hasCheckedIn ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
              </div>
              <p className="text-green-600 text-lg font-bold">已完成簽到</p>
              <p className="text-gray-600 mt-1">狀態：{finalStatus}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {activity.checkInMethod === 'numeric' && (
                <div className="mb-6">
                  <label htmlFor="checkInCode" className="block text-center text-sm font-medium text-gray-600 mb-3">
                    請輸入六位數簽到碼
                  </label>
                  <input
                    id="checkInCode"
                    type="text"
                    value={checkInCode}
                    onChange={(e) => setCheckInCode(e.target.value)}
                    maxLength={6}
                    className="w-full border-2 border-gray-200 focus:border-indigo-500 p-4 rounded-xl text-center text-3xl tracking-[0.5em] font-mono font-bold text-gray-700 outline-none transition-colors"
                    placeholder="------"
                    required
                    autoComplete="off"
                  />
                </div>
              )}
              <div className="flex flex-col gap-3">
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold shadow-md hover:bg-indigo-700 hover:shadow-lg transition-all disabled:bg-indigo-300 disabled:shadow-none"
                >
                  {isSubmitting ? '驗證中...' : '確認簽到'}
                </button>
                <button 
                  type="button"
                  onClick={() => router.back()}
                  className="w-full py-3.5 text-gray-500 font-medium hover:bg-gray-50 rounded-xl transition-colors"
                >
                  取消返回
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ====================================================================
// 4. Main Page Content
// ====================================================================

export default function AttendanceContent() {
  const searchParams = useSearchParams();
  const firestoreCourseId = searchParams.get('courseId');
  const activityId = searchParams.get('activity');
  const [tab, setTab] = useState<'live' | 'history'>('live');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);
  const [selectedCourseForHistory, setSelectedCourseForHistory] = useState<string | 'all'>('all');

  // Fetch enrolled courses list
  useEffect(() => {
    const fetchEnrolledCourses = async () => {
      try {
        const response = await fetch('/api/student/courses/list');
        if (response.ok) {
          const coursesData = await response.json();
          // 隱藏已封存課程，但保留已結束的課程供學生查看點名紀錄
          const activeCourses = (Array.isArray(coursesData) ? coursesData : [])
            .filter(c => c && c.status !== '已封存' && c.archived !== true && String(c.archived) !== 'true');
          setEnrolledCourses(activeCourses);
        }
      } catch (err) {
        console.error('Error fetching enrolled courses:', err);
      }
    };
    fetchEnrolledCourses();
  }, []);

  // Fetch all activities
  const fetchAllActivities = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true);
    try {
      const response = await fetch('/api/attendance/student-all-activities');
      if (response.ok) {
        const data = await response.json();
        setActivities(Array.isArray(data) ? data : []);
      } else {
        console.error('Failed to fetch activities');
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      if (showLoading) setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAllActivities(true);
  }, [fetchAllActivities]);

  // Polling for live updates
  useInterval(() => {
    if (tab === 'live') fetchAllActivities(false);
  }, 10000);

  // 2. 建立有效課程的 ID 集合，用來過濾活動列表
  // 只有當 enrolledCourses 載入完成後才進行過濾，避免初始載入時顯示不全
  const activeCourseIds = useMemo(() => new Set(enrolledCourses.map(c => c.id)), [enrolledCourses]);

  // 3. 只顯示來自非封存課程的點名活動（這能解決歷史紀錄出現舊資料的問題）
  const filteredActivitiesByStatus = useMemo(() => 
    activities.filter(a => activeCourseIds.has(a.firestoreCourseId)),
    [activities, activeCourseIds]
  );

  // If in check-in mode, show check-in view
  if (firestoreCourseId && activityId) {
    return <CheckInView firestoreCourseId={firestoreCourseId} activityId={activityId} />;
  }

  // Filter activities based on tab and selection
  const liveActivities = filteredActivitiesByStatus.filter(a => a.status === 'active' || a.status === 'upcoming');
  const pastActivities = filteredActivitiesByStatus.filter(a => a.status === 'past');

  const filteredPastActivities = selectedCourseForHistory === 'all'
    ? pastActivities
    : pastActivities.filter(activity => activity.firestoreCourseId === selectedCourseForHistory);

  return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-8 animate-fade-in">
      
      {/* 1. 標題與圖示 (Title with Icon) */}
      <div className="flex items-center mb-8">
        <ClockIcon className="w-8 h-8 text-indigo-600 mr-3" />
        <h2 className="text-2xl font-bold text-gray-900">線上點名</h2>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setTab('live')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              tab === 'live'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            即時活動
            {liveActivities.length > 0 && (
              <span className="ml-2 bg-red-100 text-red-600 py-0.5 px-2 rounded-full text-xs font-bold">
                {liveActivities.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab('history')}
            className={`whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              tab === 'history'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            歷史紀錄
          </button>
        </nav>
      </div>

      {/* Content Area */}
      {isLoading ? (
        <LoadingSpinner text="正在載入點名資料..." />
      ) : (
        <div className="min-h-[400px]">
          {tab === 'live' && (
            // 2. 資料分類顯示 (Grouped by Course)
            <CourseGroupedList 
              activities={liveActivities} 
              emptyText="目前沒有進行中的點名活動。" 
            />
          )}

          {tab === 'history' && (
            <div className="animate-fade-in">
              <StudentCourseSelector
                courses={enrolledCourses}
                selectedCourse={
                  selectedCourseForHistory === 'all' 
                    ? '' 
                    : enrolledCourses.find(c => c.id === selectedCourseForHistory) 
                      ? `${enrolledCourses.find(c => c.id === selectedCourseForHistory)?.name}(${enrolledCourses.find(c => c.id === selectedCourseForHistory)?.code})` 
                      : ''
                }
                onChange={(value) => {
                  const course = enrolledCourses.find(c => `${c.name}(${c.code})` === value);
                  setSelectedCourseForHistory(course ? course.id : 'all');
                }}
                label="篩選課程"
                placeholder="顯示所有課程"
              />
              {/* 2. 資料分類顯示 (Grouped by Course) */}
              <CourseGroupedList 
                activities={filteredPastActivities} 
                emptyText="查無歷史點名紀錄。" 
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}