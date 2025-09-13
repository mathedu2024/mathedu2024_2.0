'use client';

import React, { useState, useEffect, useCallback } from 'react';
import MultiSelectDropdown from './MultiSelectDropdown';
import AlertDialog from './AlertDialog';
import alerts from '../utils/alerts';
import LoadingSpinner from './LoadingSpinner';

interface Student {
  id: string; // Document ID: studentId
  studentId: string;
  name: string;
  gender: 'male' | 'female';
  grade: string;
  account: string;
  email: string;
  phone: string;
  address: string;
  remarks: string;
  enrolledCourses: string[];
}

interface Course {
  id: string;
  name: string;
  code: string;
}

export default function StudentManager() {
  const [students, setStudents] = useState<Student[]>([]);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [formErrors, setFormErrors] = useState<{ studentId?: string; email?: string }>({});
  const [alert, setAlert] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  

  const grades = ['國一', '國二', '國三', '高一', '高二', '高三'];

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student/list');
      const students = await res.json();
      setStudents(students);
    } catch (error) {
      console.error("從資料庫獲取學生資料失敗:", error);
      setAlert({ open: true, message: '讀取學生資料時發生錯誤！' });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res2 = await fetch('/api/courses/list');
        const coursesRaw = await res2.json();
        // 保證 id 為「課程名稱(課程代碼)」格式
        const courses = coursesRaw.map((c: unknown) => ({
          ...c as Record<string, unknown>,
          id: `${(c as Record<string, unknown>).name}(${(c as Record<string, unknown>).code})`
        }));
        setCourses(courses);
      } catch (error) {
        console.error("從資料庫獲取課程失敗:", error);
      }
    };

    fetchCourses();
    fetchStudents();
  }, [fetchStudents]);

  // 暫停自動重新載入功能
  // useEffect(() => {
  //   // 每30秒自動重新載入學生資料，確保與課程管理的同步
  //   const interval = setInterval(() => {
  //     fetchStudents();
  //   }, 30000); // 30秒

  //   return () => clearInterval(interval);
  // }, []);

  const handleStudentIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const studentId = e.target.value;
    // 學號不可為中文或標點符號
    const invalidId = /[\u4e00-\u9fa5\u3000-\u303F\uFF00-\uFFEF\p{P}\p{S}]/u.test(studentId);
    setFormErrors(prev => ({ ...prev, studentId: invalidId ? '學號不可包含中文或標點符號' : undefined }));
    setEditingStudent(prev => prev ? { ...prev, studentId, account: studentId } : null);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    // 基本 email 格式檢查
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    setFormErrors(prev => ({ ...prev, email: email && !valid ? '電子郵件格式錯誤' : undefined }));
    setEditingStudent(prev => prev ? { ...prev, email } : null);
  };
  
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    // 檢查學號
    if (!editingStudent?.studentId || !editingStudent?.name) {
        setAlert({ open: true, message: '學號和姓名是必填欄位！' });
        return;
    }
    // 檢查學號不可為中文或標點符號
    if (/[\u4e00-\u9fa5\u3000-\u303F\uFF00-\uFFEF\p{P}\p{S}]/u.test(editingStudent.studentId)) {
      setFormErrors(prev => ({ ...prev, studentId: '學號不可包含中文或標點符號' }));
      return;
    }
    // 檢查 email 格式
    if (editingStudent.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editingStudent.email)) {
      setFormErrors(prev => ({ ...prev, email: '電子郵件格式錯誤' }));
      return;
    }
    setFormErrors({});
    setLoading(true);

    try {
      const { studentId, name } = editingStudent;
      const docId = studentId; // 只用學號作為文件名稱
      
      const studentData: Omit<Student, 'id'> & { password: string } = {
        studentId: editingStudent.studentId,
        name: editingStudent.name,
        gender: editingStudent.gender,
        grade: editingStudent.grade,
        account: editingStudent.account,
        email: editingStudent.email,
        phone: editingStudent.phone,
        address: editingStudent.address,
        remarks: editingStudent.remarks,
        enrolledCourses: editingStudent.enrolledCourses,
        password: 'abcd1234', // 預設密碼
      };

      await fetch('/api/student/save', { method: 'POST', body: JSON.stringify({ id: docId, ...studentData }) });
      
      const originalStudent = students.find(s => s.id === docId);
      const oldCourses = originalStudent ? originalStudent.enrolledCourses : [];
      const newCourses = editingStudent.enrolledCourses;
      await updateStudentCourses(docId, oldCourses, newCourses, {
        id: editingStudent.studentId,
        name: editingStudent.name,
        account: editingStudent.account,
        email: editingStudent.email,
        studentId: editingStudent.studentId,
        grade: editingStudent.grade,
      });
      
      setAlert({ open: true, message: `學生 "${name}" 的資料已成功儲存！` });
      setIsEditing(false);
      setEditingStudent(null);
      fetchStudents(); // Re-fetch students to update the list
    } catch (error) {
      console.error("儲存學生資料失敗:", error);
      setAlert({ open: true, message: '儲存學生資料時發生錯誤！' });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setEditingStudent(null);
    setIsEditing(false);
  };

  const handleDelete = async (studentToDelete: Student) => {
    if (await alerts.confirm(`確定要刪除學生 ${studentToDelete.name} 的資料嗎？`)) {
      setLoading(true);
      try {
        await fetch('/api/student/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: studentToDelete.id }),
        });
        // 從課程中移除學生
        if (studentToDelete.enrolledCourses && studentToDelete.enrolledCourses.length > 0) {
          await updateStudentCourses(studentToDelete.id, studentToDelete.enrolledCourses, []);
        }
        setAlert({ open: true, message: '學生資料已成功刪除！' });
        fetchStudents(); // Re-fetch
      } catch (error) {
        console.error("刪除學生資料失敗:", error);
        setAlert({ open: true, message: '刪除學生資料時發生錯誤！' });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResetPassword = async (id: string) => {
    const confirmReset = await alerts.confirm('確定要將密碼復原為預設密碼嗎？');
    if (!confirmReset) {
      return;
    }
    await fetch('/api/student/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    alerts.showSuccess('密碼已復原為預設值');
  };

  const filteredStudents = students.filter(student => {
    const name = student.name || '';
    const account = student.account || '';
    const matchesSearch = name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      account.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = selectedGrade === 'all' || student.grade === selectedGrade;
    return matchesSearch && matchesGrade;
  });

  const updateStudentCourses = async (studentDocId: string, oldCourses: string[], newCourses: string[], studentInfo?: Record<string, unknown>) => {
    await fetch('/api/course-student-list/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: studentDocId, oldCourses, newCourses, studentInfo }),
    });
  };

  return (
    <div className="max-w-6xl mx-auto w-full p-4 h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-6 flex-shrink-0">學生資料管理</h2>

      {isEditing && editingStudent && (
        <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm mb-6">
          <h3 className="text-lg font-semibold mb-4 text-gray-900">
            {editingStudent.id ? '編輯學生資料' : '新增學生資料'}
          </h3>
          <form onSubmit={handleAddStudent} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">學號 *</label>
                <input
                  type="text"
                  value={editingStudent.studentId}
                  onChange={handleStudentIdChange}
                  className="w-full border border-gray-300 p-3 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  readOnly={!!editingStudent.id}
                />
                {formErrors.studentId && <div className="text-red-500 text-sm mt-1">{formErrors.studentId}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">帳號 (自動帶入)</label>
                <input
                  type="text"
                  value={editingStudent.account}
                  readOnly
                  className="w-full border border-gray-300 p-3 rounded-lg bg-gray-100 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">姓名 *</label>
                <input
                  type="text"
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full border border-gray-300 p-3 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  readOnly={!!editingStudent.id}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">性別 *</label>
                <select
                  value={editingStudent.gender}
                  onChange={(e) => setEditingStudent(prev => prev ? { ...prev, gender: e.target.value as 'male' | 'female' } : null)}
                  className="select-unified"
                  required
                >
                  <option value="male">男</option>
                  <option value="female">女</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">年級 *</label>
                <select
                  value={editingStudent.grade}
                  onChange={(e) => setEditingStudent(prev => prev ? { ...prev, grade: e.target.value } : null)}
                  className="select-unified"
                  required
                >
                  {grades.map(grade => (
                    <option key={grade} value={grade}>{grade}</option>
                  ))}
                </select>
              </div>
               <div className="md:col-span-2">
                 <label className="block text-sm font-medium text-gray-700 mb-2">選修課程</label>
                 <MultiSelectDropdown
                   options={courses}
                   selectedOptions={editingStudent.enrolledCourses}
                   onChange={(selected) => setEditingStudent(prev => prev ? { ...prev, enrolledCourses: selected } : null)}
                   placeholder="選擇學生選修的課程..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">電子郵件</label>
                <input
                  type="email"
                  value={editingStudent.email}
                  onChange={handleEmailChange}
                  className="w-full border border-gray-300 p-3 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formErrors.email && <div className="text-red-500 text-sm mt-1">{formErrors.email}</div>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">電話</label>
                <input
                  type="tel"
                  value={editingStudent.phone}
                  onChange={(e) => setEditingStudent(prev => prev ? { ...prev, phone: e.target.value } : null)}
                  className="w-full border border-gray-300 p-3 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">地址</label>
                <input
                  type="text"
                  value={editingStudent.address}
                  onChange={(e) => setEditingStudent(prev => prev ? { ...prev, address: e.target.value } : null)}
                  className="w-full border border-gray-300 p-3 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
               <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">備註</label>
                <textarea
                  value={editingStudent.remarks}
                  onChange={(e) => setEditingStudent(prev => prev ? { ...prev, remarks: e.target.value } : null)}
                  className="input-unified"
                  rows={3}
                ></textarea>
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="btn-secondary px-6 py-2"
              >
                取消
              </button>
              <button
                type="submit"
                className="btn-primary px-6 py-2"
                disabled={loading}
              >
                {loading ? '儲存中...' : (editingStudent.id ? '更新資料' : '新增學生')}
              </button>
            </div>
          </form>
        </div>
      )}

      {!isEditing && (
        <div className="flex-1 min-h-0 flex flex-col">
          <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm mb-6 flex-shrink-0">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <input
                type="text"
                placeholder="搜尋學生姓名或帳號"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 w-full border border-gray-300 p-3 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="select-unified w-full md:w-48"
              >
                <option value="all">全部年級</option>
                {grades.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>

              <button
                onClick={() => {
                  setEditingStudent({
                    id: '',
                    studentId: '',
                    name: '',
                    gender: 'male',
                    grade: '高一',
                    account: '',
                    email: '',
                    phone: '',
                    address: '',
                    remarks: '',
                    enrolledCourses: []
                  });
                  setIsEditing(true);
                }}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 w-full md:w-auto"
              >
                新增學生
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3">姓名</th>
                  <th scope="col" className="px-6 py-3">學號</th>
                  <th scope="col" className="px-6 py-3">帳號</th>
                  <th scope="col" className="px-6 py-3">年級</th>
                  <th scope="col" className="px-6 py-3">性別</th>
                  <th scope="col" className="px-6 py-3">課程數</th>
                  <th scope="col" className="px-6 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-10">
                      <div className="flex flex-col items-center gap-2">
                        <LoadingSpinner size={8} />
                        <span className="mt-2 text-gray-500">讀取中...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredStudents.length > 0 ? filteredStudents.map(student => (
                  <tr key={student.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{student.name}</td>
                    <td className="px-6 py-4">{student.studentId}</td>
                    <td className="px-6 py-4">{student.account}</td>
                    <td className="px-6 py-4">{student.grade}</td>
                    <td className="px-6 py-4">{student.gender === 'male' ? '男' : '女'}</td>
                    <td className="px-6 py-4">
                      {student.enrolledCourses ? student.enrolledCourses.length : 0}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3 w-full min-w-[180px]">
                        <button 
                          onClick={() => handleEdit(student)} 
                          className="text-blue-600 hover:text-blue-800 font-medium transition-colors"
                        >
                          編輯
                        </button>
                        <button 
                          onClick={() => handleDelete(student)} 
                          className="text-red-600 hover:text-red-800 font-medium transition-colors"
                        >
                          刪除
                        </button>
                        <button 
                          onClick={() => handleResetPassword(student.id)} 
                          className="text-yellow-600 hover:text-yellow-800 font-medium transition-colors"
                        >
                          復原密碼
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-500">
                      沒有找到符合條件的學生資料
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AlertDialog open={alert.open} message={alert.message} onClose={() => setAlert({ open: false, message: '' })} />

      
    </div>
  );
} 