import React, { Suspense } from 'react';
import CheckInPageComponent from './CheckInPageComponent';
import LoadingSpinner from '@/components/LoadingSpinner';

export const dynamic = 'force-dynamic';

export default function StudentCheckInPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <LoadingSpinner size={40} />
        </div>
      }
    >
      <CheckInPageComponent />
    </Suspense>
  );
}