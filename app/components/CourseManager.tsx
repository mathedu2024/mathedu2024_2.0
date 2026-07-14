'use client';
import React, { useState, useEffect } from 'react';
import MultiSelectDropdown from './MultiSelectDropdown';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { LoadingSpinner, PageLoadingArea, btnStyles, btnWithIconStyle, btnIcon, btnIconGap, tableActionStyles, tableActionRowWrap } from './ui';
import { createPortal } from 'react-dom';

import Swal from 'sweetalert2';
import Image from 'next/image';
import Dropdown from './ui/Dropdown';
import { removeCoursesFromEnrolledList } from '@/services/courseId';
import {
  fetchAdminCoursesList,
  fetchTeacherList,
  fetchStudentList,
  invalidateAdminCoursesList,
  invalidateStudentList,
} from '@/utils/teacherClientApi';
import RichTextEditor from '../../components/RichTextEditor';
import { courseListTableStyles, getCourseStatusColor } from './studentCourseListShared';

const customLinkIconOptions = [
  { value: 'LinkIcon', label: '預設連結' },
  { value: 'VideoCameraIcon', label: '視訊會議' },
  { value: 'DocumentTextIcon', label: '文件' },
  { value: 'FolderIcon', label: '資料夾' },
  { value: 'ChatBubbleLeftRightIcon', label: '討論區' },
];

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
  ArrowPathIcon,
  XMarkIcon,
  EyeIcon,
  LinkIcon,
  DocumentTextIcon,
  FolderIcon,
  ChatBubbleLeftRightIcon,
  VideoCameraIcon
} from '@heroicons/react/24/outline';

interface CourseManagerProps {
    onProcessingStateChange: (isProcessing: boolean) => void;
}

interface CustomLink {
  name: string;
  url: string;
  icon: string;
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
    customLinks?: CustomLink[];
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
            .then(data => setImages(data.images || []))
            .catch(() => setImages([]));
    }, []);
    return images;
}

