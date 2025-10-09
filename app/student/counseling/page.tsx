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
    return <div className="flex h-screen items-center justify-center"><LoadingSpinner /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto w-full p-2 md:p-8">
      <div className="mb-6">
      <h2 className="text-2xl font-bold mb-6">輔導預約</h2>
        <div className="flex space-x-4">
          <button
            onClick={() => setCounselingSubTab('request')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              counselingSubTab === 'request' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            申請預約
          </button>
          <button
            onClick={() => setCounselingSubTab('history')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              counselingSubTab === 'history' 
                ? 'bg-blue-600 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            預約記錄
          </button>
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
