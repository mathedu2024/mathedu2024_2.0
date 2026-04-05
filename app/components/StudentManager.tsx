'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import MultiSelectDropdown from './MultiSelectDropdown';
import LoadingSpinner from './LoadingSpinner';
import Dropdown from './ui/Dropdown';
import Swal from 'sweetalert2';
import * as XLSX from 'xlsx';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  MagnifyingGlassIcon, 
  UserIcon, 
  UserGroupIcon,
  KeyIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon
} from '@heroicons/react/24/outline';

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

interface MinimalCourse {
  name: string;
  code: string;
  status?: string;
  archived?: boolean | string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const grades = ['國一', '國二', '國三', '高一', '高二', '高三', '職一', '職二', '職三', '大一', '進修'];

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student/list');
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const text = await res.text();
      const fetchedStudents = text ? JSON.parse(text) : [];
      setStudents(fetchedStudents);
    } catch (error) {
      console.error("從資料庫獲取學生資料失敗:", error);
      Swal.fire('錯誤', '讀取學生資料時發生錯誤！', 'error');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const fetchCourses = async () => {
      try {
        const res2 = await fetch('/api/courses/list', { method: 'POST' });
        if (!res2.ok) {
          console.error("從資料庫獲取課程失敗:", res2.status);
          return;
        }
        const text = await res2.text();
        const coursesRaw = text ? JSON.parse(text) : [];
        // 報名課程不顯示已封存的課程 (保留已結束課程以維護歷史選修紀錄)
        const courses = coursesRaw
          .filter((c: MinimalCourse) => c && c.status !== '已封存' && c.archived !== true && String(c.archived) !== 'true')
          .map((c: unknown) => ({
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
    if (!editingStudent) return;

    // 檢查學號
    if (!editingStudent.studentId || !editingStudent.name) {
        Swal.fire('警告', '學號和姓名是必填欄位！', 'warning');
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
      
      const studentData: Omit<Student, 'id'> & { password?: string } = {
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
      };

      if (!editingStudent.id) { // Only set password for new students
        studentData.password = 'abcd1234';
      }

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
      
      Swal.fire({
        icon: 'success',
        title: '成功',
        text: `學生 "${name}" 的資料已成功儲存！`,
        confirmButtonColor: '#4f46e5'
      });
      setIsEditing(false);
      setEditingStudent(null);
      fetchStudents(); // Re-fetch students to update the list
    } catch (error) {
      console.error("儲存學生資料失敗:", error);
      Swal.fire({
        icon: 'error',
        title: '錯誤',
        text: '儲存學生資料時發生錯誤！',
        confirmButtonColor: '#ef4444'
      });
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
    const result = await Swal.fire({
      title: '請確認',
      text: `確定要刪除學生 ${studentToDelete.name} 的資料嗎？`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '確定刪除',
      cancelButtonText: '取消',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
    });

    if (result.isConfirmed) {
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
        Swal.fire({
            icon: 'success',
            title: '已刪除!',
            text: '學生資料已成功刪除。',
            confirmButtonColor: '#4f46e5'
        });
        fetchStudents(); // Re-fetch
      } catch (error) {
        console.error("刪除學生資料失敗:", error);
        Swal.fire({
            icon: 'error',
            title: '錯誤',
            text: '刪除學生資料時發生錯誤！',
            confirmButtonColor: '#ef4444'
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const handleResetPassword = async (id: string) => {
    const result = await Swal.fire({
      title: '請確認',
      text: '確定要將密碼復原為預設密碼嗎？',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '確定',
      cancelButtonText: '取消',
      confirmButtonColor: '#4f46e5',
    });

    if (!result.isConfirmed) {
      return;
    }
    await fetch('/api/student/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    Swal.fire({
        icon: 'success',
        title: '成功',
        text: '密碼已復原為預設值',
        confirmButtonColor: '#4f46e5'
    });
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

  // --- Excel 模板下載功能 ---
  const _handleDownloadTemplate = () => {
    const templateData = [
      {
        '學號': 'S112001',
        '姓名': '王小明',
        '性別': '男',
        '年級': '高一',
        '電子郵件': 'example@mail.com',
        '電話': '0912345678',
        '地址': '台北市... (選填)',
        '備註': '範例資料 (請刪除此列)'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '學生匯入模板');
    XLSX.writeFile(wb, '學生資料匯入模板.xlsx');
  };

  // --- Excel 檔案讀取與大量上傳功能 ---
  const _handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        setLoading(true);
        const arrayBuffer = evt.target?.result;
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws) as Record<string, string | number>[];

        if (data.length === 0) {
          Swal.fire('提示', 'Excel 檔案中沒有資料', 'info');
          return;
        }

        let successCount = 0;
        let errorCount = 0;

        for (const row of data) {
          const studentId = String(row['學號'] || '').trim();
          const name = String(row['姓名'] || '').trim();
          
          if (!studentId || !name) {
            errorCount++;
            continue;
          }

          // 性別轉換
          const genderMap: { [key: string]: 'male' | 'female' } = { '男': 'male', '女': 'female' };
          const gender = genderMap[row['性別']] || 'male';

          // 組合存檔資料
          const studentData = {
            id: studentId,
            studentId: studentId,
            name: name,
            gender: gender,
            grade: row['年級'] || '高一',
            account: studentId,
            email: row['電子郵件'] || '',
            phone: String(row['電話'] || ''),
            address: row['地址'] || '',
            remarks: row['備註'] || '',
            enrolledCourses: [],
            password: 'abcd1234' // 預設密碼
          };

          try {
            // 呼叫 API 儲存單筆資料
            const res = await fetch('/api/student/save', {
              method: 'POST',
              body: JSON.stringify(studentData)
            });
            
            if (res.ok) {
              // 同步更新課程關聯（雖然新匯入預設無課程，但為求邏輯一致呼叫一次）
              await updateStudentCourses(studentId, [], [], {
                id: studentId,
                name: name,
                account: studentId,
                studentId: studentId,
                grade: studentData.grade,
              });
              successCount++;
            } else {
              errorCount++;
            }
          } catch (err) {
            console.error(`匯入學生 ${name} 失敗:`, err);
            errorCount++;
          }
        }

        Swal.fire({
          icon: errorCount > 0 ? 'warning' : 'success',
          title: '匯入完成',
          text: `成功匯入 ${successCount} 筆，失敗 ${errorCount} 筆。`,
          confirmButtonColor: '#4f46e5'
        });

        fetchStudents();
      } catch (error) {
        console.error("讀取 Excel 失敗:", error);
        Swal.fire('錯誤', '解析檔案時發生錯誤，請確認檔案格式是否正確。', 'error');
      } finally {
        setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = ''; // 清除 input
      }
    };
    
    reader.onerror = () => {
      Swal.fire('錯誤', '檔案讀取失敗', 'error');
      setLoading(false);
    };

    reader.readAsBinaryString(file);
  };

  return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col h-full">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
        <UserGroupIcon className="w-8 h-8 mr-3 text-indigo-600" />
        學生資料管理
      </h2>

      {!isEditing && (
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm mb-6 flex-shrink-0">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="搜尋學生姓名或帳號..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
            </div>
            
            <div className="w-full md:w-48">
              <Dropdown
                  value={selectedGrade}
                  onChange={setSelectedGrade}
                  options={[{ value: 'all', label: '全部年級' }, ...grades.map(g => ({ value: g, label: g }))]}
                  placeholder="全部年級"
                  className="w-full"
                />
            </div>

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
              className="w-full md:w-auto inline-flex items-center justify-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm font-medium flex-shrink-0"
            >
              <PlusIcon className="w-5 h-5 mr-2" /> 新增學生
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0">
        {isEditing && editingStudent && (
          <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm mb-6 animate-fade-in">
            <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
                <h3 className="text-xl font-bold text-gray-800">
                    {editingStudent.id ? '編輯學生資料' : '新增學生資料'}
                </h3>
                <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
                    <span className="sr-only">關閉</span>
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <form onSubmit={handleAddStudent} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">學號 <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={editingStudent.studentId}
                    onChange={handleStudentIdChange}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
                    required
                    readOnly={!!editingStudent.id}
                    placeholder="請輸入學號"
                  />
                  {formErrors.studentId && <div className="text-red-500 text-xs mt-1">{formErrors.studentId}</div>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">帳號 (自動帶入)</label>
                  <input
                    type="text"
                    value={editingStudent.account}
                    readOnly
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed font-mono"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">姓名 <span className="text-red-500">*</span></label>
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <UserIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={editingStudent.name}
                        onChange={(e) => setEditingStudent(prev => prev ? { ...prev, name: e.target.value } : null)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        required
                        placeholder="請輸入姓名"
                      />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">性別 <span className="text-red-500">*</span></label>
                  <Dropdown
                    value={editingStudent.gender}
                    onChange={(value) => setEditingStudent(prev => prev ? { ...prev, gender: value as 'male' | 'female' } : null)}
                    options={[{ value: 'male', label: '男' }, { value: 'female', label: '女' }]}
                    placeholder="選擇性別"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">年級 <span className="text-red-500">*</span></label>
                  <Dropdown
                    value={editingStudent.grade}
                    onChange={(value) => setEditingStudent(prev => prev ? { ...prev, grade: value } : null)}
                    options={grades.map(g => ({ value: g, label: g }))}
                    placeholder="選擇年級"
                    className="w-full"
                  />
                </div>
                 <div className="md:col-span-2">
                   <label className="block text-sm font-bold text-gray-700 mb-2">選修課程</label>
                   <MultiSelectDropdown
                     options={courses.map(course => ({ label: `${course.name} (${course.code})`, value: course.id }))}
                     selectedOptions={editingStudent.enrolledCourses ? editingStudent.enrolledCourses.filter(cId => courses.some(c => c.id === cId)) : []}
                     onChange={(selected) => setEditingStudent(prev => prev ? { ...prev, enrolledCourses: selected } : null)}
                     placeholder="選擇學生選修的課程..."
                   />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">電子郵件</label>
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <EnvelopeIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        value={editingStudent.email}
                        onChange={handleEmailChange}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="student@example.com"
                      />
                  </div>
                  {formErrors.email && <div className="text-red-500 text-xs mt-1">{formErrors.email}</div>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">電話</label>
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <PhoneIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        value={editingStudent.phone}
                        onChange={(e) => setEditingStudent(prev => prev ? { ...prev, phone: e.target.value } : null)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="0912-345-678"
                      />
                  </div>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">地址</label>
                  <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <MapPinIcon className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        value={editingStudent.address}
                        onChange={(e) => setEditingStudent(prev => prev ? { ...prev, address: e.target.value } : null)}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="請輸入通訊地址"
                      />
                  </div>
                </div>
                 <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">備註</label>
                  <textarea
                    value={editingStudent.remarks}
                    onChange={(e) => setEditingStudent(prev => prev ? { ...prev, remarks: e.target.value } : null)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                    rows={3}
                    placeholder="可選填相關備註..."
                  ></textarea>
                </div>
              </div>
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-sm font-medium transition-colors disabled:opacity-70 flex items-center"
                  disabled={loading}
                >
                  {loading ? <LoadingSpinner size={16} color="white" className="mr-2" /> : null}
                  {loading ? '儲存中...' : (editingStudent.id ? '更新資料' : '新增學生')}
                </button>
              </div>
            </form>
          </div>
        )}

        {!isEditing && (
          <div className="flex-1 overflow-hidden">
            {loading ? (
              <div className="flex justify-center items-center py-20">
                <LoadingSpinner size={40} />
                <p className="text-gray-500 ml-4 font-medium">資料讀取中...</p>
              </div>
            ) : (
              <>
                {/* Mobile View: Modular Cards */}
                <div className="block md:hidden space-y-4 pb-20">
                  {filteredStudents.length > 0 ? (
                    filteredStudents.map(student => (
                      <div key={student.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 relative overflow-hidden">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                              <h3 className="font-bold text-lg text-gray-900">{student.name}</h3>
                              <p className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">{student.studentId}</p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                              student.gender === 'male' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                          }`}>
                              {student.gender === 'male' ? '男' : '女'}
                          </span>
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                            <div className="flex justify-between">
                                <span className="text-gray-500">年級:</span>
                                <span className="font-medium text-gray-800">{student.grade}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">課程數:</span>
                                <span className="font-medium text-gray-800">{student.enrolledCourses ? student.enrolledCourses.filter(cId => courses.some(c => c.id === cId)).length : 0} 堂</span>
                            </div>
                        </div>
                        
                        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                          <button 
                            onClick={() => handleResetPassword(student.id)} 
                            className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                            title="重設密碼"
                          >
                            <KeyIcon className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleEdit(student)} 
                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="編輯"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => handleDelete(student)} 
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="刪除"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                        <p className="text-gray-500">沒有找到符合條件的學生資料</p>
                    </div>
                  )}
                </div>

                {/* Desktop View: Table */}
                <div className="hidden md:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
                  <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th scope="col" className="px-6 py-4 font-bold">姓名</th>
                        <th scope="col" className="px-6 py-4 font-bold">學號</th>
                        <th scope="col" className="px-6 py-4 font-bold">帳號</th>
                        <th scope="col" className="px-6 py-4 font-bold">年級</th>
                        <th scope="col" className="px-6 py-4 font-bold">性別</th>
                        <th scope="col" className="px-6 py-4 font-bold">課程數</th>
                        <th scope="col" className="px-6 py-4 font-bold text-right w-48">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filteredStudents.length > 0 ? filteredStudents.map(student => (
                        <tr key={student.id} className="bg-white hover:bg-gray-50 transition-colors group">
                          <td className="px-6 py-4 font-bold text-gray-900">{student.name}</td>
                          <td className="px-6 py-4 font-mono text-gray-600">{student.studentId}</td>
                          <td className="px-6 py-4 font-mono text-gray-600">{student.account}</td>
                          <td className="px-6 py-4">
                              <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-medium">
                                  {student.grade}
                              </span>
                          </td>
                          <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  student.gender === 'male' ? 'bg-blue-50 text-blue-700' : 'bg-pink-50 text-pink-700'
                              }`}>
                                  {student.gender === 'male' ? '男' : '女'}
                              </span>
                          </td>
                          <td className="px-6 py-4">
                            {student.enrolledCourses ? student.enrolledCourses.filter(cId => courses.some(c => c.id === cId)).length : 0}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleResetPassword(student.id)} 
                                className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors border border-transparent hover:border-yellow-200"
                                title="重設密碼"
                              >
                                <KeyIcon className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleEdit(student)} 
                                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-200"
                                title="編輯"
                              >
                                <PencilIcon className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(student)} 
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                                title="刪除"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                            沒有找到符合條件的學生資料
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}