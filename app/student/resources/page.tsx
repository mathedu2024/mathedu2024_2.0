import React, { Suspense } from 'react';
import ResourcesContent from './ResourcesContent';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function StudentResourcesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50"><LoadingSpinner size={40} text="載入線上資源中..." /></div>
      }
    >
      <ResourcesContent />
    </Suspense>
  );
}