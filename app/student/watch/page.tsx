import React, { Suspense } from 'react';
import WatchContent from './WatchContent';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function StudentWatchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <LoadingSpinner size={40} text="載入影片中..." />
        </div>
      }
    >
      <WatchContent />
    </Suspense>
  );
}
