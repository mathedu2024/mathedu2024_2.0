'use client';

import StudentGradeViewer from '../components/StudentGradeViewer';

export default function TestGradesPage() {
  // 模擬學生資訊
  const mockStudentInfo = {
    id: 'student1',
    name: '張小明',
    studentId: 'student1'
  };

  return (
    <div className="h-full bg-gray-50">
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold text-center mb-8">成績查詢測試頁面</h1>
        <StudentGradeViewer studentInfo={mockStudentInfo} />
      </div>
    </div>
  );
}
