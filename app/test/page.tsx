'use client';

import { useState, useEffect } from 'react';

export default function TestPage() {
  // 明確型別
  const [courses, setCourses] = useState<Record<string, unknown>[]>([]);
  const [teachers, setTeachers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      // 獲取所有課程
      const coursesRes = await fetch('/api/courses/list');
      if (coursesRes.ok) {
        const coursesData = await coursesRes.json();
        setCourses(coursesData);
        console.log('All courses:', coursesData);
      }

      // 獲取所有老師
      const teachersRes = await fetch('/api/admin/list');
      if (teachersRes.ok) {
        const teachersData = await teachersRes.json();
        const teacherUsers = teachersData.filter((user: Record<string, unknown>) => 
          user.role === '老師' || user.role === 'teacher' || 
          (Array.isArray(user.role) && (user.role.includes('老師') || user.role.includes('teacher')))
        );
        setTeachers(teacherUsers);
        console.log('All teachers:', teacherUsers);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // 其餘 hooks 依賴與型別皆正確
  useEffect(() => {
    fetchAllData();
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">資料庫調試頁面</h1>
      
      <button 
        onClick={fetchAllData}
        disabled={loading}
        className="mb-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? '載入中...' : '重新載入資料'}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 課程資料 */}
        <div>
          <h2 className="text-xl font-bold mb-4">課程資料 ({courses.length})</h2>
          <div className="bg-gray-100 p-4 rounded max-h-96 overflow-y-auto">
            {courses.map((course: Record<string, unknown>, index) => (
              <div key={index} className="mb-4 p-3 bg-white rounded border">
                <div><strong>課程名稱:</strong> {String(course.name ?? '')}</div>
                <div><strong>課程代碼:</strong> {String(course.code ?? '')}</div>
                <div><strong>課程ID:</strong> {String(course.id ?? '')}</div>
                <div><strong>老師IDs (teachers):</strong> {Array.isArray(course.teachers) ? course.teachers.join(', ') : String(course.teachers ?? '')}</div>
                <div><strong>老師IDs (teacherUids):</strong> {Array.isArray(course.teacherUids) ? course.teacherUids.join(', ') : String(course.teacherUids ?? '')}</div>
                <div><strong>狀態:</strong> {String(course.status ?? '')}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 老師資料 */}
        <div>
          <h2 className="text-xl font-bold mb-4">老師資料 ({teachers.length})</h2>
          <div className="bg-gray-100 p-4 rounded max-h-96 overflow-y-auto">
            {teachers.map((teacher: Record<string, unknown>, index) => (
              <div key={index} className="mb-4 p-3 bg-white rounded border">
                <div><strong>姓名:</strong> {String(teacher.name ?? '')}</div>
                <div><strong>帳號:</strong> {String(teacher.account ?? '')}</div>
                <div><strong>用戶ID:</strong> {String(teacher.id ?? '')}</div>
                <div><strong>角色:</strong> {Array.isArray(teacher.roles) ? teacher.roles.join(', ') : String(teacher.roles ?? '')}</div>
                <div><strong>UID:</strong> {String(teacher.uid ?? 'N/A')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
} 