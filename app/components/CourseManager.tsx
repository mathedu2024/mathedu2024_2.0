'use client';

import React, { useState, useEffect } from 'react';
import MultiSelectDropdown from './MultiSelectDropdown';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import LoadingSpinner from './LoadingSpinner';
import AlertDialog from './AlertDialog';
import DetailModal from './DetailModal';
import Image from 'next/image';

interface CourseManagerProps {
  onProcessingStateChange: (isProcessing: boolean) => void;
  userInfo?: { id: string; name: string; account: string; role: string | string[]; currentRole?: string };
}

interface Course {
  id: string;
  name: string;
  code: string;
  teachingMethod: '實體上課' | '線上上課' | '非同步線上上課' | '實體與線上同步上課';
  teachers: string[];
  teacherUids?: string[];
  startDate: string;
  endDate: string;
  classTimes: ClassTime[];
  timeArrangementType: '依時段安排' | '依學年課程彈性安排' | '課程時間由學生自主安排';
  status: '未開課' | '報名中' | '開課中' | '已額滿' | '已結束' | '已封存' | '資料建置中...';
  gradeTags: string[];
  subjectTag: string;
  courseNature: string;
  showInIntroduction: boolean;
  archived: boolean;
  description?: string;
  coverImageURL?: string;
  location?: string;
  liveStreamURL?: string;
  createdAt?: string;
  updatedAt?: string;
  students?: string[];
}

interface ClassTime {
  day: string;
  startTime: string;
  endTime: string;
}

interface Teacher {
  id: string;
  name: string;
}

// 新增：取得 public/課程介紹圖片 目錄下所有圖片
function useCourseImages() {
  const [images, setImages] = useState<string[]>([]);
  useEffect(() => {
    fetch('/api/course-images')
      .then(res => res.json())
      .then(data => setImages(data.images || []));
  }, []);
  return images;
}

