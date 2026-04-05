'use client';

import dynamic from 'next/dynamic';
import LoadingSpinner from '@/components/LoadingSpinner';

// 優化：使用 dynamic import 進行懶加載 (Lazy Loading)
// 這能減少初始 Bundle 大小，加快頁面讀取速度
// ssr: false 適用於後台管理元件，避免伺服器端渲染負擔
const AttendanceManagementComponent = dynamic(
  () => import('@/components/AttendanceManagementComponent'),
  { 
    ssr: false,
    loading: () => (
      <div className="flex justify-center items-center py-20">
        <LoadingSpinner />
      </div>
    )
  }
);

export default function AttendancePage() {
  return <AttendanceManagementComponent />;
}