const Modal = ({ open, onClose, title, size = 'md', children }: { open: boolean; onClose: () => void; title: string; size?: 'md' | 'lg' | 'xl'; children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  if (!open || !mounted) return null;
  const maxWidthClass = { md: 'max-w-lg', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size];
  
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60 transition-opacity" onClick={onClose}></div>
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidthClass} max-h-full sm:max-h-[90vh] flex flex-col overflow-hidden animate-bounce-in transform scale-100`}>
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 flex justify-between items-center text-white flex-shrink-0">
          <h3 className="text-xl font-bold flex items-center">{title}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
};

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

    const fetchCourses = async (options?: { bypassCache?: boolean }) => {
        try {
            if (options?.bypassCache) invalidateAdminCoursesList();
            const courses = await fetchAdminCoursesList<Course>();
            setCourses(Array.isArray(courses) ? courses : []);
        } catch {
            setCourses([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const fetchTeachers = async () => {
            try {
                let usersTeachers = await fetchTeacherList<{ role?: string[] | string; roles?: string[] | string; name?: string }>();
                usersTeachers = (Array.isArray(usersTeachers) ? usersTeachers : []).filter((t) => (
                    ((Array.isArray(t.role) && t.role.includes('teacher')) || t.role === 'teacher' || (Array.isArray(t.roles) && t.roles.includes('teacher')) || t.roles === 'teacher') &&
                    t.name && t.name.trim() !== ''
                ));
                setAllTeachers(usersTeachers as Teacher[]);
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
            const teacherUids = editingCourse.teachers || [];

            if (editingCourse.id && editingCourse.id !== 'new') {
                // Update existing course
                const finalCourseData = {
                    ...editingCourse,
                    name: editingCourse.name.trim(),
                    code: editingCourse.code.trim(),
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
                const trimmedName = editingCourse.name.trim();
                const trimmedCode = editingCourse.code.trim();
                const docId = `${trimmedName}(${trimmedCode})`;
                const finalCourseData = {
                    ...editingCourse,
                    name: trimmedName,
                    code: trimmedCode,
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
            await fetchCourses({ bypassCache: true });
        }
    };

    const handleEdit = async (course: Course) => {
        let fullCourse = { ...course };
        try {
            const res = await fetch(`/api/courses/classdata?courseId=${course.id}`);
            if (res.ok) {
                const data = await res.json();
                fullCourse.description = data.description ?? fullCourse.description;
                fullCourse.location = data.location ?? fullCourse.location;
                fullCourse.liveStreamURL = data.liveStreamURL ?? fullCourse.liveStreamURL;
                fullCourse.customLinks = data.customLinks ?? fullCourse.customLinks ?? [];
            }
        } catch (e) { }

        const courseWithDefaults: Course = {
            ...fullCourse,
            gradeTags: course.gradeTags || [],
            classTimes: course.classTimes || [],
            teachers: course.teachers || [],
            teacherUids: course.teacherUids || [],
            description: course.description || '',
            location: course.location || '',
            liveStreamURL: course.liveStreamURL || '',
            coverImageURL: course.coverImageURL || '',
            customLinks: fullCourse.customLinks || [],
            students: course.students || [],
            subjectTag: course.subjectTag || '',
            courseNature: course.courseNature || '',
            timeArrangementType: course.timeArrangementType || '依時段安排',
            startDate: course.startDate || '',
            endDate: course.endDate || '',
            status: course.status === '資料建置中...' ? '未開課' : (course.status || '未開課'),
            showInIntroduction: typeof course.showInIntroduction === 'boolean' ? course.showInIntroduction : true,
            archived: String(course.archived) === 'true',
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

            // --- 同步移除所有學生該門課程的紀錄 ---
            try {
                const allStudents = await fetchStudentList<{ enrolledCourses?: string[]; id: string } & Record<string, unknown>>();
                const courseKey = `${courseToDelete.name}(${courseToDelete.code})`;
                
                const syncPromises = (Array.isArray(allStudents) ? allStudents : [])
                    .filter((s) => s.enrolledCourses && (s.enrolledCourses.includes(id) || s.enrolledCourses.includes(courseKey)))
                    .map((s) => {
                        const newCourses = s.enrolledCourses!.filter((c: string) => c !== id && c !== courseKey);
                        return fetch('/api/student/save', {
                            method: 'POST',
                            body: JSON.stringify({ ...s, enrolledCourses: newCourses })
                        });
                    });
                await Promise.all(syncPromises);
                invalidateStudentList();
            } catch (syncError) {
                console.error('同步刪除學生端課程資料失敗:', syncError);
            }
            // --- 結束 ---

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
            await fetchCourses({ bypassCache: true });
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
            await fetchCourses({ bypassCache: true });
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
            await fetchCourses({ bypassCache: true });
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
            return matchesSearch && matchesGrade && matchesSubject && matchesCourseNature && (course.status === '已封存' || String(course.archived) === 'true');
        }

        return matchesSearch && matchesGrade && matchesSubject && matchesCourseNature && matchesStatus && String(course.archived) !== 'true';
    }).sort((a, b) => {
        const statuses = ['報名中', '開課中', '未開課', '已額滿', '已結束', '已封存', '資料建置中...'];
        const statusA = statuses.indexOf(a.status);
        const statusB = statuses.indexOf(b.status);
        const priorityA = statusA !== -1 ? statusA : 999;
        const priorityB = statusB !== -1 ? statusB : 999;

        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        const codeA = a.code || '';
        const codeB = b.code || '';
        

        const codeCompare = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
        
        if (codeCompare !== 0) return codeCompare;
        
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });

    const handleShowStudents = async (course: Course) => {
        console.log('showStudentListModal:', course);
        setShowStudentListModal(course);
        setStudentList([]);
        setLoadingStudents(true);
        try {
            const res = await fetch(`/api/course-student-list/list?courseId=${encodeURIComponent(course.id)}`);
            if (res.ok) {
                const roster = await res.json();
                setStudentList(Array.isArray(roster) ? roster : []);
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
            invalidateStudentList();
            const allStudents = await fetchStudentList<{
              id: string;
              enrolledCourses?: string[];
              studentId?: string;
              name?: string;
              account?: string;
              email?: string;
              grade?: string;
            }>();
            const targetStudent = (Array.isArray(allStudents) ? allStudents : []).find((s) => s.id === student.id);

            if (targetStudent) {
                const courseTarget = { id: course.id, name: course.name, code: course.code };
                const oldCourses = targetStudent.enrolledCourses || [];
                const newCourses = removeCoursesFromEnrolledList(oldCourses, [courseTarget]);

                if (newCourses.length !== oldCourses.length) {
                    const syncedCourses = await fetch('/api/course-student-list/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            studentId: student.id,
                            oldCourses,
                            newCourses,
                            studentInfo: {
                                id: targetStudent.studentId || targetStudent.id,
                                name: targetStudent.name,
                                account: targetStudent.account,
                                email: targetStudent.email,
                                studentId: targetStudent.studentId || targetStudent.id,
                                grade: targetStudent.grade,
                            },
                        }),
                    }).then(async (res) => {
                        if (!res.ok) throw new Error('移除失敗');
                        const data = await res.json();
                        return data.enrolledCourses || newCourses;
                    });

                    const updateRes = await fetch('/api/student/save', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ...targetStudent, enrolledCourses: syncedCourses }),
                    });
                    if (!updateRes.ok) throw new Error('移除失敗');
                }
            }

            setStudentList((prev) => prev.filter((s) => s.id !== student.id));
            invalidateStudentList();
                Swal.fire({
                    icon: 'success',
                    title: '移除成功',
                    text: `已將學生 ${student.name} 從課程中移除`,
                    confirmButtonColor: '#4f46e5',
                    customClass: { popup: 'rounded-2xl' }
                });
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

    const isEditingArchived = String(editingCourse?.archived) === 'true';
    const isStudentListArchived = showStudentListModal?.status === '已封存' || String(showStudentListModal?.archived) === 'true';

    return (
        <div className="page-shell w-full min-w-0 flex flex-col h-full animate-fade-in">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
                <div className="border-l-4 border-indigo-500 pl-4">
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
                        <UserGroupIcon className="h-8 w-8 text-indigo-600" />
                        課程管理
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">新增、編輯、管理所有課程</p>
                </div>
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
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 relative z-[60]">
                    <div className="flex flex-col md:flex-row gap-4 items-center">
                        <div className="relative w-full md:flex-1 min-w-0">
                            <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="搜尋名稱或代碼..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all text-sm"
                            />
                        </div>
                        <div className="w-full md:w-40 flex-shrink-0">
                            <Dropdown
                                value={selectedSubject}
                                onChange={setSelectedSubject}
                                options={[{ value: 'all', label: '全部科目' }, ...subjects.map(s => ({ value: s, label: s }))]}
                                className="w-full"
                            />
                        </div>
                        <div className="w-full md:w-40 flex-shrink-0">
                            <Dropdown
                                value={selectedGrade}
                                onChange={setSelectedGrade}
                                options={[{ value: 'all', label: '全部年級' }, ...grades.map(g => ({ value: g, label: g }))]}
                                className="w-full"
                            />
                        </div>
                        <div className="w-full md:w-40 flex-shrink-0">
                            <Dropdown
                                value={selectedCourseNature}
                                onChange={setSelectedCourseNature}
                                options={[{ value: 'all', label: '全部性質' }, ...courseNatures.map(n => ({ value: n, label: n }))]}
                                className="w-full"
                            />
                        </div>
                        <div className="w-full md:w-40 flex-shrink-0">
                            <Dropdown
                                value={selectedStatus}
                                onChange={setSelectedStatus}
                                options={[{ value: 'all', label: '全部狀態' }, ...courseStatuses.map(s => ({ value: s, label: s }))]}
                                className="w-full"
                            />
                        </div>
                        {!editingCourse && (
                            <button
                                onClick={() => setEditingCourse({ id: '', name: '', code: '', coverImageURL: '', description: '', teachingMethod: '實體上課', teachers: [], startDate: '', endDate: '', classTimes: [], status: '未開課', gradeTags: [], subjectTag: '', courseNature: '', showInIntroduction: true, timeArrangementType: '依時段安排', location: '', liveStreamURL: '', archived: false } as Course)}
                                className={`${btnWithIconStyle(btnStyles.primary)} w-full md:w-auto shrink-0`}
                            >
                                <PlusIcon className={`${btnIcon} ${btnIconGap}`} />
                                新增課程
                            </button>
                        )}
                    </div>
                </div>
            </div>


            {/* Course Grid View - REPLACED TABLE */}
            {loading ? (
                <PageLoadingArea minHeight="min-h-[400px]" className="flex-1" />
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
                        <div className="mb-8">
                            {/* Desktop View: Table */}
                            <div className={courseListTableStyles.desktop.wrapper}>
                                <table className={courseListTableStyles.desktop.table}>
                                    <thead className={courseListTableStyles.desktop.thead}>
                                        <tr>
                                            <th className={`${courseListTableStyles.desktop.th} min-w-[200px]`}>課程名稱與代碼</th>
                                            <th className={`${courseListTableStyles.desktop.th} min-w-[150px]`}>授課老師</th>
                                            <th className={`${courseListTableStyles.desktop.th} min-w-[180px]`}>上課期間</th>
                                            <th className={`${courseListTableStyles.desktop.th} text-center whitespace-nowrap`}>狀態</th>
                                            <th className={`${courseListTableStyles.desktop.th} text-right min-w-[180px]`}>操作</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredCourses.map(course => (
                                            <tr key={course.id} className={courseListTableStyles.desktop.row}>
                                                <td className="px-6 py-4">
                                                    <div className={`${courseListTableStyles.desktop.courseName} whitespace-nowrap overflow-hidden text-ellipsis`}>
                                                        {course.name}
                                                        {String(course.archived) === 'true' && (
                                                            <span className="ml-2 text-xs font-medium text-red-500 border border-red-200 bg-red-50 px-1.5 py-0.5 rounded align-middle">已封存</span>
                                                        )}
                                                    </div>
                                                    <div className={courseListTableStyles.desktop.courseCode}>{course.code}</div>
                                                </td>
                                                <td className="px-6 py-4 max-w-[200px]">
                                                    {(() => {
                                                        const teacherNames = course.teachers
                                                            .map(tid => allTeachers.find(t => t.id === tid)?.name)
                                                            .filter((n): n is string => Boolean(n));
                                                        const displayNames = teacherNames.length > 0 ? teacherNames.join('、') : '未指定';
                                                        return (
                                                            <div className="flex items-center w-full">
                                                                <div className={courseListTableStyles.desktop.teacherAvatar}>
                                                                    {teacherNames[0]?.[0] || '師'}
                                                                </div>
                                                                <div className={courseListTableStyles.desktop.teacherName} title={displayNames}>
                                                                    {displayNames}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </td>
                                                <td className={courseListTableStyles.desktop.classTimesCell}>
                                                    <div className={`${courseListTableStyles.desktop.classTimes} flex flex-col gap-0.5`}>
                                                        <div className="flex items-center"><CalendarIcon className="w-3.5 h-3.5 mr-1 text-gray-400 shrink-0" /> {course.startDate}</div>
                                                        <div className="pl-4.5 text-gray-400">至 {course.endDate}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                                    <span className={`${courseListTableStyles.desktop.statusBadge} ${getCourseStatusColor(course.status)}`}>
                                                        {course.status}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    <div className={courseListTableStyles.desktop.actionRow}>
                                                        <button 
                                                            onClick={() => handleEdit(course)}
                                                            className={courseListTableStyles.desktop.actionPrimary}
                                                        >
                                                            {course.status === '已封存' || String(course.archived) === 'true' ? '查看' : '編輯'}
                                                        </button>
                                                        <button 
                                                            onClick={() => handleShowStudents(course)}
                                                            className={courseListTableStyles.desktop.actionSuccess}
                                                        >
                                                            名單
                                                        </button>
                                                        <button 
                                                            onClick={() => String(course.archived) === 'true' ? handleUnarchive(course.id) : handleArchive(course.id)}
                                                            className={courseListTableStyles.desktop.actionSecondary}
                                                        >
                                                            {String(course.archived) === 'true' ? '取消封存' : '封存'}
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDelete(course.id)}
                                                            className={courseListTableStyles.desktop.actionDanger}
                                                            disabled={course.status === '已封存' || String(course.archived) === 'true'}
                                                        >
                                                            刪除
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile View: Cards */}
                            <div className={courseListTableStyles.mobile.wrapper}>
                                {filteredCourses.map(course => (
                                    <div key={course.id} className={courseListTableStyles.mobile.card}>
                                        <div className="mb-2">
                                            <div className={courseListTableStyles.mobile.courseName}>{course.name}</div>
                                        </div>
                                        <div className={courseListTableStyles.mobile.courseCode}>{course.code}</div>
                                        <div className="mb-4">
                                            <span className={`${courseListTableStyles.mobile.statusBadge} ${getCourseStatusColor(course.status)}`}>
                                                {course.status}
                                            </span>
                                        </div>
                                        <div className={`${tableActionRowWrap} flex-wrap`}>
                                            <button 
                                                onClick={() => handleEdit(course)}
                                                className={tableActionStyles.primary}
                                            >
                                                {course.status === '已封存' || String(course.archived) === 'true' ? '查看' : '編輯'}
                                            </button>
                                            <button 
                                                onClick={() => handleShowStudents(course)}
                                                className={tableActionStyles.success}
                                            >
                                                名單
                                            </button>
                                            <button 
                                                onClick={() => String(course.archived) === 'true' ? handleUnarchive(course.id) : handleArchive(course.id)}
                                                className={tableActionStyles.secondary}
                                            >
                                                {String(course.archived) === 'true' ? '取消封存' : '封存'}
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(course.id)}
                                                className={tableActionStyles.danger}
                                                disabled={course.status === '已封存' || String(course.archived) === 'true'}
                                            >
                                                刪除
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
                <Modal open={!!editingCourse} onClose={() => setEditingCourse(null)} title={editingCourse.id && editingCourse.id !== 'new' ? (isEditingArchived ? '查看課程' : '編輯課程') : '新增課程'} size="lg">
                    <form onSubmit={handleSaveCourse} className="flex flex-col flex-1 overflow-hidden">
                        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar pb-6">
                        {isEditingArchived && (
                            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm">
                                <span className="font-bold mr-2">提示：</span>
                                此為封存課程，僅供檢視。若要修改請先取消封存。
                            </div>
                        )}
                        {/* Section 1: Basic Info */}
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 relative z-[40] hover:z-[50] focus-within:z-[50]">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                                <span className="w-1 h-4 bg-indigo-500 rounded-full mr-2"></span>
                                基本資訊
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="relative z-[30]">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">課程名稱 <span className="text-red-500">*</span></label>
                                    <input type="text" value={editingCourse.name} onChange={e => setEditingCourse(prev => prev ? { ...prev, name: e.target.value } : null)} className={`w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${editingCourse.id && editingCourse.id !== 'new' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} required readOnly={!!(editingCourse.id && editingCourse.id !== 'new')} placeholder="輸入課程名稱" />
                                </div>
                                <div className="relative z-[30]">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">課程代碼 <span className="text-red-500">*</span></label>
                                    <input type="text" value={editingCourse.code} onChange={e => setEditingCourse(prev => prev ? { ...prev, code: e.target.value } : null)} className={`w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all ${editingCourse.id && editingCourse.id !== 'new' ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} required readOnly={!!(editingCourse.id && editingCourse.id !== 'new')} placeholder="例: M20240901" />
                                </div>
                                {editingCourse.id && editingCourse.id !== 'new' && (
                                    <div className="md:col-span-2 text-xs text-amber-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200 relative z-[20]">
                                        注意：課程名稱與代碼建立後即作為系統唯一識別碼，不可修改。若需變更，請刪除舊課程後重新建立。
                                    </div>
                                )}
                                <div className={`md:col-span-2 relative z-[10] ${isEditingArchived ? 'pointer-events-none opacity-60' : ''}`}>
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
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 relative z-[30] hover:z-[50] focus-within:z-[50]">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                                <span className="w-1 h-4 bg-purple-500 rounded-full mr-2"></span>
                                內容與分類
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className={`md:col-span-2 relative z-[50] ${isEditingArchived ? 'pointer-events-none opacity-60' : ''}`}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">課程性質 <span className="text-red-500">*</span></label>
                                        <Dropdown
                                            value={editingCourse.courseNature}
                                            onChange={(value) => setEditingCourse(prev => prev ? { ...prev, courseNature: value } : null)}
                                            options={courseNatures.map(n => ({ value: n, label: n }))}
                                            placeholder="選擇課程性質"
                                            className="w-full"
                                        />
                                </div>
                                <div className="md:col-span-2 relative z-[40]">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">適用年級 <span className="text-red-500">*</span></label>
                                    <div className="flex flex-wrap gap-2">
                                        {grades.map(grade => {
                                            const isSelected = (editingCourse.gradeTags || []).includes(grade);
                                            return (
                                                <button
                                                    key={grade}
                                                    type="button"
                                                    disabled={isEditingArchived}
                                                    onClick={() => {
                                                        const currentGrades = editingCourse.gradeTags || [];
                                                        const newGrades = isSelected ? currentGrades.filter(g => g !== grade) : [...currentGrades, grade];
                                                        setEditingCourse(prev => prev ? { ...prev, gradeTags: newGrades } : null);
                                                    }}
                                                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                                        isSelected 
                                                        ? 'bg-indigo-100 text-indigo-700 ring-2 ring-indigo-500 ring-offset-1' 
                                                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                                                    } ${isEditingArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                                                >
                                                    {grade}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className={`md:col-span-2 relative z-[30] ${isEditingArchived ? 'pointer-events-none opacity-60' : ''}`}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">科目 <span className="text-red-500">*</span></label>
                                        <Dropdown
                                            value={editingCourse.subjectTag}
                                            onChange={(value) => setEditingCourse(prev => prev ? { ...prev, subjectTag: value } : null)}
                                            options={subjects.map(s => ({ value: s, label: s }))}
                                            placeholder="選擇科目"
                                            className="w-full"
                                        />
                                </div>
                                <div className="md:col-span-2 relative z-[20]">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">課程描述</label>
                                    <textarea 
                                        value={editingCourse.description} 
                                        onChange={e => setEditingCourse(prev => prev ? { ...prev, description: e.target.value } : null)} 
                                        className={`w-full p-3 border border-gray-300 rounded-lg h-48 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none ${isEditingArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} 
                                        disabled={isEditingArchived}
                                        placeholder="請描述課程內容、目標等..."
                                    ></textarea>
                                </div>
                                <div className="md:col-span-2 relative z-[10]">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">課程介紹封面圖片 <span className="text-red-500">*</span></label>
                                    <div className="flex gap-4 overflow-x-auto p-5 border border-gray-200 rounded-2xl bg-gray-50/50 shadow-inner no-scrollbar snap-x min-h-[300px] items-center">
                                        {courseImages.map(img => (
                                            <div key={img} className={`relative flex-shrink-0 w-48 h-48 sm:w-56 sm:h-56 rounded-xl overflow-hidden group border-2 transition-all snap-start shadow-md ${selectedImage === img ? 'border-indigo-500 ring-4 ring-indigo-100 scale-[0.98]' : 'border-white hover:border-indigo-200'} ${isEditingArchived ? 'cursor-default opacity-80' : 'cursor-pointer'}`} onClick={() => !isEditingArchived && setSelectedImage(img)}>
                                                <Image src={img} alt="課程圖片" fill className={`object-cover bg-white transition-transform duration-500 ${isEditingArchived ? '' : 'group-hover:scale-110'}`} sizes="(max-width: 768px) 192px, 224px" />
                                                {selectedImage === img && (
                                                    <div className="absolute inset-0 bg-indigo-600/30-[1px] flex items-center justify-center">
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
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 relative z-[20] hover:z-[50] focus-within:z-[50]">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                                <span className="w-1 h-4 bg-green-500 rounded-full mr-2"></span>
                                時間與地點
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="relative z-[50]">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">開始日期 <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <DatePicker disabled={isEditingArchived} selected={editingCourse.startDate ? new Date(editingCourse.startDate.replace(/-/g, '/')) : null} onChange={(date: Date | null) => { const newDate = date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : ''; setEditingCourse(prev => prev ? { ...prev, startDate: newDate } : null) }} dateFormat="yyyy/MM/dd" className={`w-full p-2.5 pl-10 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${isEditingArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} placeholderText="YYYY/MM/DD" required wrapperClassName="w-full" />
                                        <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                                <div className="relative z-[50]">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">結束日期 <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <DatePicker disabled={isEditingArchived} selected={editingCourse.endDate ? new Date(editingCourse.endDate.replace(/-/g, '/')) : null} onChange={(date: Date | null) => { const newDate = date ? new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0] : ''; setEditingCourse(prev => prev ? { ...prev, endDate: newDate } : null) }} dateFormat="yyyy/MM/dd" className={`w-full p-2.5 pl-10 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 ${isEditingArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} placeholderText="YYYY/MM/DD" required wrapperClassName="w-full" />
                                        <CalendarIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>
                                </div>
                                <div className={`md:col-span-2 relative z-[40] ${isEditingArchived ? 'pointer-events-none opacity-60' : ''}`}>
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
                                    <div className="md:col-span-2 relative z-[35]">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">上課地點 <span className="text-red-500">*</span></label>
                                        <div className="relative">
                                            <input type="text" disabled={isEditingArchived} value={editingCourse.location} onChange={e => setEditingCourse(prev => prev ? { ...prev, location: e.target.value } : null)} className={`w-full p-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${isEditingArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} required placeholder="例如：A棟 301 教室" />
                                            <MapPinIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        </div>
                                    </div>
                                )}
                                {editingCourse.teachingMethod === '線上上課' && (
                                    <div className="md:col-span-2 relative z-[35]">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">直播網址 <span className="text-red-500">*</span></label>
                                        <input type="text" disabled={isEditingArchived} value={editingCourse.liveStreamURL} onChange={e => setEditingCourse(prev => prev ? { ...prev, liveStreamURL: e.target.value } : null)} className={`w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${isEditingArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} required placeholder="https://..." />
                                    </div>
                                )}
                                {editingCourse.teachingMethod === '實體與線上同步上課' && (
                                    <>
                                        <div className="md:col-span-2 relative z-[35]">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">上課地點 <span className="text-red-500">*</span></label>
                                            <div className="relative">
                                                <input type="text" disabled={isEditingArchived} value={editingCourse.location} onChange={e => setEditingCourse(prev => prev ? { ...prev, location: e.target.value } : null)} className={`w-full p-2.5 pl-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${isEditingArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} required />
                                                <MapPinIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                            </div>
                                        </div>
                                        <div className="md:col-span-2 relative z-[34]">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">直播網址 <span className="text-red-500">*</span></label>
                                            <input type="text" disabled={isEditingArchived} value={editingCourse.liveStreamURL} onChange={e => setEditingCourse(prev => prev ? { ...prev, liveStreamURL: e.target.value } : null)} className={`w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none ${isEditingArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} required />
                                        </div>
                                    </>
                                )}
                                <div className={`md:col-span-2 relative z-[32] ${isEditingArchived ? 'pointer-events-none opacity-60' : ''}`}>
                                  <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-gray-700">自訂連結按鈕</label>
                                    <button type="button" onClick={() => setEditingCourse(prev => prev ? { ...prev, customLinks: [...(prev.customLinks || []), { name: '', url: '', icon: 'LinkIcon' }] } : null)} disabled={isEditingArchived} className="text-indigo-600 text-xs font-bold hover:text-indigo-800 flex items-center">
                                      <PlusIcon className="w-4 h-4 mr-1" /> 新增連結
                                    </button>
                                  </div>
                                  <div className="space-y-3 bg-white p-3 rounded-lg border border-gray-200">
                                    {(editingCourse.customLinks || []).map((link, idx) => (
                                      <div key={idx} className="flex gap-2 items-center">
                                        <div className={`w-36 ${isEditingArchived ? 'pointer-events-none opacity-60' : ''}`}>
                                          <Dropdown
                                            value={link.icon}
                                            onChange={(icon) => {
                                              const newLinks = [...(editingCourse.customLinks || [])];
                                              newLinks[idx] = { ...newLinks[idx], icon };
                                              setEditingCourse(prev => prev ? { ...prev, customLinks: newLinks } : null);
                                            }}
                                            options={customLinkIconOptions}
                                            placeholder="圖示"
                                            buttonClassName="py-2 text-sm h-10"
                                          />
                                        </div>
                                        <input 
                                          type="text" 
                                          placeholder="按鈕名稱" 
                                          value={link.name} 
                                          disabled={isEditingArchived}
                                          onChange={(e) => {
                                            const newLinks = [...(editingCourse.customLinks || [])];
                                            newLinks[idx] = { ...newLinks[idx], name: e.target.value };
                                            setEditingCourse(prev => prev ? { ...prev, customLinks: newLinks } : null);
                                          }}
                                          className="w-1/3 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 outline-none h-10"
                                        />
                                        <input 
                                          type="url" 
                                          placeholder="網址 (URL)" 
                                          value={link.url} 
                                          disabled={isEditingArchived}
                                          onChange={(e) => {
                                            const newLinks = [...(editingCourse.customLinks || [])];
                                            newLinks[idx] = { ...newLinks[idx], url: e.target.value };
                                            setEditingCourse(prev => prev ? { ...prev, customLinks: newLinks } : null);
                                          }}
                                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 outline-none h-10"
                                        />
                                        {!isEditingArchived && (
                                            <button type="button" onClick={() => {
                                                const newLinks = [...(editingCourse.customLinks || [])];
                                                newLinks.splice(idx, 1);
                                                setEditingCourse(prev => prev ? { ...prev, customLinks: newLinks } : null);
                                            }} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg">
                                            <TrashIcon className="w-4 h-4" />
                                            </button>
                                        )}
                                      </div>
                                    ))}
                                    {!(editingCourse.customLinks && editingCourse.customLinks.length > 0) && (
                                      <div className="text-sm text-gray-400 italic py-1">尚無自訂連結</div>
                                    )}
                                  </div>
                                </div>
                                <div className={`md:col-span-2 relative z-[30] ${isEditingArchived ? 'pointer-events-none opacity-60' : ''}`}>
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
                                    <div className="md:col-span-2 space-y-3 bg-white p-4 rounded-lg border border-gray-200 relative z-[20]">
                                        <label className="block text-sm font-medium text-gray-700">設定上課時段</label>
                                        {(editingCourse.classTimes || []).map((time, index) => (
                                            <div key={index} className="flex flex-wrap items-center gap-2 relative" style={{ zIndex: 50 - index }}>
                                                <div className={`min-w-[120px] flex-grow ${isEditingArchived ? 'pointer-events-none opacity-60' : ''}`}>
                                                    <Dropdown
                                                        value={time.day}
                                                        onChange={(value) => updateClassTime(index, 'day', value)}
                                                        options={weekdays.map(day => ({ value: day, label: day }))}
                                                        placeholder="選擇星期"
                                                        className="w-full"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2 flex-grow">
                                                    <input type="time" disabled={isEditingArchived} value={time.startTime} onChange={e => updateClassTime(index, 'startTime', e.target.value)} className={`p-2 border border-gray-300 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500 ${isEditingArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} step="300" />
                                                    <span className="text-gray-400">→</span>
                                                    <input type="time" disabled={isEditingArchived} value={time.endTime} onChange={e => updateClassTime(index, 'endTime', e.target.value)} className={`p-2 border border-gray-300 rounded-lg w-full outline-none focus:ring-2 focus:ring-indigo-500 ${isEditingArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`} step="300" />
                                                </div>
                                                {!isEditingArchived && (
                                                    <button type="button" onClick={() => removeClassTime(index)} className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors">
                                                        <TrashIcon className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {!isEditingArchived && (
                                            <button type="button" onClick={addClassTime} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center mt-2">
                                                <PlusIcon className="w-4 h-4 mr-1" /> 新增時段
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Section 4: Status & Visibility */}
                        <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100 relative z-[10] hover:z-[50] focus-within:z-[50]">
                            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                                <span className="w-1 h-4 bg-yellow-500 rounded-full mr-2"></span>
                                狀態與可見度
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className={`relative z-[20] ${isEditingArchived ? 'pointer-events-none opacity-60' : ''}`}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">課程狀態 <span className="text-red-500">*</span></label>
                                        <Dropdown
                                            value={editingCourse.status}
                                            onChange={(value) => setEditingCourse(prev => prev ? { ...prev, status: value as Course['status'] } : null)}
                                            options={courseStatuses.map(s => ({ value: s, label: s }))}
                                            placeholder="選擇課程狀態"
                                            className="w-full"
                                        />
                                </div>
                                <div className="md:col-span-2 pt-2 relative z-[10]">
                                    <label className={`inline-flex items-center select-none ${isEditingArchived ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}>
                                        <input type="checkbox" disabled={isEditingArchived} checked={editingCourse.showInIntroduction} onChange={e => setEditingCourse(prev => prev ? { ...prev, showInIntroduction: e.target.checked } : null)} className={`w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 accent-indigo-600 ${isEditingArchived ? 'cursor-not-allowed' : 'cursor-pointer'}`} />
                                        <span className="ml-3 text-sm text-gray-700">將課程顯示在首頁的「課程介紹」中</span>
                                    </label>
                                </div>
                            </div>
                        </div>
                        </div>

                        <div className="p-4 bg-gray-50 border-t border-gray-100 flex gap-2 flex-shrink-0">
                            <button type="button" onClick={() => setEditingCourse(null)} disabled={isSubmitting} className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
                                {isEditingArchived ? '關閉' : '取消'}
                            </button>
                            {!isEditingArchived && (
                                <button type="submit" disabled={isSubmitting} className="flex-1 bg-indigo-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors flex items-center justify-center disabled:opacity-50">
                                    {isSubmitting && <LoadingSpinner size={16} color="white" className="mr-2" />}
                                    {editingCourse.id && editingCourse.id !== 'new' ? '儲存更新' : '確認建立'}
                                </button>
                            )}
                        </div>
                    </form>
                </Modal>
            )}

            {/* Student List Modal */}
            {showStudentListModal && (
                <Modal open={!!showStudentListModal} onClose={() => setShowStudentListModal(null)} title={`「${showStudentListModal?.name}」學生清單`} size="lg">
                    <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                        {isStudentListArchived && (
                            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-4">
                                <span className="font-bold mr-2">提示：</span>
                                此課程已封存，您只能查看名單，無法移除學生。
                            </div>
                        )}
                        {loadingStudents ? (
                            <PageLoadingArea minHeight="min-h-[200px]" />
                        ) : studentList.length > 0 ? (
                            <div className="border border-gray-200 rounded-xl overflow-hidden">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="bg-gray-50 text-xs text-gray-700 uppercase border-b border-gray-200">
                                        <tr>
                                            <th className="px-6 py-3 font-bold">姓名</th>
                                            <th className="px-4 py-3 font-bold">學號</th>
                                            <th className="px-4 py-3 font-bold">年級</th>
                                            {!isStudentListArchived && (
                                                <th className="px-6 py-3 font-bold text-right">操作</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {studentList.map((stu) => (
                                            <tr key={stu.id} className="hover:bg-indigo-50/30 transition-colors">
                                                <td className="px-6 py-3">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className={courseListTableStyles.desktop.teacherAvatar}>
                                                            {stu.name[0] || '生'}
                                                        </div>
                                                        <span className="font-medium text-gray-900 truncate">{stu.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap font-mono text-gray-600">{stu.studentId}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-600">{stu.grade || '未設定'}</td>
                                                {!isStudentListArchived && (
                                                    <td className="px-6 py-3 text-right whitespace-nowrap">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveStudentFromCourse(stu, showStudentListModal!)}
                                                            className={tableActionStyles.danger}
                                                            title="移除學生"
                                                        >
                                                            移除
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                <UserGroupIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                <p className="text-gray-500">此課程尚無學生選修。</p>
                            </div>
                        )}
                    </div>
                    <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2 flex-shrink-0">
                        <button onClick={() => setShowStudentListModal(null)} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 shadow-sm transition-colors">
                            關閉
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}