export default function CourseManager({ onProcessingStateChange, userInfo }: CourseManagerProps) {
  const [searchTerm] = useState('');
  const [selectedSubject] = useState<string>('all');
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [showStudentListModal, setShowStudentListModal] = useState<Course | null>(null);
  interface Student {
    id: string;
    studentId: string;
    name: string;
    grade?: string;
  }
  const [studentList, setStudentList] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allTeachers, setAllTeachers] = useState<Teacher[]>([]);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [alert, setAlert] = useState({ open: false, message: '' });
  const [selectedGrade] = useState<string>('all');
  const [showArchived] = useState(false);
  const courseImages = useCourseImages();

  const isAdmin = userInfo && (
    Array.isArray(userInfo.role) 
      ? userInfo.role.includes('admin') || userInfo.role.includes('管理員')
      : userInfo.role === 'admin' || userInfo.role === '管理員'
  );
  const isTeacher = userInfo && (
    Array.isArray(userInfo.role) 
      ? userInfo.role.includes('teacher') || userInfo.role.includes('老師')
      : userInfo.role === 'teacher' || userInfo.role === '老師'
  );
  const teacherId = userInfo?.id || userInfo?.account;

  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/courses/list');
      if (res.ok) {
        const courses = await res.json();
        setCourses(courses);
      } else {
        setCourses([]);
      }
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get UIDs for teacher emails
  const getTeacherUids = async (teacherEmails: string[]): Promise<string[]> => {
    if (!teacherEmails || teacherEmails.length === 0) return [];
    try {
      const res = await fetch('/api/teacher-uids', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherEmails })
      });
      const data = await res.json();
      return data.uids || [];
    } catch {
      return [];
    }
  };

  useEffect(() => {
    const fetchTeachers = async () => {
      try {
        // 只抓 users 集合中有老師資格的帳號
        const res1 = await fetch('/api/teacher/list');
        let usersTeachers = await res1.json();
        // 過濾掉沒有 name 欄位的
        usersTeachers = usersTeachers.filter((t: { role?: string[] | string; roles?: string[] | string; name?: string }) => (
          ((Array.isArray(t.role) && t.role.includes('teacher')) || t.role === 'teacher' || (Array.isArray(t.roles) && t.roles.includes('teacher')) || t.roles === 'teacher') &&
          t.name && t.name.trim() !== ''
        ));
        setAllTeachers(usersTeachers);
      } catch {
      }
    };
    fetchTeachers();
    fetchCourses();
  }, []);

  const teachingMethods = ['實體上課', '線上上課', '非同步線上上課', '實體與線上同步上課'];
  const courseStatuses = ['未開課', '報名中', '開課中', '已額滿', '已結束', '已封存'];
  const grades = ['國一', '國二', '國三', '高一', '高二', '高三'];
  const subjects = ['數學', '理化', '物理', '化學', '生物'];
  const courseNatures = ['進度課程', '升學考試複習', '檢定/考試訓練班'];
  const weekdays = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;

    // 暫時移除所有必填欄位驗證，讓按鈕永遠可按
    // if (
    //   !editingCourse.name?.trim() ||
    //   !editingCourse.code?.trim() ||
    //   !editingCourse.startDate?.trim() ||
    //   !editingCourse.endDate?.trim() ||
    //   !editingCourse.teachers?.length ||
    //   !editingCourse.courseNature?.trim() ||
    //   !editingCourse.gradeTags?.length ||
    //   !editingCourse.subjectTag?.trim() ||
    //   !editingCourse.teachingMethod?.trim() ||
    //   !selectedImage
    // ) {
    //   setAlert({ open: true, message: '請完整填寫所有必填欄位！' });
    //   return;
    // }

    onProcessingStateChange(true);
    setIsSubmitting(true);
    const docId = `${editingCourse.name}(${editingCourse.code})`;

    // Step 1: Immediately update UI with a temporary state
    const newCourseTemp = {
      ...editingCourse,
      id: editingCourse.id && editingCourse.id !== 'new' ? editingCourse.id : docId,
      status: editingCourse.id && editingCourse.id !== 'new'
        ? editingCourse.status // 編輯時保留原本狀態
        : '未開課',            // 新增時預設未開課
      coverImageURL: selectedImage,
    };

    if (editingCourse.id && editingCourse.id !== 'new') {
      setCourses(prev => prev.map(c => c.id === editingCourse.id ? newCourseTemp : c));
    } else {
      setCourses(prev => [newCourseTemp, ...prev]);
    }
    
    setEditingCourse(null);

    try {
      const coverImageURL = selectedImage || editingCourse.coverImageURL || '';

      const teacherUids = await getTeacherUids(editingCourse.teachers);

      const finalCourseData = {
        ...editingCourse,
        id: docId,
        coverImageURL,
        teacherUids,
        status: editingCourse.status === '資料建置中...' ? '未開課' : editingCourse.status, // Revert status
        updatedAt: new Date().toISOString(),
      };

      // Step 3: Update database and then UI
      if (editingCourse.id && editingCourse.id !== 'new') { // Update existing course
        const updateResponse = await fetch('/api/courses/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalCourseData),
        });
        
        if (!updateResponse.ok) {
          const errorData = await updateResponse.json();
          throw new Error(errorData.error || '課程更新失敗');
        }
        
        setAlert({ open: true, message: '課程更新成功！' });
      } else { // Add new course
        console.log('準備建立新課程，資料:', finalCourseData);
        
        const createResponse = await fetch('/api/courses/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalCourseData),
        });
        
        console.log('課程建立 API 回應狀態:', createResponse.status);
        
        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          console.error('課程建立 API 錯誤:', errorData);
          throw new Error(errorData.error || '課程建立失敗');
        }
        
        const result = await createResponse.json();
        console.log('課程建立成功，結果:', result);
        setAlert({ open: true, message: '課程建立成功！' });
      }

    } catch {
      setAlert({ open: true, message: '儲存課程時發生錯誤' });
      // Revert UI on failure
      setCourses(prev => prev.filter(c => c.id !== docId));
    } finally {
      setIsSubmitting(false);
      onProcessingStateChange(false);
      await fetchCourses();
    }
  };

  // 注意：老師課程同步現在由後端API自動處理
  // 創建、更新、刪除課程時會自動同步更新老師的授課清單

  const handleEdit = (course: Course) => {
    const courseWithDefaults = {
      ...course,
      gradeTags: course.gradeTags || [],
      classTimes: course.classTimes || [],
      teachers: course.teachers || [],
      teacherUids: course.teacherUids || [],
      description: course.description || '',
      location: course.location || '',
      liveStreamURL: course.liveStreamURL || '',
      coverImageURL: course.coverImageURL || '',
      students: course.students || [],
      subjectTag: course.subjectTag || '',
      courseNature: course.courseNature || '',
      timeArrangementType: course.timeArrangementType || '依時段安排',
      startDate: course.startDate || '',
      endDate: course.endDate || '',
      status: course.status || '未開課',
      showInIntroduction: typeof course.showInIntroduction === 'boolean' ? course.showInIntroduction : false,
      archived: typeof course.archived === 'boolean' ? course.archived : false,
    };
    console.log('editingCourse:', courseWithDefaults);
    setEditingCourse(JSON.parse(JSON.stringify(courseWithDefaults)));
    if (course.coverImageURL) {
      setSelectedImage(course.coverImageURL);
    } else {
      setSelectedImage('');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('確定要刪除此課程嗎？')) return;
    try {
      // 找到要刪除的課程
      const courseToDelete = courses.find(course => course.id === id);
      if (!courseToDelete) {
        setAlert({ open: true, message: '找不到要刪除的課程。' });
        return;
      }
      // 如果有封面圖片，嘗試從 Cloudinary 刪除
      if (courseToDelete?.coverImageURL) {
        try {
          const response = await fetch('/api/upload-image', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              public_id: extractPublicIdFromUrl(courseToDelete.coverImageURL)
            }),
          });
          if (!response.ok) {
          }
        } catch {
        }
      }
      // 呼叫 server 端 API 刪除課程（會自動同步從老師授課清單中移除）
      await fetch('/api/courses/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      setCourses(prev => prev.filter(course => course.id !== id));
      setAlert({ open: true, message: '課程刪除成功！' });
    } catch {
      setAlert({ open: true, message: '刪除課程時發生錯誤。' });
    } finally {
      await fetchCourses();
    }
  };

  const handleArchive = async (id: string) => {
    if (!window.confirm('確定要封存此課程嗎？封存後課程將不會顯示在課程列表中。')) return;
    try {
      await fetch('/api/courses/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, archived: true })
      });
      setCourses(prev => prev.map(course => course.id === id ? { ...course, archived: true, status: '已封存' } : course));
      setAlert({ open: true, message: '課程封存成功！' });
    } catch {
      setAlert({ open: true, message: '封存課程時發生錯誤。' });
    } finally {
      await fetchCourses();
    }
  };

  const handleUnarchive = async (id: string) => {
    if (!window.confirm('確定要取消封存此課程嗎？')) return;
    try {
      await fetch('/api/courses/archive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, archived: false })
      });
      setCourses(prev => prev.map(course => course.id === id ? { ...course, archived: false, status: '未開課' } : course));
      setAlert({ open: true, message: '課程取消封存成功！' });
    } catch {
      setAlert({ open: true, message: '取消封存課程時發生錯誤。' });
    } finally {
      await fetchCourses();
    }
  };

  // 從 Cloudinary URL 中提取 public_id
  const extractPublicIdFromUrl = (url: string): string | null => {
    try {
      const urlParts = url.split('/');
      const uploadIndex = urlParts.findIndex(part => part === 'upload');
      if (uploadIndex !== -1 && uploadIndex + 2 < urlParts.length) {
        const pathParts = urlParts.slice(uploadIndex + 2);
        const fullPath = pathParts.join('/');
        const extensionIndex = fullPath.lastIndexOf('.');
        return extensionIndex !== -1 ? fullPath.substring(0, extensionIndex) : fullPath;
      }
      return null;
    } catch {
      return null;
    }
  };

  const addClassTime = () => {
    if (editingCourse) {
      const newClassTime: ClassTime = {
        day: '星期一',
        startTime: '08:00',
        endTime: '09:00'
      };
      setEditingCourse(prev => prev ? {
        ...prev,
        classTimes: [...(prev.classTimes || []), newClassTime]
      } : null);
    }
  };

  const removeClassTime = (index: number) => {
    if (editingCourse) {
      setEditingCourse(prev => prev ? {
        ...prev,
        classTimes: (prev.classTimes || []).filter((_, i) => i !== index)
      } : null);
    }
  };

  const updateClassTime = (index: number, field: keyof ClassTime, value: string) => {
    if (editingCourse) {
      const currentClassTimes = editingCourse.classTimes || [];
      const updatedTimes = [...currentClassTimes];
      updatedTimes[index] = { ...updatedTimes[index], [field]: value };
      setEditingCourse(prev => prev ? {
        ...prev,
        classTimes: updatedTimes
      } : null);
    }
  };

  const filteredCourses = courses.filter(course => {
    const matchesSearch = (course.name && course.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (course.code && course.code.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesGrade = selectedGrade === 'all' || (course.gradeTags && Array.isArray(course.gradeTags) && course.gradeTags.includes(selectedGrade));
    const matchesSubject = selectedSubject === 'all' || course.subjectTag === selectedSubject;
    const matchesArchive = showArchived ? course.archived : !course.archived;
    return matchesSearch && matchesGrade && matchesSubject && matchesArchive;
  });

  const handleShowStudents = async (course: Course) => {
    console.log('showStudentListModal:', course);
    setShowStudentListModal(course);
    setStudentList([]);
    setLoadingStudents(true);
    try {
      // 直接查 course-student-list
      const res = await fetch('/api/course-student-list/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseName: course.name, courseCode: course.code })
      });
      if (res.ok) {
        const students = await res.json();
        setStudentList(students);
      } else {
        setStudentList([]);
      }
    } catch {
      setStudentList([]);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleRemoveStudentFromCourse = async (student: Student, course: Course) => {
    if (!window.confirm(`確定要將學生 ${student.name} 從課程「${course.name}」中移除嗎？`)) {
      return;
    }

    try {
      // 從 course-student-list 中移除學生
      const res = await fetch('/api/course-student-list/remove-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: course.name,
          courseCode: course.code,
          studentId: student.id
        })
      });

      if (res.ok) {
        // 更新本地學生列表
        setStudentList(prev => prev.filter(s => s.id !== student.id));
        setAlert({ open: true, message: `已將學生 ${student.name} 從課程中移除` });
      } else {
        setAlert({ open: true, message: '移除學生時發生錯誤' });
      }
    } catch {
      setAlert({ open: true, message: '移除學生時發生錯誤' });
    }
  };

  return (
    <div className="max-w-6xl mx-auto w-full p-4">
      <h2 className="text-2xl font-bold mb-6">課程管理</h2>
      {/* 篩選器區塊已移除 */}
        {/* 新增課程按鈕 */}
        {!editingCourse && (
          <div className="flex justify-end">
            <button
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 whitespace-nowrap"
              onClick={() => setEditingCourse({
                id: '',
                name: '',
                code: '',
                coverImageURL: '',
                description: '',
                teachingMethod: '實體上課',
                teachers: [],
                startDate: '',
                endDate: '',
                classTimes: [],
                status: '未開課',
                gradeTags: [],
                subjectTag: '',
                courseNature: '',
                showInIntroduction: false,
                timeArrangementType: '依時段安排',
                location: '',
                liveStreamURL: '',
                archived: false
              })}
            >
              新增課程
            </button>
          </div>
        )}
      {/* 編輯/新增表單 */}
      {editingCourse && (
        <div className="bg-white border border-gray-200 p-6 rounded-lg mb-6">
          <form onSubmit={handleSaveCourse} className="space-y-4">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold">
                {editingCourse.id && editingCourse.id !== 'new' ? '編輯課程' : '新增課程'}
              </h3>
              <button
                type="button"
                onClick={() => setEditingCourse(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Row 1: 課程名稱, 課程代碼 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">課程名稱 *</label>
                <input
                  type="text"
                  value={editingCourse.name}
                  onChange={(e) => setEditingCourse(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">課程代碼 *</label>
                <input
                  type="text"
                  value={editingCourse.code}
                  onChange={(e) => setEditingCourse(prev => prev ? { ...prev, code: e.target.value } : null)}
                  className="w-full p-2 border rounded-md"
                  required
                />
              </div>

              {/* Row 2: 開始日期, 結束日期 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">開始日期 *</label>
                <DatePicker
                  selected={editingCourse.startDate ? new Date(editingCourse.startDate) : null}
                  onChange={(date) => {
                    const newDate = date ? date.toISOString().split('T')[0] : '';
                    setEditingCourse(prev => prev ? { ...prev, startDate: newDate } : null)
                  }}
                  dateFormat="yyyy/MM/dd"
                  className="w-full"
                  placeholderText="YYYY/MM/DD"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">結束日期 *</label>
                <DatePicker
                  selected={editingCourse.endDate ? new Date(editingCourse.endDate) : null}
                  onChange={(date) => {
                    const newDate = date ? date.toISOString().split('T')[0] : '';
                    setEditingCourse(prev => prev ? { ...prev, endDate: newDate } : null)
                  }}
                  dateFormat="yyyy/MM/dd"
                  className="w-full"
                  placeholderText="YYYY/MM/DD"
                  required
                />
              </div>

              {/* Row 3: 授課老師, 課程性質 */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">授課老師 *</label>
                {editingCourse && (
                  <MultiSelectDropdown
                    options={allTeachers}
                    selectedOptions={editingCourse.teachers}
                    onChange={(selected) =>
                      setEditingCourse((prev) => (prev ? { ...prev, teachers: selected } : null))
                    }
                    placeholder="選擇授課老師"
                  />
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">課程性質 *</label>
                <div className="flex flex-wrap gap-x-6 gap-y-2 h-10 items-center">
                  {courseNatures.map(nature => (
                    <label key={nature} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="courseNature"
                        value={nature}
                        checked={editingCourse.courseNature === nature}
                        onChange={(e) => setEditingCourse(prev => prev ? { ...prev, courseNature: e.target.value } : null)}
                        className="rounded-full"
                      />
                      <span>{nature}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Row 4: 年級, 科目 */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">年級 *</label>
                <div className="flex flex-wrap gap-3">
                  {grades.map(grade => (
                    <label key={grade} className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={editingCourse.gradeTags?.includes(grade) || false}
                        onChange={(e) => {
                          const currentGrades = editingCourse.gradeTags || [];
                          const newGrades = e.target.checked
                            ? [...currentGrades, grade]
                            : currentGrades.filter(g => g !== grade);
                          setEditingCourse(prev => prev ? { ...prev, gradeTags: newGrades } : null);
                        }}
                        className="mr-2"
                      />
                      {grade}
                    </label>
                  ))}
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">科目 *</label>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {subjects.map(subject => (
                    <label key={subject} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="subjectTag"
                        value={subject}
                        checked={editingCourse.subjectTag === subject}
                        onChange={(e) => setEditingCourse(prev => prev ? { ...prev, subjectTag: e.target.value } : null)}
                        className="rounded-full"
                      />
                      <span>{subject}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Row 5: 授課方式 */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">授課方式 *</label>
                <select
                  value={editingCourse.teachingMethod}
                  onChange={(e) => setEditingCourse(prev => prev ? { ...prev, teachingMethod: e.target.value as '實體上課' | '線上上課' | '非同步線上上課' | '實體與線上同步上課' } : null)}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  {teachingMethods.map(method => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </select>
              </div>

              {/* Row 6: 上課地點 / 直播網址 */}
              {editingCourse.teachingMethod === '實體上課' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">上課地點 *</label>
                  <input
                    type="text"
                    value={editingCourse.location || ''}
                    onChange={(e) => setEditingCourse(prev => prev ? { ...prev, location: e.target.value } : null)}
                    className="w-full p-2 border rounded-md"
                    required
                  />
                </div>
              )}
              {editingCourse.teachingMethod === '線上上課' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">直播網址 *</label>
                  <input
                    type="url"
                    value={editingCourse.liveStreamURL || ''}
                    onChange={(e) => setEditingCourse(prev => prev ? { ...prev, liveStreamURL: e.target.value } : null)}
                    className="w-full p-2 border rounded-md"
                    required
                  />
                </div>
              )}
              {editingCourse.teachingMethod === '實體與線上同步上課' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">上課地點 *</label>
                    <input
                      type="text"
                      value={editingCourse.location || ''}
                      onChange={(e) => setEditingCourse(prev => prev ? { ...prev, location: e.target.value } : null)}
                      className="w-full p-2 border rounded-md"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">直播網址 *</label>
                    <input
                      type="url"
                      value={editingCourse.liveStreamURL || ''}
                      onChange={(e) => setEditingCourse(prev => prev ? { ...prev, liveStreamURL: e.target.value } : null)}
                      className="w-full p-2 border rounded-md"
                      required
                    />
                  </div>
                </>
              )}
              
              {/* Row 7: 上課時間安排 */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">上課時間安排 *</label>
                <select
                  value={editingCourse.timeArrangementType}
                  onChange={(e) => setEditingCourse(prev => prev ? { ...prev, timeArrangementType: e.target.value as '依時段安排' | '依學年課程彈性安排' | '課程時間由學生自主安排' } : null)}
                  className="w-full p-2 border rounded-md"
                >
                  <option value="依時段安排">依時段安排</option>
                  <option value="依學年課程彈性安排">依學年課程彈性安排</option>
                  <option value="課程時間由學生自主安排">課程時間由學生自主安排</option>
                </select>
                
                {editingCourse.timeArrangementType === '依時段安排' && (
                  <div className="mt-4 space-y-3">
                    <div className="text-sm font-medium text-gray-700">設定上課時段：</div>
                    {(editingCourse.classTimes || []).map((time, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 border rounded-md">
                        <select
                          value={time.day}
                          onChange={(e) => updateClassTime(index, 'day', e.target.value)}
                          className="p-2 border rounded-md"
                        >
                          {weekdays.map(day => (
                            <option key={day} value={day}>{day}</option>
                          ))}
                        </select>
                        <input
                          type="time"
                          value={time.startTime}
                          onChange={(e) => {
                            // 自動修正分鐘為5的倍數
                            const [h, mRaw] = e.target.value.split(":");
                            const m = (Math.round(parseInt(mRaw, 10) / 5) * 5).toString().padStart(2, '0');
                            updateClassTime(index, 'startTime', `${h}:${m}`);
                          }}
                          className="p-2 border rounded-md"
                          step="300"
                          lang="zh-Hant"
                        />
                        <span>至</span>
                        <input
                          type="time"
                          value={time.endTime}
                          onChange={(e) => {
                            const [h, mRaw] = e.target.value.split(":");
                            const m = (Math.round(parseInt(mRaw, 10) / 5) * 5).toString().padStart(2, '0');
                            updateClassTime(index, 'endTime', `${h}:${m}`);
                          }}
                          className="p-2 border rounded-md"
                          step="300"
                          lang="zh-Hant"
                        />
                        <button
                          type="button"
                          onClick={() => removeClassTime(index)}
                          className="text-red-500 hover:text-red-700"
                        >
                          刪除
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addClassTime}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      + 新增時段
                    </button>
                  </div>
                )}
              </div>

              {/* Row 8: 課程圖片 */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">課程圖片 *</label>
                <div className="flex flex-wrap gap-4">
                  {courseImages.map(img => (
                    <div key={img} className="relative">
                      <Image
                        src={img}
                        alt={img}
                        width={96}
                        height={96}
                        className={`w-24 h-24 object-cover rounded-lg border-2 cursor-pointer ${selectedImage === img ? 'border-blue-600' : 'border-gray-200'}`}
                        onClick={() => setSelectedImage(img)}
                      />
                      {selectedImage === img && (
                        <div className="absolute inset-0 flex items-center justify-center bg-blue-600 bg-opacity-40 rounded-lg">
                          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                {!selectedImage && <div className="text-red-500 text-sm mt-2">請選擇一張課程圖片</div>}
              </div>

              {/* Row 9: 課程描述 */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">課程描述</label>
                <textarea
                  value={editingCourse.description || ''}
                  onChange={(e) => setEditingCourse(prev => prev ? { ...prev, description: e.target.value } : null)}
                  className="w-full p-2 border rounded-md h-32"
                  placeholder="請描述課程內容、目標等..."
                />
              </div>
              
              {/* Row 10: 課程狀態 & 顯示設定 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">課程狀態 *</label>
                <select
                  value={editingCourse.status}
                  onChange={(e) => setEditingCourse(prev => prev ? { ...prev, status: e.target.value as '未開課' | '報名中' | '開課中' | '已額滿' | '已結束' | '已封存' | '資料建置中...' } : null)}
                  className="w-full p-2 border rounded-md"
                  required
                >
                  {courseStatuses.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">顯示設定</label>
                <div className="flex items-center h-10">
                  <label className="inline-flex items-center">
                    <input
                      type="checkbox"
                      checked={editingCourse.showInIntroduction}
                      onChange={(e) => setEditingCourse(prev => prev ? { ...prev, showInIntroduction: e.target.checked } : null)}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-700">將課程顯示在課程介紹中</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-6">
              <button
                type="submit"
                className="btn-primary px-4 py-2"
                disabled={false}
              >
                {isSubmitting ? <LoadingSpinner size={5} className="mr-2" /> : null}
                {editingCourse.id && editingCourse.id !== 'new' ? '更新課程' : '建立課程'}
              </button>
              <button
                type="button"
                className="btn-secondary px-4 py-2"
                onClick={() => setEditingCourse(null)}
                disabled={isSubmitting}
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}
      {/* 課程列表 - 只在非編輯狀態下顯示 */}
      {!editingCourse && (
        <>
          {/* 課程列表 */}
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size={12} />
              <p className="text-gray-600 ml-4">載入中...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 調試信息 */}
              <div className="text-sm text-gray-500 mb-4">
                載入到 {filteredCourses.length} 個課程 (總共 {courses.length} 個)
              </div>
              
              {filteredCourses.map((course) => (
                <div
                  key={course.id}
                  className={`bg-white border border-gray-200 p-6 rounded-lg flex flex-col md:flex-row md:items-center md:justify-between ${course.archived ? 'bg-gray-50 opacity-75' : ''}`}
                >
                  {/* Left Part: Name and Code */}
                  <div className="flex-1 mb-4 md:mb-0">
                    <h3 className="text-lg font-semibold">{course.name}</h3>
                    <p className="text-sm text-gray-500">{course.code}</p>
                    {course.archived && (
                      <span className="inline-block mt-1 px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded-full">
                        已封存
                      </span>
                    )}
                  </div>

                  {/* Middle Part: Teachers */}
                  <div className="flex-1 text-sm text-gray-700 mb-4 md:mb-0 md:text-center">
                    <span className="font-medium">授課老師：</span>
                    <span>{course.teachers.map(teacherId => allTeachers.find(t => t.id === teacherId)?.name).join(', ') || 'N/A'}</span>
                  </div>

                  {/* Right Part: Status and Buttons */}
                  <div className="flex-shrink-0 flex items-center gap-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                        course.status === '未開課' ? 'bg-gray-100 text-gray-800' :
                        course.status === '報名中' ? 'bg-green-100 text-green-800' :
                        course.status === '開課中' ? 'bg-blue-100 text-blue-800' :
                        course.status === '已額滿' ? 'bg-red-100 text-red-800' :
                        course.status === '已封存' ? 'bg-gray-200 text-gray-600' :
                        course.status === '資料建置中...' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                      {course.status === '資料建置中...' && (
                        <svg className="animate-spin h-3 w-3 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                      {course.status || '未開課'}
                    </span>
                    {/* 編輯按鈕 - 管理員總是可以編輯，老師只能編輯自己的課程 */}
                    {(isAdmin || (isTeacher && teacherId && course.teachers && course.teachers.includes(teacherId))) && (
                      <button
                        onClick={() => {
                          handleEdit(course);
                        }}
                        className="text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                        disabled={course.status === '資料建置中...'}
                      >
                        編輯
                      </button>
                    )}
                    <button
                      onClick={() => handleShowStudents(course)}
                      className="text-green-600 hover:text-green-800"
                    >
                      學生清單
                    </button>
                    {course.archived ? (
                      <button
                        onClick={() => handleUnarchive(course.id)}
                        className="text-green-600 hover:text-green-800"
                      >
                        取消封存
                      </button>
                    ) : (
                      <button
                        onClick={() => handleArchive(course.id)}
                        className="text-orange-600 hover:text-orange-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                        disabled={course.status === '資料建置中...'}
                      >
                        封存
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(course.id)}
                      className="text-red-600 hover:text-red-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                      disabled={course.status === '資料建置中...'}
                    >
                      刪除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {/* Course Detail Modal */}
      {showStudentListModal && (
        <DetailModal
          open={!!showStudentListModal}
          title={`「${showStudentListModal.name}」學生清單`}
          onClose={() => setShowStudentListModal(null)}
        >
          <div className="max-h-[80vh] overflow-y-auto">
            {/* 學生名單 */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2 text-center">學生名單</h4>
              {loadingStudents ? (
                <div className="flex items-center justify-center gap-2 text-gray-500 py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                  <span>正在載入學生名單...</span>
                </div>
              ) : studentList.length > 0 ? (
                <div className="max-w-md mx-auto w-full p-2" style={{ maxHeight: 300 }}>
                  <div className="overflow-x-auto" style={{ maxHeight: 220 }}>
                    <table className="w-full table-fixed border border-gray-200 rounded-lg text-sm overflow-hidden">
                    <thead>
                      <tr className="bg-gray-100">
                          <th className="px-1 py-1 text-center font-semibold text-gray-700 w-14 truncate">學號</th>
                          <th className="px-1 py-1 text-center font-semibold text-gray-700 w-16 truncate">姓名</th>
                          <th className="px-1 py-1 text-center font-semibold text-gray-700 w-12 truncate">年級</th>
                          <th className="px-1 py-1 text-center font-semibold text-gray-700 w-12 truncate">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                        {studentList.map(stu => (
                          <tr key={stu.id} className="border-t hover:bg-blue-50 even:bg-gray-50">
                            <td className="px-1 py-1 text-center text-gray-800 font-medium truncate">{stu.studentId}</td>
                            <td className="px-1 py-1 text-center text-gray-800 truncate">{stu.name}</td>
                            <td className="px-1 py-1 text-center text-gray-800 truncate">{stu.grade || '未設定'}</td>
                            <td className="px-1 py-1 text-center">
                            <button
                                onClick={() => handleRemoveStudentFromCourse(stu, showStudentListModal!)}
                                className="bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 transition text-xs"
                            >
                              移除
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">此課程尚無學生選修。</p>
              )}
            </div>
          </div>
        </DetailModal>
      )}
      <AlertDialog open={alert.open} message={alert.message} onClose={() => setAlert({ open: false, message: '' })} />
    </div>
  );
} 