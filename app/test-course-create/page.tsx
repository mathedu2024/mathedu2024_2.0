'use client';

import { useState } from 'react';

export default function TestCourseCreate() {
  const [result, setResult] = useState<string | number | boolean | React.ReactNode | null>(null);
  const [loading, setLoading] = useState(false);

  const testCourseCreate = async () => {
    setLoading(true);
    try {
      const testCourseData = {
        id: `test-course-${Date.now()}`,
        name: '測試課程',
        code: 'TEST001',
        teachingMethod: '實體上課',
        teachers: [],
        teacherUids: [],
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        classTimes: [],
        timeArrangementType: '依時段安排',
        status: '未開課',
        gradeTags: ['高一'],
        subjectTag: '數學',
        courseNature: '進度課程',
        showInIntroduction: false,
        archived: false,
        description: '這是一個測試課程',
        location: '測試地點',
        coverImageURL: ''
      };

      console.log('準備建立測試課程:', testCourseData);

      const response = await fetch('/api/courses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCourseData),
      });

      console.log('API 回應狀態:', response.status);
      
      const data = await response.json();
      console.log('API 回應資料:', data);
      
      setResult(JSON.stringify({
        status: response.status,
        data: data
      }));
    } catch (error) {
      console.error('測試課程建立失敗:', error);
      setResult(JSON.stringify({ 
        error: error instanceof Error ? error.message : '未知錯誤',
        status: 'error'
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">課程建立測試</h1>
      
      <button 
        onClick={testCourseCreate}
        disabled={loading}
        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-4"
      >
        {loading ? '建立中...' : '建立測試課程'}
      </button>

      {result && (
        <div className="mt-4">
          <h2 className="text-lg font-semibold mb-2">測試結果:</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {result}
          </pre>
        </div>
      )}
    </div>
  );
} 