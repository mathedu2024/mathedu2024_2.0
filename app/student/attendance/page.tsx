'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSession } from '@/utils/session';
import LoadingSpinner from '@/components/LoadingSpinner';
// import alerts from '@/utils/alerts';
import { useInterval } from '@/utils/hooks';
import Swal from 'sweetalert2'; // Import SweetAlert2
import Dropdown from '@/components/ui/Dropdown'; // Import Dropdown component

// ====================================================================
// Activity Interfaces
// ====================================================================

interface Activity {
  id: string;
  courseId: string; // Human-readable courseId
  firestoreCourseId: string; // Actual Firestore document ID
  title: string;
  courseName: string;
  startTime: string;
  endTime: string;
  status: 'upcoming' | 'active' | 'past';
  studentStatus?: string; // Add student's attendance status
}

interface ActivityDetails extends Activity {
  checkInMethod: 'numeric' | 'manual';
}


// ====================================================================
// Reusable Activity List Component
// ====================================================================

const ActivityListItem = ({ activity }: { activity: Activity }) => {
  const router = useRouter();

  const getStatusBadge = (status: Activity['status']) => {
    switch (status) {
      case 'upcoming':
        return <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-200">即將開始</span>;
      case 'active':
        return <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-green-600 bg-green-200">進行中</span>;
      case 'past':
        return <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-gray-600 bg-gray-200">已結束</span>;
    }
  };

  const getAttendanceStatusPill = (status: string | undefined) => {
    if (!status) {
      return null; // Display nothing if status is empty or undefined
    }
    switch (status) {
      case 'present':
        return <span className="px-3 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full">出席</span>;
      case 'late':
        return <span className="px-3 py-1 text-xs font-semibold text-yellow-800 bg-yellow-200 rounded-full">遲到</span>;
      case 'absent':
        return <span className="px-3 py-1 text-xs font-semibold text-red-800 bg-red-200 rounded-full">曠課</span>;
      case 'leave':
        // Assuming leaveType is not directly available here, or needs to be fetched separately if desired
        return <span className="px-3 py-1 text-xs font-semibold text-purple-800 bg-purple-200 rounded-full">請假</span>;
      default:
        return null;
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg border flex items-center justify-between transition-shadow hover:shadow-md">
      <div>
        <p className="font-bold text-gray-800">{activity.title}</p>
        <p className="text-sm text-gray-600">{activity.courseName}</p>
        <p className="text-xs text-gray-500 mt-1">
          {new Date(activity.startTime).toLocaleString('zh-TW')} - {new Date(activity.endTime).toLocaleString('zh-TW')}
        </p>
      </div>
      <div className="flex items-center space-x-4">
        {activity.status === 'past' ? getAttendanceStatusPill(activity.studentStatus) : getStatusBadge(activity.status)}
        {activity.status === 'active' && (
          <button
            onClick={() => router.push(`/student/attendance?courseId=${activity.firestoreCourseId}&activity=${activity.id}`)}
            className="bg-green-500 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-600 transition-colors"
          >
            前往簽到
          </button>
        )}
      </div>
    </div>
  );
};

const ActivitiesList = ({ activities, emptyText }: { activities: Activity[], emptyText: string }) => {
  if (activities.length === 0) {
    return <p className="text-center text-gray-500 py-8">{emptyText}</p>;
  }

  return (
    <div className="space-y-4">
      {activities.map(activity => {
        return <ActivityListItem key={activity.id} activity={activity} />
      })}
    </div>
  );
};


// ====================================================================
// Check-in View Component
// ====================================================================

function CheckInView({ firestoreCourseId, activityId }: { firestoreCourseId: string, activityId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const _urlCheckInCode = searchParams.get('checkInCode');
  const [activity, setActivity] = useState<ActivityDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkInCode, setCheckInCode] = useState(''); // For numeric input
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCheckedIn, _setHasCheckedIn] = useState(false); // New state to track successful check-in
  const [finalStatus, _setFinalStatus] = useState<string | null>(null); // New state to store final status

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
      Swal.fire({
        icon: 'error',
        title: '錯誤',
        text: '無法驗證您的身份，請重新登入。',
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const codeToSubmit = checkInCode;

      if (!codeToSubmit) {
        Swal.fire({
          icon: 'error',
          title: '錯誤',
          text: '簽到碼遺失。',
        });
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
          checkInCode: codeToSubmit,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '簽到失敗。');
      }

      const statusText = data.status === 'present' ? '出席' : '遲到'; // Changed '準時' to '出席'
      Swal.fire({
        icon: 'success',
        title: '簽到成功！',
        text: `狀態：${statusText}`,
      }).then(() => {
        router.push('/student/attendance'); // Redirect to main attendance page
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
  if (error) return <p className="text-center text-red-500 font-semibold">{error}</p>;
  if (!activity) return <p className="text-center text-gray-600">找不到點名活動。</p>;

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6 w-full max-w-md mx-auto">
      <h3 className="text-xl font-bold text-gray-900 mb-2">{activity.title}</h3>
      <p className="text-sm text-gray-500 mb-2">課程：{activity.courseName}</p>
      <p className="text-sm text-gray-500 mb-4">
        {new Date(activity.startTime).toLocaleString('zh-TW')} - {new Date(activity.endTime).toLocaleString('zh-TW')}
      </p>
      
      {hasCheckedIn ? (
        <div className="text-center py-8">
          <p className="text-green-600 text-lg font-semibold mb-2">您已成功簽到！</p>
          <p className="text-gray-700 text-md">您的狀態為：<span className="font-bold">{finalStatus}</span></p>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {activity.checkInMethod === 'numeric' && (
            <div className="mb-4">
              <label htmlFor="checkInCode" className="block text-sm font-medium text-gray-700 mb-2">六位簽到碼</label>
              <input
                id="checkInCode"
                type="text"
                value={checkInCode}
                onChange={(e) => setCheckInCode(e.target.value)}
                maxLength={6}
                className="w-full border border-gray-300 p-3 rounded-lg text-center text-2xl tracking-[.5em] font-mono"
                placeholder="123456"
                required
              />
            </div>
          )}
          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400"
          >
            {isSubmitting ? '傳送中...' : '確認簽到'}
          </button>
          <button 
            type="button"
            onClick={() => router.back()}
            className="w-full mt-3 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            返回
          </button>
        </form>
      )}
    </div>
  );
}

// ====================================================================
// Main Page Content Component with Tabs
// ====================================================================

function StudentAttendancePageContent() {
  const searchParams = useSearchParams();
  const firestoreCourseId = searchParams.get('courseId');
  const activityId = searchParams.get('activity');
  const [tab, setTab] = useState<'live' | 'history'>('live');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [enrolledCourses, setEnrolledCourses] = useState<{ id: string; name: string; code: string }[]>([]);
  const [selectedCourseForHistory, setSelectedCourseForHistory] = useState<string | 'all'>('all');

  useEffect(() => {
    const fetchEnrolledCourses = async () => {
      try {
        const response = await fetch('/api/student/courses/list');
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '無法獲取學生課程列表。');
        }
        const coursesData = await response.json();
        if (Array.isArray(coursesData)) {
          setEnrolledCourses(coursesData);
        } else {
          setEnrolledCourses([]);
        }
      } catch (err) {
        console.error('Error fetching enrolled courses:', err);
        setEnrolledCourses([]);
      }
    };
    fetchEnrolledCourses();
  }, []);

  useEffect(() => {
    const fetchData = async (showLoading = true) => {
      if (showLoading) {
        setIsLoading(true);
      }
      try {
        const activitiesResponse = await fetch('/api/attendance/student-all-activities');

        if (!activitiesResponse.ok) {
          const errorData = await activitiesResponse.json();
          console.error('API Error:', activitiesResponse.status, errorData);
          throw new Error(errorData.error || '無法獲取所有點名活動。');
        }
        const activitiesData = await activitiesResponse.json();
        if (Array.isArray(activitiesData)) {
          setActivities(activitiesData);
        } else {
          console.error('API response for activities is not an array:', activitiesData);
          setActivities([]); // Set to empty array if not an array
        }

      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: '獲取資料失敗',
          text: err instanceof Error ? err.message : '獲取資料時發生錯誤。',
        });
        setActivities([]); // Also set to empty array on error
      } finally {
        if (showLoading) {
          setIsLoading(false);
        }
      }
    };
    fetchData();
  }, []);

  const fetchActivities = useCallback(async () => {
    try {
      const activitiesResponse = await fetch('/api/attendance/student-all-activities');
      if (!activitiesResponse.ok) {
        const errorData = await activitiesResponse.json();
        console.error('API Error in interval:', activitiesResponse.status, errorData);
        return;
      }
      const activitiesData = await activitiesResponse.json();
      if (Array.isArray(activitiesData)) {
        setActivities(activitiesData);
      } else {
        console.error('API response for activities in interval is not an array:', activitiesData);
      }
    } catch (err) {
      console.error('Error fetching activities in interval:', err);
    }
  }, [setActivities]);

  useInterval(fetchActivities, 10000);

  if (firestoreCourseId && activityId) {
    return <CheckInView firestoreCourseId={firestoreCourseId} activityId={activityId} />;
  }

  const liveActivities = activities.filter(a => a.status === 'active' || a.status === 'upcoming');
  const pastActivities = activities.filter(a => a.status === 'past');

  const filteredPastActivities = selectedCourseForHistory === 'all'
    ? pastActivities
    : pastActivities.filter(activity => activity.firestoreCourseId === selectedCourseForHistory);

  return (
    <div className="max-w-6xl mx-auto w-full p-2 md:p-8 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-6">線上點名</h2>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setTab('live')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                tab === 'live'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              即時活動
            </button>
            <button
              onClick={() => setTab('history')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                tab === 'history'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              歷史紀錄
            </button>
          </nav>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner text="正在載入點名活動..." />
      ) : (
        <div>
          {tab === 'live' && 
            <ActivitiesList activities={liveActivities} emptyText="目前沒有即時的點名活動。" />
          }
          {tab === 'history' && (
            <div className="mt-4">
              <Dropdown
                value={selectedCourseForHistory}
                onChange={(value) => setSelectedCourseForHistory(value)}
                options={[{ value: 'all', label: '所有課程' }, ...enrolledCourses.map(course => ({ value: course.id, label: `${course.name}（${course.code}）` }))]}
                placeholder="所有課程"
                className="mb-4 p-2 border border-gray-300 rounded-md w-1/3 min-w-[240px]"
              />
              <ActivitiesList activities={filteredPastActivities} emptyText="沒有歷史點名紀錄。" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ====================================================================
// Main Export Component
// ====================================================================

export default function StudentAttendancePage() {
  return (
    <Suspense fallback={<LoadingSpinner text="載入頁面中..." />}>
      <StudentAttendancePageContent />
    </Suspense>
  );
}