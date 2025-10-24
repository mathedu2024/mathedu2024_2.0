'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSession } from '@/utils/session';
import LoadingSpinner from '@/components/LoadingSpinner';
import alerts from '@/utils/alerts';

interface ActiveActivity {
  id: string;
  title: string;
  checkInMethod: 'numeric' | 'manual';
}

function CheckInPageComponent() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get('courseId');
  
  const [activity, setActivity] = useState<ActiveActivity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkInCode, setCheckInCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!courseId) {
      setError('未提供課程 ID');
      setIsLoading(false);
      return;
    }

    const fetchActiveActivity = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/student/attendance/active?courseId=${courseId}`);
        if (res.status === 404) {
          setActivity(null);
        } else if (res.ok) {
          const data = await res.json();
          setActivity(data);
        } else {
          const errorData = await res.json();
          throw new Error(errorData.error || '無法獲取點名活動');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '發生未知錯誤');
      } finally {
        setIsLoading(false);
      }
    };

    fetchActiveActivity();
  }, [courseId]);

  const handleCheckInSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activity || !checkInCode) return;

    const session = getSession();
    if (!session) {
      alerts.showError('請先登入');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          studentId: session.id,
          checkInCode,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '簽到失敗');
      }

      alerts.showSuccess(`簽到成功！狀態：${data.status === 'present' ? '準時' : '遲到'}`);
      // Optionally, redirect or update UI
    } catch (err) {
      alerts.showError(err instanceof Error ? err.message : '簽到時發生錯誤');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderCheckInMethod = () => {
    if (!activity) return null;

    switch (activity.checkInMethod) {
      case 'numeric':
        return (
          <form onSubmit={handleCheckInSubmit} className="space-y-4">
            <div>
              <label htmlFor="checkInCode" className="block text-sm font-medium text-gray-700">簽到碼</label>
              <input
                type="text"
                id="checkInCode"
                value={checkInCode}
                onChange={(e) => setCheckInCode(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="請輸入6位數字簽到碼"
                maxLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? '傳送中...' : '確認簽到'}
            </button>
          </form>
        );
      
      case 'manual':
        return <p className="text-center text-gray-600">請等待老師為您手動簽到。</p>;
      default:
        return <p className="text-center text-red-500">不支援的簽到方式。</p>;
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen text="正在尋找點名活動..." />;
  }

  if (error) {
    return <div className="text-center text-red-500 font-semibold">{error}</div>;
  }

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="bg-white shadow-lg rounded-lg p-8">
        {activity ? (
          <div>
            <h2 className="text-2xl font-bold text-center mb-2">{activity.title}</h2>
            <p className="text-center text-gray-500 mb-6">此點名活動進行中</p>
            {renderCheckInMethod()}
          </div>
        ) : (
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">目前沒有進行中的點名活動</h2>
            <p className="text-gray-500">請稍後再試，或聯繫您的老師。</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentCheckInPage() {
    return (
        <Suspense fallback={<LoadingSpinner fullScreen text="載入中..."/>}>
            <CheckInPageComponent />
        </Suspense>
    )
}