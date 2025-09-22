'use client';
import React, { useState, useEffect } from 'react';
import MultiSelectDropdown from './MultiSelectDropdown';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import LoadingSpinner from './LoadingSpinner';

import alerts from '../utils/alerts';
import Swal from 'sweetalert2';
import { Modal } from './ui';
import Image from 'next/image';
import Dropdown from './ui/Dropdown';

interface CourseManagerProps {
    onProcessingStateChange: (isProcessing: boolean) => void;
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
    const [images, setImages] = useState([]);
    useEffect(() => {
        fetch('/api/course-images')
            .then(res => res.json())
            .then(data => setImages(data.images || []));
    }, []);
    return images;
}

export default function CourseManager({ onProcessingStateChange }: CourseManagerProps) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedSubject, setSelectedSubject] = useState('all');
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
    const [selectedImage, setSelectedImage] = useState('');

    const [selectedGrade, setSelectedGrade] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedCourseNature, setSelectedCourseNature] = useState('all');

    const courseImages = useCourseImages();



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
            } catch { }
        };
        fetchTeachers();
        fetchCourses();
    }, []);

    const teachingMethods = ['實體上課', '線上上課', '非同步線上上課', '實體與線上同步上課'];
    const courseStatuses = ['未開課', '報名中', '開課中', '已額滿', '已結束', '已封存'];
    const grades = ['國一', '國二', '國三', '高一', '高二', '高三', '職一', '職二', '職三', '大一', '進修'];
    const subjects = ['數學', '理化', '物理', '化學', '生物'];
    const courseNatures = ['進度課程', '升學考試複習', '檢定/考試訓練班'];
    const weekdays = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];

    const handleSaveCourse = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCourse) return;

        onProcessingStateChange(true);
        setIsSubmitting(true);

        try {
            const coverImageURL = selectedImage || editingCourse.coverImageURL || '';
            const teacherUids = await getTeacherUids(editingCourse.teachers);

            if (editingCourse.id && editingCourse.id !== 'new') {
                // Update existing course
                const finalCourseData = {
                    ...editingCourse,
                    coverImageURL,
                    teacherUids,
                    status: editingCourse.status === '資料建置中...' ? '未開課' : editingCourse.status,
                    updatedAt: new Date().toISOString(),
                };
                const updateResponse = await fetch('/api/courses/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(finalCourseData),
                });
                if (!updateResponse.ok) {
                    const errorData = await updateResponse.json();
                    throw new Error(errorData.error || '課程更新失敗');
                }
                Swal.fire('成功', '課程更新成功！', 'success');
            } else {
                // Add new course
                const docId = `${editingCourse.name}(${editingCourse.code})`;
                const finalCourseData = {
                    ...editingCourse,
                    id: docId,
                    coverImageURL,
                    teacherUids,
                    status: editingCourse.status === '資料建置中...' ? '未開課' : editingCourse.status,
                    updatedAt: new Date().toISOString(),
                };
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
                Swal.fire('成功', '課程建立成功！', 'success');
            }
        } catch (error: unknown) {
            Swal.fire('錯誤', (error as Error).message || '儲存課程時發生錯誤', 'error');
        } finally {
            setEditingCourse(null);
            setIsSubmitting(false);
            onProcessingStateChange(false);
            await fetchCourses();
        }
    };

    const handleEdit = (course: Course) => {
        const courseWithDefaults: Course = {
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
        if (!(await alerts.confirm('確定要刪除此課程嗎？'))) return;

        try {
            // 找到要刪除的課程
            const courseToDelete = courses.find(course => course.id === id);
            if (!courseToDelete) {
                Swal.fire('錯誤', '找不到要刪除的課程。', 'error');
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
                        body: JSON.stringify({ public_id: extractPublicIdFromUrl(courseToDelete.coverImageURL) }),
                    });
                    if (!response.ok) {
                        // Log error but don't block deletion
                    }
                } catch {
                    // Log error but don't block deletion
                }
            }

            // 呼叫 server 端 API 刪除課程（會自動同步從老師授課清單中移除）
            await fetch('/api/courses/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });

            setCourses(prev => prev.filter(course => course.id !== id));
            Swal.fire('成功', '課程刪除成功！', 'success');
        } catch {
        } finally {
            await fetchCourses();
        }
    };

    const handleArchive = async (id: string) => {
        if (!(await alerts.confirm('確定要封存此課程嗎？封存後課程將不會顯示在課程列表中。'))) return;
        try {
            await fetch('/api/courses/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, archived: true })
            });
            setCourses(prev => prev.map(course => course.id === id ? { ...course, archived: true, status: '已封存' } : course));
        } catch {
            Swal.fire('錯誤', '封存課程時發生錯誤。', 'error');
        } finally {
            await fetchCourses();
        }
    };

    const handleUnarchive = async (id: string) => {
        if (!(await alerts.confirm('確定要取消封存此課程嗎？'))) return;
        try {
            await fetch('/api/courses/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, archived: false })
            });
            setCourses(prev => prev.map(course => course.id === id ? { ...course, archived: false, status: '未開課' } : course));
            Swal.fire('成功', '課程取消封存成功！', 'success');
        } catch {
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
            const newClassTime: ClassTime = { day: '星期一', startTime: '08:00', endTime: '09:00' };
            setEditingCourse(prev => prev ? { ...prev, classTimes: [...(prev.classTimes || []), newClassTime] } : null);
        }
    };

    const removeClassTime = (index: number) => {
        if (editingCourse) {
            setEditingCourse(prev => prev ? { ...prev, classTimes: (prev.classTimes || []).filter((_, i) => i !== index) } : null);
        }
    };

    const updateClassTime = (index: number, field: keyof ClassTime, value: string) => {
        if (editingCourse) {
            const currentClassTimes = editingCourse.classTimes || [];
            const updatedTimes = [...currentClassTimes];
            updatedTimes[index] = { ...updatedTimes[index], [field]: value };
            setEditingCourse(prev => prev ? { ...prev, classTimes: updatedTimes } : null);
        }
    };

    const filteredCourses = courses.filter(course => {
        const matchesSearch = (course.name && course.name.toLowerCase().includes(searchTerm.toLowerCase())) || (course.code && course.code.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesGrade = selectedGrade === 'all' || (course.gradeTags && Array.isArray(course.gradeTags) && course.gradeTags.includes(selectedGrade));
        const matchesSubject = selectedSubject === 'all' || course.subjectTag === selectedSubject;
        const matchesCourseNature = selectedCourseNature === 'all' || course.courseNature === selectedCourseNature;
        const matchesStatus = selectedStatus === 'all' || course.status === selectedStatus;

        if (selectedStatus === '已封存') {
            return matchesSearch && matchesGrade && matchesSubject && matchesCourseNature && course.status === '已封存';
        }

        return matchesSearch && matchesGrade && matchesSubject && matchesCourseNature && matchesStatus && !course.archived;
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
        } finally {
            setLoadingStudents(false);
        }
    };

    const handleRemoveStudentFromCourse = async (student: Student, course: Course) => {
        if (!(await alerts.confirm(`確定要將學生 ${student.name} 從課程「${course.name}」中移除嗎？`))) {
            return;
        }
        try {
            // 從 course-student-list 中移除學生
            const res = await fetch('/api/course-student-list/remove-student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseName: course.name, courseCode: course.code, studentId: student.id })
            });
            if (res.ok) {
                // 更新本地學生列表
                setStudentList(prev => prev.filter(s => s.id !== student.id));
                Swal.fire('成功', `已將學生 ${student.name} 從課程中移除`, 'success');
            } else {
                Swal.fire('錯誤', '移除學生時發生錯誤', 'error');
            }
        } catch {
            Swal.fire('錯誤', '移除學生時發生錯誤', 'error');
        }
    };

    return (
        <div className="max-w-6xl mx-auto w-full p-4 flex flex-col min-h-0">
            <h1 className="text-2xl font-bold mb-4">課程管理</h1>

            <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm mb-6 flex-shrink-0">
                <div className="flex flex-col md:flex-row gap-4 items-center">
                    <Dropdown
                        value={selectedSubject}
                        onChange={setSelectedSubject}
                        options={[{ value: 'all', label: '全部科目' }, ...subjects.map(s => ({ value: s, label: s }))]}
                        placeholder="全部科目"
                        className="w-full md:w-48"
                    />
                    <Dropdown
                        value={selectedGrade}
                        onChange={setSelectedGrade}
                        options={[{ value: 'all', label: '全部年級' }, ...grades.map(g => ({ value: g, label: g }))]}
                        placeholder="全部年級"
                        className="w-full md:w-48"
                    />
                    <Dropdown
                        value={selectedCourseNature}
                        onChange={setSelectedCourseNature}
                        options={[{ value: 'all', label: '全部性質' }, ...courseNatures.map(n => ({ value: n, label: n }))]}
                        placeholder="全部性質"
                        className="w-full md:w-48"
                    />
                    <Dropdown
                        value={selectedStatus}
                        onChange={setSelectedStatus}
                        options={[{ value: 'all', label: '全部狀態' }, ...courseStatuses.map(s => ({ value: s, label: s }))]}
                        placeholder="全部狀態"
                        className="w-full md:w-48"
                    />
                    <input
                        type="text"
                        placeholder="搜尋課程名稱或代碼"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="flex-1 w-full border border-gray-300 p-3 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {!editingCourse && (
                        <button
                            onClick={() => setEditingCourse({ id: '', name: '', code: '', coverImageURL: '', description: '', teachingMethod: '實體上課', teachers: [], startDate: '', endDate: '', classTimes: [], status: '未開課', gradeTags: [], subjectTag: '', courseNature: '', showInIntroduction: false, timeArrangementType: '依時段安排', location: '', liveStreamURL: '', archived: false } as Course)}
                            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 w-full md:w-auto"
                        >
                            新增課程
                        </button>
                    )}
                </div>
            </div>



            {/* 編輯/新增表單 */}
            {editingCourse && (
                <Modal open={!!editingCourse} onClose={() => setEditingCourse(null)} title={editingCourse.id && editingCourse.id !== 'new' ? '編輯課程' : '新增課程'} size="xl">
                    <form onSubmit={handleSaveCourse} className="space-y-4">
                        {/* Form fields... */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">課程名稱 *</label>
                                <input type="text" value={editingCourse.name} onChange={e => setEditingCourse(prev => prev ? { ...prev, name: e.target.value } : null)} className="w-full p-2 border rounded-md" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">課程代碼 *</label>
                                <input type="text" value={editingCourse.code} onChange={e => setEditingCourse(prev => prev ? { ...prev, code: e.target.value } : null)} className="w-full p-2 border rounded-md" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">開始日期 *</label>
                                <DatePicker selected={editingCourse.startDate ? new Date(editingCourse.startDate) : null} onChange={(date: Date | null) => { const newDate = date ? date.toISOString().split('T')[0] : ''; setEditingCourse(prev => prev ? { ...prev, startDate: newDate } : null) }} dateFormat="yyyy/MM/dd" className="w-full" placeholderText="YYYY/MM/DD" required />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">結束日期 *</label>
                                <DatePicker selected={editingCourse.endDate ? new Date(editingCourse.endDate) : null} onChange={(date: Date | null) => { const newDate = date ? date.toISOString().split('T')[0] : ''; setEditingCourse(prev => prev ? { ...prev, endDate: newDate } : null) }} dateFormat="yyyy/MM/dd" className="w-full" placeholderText="YYYY/MM/DD" required />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">授課老師 *</label>
                                {editingCourse && (
                                    <MultiSelectDropdown
                                        options={allTeachers.map(t => ({ id: t.id, name: t.name }))}
                                        selectedOptions={editingCourse.teachers || []}
                                        onChange={(selected) => {
                                            setEditingCourse((prev) => (prev ? { ...prev, teachers: selected } : null))
                                        }}
                                        placeholder="選擇授課老師"
                                    />
                                )}
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">課程性質 *</label>
                                <Dropdown
                                    value={editingCourse.courseNature}
                                    onChange={(value) => setEditingCourse(prev => prev ? { ...prev, courseNature: value } : null)}
                                    options={courseNatures.map(n => ({ value: n, label: n }))}
                                    placeholder="選擇課程性質"
                                    className="w-full"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">年級 *</label>
                                <div className="flex flex-wrap gap-2">
                                    {grades.map(grade => (
                                        <label key={grade} className="inline-flex items-center">
                                            <input type="checkbox" checked={(editingCourse.gradeTags || []).includes(grade)} onChange={e => {
                                                const currentGrades = editingCourse.gradeTags || [];
                                                const newGrades = e.target.checked ? [...currentGrades, grade] : currentGrades.filter(g => g !== grade);
                                                setEditingCourse(prev => prev ? { ...prev, gradeTags: newGrades } : null);
                                            }} className="mr-2 accent-blue-600" />
                                            {grade}
                                        </label>
                                    ))}
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">科目 *</label>
                                <Dropdown
                                    value={editingCourse.subjectTag}
                                    onChange={(value) => setEditingCourse(prev => prev ? { ...prev, subjectTag: value } : null)}
                                    options={subjects.map(s => ({ value: s, label: s }))}
                                    placeholder="選擇科目"
                                    className="w-full"
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">授課方式 *</label>
                                <Dropdown
                                    value={editingCourse.teachingMethod}
                                    onChange={(value) => setEditingCourse(prev => prev ? { ...prev, teachingMethod: value as '實體上課' | '線上上課' | '非同步線上上課' | '實體與線上同步上課' } : null)}
                                    options={teachingMethods.map(method => ({ value: method, label: method }))}
                                    placeholder="選擇授課方式"
                                    className="w-full"
                                />
                            </div>

                            {editingCourse.teachingMethod === '實體上課' && (
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">上課地點 *</label>
                                    <input type="text" value={editingCourse.location} onChange={e => setEditingCourse(prev => prev ? { ...prev, location: e.target.value } : null)} className="w-full p-2 border rounded-md" required />
                                </div>
                            )}
                            {editingCourse.teachingMethod === '線上上課' && (
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">直播網址 *</label>
                                    <input type="text" value={editingCourse.liveStreamURL} onChange={e => setEditingCourse(prev => prev ? { ...prev, liveStreamURL: e.target.value } : null)} className="w-full p-2 border rounded-md" required />
                                </div>
                            )}
                            {editingCourse.teachingMethod === '實體與線上同步上課' && (
                                <>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">上課地點 *</label>
                                        <input type="text" value={editingCourse.location} onChange={e => setEditingCourse(prev => prev ? { ...prev, location: e.target.value } : null)} className="w-full p-2 border rounded-md" required />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-sm font-medium text-gray-700">直播網址 *</label>
                                        <input type="text" value={editingCourse.liveStreamURL} onChange={e => setEditingCourse(prev => prev ? { ...prev, liveStreamURL: e.target.value } : null)} className="w-full p-2 border rounded-md" required />
                                    </div>
                                </>
                            )}

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">上課時間安排 *</label>
                                <Dropdown
                                    value={editingCourse.timeArrangementType}
                                    onChange={(value) => setEditingCourse(prev => prev ? { ...prev, timeArrangementType: value as '依時段安排' | '依學年課程彈性安排' | '課程時間由學生自主安排' } : null)}
                                    options={[
                                        { value: '依時段安排', label: '依時段安排' },
                                        { value: '依學年課程彈性安排', label: '依學年課程彈性安排' },
                                        { value: '課程時間由學生自主安排', label: '課程時間由學生自主安排' }
                                    ]}
                                    placeholder="選擇上課時間安排"
                                    className="w-full"
                                />
                            </div>

                            {editingCourse.timeArrangementType === '依時段安排' && (
                                <div className="col-span-2 space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">設定上課時段：</label>
                                    {(editingCourse.classTimes || []).map((time, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Dropdown
                                                value={time.day}
                                                onChange={(value) => updateClassTime(index, 'day', value)}
                                                options={weekdays.map(day => ({ value: day, label: day }))}
                                                placeholder="選擇星期"
                                                style={{ width: '125px' }}
                                            />
                                            <input type="time" value={time.startTime} onChange={e => {
                                                const [h, mRaw] = e.target.value.split(":");
                                                const m = (Math.round(parseInt(mRaw, 10) / 5) * 5).toString().padStart(2, '0');
                                                updateClassTime(index, 'startTime', `${h}:${m}`);
                                            }} className="p-2 border rounded-md" step="300" lang="zh-Hant" />
                                            <span>至</span>
                                            <input type="time" value={time.endTime} onChange={e => {
                                                const [h, mRaw] = e.target.value.split(":");
                                                const m = (Math.round(parseInt(mRaw, 10) / 5) * 5).toString().padStart(2, '0');
                                                updateClassTime(index, 'endTime', `${h}:${m}`);
                                            }} className="p-2 border rounded-md" step="300" lang="zh-Hant" />
                                            <button type="button" onClick={() => removeClassTime(index)} className="text-red-500 hover:text-red-700">刪除</button>
                                        </div>
                                    ))}
                                    <button type="button" onClick={addClassTime} className="text-blue-500 hover:text-blue-700">+ 新增時段</button>
                                </div>
                            )}

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">課程圖片 *</label>
                                <div className="flex gap-1 mt-2 overflow-x-auto">
                                    {courseImages.map(img => (
                                        <div key={img} className={`relative border-2 rounded-lg overflow-hidden cursor-pointer flex-shrink-0 ${selectedImage === img ? 'border-blue-500' : 'border-transparent'}`} onClick={() => setSelectedImage(img)}>
                                            <Image src={img} alt="課程圖片" width={150} height={112} style={{ objectFit: 'cover' }} />
                                            {selectedImage === img && (
                                                <div className="absolute inset-0 bg-blue-500 bg-opacity-50 flex items-center justify-center">
                                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {!selectedImage && <p className="text-red-500 text-sm mt-1">請選擇一張課程圖片</p>}
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">課程描述</label>
                                <textarea value={editingCourse.description} onChange={e => setEditingCourse(prev => prev ? { ...prev, description: e.target.value } : null)} className="w-full p-2 border rounded-md h-32" placeholder="請描述課程內容、目標等..."></textarea>
                            </div>

                            <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-700">課程狀態 *</label>
                                <Dropdown
                                    value={editingCourse.status}
                                    onChange={(value) => setEditingCourse(prev => prev ? { ...prev, status: value as '未開課' | '報名中' | '開課中' | '已額滿' | '已結束' | '已封存' | '資料建置中...' } : null)}
                                    options={courseStatuses.map(s => ({ value: s, label: s }))}
                                    placeholder="選擇課程狀態"
                                    className="w-full"
                                />
                            </div>

                            <div className="col-span-2">
                                <label className="inline-flex items-center">
                                    <input type="checkbox" checked={editingCourse.showInIntroduction} onChange={e => setEditingCourse(prev => prev ? { ...prev, showInIntroduction: e.target.checked } : null)} className="mr-2 accent-blue-600" />
                                    將課程顯示在課程介紹中
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end gap-4 mt-4">
                            <button type="button" onClick={() => setEditingCourse(null)} disabled={isSubmitting} className="px-4 py-2 bg-gray-200 rounded-md">取消</button>
                            <button type="submit" disabled={isSubmitting} className="px-4 py-2 bg-blue-600 text-white rounded-md">
                                {isSubmitting ? '更新中...' : (editingCourse.id && editingCourse.id !== 'new' ? '更新課程' : '建立課程')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* 課程列表 */}
            {!editingCourse && (
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
                        {loading ? (
                            <div className="text-center p-8">
                                <LoadingSpinner />
                                <p>載入中...</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">課程名稱</th>
                                        <th scope="col" className="px-6 py-3">授課老師</th>
                                        <th scope="col" className="px-6 py-3">狀態</th>
                                        <th scope="col" className="px-6 py-3">開課日期</th>
                                        <th scope="col" className="px-6 py-3">結束日期</th>
                                        <th scope="col" className="px-6 py-3">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredCourses.map((course) => (
                                        <tr key={course.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                                                <div>{course.name} {course.archived && ( <span className="text-xs text-red-500 ml-2">已封存</span> )}</div>
                                                <div className="text-sm text-gray-500">{course.code}</div>
                                            </td>
                                            <td className="px-6 py-4">{course.teachers.map(teacherId => allTeachers.find(t => t.id === teacherId)?.name).join(', ') || 'N/A'}</td>
                                            <td className="px-6 py-4">{course.status}</td>
                                            <td className="px-6 py-4">{course.startDate}</td>
                                            <td className="px-6 py-4">{course.endDate}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex gap-3 w-full min-w-[240px]">
                                                    <button onClick={() => { handleEdit(course); }} className="text-blue-600 hover:text-blue-800 font-medium transition-colors" disabled={course.status === '資料建置中...'}>編輯</button>
                                                    <button onClick={() => handleShowStudents(course)} className="text-green-600 hover:text-green-800 font-medium transition-colors">學生清單</button>
                                                    {course.archived ? (
                                                        <button onClick={() => handleUnarchive(course.id)} className="text-gray-600 hover:text-gray-800 font-medium transition-colors">取消封存</button>
                                                    ) : (
                                                        <button onClick={() => handleArchive(course.id)} className="text-yellow-600 hover:text-yellow-800 font-medium transition-colors" disabled={course.status === '資料建置中...'}>封存</button>
                                                    )}
                                                    <button onClick={() => handleDelete(course.id)} className="text-red-600 hover:text-red-800 font-medium transition-colors" disabled={course.status === '資料建置中...'}>刪除</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Student List Modal */}
            {showStudentListModal && (
                <Modal open={!!showStudentListModal} onClose={() => setShowStudentListModal(null)} title={`「${showStudentListModal?.name}」學生清單`} size="lg">
                    <div className="p-4">
                        <h3 className="font-bold text-lg mb-2">學生名單</h3>
                        {loadingStudents ? (
                            <LoadingSpinner />
                        ) : studentList.length > 0 ? (
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-2">學號</th>
                                        <th className="px-4 py-2">姓名</th>
                                        <th className="px-4 py-2">年級</th>
                                        <th className="px-4 py-2">操作</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentList.map(stu => (
                                        <tr key={stu.id} className="border-b">
                                            <td className="px-4 py-2">{stu.studentId}</td>
                                            <td className="px-4 py-2">{stu.name}</td>
                                            <td className="px-4 py-2">{stu.grade || '未設定'}</td>
                                            <td className="px-4 py-2">
                                                <button onClick={() => handleRemoveStudentFromCourse(stu, showStudentListModal!)} className="bg-red-100 text-red-600 px-3 py-1 rounded hover:bg-red-200 transition text-sm">
                                                    移除
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <p>此課程尚無學生選修。</p>
                        )}
                    </div>
                </Modal>
            )}


        </div>
    );
}
