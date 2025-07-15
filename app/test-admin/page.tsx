'use client';

import { useState } from 'react';

export default function TestAdminPage() {
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const testAdminConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/test-admin');
      const result = await response.json();
      setTestResult(result);
    } catch (error) {
      setTestResult({ error: (error as any).message });
    } finally {
      setLoading(false);
    }
  };

  const testClassDataAPI = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/courses/classdata?courseId=test-course');
      const result = await response.json();
      setTestResult({ classData: result });
    } catch (error) {
      setTestResult({ error: (error as any).message });
    } finally {
      setLoading(false);
    }
  };

  const testStudentListAPI = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/course-student-list/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseName: 'Test Course', courseCode: 'TEST001' })
      });
      const result = await response.json();
      setTestResult({ studentList: result });
    } catch (error) {
      setTestResult({ error: (error as any).message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Firebase Admin 測試頁面</h1>
      
      <div className="space-y-4 mb-8">
        <button
          onClick={testAdminConnection}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? '測試中...' : '測試 Firebase Admin 連接'}
        </button>
        
        <button
          onClick={testClassDataAPI}
          disabled={loading}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50 ml-4"
        >
          {loading ? '測試中...' : '測試 ClassData API'}
        </button>
        
        <button
          onClick={testStudentListAPI}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50 ml-4"
        >
          {loading ? '測試中...' : '測試 Student List API'}
        </button>
      </div>

      {testResult && (
        <div className="bg-gray-100 p-4 rounded">
          <h3 className="font-semibold mb-2">測試結果：</h3>
          <pre className="text-sm overflow-auto">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
} 