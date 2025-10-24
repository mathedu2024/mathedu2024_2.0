'use client';

import React, { useState } from 'react';
import { useStudentInfo } from '../StudentInfoContext';
import TutoringRequest from '../../components/TutoringRequest';
import StudentTutoringHistory from '../../components/StudentTutoringHistory';
import LoadingSpinner from '../../components/LoadingSpinner';

export default function CounselingPage() {
  const { studentInfo, loading } = useStudentInfo();
  const [counselingSubTab, setCounselingSubTab] = useState<'request' | 'history'>('request');

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="max-w-6xl mx-auto w-full p-2 md:p-8">
      <div className="mb-6">
      <h2 className="text-2xl font-bold mb-6">輔導預約</h2>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setCounselingSubTab('request')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                counselingSubTab === 'request'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              申請預約
            </button>
            <button
              onClick={() => setCounselingSubTab('history')}
              className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                counselingSubTab === 'history'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              預約記錄
            </button>
          </nav>
        </div>
      </div>
      
      {counselingSubTab === 'request' && studentInfo && (
        <TutoringRequest />
      )}
      
      {counselingSubTab === 'history' && studentInfo && (
        <StudentTutoringHistory userInfo={studentInfo} />
      )}
    </div>
  );
}
