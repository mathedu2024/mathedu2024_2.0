'use client';
import React, { useState, useEffect } from 'react';
import MultiSelectDropdown from './MultiSelectDropdown';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { LoadingSpinner } from './ui';

import Swal from 'sweetalert2';
import { Modal } from './ui';
import Image from 'next/image';
import Dropdown from './ui/Dropdown';

// Heroicons
import { 
  PencilSquareIcon, 
  UserGroupIcon, 
  ArchiveBoxIcon, 
  TrashIcon, 
  PlusIcon,
  FunnelIcon,
  ChevronDownIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  CalendarIcon,
  UserIcon,
  PhotoIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

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
    examScope?: string[];
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
    const [isFilterOpen, setIsFilterOpen] = useState(false);

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
                if (updateResponse.ok) {
                    await Swal.fire({
                        icon: 'success',
                        title: '更新成功',
                        text: '課程資料已成功儲存。',
                        confirmButtonColor: '#4f46e5',
                        customClass: { popup: 'rounded-2xl' }
                    });
                } else {
                    const errorData = await updateResponse.json();
                    throw new Error(errorData.error || '課程更新失敗');
                }
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
                if (createResponse.ok) {
                    await Swal.fire({
                        icon: 'success',
                        title: '建立成功',
                        text: '新課程已成功加入系統。',
                        confirmButtonColor: '#4f46e5',
                        customClass: { popup: 'rounded-2xl' }
                    });
                } else {
                    const errorData = await createResponse.json();
                    throw new Error(errorData.error || '課程建立失敗');
                }
            }
        } catch (err: unknown) {
            await Swal.fire({
                icon: 'error',
                title: '儲存失敗',
                text: err instanceof Error ? err.message : '儲存課程時發生錯誤',
                confirmButtonColor: '#4f46e5',
                customClass: { popup: 'rounded-2xl' }
            });
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
            examScope: course.examScope || [],
            timeArrangementType: course.timeArrangementType || '依時段安排',
            startDate: course.startDate || '',
            endDate: course.endDate || '',
            status: course.status || '未開課',
            showInIntroduction: typeof course.showInIntroduction === 'boolean' ? course.showInIntroduction : true,
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
        const result = await Swal.fire({
            title: '確定要刪除此課程嗎？',
            text: '此動作將無法還原，且相關授課紀錄也會被移除。',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#9ca3af',
            confirmButtonText: '確定刪除',
            cancelButtonText: '取消',
            customClass: { popup: 'rounded-2xl' }
        });

        if (!result.isConfirmed) return;

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
            Swal.fire({
                icon: 'success',
                title: '刪除成功',
                text: '課程已從系統中移除。',
                confirmButtonColor: '#4f46e5',
                customClass: { popup: 'rounded-2xl' }
            });
        } catch {
            Swal.fire({
                icon: 'error',
                title: '錯誤',
                text: '刪除課程時發生錯誤。',
                confirmButtonColor: '#4f46e5',
                customClass: { popup: 'rounded-2xl' }
            });
        } finally {
            await fetchCourses();
        }
    };

    const handleArchive = async (id: string) => {
        const result = await Swal.fire({
            title: '確定要封存此課程嗎？',
            text: '封存後課程將不會顯示在首頁清單中。',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#9ca3af',
            confirmButtonText: '確定封存',
            cancelButtonText: '取消',
            customClass: { popup: 'rounded-2xl' }
        });

        if (!result.isConfirmed) return;
        try {
            await fetch('/api/courses/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, archived: true })
            });
            setCourses(prev => prev.map(course => course.id === id ? { ...course, archived: true, status: '已封存' } : course));
            Swal.fire({
                icon: 'success',
                title: '已封存',
                text: '課程已成功移至封存清單。',
                confirmButtonColor: '#4f46e5',
                customClass: { popup: 'rounded-2xl' }
            });
        } catch {
            Swal.fire({
                icon: 'error',
                title: '錯誤',
                text: '封存課程時發生錯誤。',
                confirmButtonColor: '#4f46e5',
                customClass: { popup: 'rounded-2xl' }
            });
        } finally {
            await fetchCourses();
        }
    };

    const handleUnarchive = async (id: string) => {
        const result = await Swal.fire({
            title: '確定要取消封存此課程嗎？',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#4f46e5',
            cancelButtonColor: '#9ca3af',
            confirmButtonText: '確認取消封存',
            cancelButtonText: '再想想',
            customClass: { popup: 'rounded-2xl' }
        });

        if (!result.isConfirmed) return;
        try {
            await fetch('/api/courses/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, archived: false })
            });
            setCourses(prev => prev.map(course => course.id === id ? { ...course, archived: false, status: '未開課' } : course));
            Swal.fire({
                icon: 'success',
                title: '已復原',
                text: '課程已取消封存。',
                confirmButtonColor: '#4f46e5',
                customClass: { popup: 'rounded-2xl' }
            });
        } catch {
            Swal.fire({
                icon: 'error',
                title: '錯誤',
                text: '操作失敗，請稍後再試。',
                confirmButtonColor: '#4f46e5',
                customClass: { popup: 'rounded-2xl' }
            });
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
        const result = await Swal.fire({
            title: '移除學生確認',
            text: `確定要將學生 ${student.name} 從課程「${course.name}」中移除嗎？`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#9ca3af',
            confirmButtonText: '確認移除',
            cancelButtonText: '取消',
            customClass: { popup: 'rounded-2xl' }
        });

        if (!result.isConfirmed) return;

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
                Swal.fire({
                    icon: 'success',
                    title: '移除成功',
                    text: `已將學生 ${student.name} 從課程中移除`,
                    confirmButtonColor: '#4f46e5',
                    customClass: { popup: 'rounded-2xl' }
                });
            } else {
                throw new Error('移除失敗');
            }
        } catch {
            Swal.fire({
                icon: 'error',
                title: '錯誤',
                text: '移除學生時發生錯誤',
                confirmButtonColor: '#4f46e5',
                customClass: { popup: 'rounded-2xl' }
            });
        }
    };

    // Helper for Status Badge Color
    const getStatusColor = (status: string) => {
        switch (status) {
            case '開課中': return 'bg-green-100 text-green-700 ring-green-600/20';
            case '報名中': return 'bg-blue-100 text-blue-700 ring-blue-600/20';
            case '已額滿': return 'bg-yellow-100 text-yellow-800 ring-yellow-600/20';
            case '已結束': return 'bg-gray-100 text-gray-600 ring-gray-500/10';
            case '未開課': return 'bg-indigo-50 text-indigo-700 ring-indigo-700/10';
            case '已封存': return 'bg-red-50 text-red-700 ring-red-600/10';
            default: return 'bg-gray-50 text-gray-600 ring-gray-500/10';
        }
    };

    return (
        <div className="max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col h-full animate-fade-in">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                    <UserGroupIcon className="w-8 h-8 mr-2 text-indigo-600" />
                    課程管理
                </h1>
                <button
                    onClick={() => setEditingCourse({ id: '', name: '', code: '', coverImageURL: '', description: '', teachingMethod: '實體上課', teachers: [], startDate: '', endDate: '', classTimes: [], status: '未開課', gradeTags: [], subjectTag: '', courseNature: '', examScope: [], showInIntroduction: true, timeArrangementType: '依時段安排', location: '', liveStreamURL: '', archived: false } as Course)}
                    className="btn-primary flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
                >
                    <PlusIcon className="w-5 h-5 mr-1" />
                    新增課程
                </button>
            </div>

            {/* 手機版：展開/收合觸發按鈕 */}
            <div className="md:hidden mb-4">
                <button
                    onClick={() => setIsFilterOpen(!isFilterOpen)}
                    className="w-full flex items-center justify-between bg-white px-5 py-4 rounded-xl shadow-sm border border-gray-100 transition-all active:scale-[0.99]"
                >
                    <span className="font-bold text-gray-700 flex items-center text-sm">
                        <FunnelIcon className="w-5 h-5 mr-2 text-indigo-500" />
                        條件篩選與搜尋
                    </span>
                    <ChevronDownIcon 
                        className={`w-5 h-5 text-gray-400 transform transition-transform duration-300 ${isFilterOpen ? 'rotate-180' : ''}`} 
                    />
                </button>
            </div>

            {/* 篩選器內容：手機版具備收合動畫，電腦版保持顯示 */}
            <div className={`
                md:block mb-8 transition-all duration-300 ease-in-out
                ${isFilterOpen ? 'max-h-[1000px] opacity-100 overflow-visible' : 'max-h-0 md:max-h-none opacity-0 md:opacity-100 overflow-hidden md:overflow-visible'}
            `}>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                        <div className="relative">
                        <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="搜尋名稱或代碼..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                        />
                    </div>
                    <Dropdown
                        value={selectedSubject}
                        onChange={setSelectedSubject}
                        options={[{ value: 'all', label: '全部科目' }, ...subjects.map(s => ({ value: s, label: s }))]}
                        className="w-full"
                    />
                    <Dropdown
                        value={selectedGrade}
                        onChange={setSelectedGrade}
                        options={[{ value: 'all', label: '全部年級' }, ...grades.map(g => ({ value: g, label: g }))]}
                        className="w-full"
                    />
                    <Dropdown
                        value={selectedCourseNature}
                        onChange={setSelectedCourseNature}
                        options={[{ value: 'all', label: '全部性質' }, ...courseNatures.map(n => ({ value: n, label: n }))]}
                        className="w-full"
                    />
                    <Dropdown
                        value={selectedStatus}
                        onChange={setSelectedStatus}
                        options={[{ value: 'all', label: '全部狀態' }, ...courseStatuses.map(s => ({ value: s, label: s }))]}
                        className="w-full"
                    />
                </div>
                </div>
            </div>

            {/* Course Grid View - REPLACED TABLE */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center min-h-[400px]">
                    <LoadingSpinner size={60} text="載入課程中..." />
                </div>
            ) : (
                <>
                    {filteredCourses.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-gray-200 text-gray-400">
                            <ArchiveBoxIcon className="w-16 h-16 mb-4 text-gray-300" />
                            <p className="text-lg">沒有找到符合條件的課程</p>
                            <button onClick={() => { setSearchTerm(''); setSelectedSubject('all'); setSelectedStatus('all'); }} className="mt-4 text-indigo-600 hover:text-indigo-800 font-medium flex items-center">
                                <ArrowPathIcon className="w-4 h-4 mr-1" /> 清除篩選
                            </button>
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden mb-8">
                            {/* Desktop View: Table */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th scope="col" className="px-6 py-4 font-bold">課程名稱與代碼</th>
                                            <th scope="col" className="px-6 py-4 font-bold">授課老師</th>
                                            <th scope="col" className="px-6 py-4 font-bold">上課期間</th>
                                            <th scope="col" className="px-6 py-4 font-bold">年級</th>
                                            <th scope="col" className="px-6 py-4 font-bold">狀態</th>
                                            <th scope="col" className="px-6 py-4 font-bold text-right">操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredCourses.map(course => (
                                            <tr key={course.id} className="bg-white hover:bg-gray-50 transition-colors group">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        {course.coverImageURL ? (
                                                            <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-gray-100">
                                                                <Image src={course.coverImageURL} alt={course.name} fill className="object-contain bg-gray-50" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
                                                                <PhotoIcon className="w-6 h-6" />
                                                            </div>
                                                        )}
                                                        <div>
                                                            <div className="font-bold text-gray-900 line-clamp-1">
                                                                {course.name}
                                                                {course.archived && <span className="ml-2 text-[10px] text-red-500 border border-red-200 bg-red-50 px-1 rounded">已封存</span>}
                                                            </div>
                                                            <div className="text-xs font-mono text-gray-400 mt-0.5">{course.code}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center text-gray-600">
                                                        <UserIcon className="w-4 h-4 mr-1.5 text-gray-400" />
                                                        <span className="truncate max-w-[150px]">
                                                            {course.teachers.map(tid => allTeachers.find(t => t.id === tid)?.name).join(', ') || '未指定'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs text-gray-600 flex flex-col gap-0.5">
                                                        <div className="flex items-center"><CalendarIcon className="w-3.5 h-3.5 mr-1 text-gray-400" /> {course.startDate}</div>
                                                        <div className="flex items-center pl-4.5 text-gray-400">至 {course.endDate}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex flex-wrap gap-1 max-w-[120px]">
                                                        {course.gradeTags.slice(0, 2).map(g => (
                                                            <span key={g} className="text-[10px] px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded">
                                                                {g}
                                                            </span>
                                                        ))}
                                                        {course.gradeTags.length > 2 && <span className="text-[10px] px-1 text-gray-400">...</span>}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getStatusColor(course.status)}`}>
                                                        {course.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => handleEdit(course)}
                                                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                            title="編輯課程"
                                                            disabled={course.status === '資料建置中...'}
                                                        >
                                                            <PencilSquareIcon className="w-5 h-5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleShowStudents(course)}
                                                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                            title="學生名單"
                                                        >
                                                            <UserGroupIcon className="w-5 h-5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => course.archived ? handleUnarchive(course.id) : handleArchive(course.id)}
                                                            className={`p-1.5 rounded-lg transition-colors ${course.archived ? 'text-green-600 hover:bg-green-50' : 'text-yellow-600 hover:bg-yellow-50'}`}
                                                            title={course.archived ? "取消封存" : "封存課程"}
                                                            disabled={course.status === '資料建置中...'}
                                                        >
                                                            <ArchiveBoxIcon className="w-5 h-5" />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(course.id)}
                                                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                            title="刪除課程"
                                                            disabled={course.status === '資料建置中...'}
                                                        >
                                                            <TrashIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile View: Cards in a List */}
                            <div className="md:hidden divide-y divide-gray-100">
                                {filteredCourses.map(course => (
                                    <div key={course.id} className="p-4 bg-white active:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start mb-3">
                                            <div className="flex gap-3">
                                                <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden relative border border-gray-100">
                                                {course.coverImageURL ? <Image src={course.coverImageURL} alt="" fill className="object-contain bg-gray-50" /> : <PhotoIcon className="w-6 h-6 m-auto text-gray-300 h-full" />}
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 line-clamp-1">{course.name}</h3>
                                                    <p className="text-xs font-mono text-gray-400">{course.code}</p>
                                                </div>
                                            </div>
                                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${getStatusColor(course.status)}`}>
                                                {course.status}
                                            </span>
                                        </div>
                                        
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {course.gradeTags.map(g => (
                                                <span key={g} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                                                    {g}
                                                </span>
                                            ))}
                                        </div>

                                        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                                            <button 
                                                onClick={() => handleEdit(course)}
                                                className="text-xs font-bold text-indigo-600 flex items-center px-2 py-1"
                                            >
                                                <PencilSquareIcon className="w-4 h-4 mr-1" /> 編輯
                                            </button>
                                            <button 
                                                onClick={() => handleShowStudents(course)}
                                                className="text-xs font-bold text-green-600 flex items-center px-2 py-1"
                                            >
                                                <UserGroupIcon className="w-4 h-4 mr-1" /> 名單
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(course.id)}
                                                className="text-xs font-bold text-red-500 flex items-center px-2 py-1"
                                            >
                                                <TrashIcon className="w-4 h-4 mr-1" /> 刪除
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* 編輯/新增 Modal */}
            {editingCourse && (
                <Modal open={!!editingCourse} onClose={() => setEditingCourse(null)} title={editingCourse.id && editingCourse.id !== 'new' ? '編輯課程' : '新增課程'} size="lg">
                    <form onSubmit={handleSaveCourse} className="space-y-6">
                        {/* Section 1: Basic Info */}
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                                <span className="w-1 h-4 bg-indigo-500 rounded-full mr-2"></span>
                                基本資訊
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">課程名稱 <span className="text-red-500">*</span></label>
                                    <input type="text" value={editingCourse.name} onChange={e => setEditingCourse(prev => prev ? { ...prev, name: e.target.value } : null)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" required placeholder="輸入課程名稱" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">課程代碼 <span className="text-red-500">*</span></label>
                                    <input type="text" value={editingCourse.code} onChange={e => setEditingCourse(prev => prev ? { ...prev, code: e.target.value } : null)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all" required placeholder="例: MAT-101" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">授課老師 <span className="text-red-500">*</span></label>
                                    <MultiSelectDropdown
                                        options={allTeachers.map(t => ({ label: t.name, value: t.id }))}
                                        selectedOptions={editingCourse.teachers || []}
                                        onChange={(selected) => setEditingCourse(prev => prev ? { ...prev, teachers: selected } : null)}
                                        placeholder="選擇授課老師"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Content & Categorization */}
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                                <span className="w-1 h-4 bg-purple-500 rounded-full mr-2"></span>
                                內容與分類
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">課程性質 <span className="text-red-500">*</span></label>
                                    <Dropdown
                                        value={editingCourse.courseNature}
                                        onChange={(value) => setEditingCourse(prev => prev ? { ...prev, courseNature: value } : null)}
                                        options={courseNatures.map(n => ({ value: n, label: n }))}
                                        placeholder="選擇課程性質"
                                        className="w-full"
                                    />
                                </div>
                                {['升學考試複習', '檢定/考試訓練班'].includes(editingCourse.courseNature) && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">考試範圍</label>
                                        <div className="flex flex-wrap gap-3 p-3 border border-gray-200 rounded-lg bg-white">
                                            {['第一次定期評量', '第二次定期評量', '期末評量'].map(exam => (
                                                <label key={exam} className="inline-flex items-center cursor-pointer select-none">
                                                    <input type="checkbox" checked={(editingCourse.examScope || []).includes(exam)} onChange={e => {
                                                        const currentScope = editingCourse.examScope || [];
                                                        const newScope = e.target.checked ? [...currentScope, exam] : currentScope.filter(s => s !== exam);
                                                        setEditingCourse(prev => prev ? { ...prev, examScope: newScope } : null);
                                                    }} className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                                                    <span className="ml-2 text-sm text-gray-700">{exam}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">適用年級 <span className="text-red-500">*</span></label>
                                    <div className="flex flex-wrap gap-2">
                                        {grades.map(grade => {
                                            const isSelected = (editingCourse.gradeTags || []).includes(grade);
                                            return (
                                                <button
                                                    key={grade}
                                                    type="button"
                                                    onClick={() => {
                                                        const currentGrades = editingCourse.gradeTags || [];
                                                        const newGrades = isSelected ? currentGrades.filter(g => g !== grade) : [...currentGrades, grade];
                                                        setEditingCourse(prev => prev ? { ...prev, gradeTags: newGrades } : null);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                                        isSelected 
                                                        ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500 ring-offset-1' 
                                                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {grade}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">科目 <span className="text-red-500">*</span></label>
                                    <Dropdown
                                        value={editingCourse.subjectTag}
                                        onChange={(value) => setEditingCourse(prev => prev ? { ...prev, subjectTag: value } : null)}
                                        options={subjects.map(s => ({ value: s, label: s }))}
                                        placeholder="選擇科目"
                                        className="w-full"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">課程描述</label>
                                    <textarea 
                                        value={editingCourse.description} 
                                        onChange={e => setEditingCourse(prev => prev ? { ...prev, description: e.target.value } : null)} 
                                        className="w-full p-3 border border-gray-300 rounded-lg h-48 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none" 
                                        placeholder="請描述課程內容、目標等..."
                                    ></textarea>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">課程介紹封面圖片 <span className="text-red-500">*</span></label>
                                    <div className="flex gap-4 overflow-x-auto p-5 border border-gray-200 rounded-2xl bg-gray-50/50 shadow-inner no-scrollbar snap-x min-h-[300px] items-center">
                                        {courseImages.map(img => (
                                            <div key={img} className={`relative flex-shrink-0 w-48 h-48 sm:w-56 sm:h-56 rounded-xl overflow-hidden cursor-pointer group border-2 transition-all snap-start shadow-md ${selectedImage === img ? 'border-indigo-500 ring-4 ring-indigo-100 scale-[0.98]' : 'border-white hover:border-indigo-200'}`} onClick={() => setSelectedImage(img)}>
                                                <Image src={img} alt="課程圖片" fill className="object-cover bg-white group-hover:scale-110 transition-transform duration-500" sizes="(max-width: 768px) 192px, 224px" />
                                                {selectedImage === img && (
                                                    <div className="absolute inset-0 bg-indigo-600/30 backdrop-blur-[1px] flex items-center justify-center">
                                                        <div className="bg-indigo-600 rounded-full p-2 shadow-xl ring-2 ring-white">
                                                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                    {!selectedImage && <p className="text-red-500 text-xs mt-2 font-medium">尚未選擇圖片，請從上方選單挑選一張封面圖</p>}
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Time & Location */}
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                                <span className="w-1 h-4 bg-green-500 rounded-full mr-2"></span>
                                時間與地點
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">開始日期 <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <DatePicker selected={editingCourse.startDate ? new Date(editingCourse.startDate) : null} onChange={(date: Date | null) => { const newDate = date ? date.toISOString().split('T')[0] : ''; setEditingCourse(prev => prev ? { ...prev, startDate: newDate } : null) }} dateFormat="yyyy/MM/dd" className="w-full p-2.5 pl-10 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholderText="YYYY/MM/DD" required wrapperClassName="w-full" />
                                        <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">結束日期 <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <DatePicker selected={editingCourse.endDate ? new Date(editingCourse.endDate) : null} onChange={(date: Date | null) => { const newDate = date ? date.toISOString().split('T')[0] : ''; setEditingCourse(prev => prev ? { ...prev, endDate: newDate } : null) }} dateFormat="yyyy/MM/dd" className="w-full p-2.5 pl-10 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholderText="YYYY/MM/DD" required wrapperClassName="w-full" />
                                        <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">授課方式 <span className="text-red-500">*</span></label>
                                    <Dropdown
                                        value={editingCourse.teachingMethod}
                                        onChange={(value) => setEditingCourse(prev => prev ? { ...prev, teachingMethod: value as Course['teachingMethod'] } : null)}
                                        options={teachingMethods.map(method => ({ value: method, label: method }))}
                                        placeholder="選擇授課方式"
                                        className="w-full"
                                    />
                                </div>
                                {editingCourse.teachingMethod === '實體上課' && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">上課地點 <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input type="text" value={editingCourse.location} onChange={e => setEditingCourse(prev => prev ? { ...prev, location: e.target.value } : null)} className="w-full p-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required placeholder="例如：A棟 301 教室" />
                                            <MapPinIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        </div>
                                    </div>
                                )}
                                {editingCourse.teachingMethod === '線上上課' && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">直播網址 <span className="text-red-500">*</span></label>
                                        <input type="text" value={editingCourse.liveStreamURL} onChange={e => setEditingCourse(prev => prev ? { ...prev, liveStreamURL: e.target.value } : null)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required placeholder="https://..." />
                                    </div>
                                )}
                                {editingCourse.teachingMethod === '實體與線上同步上課' && (
                                    <>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">上課地點 <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <input type="text" value={editingCourse.location} onChange={e => setEditingCourse(prev => prev ? { ...prev, location: e.target.value } : null)} className="w-full p-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
                                                <MapPinIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                            </div>
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">直播網址 <span className="text-red-500">*</span></label>
                                            <input type="text" value={editingCourse.liveStreamURL} onChange={e => setEditingCourse(prev => prev ? { ...prev, liveStreamURL: e.target.value } : null)} className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" required />
                                        </div>
                                    </>
                                )}
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">上課時間安排 <span className="text-red-500">*</span></label>
                                    <Dropdown
                                        value={editingCourse.timeArrangementType}
                                        onChange={(value) => setEditingCourse(prev => prev ? { ...prev, timeArrangementType: value as Course['timeArrangementType'] } : null)}
                                        options={[{ value: '依時段安排', label: '依時段安排' }, { value: '依學年課程彈性安排', label: '依學年課程彈性安排' }, { value: '課程時間由學生自主安排', label: '課程時間由學生自主安排' }]}
                                        placeholder="選擇上課時間安排"
                                        className="w-full"
                                    />
                                </div>
                                {editingCourse.timeArrangementType === '依時段安排' && (
                                    <div className="md:col-span-2 space-y-3 bg-white p-4 rounded-lg border border-gray-200">
                                        <label className="block text-sm font-medium text-gray-700">設定上課時段</label>
                                        {(editingCourse.classTimes || []).map((time, index) => (
                                            <div key={index} className="flex flex-wrap items-center gap-2">
                                                <Dropdown
                                                    value={time.day}
                                                    onChange={(value) => updateClassTime(index, 'day', value)}
                                                    options={weekdays.map(day => ({ value: day, label: day }))}
                                                    placeholder="選擇星期"
                                                    className="min-w-[120px] flex-grow"
                                                />
                                                <div className="flex items-center gap-2 flex-grow">
                                                    <input type="time" value={time.startTime} onChange={e => updateClassTime(index, 'startTime', e.target.value)} className="p-2 border border-gray-300 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" step="300" />
                                                    <span className="text-gray-400">→</span>
                                                    <input type="time" value={time.endTime} onChange={e => updateClassTime(index, 'endTime', e.target.value)} className="p-2 border border-gray-300 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500" step="300" />
                                                </div>
                                                <button type="button" onClick={() => removeClassTime(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors">
                                                    <TrashIcon className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ))}
                                        <button type="button" onClick={addClassTime} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center mt-2">
                                            <PlusIcon className="w-4 h-4 mr-1" /> 新增時段
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 4: Status & Visibility */}
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                                <span className="w-1 h-4 bg-yellow-500 rounded-full mr-2"></span>
                                狀態與可見度
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">課程狀態 <span className="text-red-500">*</span></label>
                                    <Dropdown
                                        value={editingCourse.status}
                                        onChange={(value) => setEditingCourse(prev => prev ? { ...prev, status: value as Course['status'] } : null)}
                                        options={courseStatuses.map(s => ({ value: s, label: s }))}
                                        placeholder="選擇課程狀態"
                                        className="w-full"
                                    />
                                </div>
                                <div className="md:col-span-2 pt-2">
                                    <label className="inline-flex items-center cursor-pointer select-none">
                                        <input type="checkbox" checked={editingCourse.showInIntroduction} onChange={e => setEditingCourse(prev => prev ? { ...prev, showInIntroduction: e.target.checked } : null)} className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500" />
                                        <span className="ml-3 text-sm text-gray-700">將課程顯示在首頁的「課程介紹」中</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                            <button type="button" onClick={() => setEditingCourse(null)} disabled={isSubmitting} className="px-5 py-2.5 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 font-medium transition-colors">取消</button>
                            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium shadow-sm transition-colors flex items-center">
                                {isSubmitting && <LoadingSpinner size={16} color="white" className="mr-2" />}
                                {editingCourse.id && editingCourse.id !== 'new' ? '儲存更新' : '確認建立'}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Student List Modal */}
            {showStudentListModal && (
                <Modal open={!!showStudentListModal} onClose={() => setShowStudentListModal(null)} title={`「${showStudentListModal?.name}」學生清單`} size="lg">
                    <div className="p-1">
                        {loadingStudents ? (
                            <div className="flex justify-center p-12"><LoadingSpinner /></div>
                        ) : studentList.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {studentList.map(stu => (
                                    <div key={stu.id} className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold">
                                                {stu.name[0]}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900">{stu.name}</p>
                                                <p className="text-xs text-gray-500">{stu.studentId} • {stu.grade || '未設定'}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => handleRemoveStudentFromCourse(stu, showStudentListModal!)} 
                                            className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all"
                                            title="移除學生"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <UserGroupIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500">此課程尚無學生選修。</p>
                            </div>
                        )}
                    </div>
                </Modal>
            )}
        </div>
    );
}