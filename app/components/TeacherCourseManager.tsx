'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import "react-datepicker/dist/react-datepicker.css";
import Swal from '@/utils/swalTheme';
import { LoadingSpinner, PageLoadingArea, BackButton, btnStyles, btnWithIconStyle, btnIcon, btnIconGap, tableActionStyles, tableActionRowWrap, TabNav } from './ui';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided } from '@hello-pangea/dnd';
import { fixDraggableStyle } from '@/utils/dndStyle';
import { 
  PlusIcon, 
  TrashIcon, 
  BookOpenIcon,
  CloudArrowUpIcon,
  Bars3Icon,
  XMarkIcon,
  PaperClipIcon,
  LinkIcon,
  VideoCameraIcon,
  ClockIcon,
  EyeIcon,
  EyeSlashIcon,
  MegaphoneIcon,
  DocumentTextIcon,
  FolderIcon,
  ChatBubbleLeftRightIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  DocumentDuplicateIcon,
  CalendarDaysIcon,
  ChartBarIcon,
  PencilSquareIcon,
  InformationCircleIcon,
  BoltIcon,
} from '@heroicons/react/24/outline';
import CourseFilter from './CourseFilter';
import Dropdown from './ui/Dropdown';
import { getCourseStatusColor, courseListTableStyles, filterAndSortCoursesForList } from './studentCourseListShared';
import { formatCourseDateForDisplay } from '@/services/courseDate';
import { filterQuizzesForCourse } from '@/services/gradeQuizImport';
import { normalizeLessonAssignedQuizzes, getOrphanedLessonQuizzes, filterLessonAssignedQuizzes, type LessonAssignedQuiz } from '@/services/lessonQuiz';
import type { Quiz } from '@/services/quizTypes';
import { normalizeAssignedCourses, validateQuizForPublish } from '@/services/quizTypes';
import RichTextEditor from '../../components/RichTextEditor';
import { examDetailPath, examCreatePath } from '@/utils/examRoutes';
import { surveyDetailPath, surveyCreatePath } from '@/utils/surveyRoutes';
import { teacherCourseHubPath } from '@/utils/teacherCourseHub';
import { openTeacherCoursePreviewInNewTab } from '@/utils/teacherCoursePreview';
import { openTeacherCourseInteractInNewTab } from '@/utils/teacherCourseInteract';
import {
  invalidateTeacherQuizzes,
  invalidateQuizByCode,
  fetchTeacherQuizzes,
  fetchTeacherSurveys,
  invalidateTeacherSurveys,
  invalidateSurveyByCode,
  fetchCoursesByTeacherId,
  fetchTeacherCourseLessons,
  invalidateTeacherCourseLessons,
} from '@/utils/teacherClientApi';
import type { Survey } from '@/services/surveyTypes';
import {
  filterSurveysForCourse,
  formatSurveyResponseMode,
  validateSurveyForPublish,
  normalizeAssignedCourses as normalizeSurveyAssignedCourses,
} from '@/services/surveyTypes';
import CourseHubTabNav, {
  TEACHER_COURSE_HUB_TAB_IDS,
  CourseHubFeatureIcon,
} from './CourseHubTabNav';
import StudentVisibilityToggle, { isStudentVisible } from './StudentVisibilityToggle';

const GradeManager = dynamic(() => import('./GradeManager'), { ssr: false });
const AttendanceManagementComponent = dynamic(() => import('./AttendanceManagementComponent'), { ssr: false });

const TEACHER_COURSE_TABS = TEACHER_COURSE_HUB_TAB_IDS;
type TeacherCourseTab = (typeof TEACHER_COURSE_TABS)[number];

function parseTeacherCourseTab(value: string | null | undefined): TeacherCourseTab {
  if (value && (TEACHER_COURSE_TABS as readonly string[]).includes(value)) {
    return value as TeacherCourseTab;
  }
  return 'lessons';
}

function buildTeacherCourseTabUrl(courseCode: string, tab: TeacherCourseTab): string {
  return teacherCourseHubPath(courseCode, tab);
}

const customLinkIconOptions = [
  { value: 'LinkIcon', label: '預設連結' },
  { value: 'VideoCameraIcon', label: '視訊會議' },
  { value: 'DocumentTextIcon', label: '文件' },
  { value: 'FolderIcon', label: '資料夾' },
  { value: 'ChatBubbleLeftRightIcon', label: '討論區' },
];

// --- 1. 共用 Modal 元件 (給 LessonManager 使用) ---
const Modal = ({ open, onClose, title, size = 'md', children }: { open: boolean; onClose: () => void; title: string; size?: 'md' | 'lg' | 'xl'; children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  if (!open || !mounted) return null;

  const maxWidthClass = { md: 'max-w-lg', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size];
   
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidthClass} max-h-full sm:max-h-[90vh] flex flex-col overflow-hidden animate-bounce-in border border-gray-100`}>
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 flex justify-between items-center text-white flex-shrink-0">
          <h3 className="text-xl font-bold flex items-center">{title}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-white">{children}</div>
      </div>
    </div>,
    document.body
  );
};

// --- 2. 型別定義 ---
interface UserInfo {
  id: string;
  name: string;
  account: string;
  role: '管理員' | '老師' | '學生';
}

interface Teacher {
  id: string;
  name: string;
  account: string;
  uid?: string;
}

interface LessonAttachment {
  name: string;
  url: string;
  visibleToStudents?: boolean;
}

interface CustomLink {
  name: string;
  url: string;
  icon: string;
}

interface CourseAnnouncement {
  id: string;
  title: string;
  content: string;
  links: { name: string; url: string }[];
  createdAt: string;
  /** 開放＝學生可見；隱藏＝學生端不顯示（未設視為開放，相容舊資料） */
  visibleToStudents?: boolean;
  /** 最近一次對學生開放的時間 */
  visiblePublishedAt?: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  status: '未開課' | '報名中' | '開課中' | '已額滿' | '已結束' | '已封存' | '資料建置中...';
  gradeTags: string[];
  subjectTag: string;
  startDate: string; 
  endDate: string;
  teachers: string[];
  description: string;
  classTimes: Record<string, unknown>[];
  teachingMethod: string;
  courseNature: string;
  location: string;
  liveStreamURL: string;
  students: Student[];
  showInIntroduction: boolean;
  archived: boolean;
  coverImageURL?: string;
  customLinks?: CustomLink[];
  announcements?: CourseAnnouncement[];
}

interface TeacherCourseManagerProps {
  userInfo: UserInfo | null;
  courses?: Course[];
  courseCodeFromUrl?: string;
  tabFromUrl?: string;
}

interface LessonData {
  id: string;
  title: string;
  date: string;
  visibleToStudents?: boolean;
  /** 最近一次對學生開放的時間 */
  visiblePublishedAt?: string;
  progress: string;
  attachments?: LessonAttachment[];
  noAttachment?: boolean;
  videos?: string[];
  homework?: string;
  noHomework?: boolean;
  onlineExam?: string;
  assignedQuizzes?: LessonAssignedQuiz[];
  /** @deprecated 儲存時仍寫入以相容舊資料 */
  assignedQuizCodes?: string[];
  /** @deprecated 儲存時仍寫入以相容舊資料 */
  requireQuizBeforeVideo?: boolean;
  noOnlineExam?: boolean;
  examScope?: string;
  noExamScope?: boolean;
  notes?: string;
  noNotes?: boolean;
  order?: number;
  createdAt?: { seconds: number };
  updatedAt?: { seconds: number };
}

interface Student {
  id: string; 
  studentId: string; 
  name: string; 
  grade: string;
}

interface ClassTime {
  day: string;
  startTime: string;
  endTime: string;
}

// 課堂管理元件
const emptyLessonForm = (): Omit<LessonData, 'id' | 'order' | 'createdAt' | 'updatedAt'> => ({
  title: '',
  date: '',
  visibleToStudents: true,
  progress: '',
  attachments: [{ name: '', url: '', visibleToStudents: true }],
  noAttachment: false,
  videos: [''],
  homework: '',
  noHomework: false,
  onlineExam: '',
  assignedQuizzes: [],
  noOnlineExam: false,
  examScope: '',
  noExamScope: false,
  notes: '',
  noNotes: false,
});

function LessonManager({
  courseId,
  courseName,
  courseCode,
  teacherId,
  onClose,
  isArchived = false,
  embedded = false,
}: {
  courseId: string;
  courseName: string;
  courseCode: string;
  teacherId: string;
  onClose: () => void;
  isArchived?: boolean;
  embedded?: boolean;
}) {
  const [lessons, setLessons] = useState<LessonData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonData | null>(null);
  const [courseQuizzes, setCourseQuizzes] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);

  const [form, setForm] = useState<Omit<LessonData, 'id' | 'order' | 'createdAt' | 'updatedAt'>>(emptyLessonForm());

  const [isOrderDirty, setIsOrderDirty] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLessons = useCallback(async () => {
    setIsLoading(true);
    try {
      const lessons = await fetchTeacherCourseLessons(courseId);
      const sortedLessons = Array.isArray(lessons)
        ? (lessons as LessonData[]).sort((a, b) => {
            const aOrder = typeof a.order === 'number' ? a.order : 9999;
            const bOrder = typeof b.order === 'number' ? b.order : 9999;
            if (aOrder === 9999 && bOrder === 9999) return (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0);
            return aOrder - bOrder;
          })
        : [];
      setLessons(sortedLessons);
    } catch {
      Swal.fire('錯誤', '讀取課堂失敗', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) fetchLessons();
  }, [courseId, fetchLessons]);

  useEffect(() => {
    if (!isModalOpen || !teacherId || !courseId) return;

    let cancelled = false;
    setQuizzesLoading(true);
    fetchTeacherQuizzes(teacherId)
      .then((quizzes) => {
        if (!cancelled) {
          setCourseQuizzes(filterQuizzesForCourse(quizzes, courseId, { publishedOnly: false }));
        }
      })
      .catch(() => {
        if (!cancelled) setCourseQuizzes([]);
      })
      .finally(() => {
        if (!cancelled) setQuizzesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isModalOpen, teacherId, courseId]);

  const validCourseQuizCodes = useMemo(
    () => new Set(courseQuizzes.map((q) => q.quizCode)),
    [courseQuizzes]
  );

  const orphanedAssignedQuizzes = useMemo(
    () => getOrphanedLessonQuizzes(form.assignedQuizzes ?? [], validCourseQuizCodes),
    [form.assignedQuizzes, validCourseQuizCodes]
  );

  const toggleAssignedQuiz = (quizCode: string, checked: boolean) => {
    setForm((f) => {
      const current = f.assignedQuizzes ?? [];
      const next = checked
        ? current.some((q) => q.quizCode === quizCode)
          ? current
          : [...current, { quizCode, requireBeforeVideo: false }]
        : current.filter((q) => q.quizCode !== quizCode);
      return {
        ...f,
        assignedQuizzes: next,
        noOnlineExam: next.length === 0 && !f.onlineExam?.trim(),
      };
    });
  };

  const toggleQuizRequireBeforeVideo = (quizCode: string, checked: boolean) => {
    setForm((f) => ({
      ...f,
      assignedQuizzes: (f.assignedQuizzes ?? []).map((q) =>
        q.quizCode === quizCode ? { ...q, requireBeforeVideo: checked } : q
      ),
    }));
  };

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    const items = Array.from(lessons);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);
    setLessons(items.map((item, index) => ({ ...item, order: index })));
    setIsOrderDirty(true);
  };

  const handleSaveChanges = async () => {
    setIsSubmitting(true);
    try {
      if (isOrderDirty) {
        await fetch('/api/lessons/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, order: lessons.map(l => l.id) })
        });
      }
      Swal.fire('成功', '變更已儲存', 'success');
      setIsOrderDirty(false);
      invalidateTeacherCourseLessons(courseId);
    } catch {
      Swal.fire('錯誤', '儲存變更失敗', 'error');
    } finally {
      await fetchLessons();
      setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setEditingLesson(null);
    setForm(emptyLessonForm());
    setIsModalOpen(true);
  };

  const handleEditClick = (lesson: LessonData) => {
    const normalizedAttachments = (lesson.attachments || [{ name: '', url: '', visibleToStudents: true }]).map((att, idx) => {
      if (typeof att === 'string') {
        return { name: `附件${idx + 1}`, url: att, visibleToStudents: true };
      }
      return {
        name: att?.name || `附件${idx + 1}`,
        url: att?.url || '',
        visibleToStudents: att?.visibleToStudents !== false,
      };
    });
    const assignedQuizzes = normalizeLessonAssignedQuizzes(lesson);
    setEditingLesson(lesson);
    setForm({
      title: lesson.title,
      date: lesson.date,
      visibleToStudents: lesson.visibleToStudents !== false,
      progress: lesson.progress,
      attachments: normalizedAttachments,
      noAttachment: lesson.noAttachment || false,
      videos: lesson.videos || [''],
      homework: lesson.homework || '',
      noHomework: lesson.noHomework || false,
      onlineExam: lesson.onlineExam || '',
      assignedQuizzes,
      noOnlineExam: lesson.noOnlineExam || (assignedQuizzes.length === 0 && !lesson.onlineExam?.trim()),
      examScope: lesson.examScope || '',
      noExamScope: lesson.noExamScope || false,
      notes: lesson.notes || '',
      noNotes: lesson.noNotes || false,
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async () => {
    setIsSubmitting(true);
    try {
      const assignedQuizzes = form.noOnlineExam
        ? []
        : filterLessonAssignedQuizzes(
            (form.assignedQuizzes ?? []).filter((q) => q.quizCode?.trim()),
            validCourseQuizCodes
          );
      const assignedQuizCodes = assignedQuizzes.map((q) => q.quizCode);
      const lessonData = {
        ...form,
        attachments: (form.attachments || [])
          .filter((a) => a.url && a.url.trim() !== '')
          .map((a, idx) => ({
            name: a.name?.trim() ? a.name.trim() : `附件${idx + 1}`,
            url: a.url.trim(),
            visibleToStudents: a.visibleToStudents !== false,
          })),
        assignedQuizzes,
        assignedQuizCodes,
        requireQuizBeforeVideo: assignedQuizzes.some((q) => q.requireBeforeVideo),
        onlineExam: assignedQuizzes.length > 0 ? '' : form.onlineExam?.trim() ?? '',
        noOnlineExam:
          form.noOnlineExam ||
          (assignedQuizzes.length === 0 && !form.onlineExam?.trim()),
        updatedAt: new Date().toISOString(),
        ...(form.visibleToStudents !== false
          ? {
              visiblePublishedAt:
                editingLesson && isStudentVisible(editingLesson.visibleToStudents)
                  ? editingLesson.visiblePublishedAt || new Date().toISOString()
                  : new Date().toISOString(),
            }
          : { visiblePublishedAt: null }),
      };

      if (editingLesson) {
        await fetch('/api/lessons/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, lessonId: editingLesson.id, ...lessonData }) });
      } else {
        await fetch('/api/lessons/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, ...lessonData, createdAt: new Date().toISOString() }) });
      }
      invalidateTeacherCourseLessons(courseId);
      setIsModalOpen(false); setEditingLesson(null); await fetchLessons();
      Swal.fire('成功', editingLesson ? '課堂已更新' : '課堂已新增', 'success');
    } catch { Swal.fire('錯誤', '操作失敗', 'error'); } finally { setIsSubmitting(false); }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    const result = await Swal.fire({ title: '請確認', text: '確定要刪除此課堂嗎？', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: '刪除', cancelButtonText: '取消', customClass: { popup: 'rounded-2xl' } });
    if (!result.isConfirmed) return;
    try {
      await fetch('/api/lessons/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, lessonId }) });
      invalidateTeacherCourseLessons(courseId);
      setLessons(lessons.filter(l => l.id !== lessonId));
      Swal.fire('已刪除', '課堂已移除', 'success');
    } catch { Swal.fire('錯誤', '刪除失敗', 'error'); }
  };

  const handleToggleLessonVisibility = async (lesson: LessonData) => {
    const nextVisible = !(lesson.visibleToStudents !== false);
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/lessons/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          lessonId: lesson.id,
          visibleToStudents: nextVisible,
          ...(nextVisible
            ? { visiblePublishedAt: new Date().toISOString() }
            : { visiblePublishedAt: null }),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      invalidateTeacherCourseLessons(courseId);
      setLessons((prev) =>
        prev.map((l) =>
          l.id === lesson.id
            ? {
                ...l,
                visibleToStudents: nextVisible,
                ...(nextVisible
                  ? { visiblePublishedAt: new Date().toISOString() }
                  : { visiblePublishedAt: undefined }),
              }
            : l
        )
      );
      Swal.fire('成功', `已${nextVisible ? '開放' : '隱藏'}此課堂給學生查看。`, 'success');
    } catch (error) {
      console.error('更新課堂可見性失敗:', error);
      Swal.fire('錯誤', '更新課堂可見性失敗', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAttachmentChange = (idx: number, key: 'name' | 'url', value: string) => setForm((f) => { const att = [...(f.attachments || [])]; att[idx] = { ...att[idx], [key]: value }; return { ...f, attachments: att }; });
  const handleAttachmentVisibilityChange = (idx: number, visible: boolean) => setForm((f) => {
    const att = [...(f.attachments || [])];
    att[idx] = { ...att[idx], visibleToStudents: visible };
    return { ...f, attachments: att };
  });
  const handleVideoChange = (idx: number, value: string) => setForm((f) => { const v = [...(f.videos || [])]; v[idx] = value; return { ...f, videos: v }; });

  return (
    <div className={embedded ? 'w-full min-w-0 flex flex-col animate-fade-in' : 'page-shell w-full min-w-0 pb-10 flex flex-col animate-fade-in'}>
      {!embedded && (
      <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-0">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <BookOpenIcon className="h-8 w-8 text-indigo-600" />
            {courseName}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{courseCode}</p>
        </div>
      </div>
      {isArchived && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-4">
          <span className="font-bold mr-2">提示：</span>
          此課程已封存，您只能查看課堂資料，無法新增或修改。
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 mb-6">
        <BackButton label="返回列表" onClick={onClose} withSpacing={false} />
        {!isArchived && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button className={btnWithIconStyle(btnStyles.primary)} onClick={openAddModal}>
              <PlusIcon className="w-4 h-4 mr-2" /> 新增課堂
            </button>
            {isOrderDirty && (
              <button className={btnWithIconStyle(btnStyles.primary)} onClick={handleSaveChanges} disabled={isSubmitting}>
                {isSubmitting ? <LoadingSpinner size={16} color="white" /> : <><CloudArrowUpIcon className="w-4 h-4 mr-2" /> 儲存排序</>}
              </button>
            )}
          </div>
        )}
      </div>
      </>
      )}
      {embedded && (
      <>
      {isArchived && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-4">
          <span className="font-bold mr-2">提示：</span>
          此課程已封存，您只能查看課堂資料，無法新增或修改。
        </div>
      )}
      {!isArchived && (
      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 mb-6">
        <button className={btnWithIconStyle(btnStyles.primary)} onClick={openAddModal}>
          <PlusIcon className="w-4 h-4 mr-2" /> 新增課堂
        </button>
        {isOrderDirty && (
          <button className={btnWithIconStyle(btnStyles.primary)} onClick={handleSaveChanges} disabled={isSubmitting}>
            {isSubmitting ? <LoadingSpinner size={16} color="white" /> : <><CloudArrowUpIcon className="w-4 h-4 mr-2" /> 儲存排序</>}
          </button>
        )}
      </div>
      )}
      </>
      )}

      {isLoading ? (
        <PageLoadingArea />
      ) : (
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="lesson-list">
          {(provided: DroppableProvided) => (
            <div className="grid grid-cols-1 gap-4" ref={provided.innerRef} {...provided.droppableProps}>
              {lessons.length === 0 ? (
                <div className="text-center min-h-[280px] flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  <BookOpenIcon className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-gray-500 font-medium">目前沒有課堂資料</p>
                </div>
              ) : (
                lessons.map((lesson, idx) => (
                  <Draggable key={lesson.id} draggableId={lesson.id} index={idx} isDragDisabled={isArchived}>
                    {(provided: DraggableProvided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.draggableProps}
                        style={fixDraggableStyle(provided.draggableProps.style)}
                        className={`bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-indigo-200 transition-shadow duration-200 ${
                          snapshot.isDragging ? 'shadow-lg border-indigo-200' : ''
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="min-w-0 flex items-start sm:items-center gap-3">
                            {!isArchived && (
                              <div
                                className="cursor-move text-gray-300 hover:text-gray-500 shrink-0 mt-1 sm:mt-0"
                                {...provided.dragHandleProps}
                                title="拖曳排序"
                              >
                                <Bars3Icon className="w-5 h-5" />
                              </div>
                            )}
                            <div className="hidden sm:flex flex-shrink-0 w-10 h-10 bg-indigo-50 rounded-full items-center justify-center text-indigo-600">
                              <CourseHubFeatureIcon id="lessons" />
                            </div>
                            <div className="min-w-0">
                              <span className="sm:hidden inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md mb-1">
                                <CourseHubFeatureIcon id="lessons" className="w-3.5 h-3.5" />
                                第 {idx + 1} 堂
                              </span>
                              <h4 className="text-lg font-bold text-gray-900 line-clamp-2 leading-7">{lesson.title}</h4>
                              <div className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                <span className="inline-flex items-center">
                                  <ClockIcon className="w-4 h-4 mr-1 shrink-0" />
                                  {lesson.date || '日期未定'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                            <StudentVisibilityToggle
                              open={isStudentVisible(lesson.visibleToStudents)}
                              disabled={isArchived}
                              onToggle={() => void handleToggleLessonVisibility(lesson)}
                            />
                            <button
                              type="button"
                              onClick={() => handleEditClick(lesson)}
                              className={isArchived ? courseListTableStyles.desktop.actionSecondary : courseListTableStyles.desktop.actionPrimary}
                            >
                              {isArchived ? '查看' : '編輯'}
                            </button>
                            {!isArchived && (
                              <button
                                type="button"
                                onClick={() => handleDeleteLesson(lesson.id)}
                                className={courseListTableStyles.desktop.actionDanger}
                              >
                                刪除
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
      )}

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingLesson ? (isArchived ? '查看課堂' : '編輯課堂') : '新增課堂'} size="lg">
         <div className="space-y-0">
            {isArchived && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-4">
                <span className="font-bold mr-2">提示：</span>
                此為封存課程，僅供檢視。
              </div>
            )}
            <div className="border-t border-gray-100 pt-4">
              <label className="flex items-center text-sm font-bold text-gray-700 mb-2">
                <BookOpenIcon className="w-4 h-4 mr-1.5" />
                課堂標題 <span className="text-red-500">*</span>
              </label>
              <input type="text" className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all outline-none ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} value={form.title} onChange={e => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="例如：第一章 數列與級數" disabled={isArchived} />
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="flex items-center text-sm font-bold text-gray-700 mb-2">
                <CalendarDaysIcon className="w-4 h-4 mr-1.5" />
                課程日期 <span className="text-red-500">*</span>
              </label>
              <input type="date" className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all outline-none ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} value={form.date} onChange={e => setForm((f) => ({ ...f, date: e.target.value }))} disabled={isArchived} />
              <label className={`inline-flex items-center mt-3 text-sm font-medium text-gray-700 ${isArchived ? 'opacity-60 cursor-default' : ''}`}>
                <input
                  type="checkbox"
                  className="w-4 h-4 text-indigo-600 rounded mr-2 accent-indigo-600 cursor-pointer disabled:opacity-50"
                  checked={form.visibleToStudents !== false}
                  onChange={(e) => setForm((f) => ({ ...f, visibleToStudents: e.target.checked }))}
                  disabled={isArchived}
                />
                此課堂開放學生查看
              </label>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="flex items-center text-sm font-bold text-gray-700 mb-2">
                <ChartBarIcon className="w-4 h-4 mr-1.5" />
                課程進度
              </label>
              <textarea className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all outline-none resize-none ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} value={form.progress} onChange={e => setForm((f) => ({ ...f, progress: e.target.value }))} rows={3} placeholder="本堂課的教學重點..." disabled={isArchived} />
            </div>
            
            {/* Attachments & Videos */}
            <div className="border-t border-gray-100 pt-4">
                 <label className="flex items-center justify-between text-sm font-bold text-gray-700 mb-3">
                    <span className="flex items-center"><PaperClipIcon className="w-4 h-4 mr-1.5"/> 附件資源</span>
                    <div className={`flex items-center font-normal ${isArchived ? 'opacity-60' : ''}`}>
                       <input type="checkbox" id="noAttachment" className="w-4 h-4 text-indigo-600 rounded mr-2 accent-indigo-600 cursor-pointer disabled:opacity-50" checked={form.noAttachment} onChange={e => setForm((f) => ({ ...f, noAttachment: e.target.checked }))} disabled={isArchived} />
                       <label htmlFor="noAttachment" className="text-gray-500 text-xs">無附件</label>
                    </div>
                 </label>
                 {!form.noAttachment && (
                    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        {(form.attachments || []).map((att, idx) => (
                           <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                              <input type="text" className={`border border-gray-300 rounded-lg px-3 py-2 w-full sm:w-1/3 text-sm focus:ring-indigo-500 ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} placeholder="檔案名稱" value={att.name} onChange={e => handleAttachmentChange(idx, 'name', e.target.value)} disabled={isArchived} />
                              <div className="flex gap-2 items-center w-full sm:w-auto sm:flex-1">
                                <input type="url" className={`border border-gray-300 rounded-lg px-3 py-2 flex-1 text-sm focus:ring-indigo-500 ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} placeholder="檔案連結 (URL)" value={att.url} onChange={e => handleAttachmentChange(idx, 'url', e.target.value)} disabled={isArchived} />
                                {att.url?.trim() ? (
                                  <a
                                    href={att.url.trim()}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg shrink-0 transition-colors flex items-center gap-1 text-xs font-medium"
                                    title="查看附件"
                                  >
                                    <EyeIcon className="w-5 h-5" />
                                    <span className="hidden sm:inline">查看</span>
                                  </a>
                                ) : null}
                                <label className={`flex items-center text-xs text-gray-600 whitespace-nowrap px-2 ${isArchived ? 'opacity-60' : ''}`}>
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 text-indigo-600 rounded mr-1.5 accent-indigo-600 cursor-pointer disabled:opacity-50"
                                    checked={att.visibleToStudents !== false}
                                    onChange={(e) => handleAttachmentVisibilityChange(idx, e.target.checked)}
                                    disabled={isArchived}
                                  />
                                  學生可見
                                </label>
                                {!isArchived && (form.attachments || []).length > 1 && (
                                  <button type="button" className="text-red-400 hover:text-red-600 p-1" onClick={() => setForm(f => ({...f, attachments: f.attachments?.filter((_, i) => i !== idx)}))}>
                                     <XMarkIcon className="w-5 h-5"/>
                                  </button>
                                )}
                              </div>
                           </div>
                        ))}
                        {!isArchived && (
                          <button type="button" className="text-indigo-600 text-xs font-bold hover:text-indigo-800 flex items-center" onClick={() => setForm(f => ({...f, attachments: [...(f.attachments || []), {name:'', url:'', visibleToStudents: true}]}))}>
                             <PlusIcon className="w-3 h-3 mr-1" /> 新增附件欄位
                          </button>
                        )}
                    </div>
                 )}
            </div>

            <div className="border-t border-gray-100 pt-4">
                 <label className="text-sm font-bold text-gray-700 mb-3 flex items-center"><VideoCameraIcon className="w-4 h-4 mr-1.5"/> 影片連結</label>
                 <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {(form.videos || []).map((video, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                           <LinkIcon className="w-4 h-4 text-gray-400" />
                           <input type="url" className={`border border-gray-300 rounded-lg px-3 py-2 flex-1 text-sm focus:ring-indigo-500 outline-none ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} placeholder="YouTube 或其他影片連結" value={video} onChange={e => handleVideoChange(idx, e.target.value)} disabled={isArchived} />
                           {!isArchived && (form.videos || []).length > 1 && (
                             <button type="button" className="text-red-400 hover:text-red-600 p-1" onClick={() => setForm(f => ({...f, videos: f.videos?.filter((_, i) => i !== idx)}))}>
                                <XMarkIcon className="w-5 h-5"/>
                             </button>
                           )}
                        </div>
                    ))}
                    {!isArchived && (
                      <button type="button" className="text-indigo-600 text-xs font-bold hover:text-indigo-800 flex items-center" onClick={() => setForm(f => ({...f, videos: [...(f.videos || []), '']}))}>
                          <PlusIcon className="w-3 h-3 mr-1" /> 新增影片欄位
                      </button>
                    )}
                 </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="flex items-center justify-between text-sm font-bold text-gray-700 mb-3">
                <span className="flex items-center">
                  <ClipboardDocumentCheckIcon className="w-4 h-4 mr-1.5" />
                  綁定線上測驗
                </span>
                <div className={`flex items-center font-normal ${isArchived ? 'opacity-60' : ''}`}>
                  <input
                    type="checkbox"
                    className="w-4 h-4 text-indigo-600 rounded mr-1.5 accent-indigo-600 cursor-pointer disabled:opacity-50"
                    checked={form.noOnlineExam}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        noOnlineExam: e.target.checked,
                        assignedQuizzes: e.target.checked ? [] : f.assignedQuizzes,
                        onlineExam: e.target.checked ? '' : f.onlineExam,
                      }))
                    }
                    disabled={isArchived}
                  />
                  <span className="text-gray-500 text-xs">無測驗</span>
                </div>
              </label>
              {!form.noOnlineExam && (
                <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <p className="text-xs text-gray-500">
                    勾選要指派給本課堂的測驗（可複選）。學生可在課程頁／課堂內容中看到已綁定的測驗。
                  </p>
                  {quizzesLoading ? (
                    <PageLoadingArea minHeight="min-h-[4rem]" />
                  ) : courseQuizzes.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      此課程尚無已開放的線上測驗。請先至「線上測驗」分頁建立並開放測驗。
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {orphanedAssignedQuizzes.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {orphanedAssignedQuizzes.map((orphan) => (
                            <div
                              key={orphan.quizCode}
                              className="flex items-start justify-between gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-amber-900">測驗已刪除或不再適用</p>
                                <p className="text-xs text-amber-700 mt-0.5">
                                  此課堂仍保留已失效的測驗指派，儲存後將自動移除。
                                </p>
                              </div>
                              {!isArchived && (
                                <button
                                  type="button"
                                  onClick={() => toggleAssignedQuiz(orphan.quizCode, false)}
                                  className="text-xs font-medium text-amber-800 hover:text-amber-950 shrink-0"
                                >
                                  移除
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs text-gray-500 px-0.5">
                        <span>請選擇要綁定的測驗</span>
                        <span>
                          已選 {(form.assignedQuizzes ?? []).filter((q) =>
                            courseQuizzes.some((cq) => cq.quizCode === q.quizCode)
                          ).length} / {courseQuizzes.length}
                        </span>
                      </div>
                      {courseQuizzes.map((quiz) => {
                        const assignment = (form.assignedQuizzes ?? []).find(
                          (q) => q.quizCode === quiz.quizCode
                        );
                        const checked = !!assignment;
                        return (
                          <div
                            key={quiz.id}
                            className={`rounded-lg border transition-colors ${
                              checked
                                ? 'bg-indigo-50 border-indigo-200'
                                : 'bg-white border-gray-200 hover:border-indigo-200'
                            }`}
                          >
                            <label
                              className={`flex items-start gap-3 p-3 ${
                                isArchived ? 'opacity-60 cursor-default' : 'cursor-pointer'
                              }`}
                            >
                              <input
                                type="checkbox"
                                className="w-4 h-4 mt-1 text-indigo-600 rounded accent-indigo-600 cursor-pointer disabled:opacity-50"
                                checked={checked}
                                onChange={(e) => toggleAssignedQuiz(quiz.quizCode, e.target.checked)}
                                disabled={isArchived}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-bold text-gray-900">
                                    {quiz.title}
                                  </p>
                                  {checked && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-600 text-white">
                                      已綁定
                                    </span>
                                  )}
                                  {quiz.teacherId !== teacherId && (
                                    <span className="text-xs font-normal text-indigo-600">
                                      （其他老師）
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                  滿分 {quiz.totalPoints} 分
                                  {!checked && ' · 勾選以指派給本課堂'}
                                </p>
                              </div>
                            </label>
                            {checked && (
                              <label
                                className={`flex items-center text-xs text-gray-700 px-3 pb-3 pl-10 ${
                                  isArchived ? 'opacity-60 cursor-default' : 'cursor-pointer'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 text-indigo-600 rounded mr-2 accent-indigo-600 cursor-pointer disabled:opacity-50"
                                  checked={!!assignment?.requireBeforeVideo}
                                  onChange={(e) =>
                                    toggleQuizRequireBeforeVideo(quiz.quizCode, e.target.checked)
                                  }
                                  disabled={isArchived}
                                />
                                需完成此測驗後才可觀看影片
                              </label>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="flex items-center justify-between text-sm font-bold text-gray-700 mb-3">
                <span className="flex items-center">
                  <PencilSquareIcon className="w-4 h-4 mr-1.5" />
                  作業說明
                </span>
                <div className={`flex items-center font-normal ${isArchived ? 'opacity-60' : ''}`}>
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded mr-1.5 accent-indigo-600 cursor-pointer disabled:opacity-50" checked={form.noHomework} onChange={e => setForm(f => ({...f, noHomework: e.target.checked}))} disabled={isArchived} />
                  <span className="text-gray-500 text-xs">無作業</span>
                </div>
              </label>
              {!form.noHomework && (
                <textarea className={`w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-indigo-500 resize-none bg-gray-50 ${isArchived ? 'text-gray-500' : ''}`} rows={2} value={form.homework} onChange={e => setForm(f => ({...f, homework: e.target.value}))} disabled={isArchived} placeholder="請輸入作業說明..." />
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="flex items-center justify-between text-sm font-bold text-gray-700 mb-3">
                <span className="flex items-center">
                  <DocumentTextIcon className="w-4 h-4 mr-1.5" />
                  考試範圍
                </span>
                <div className={`flex items-center font-normal ${isArchived ? 'opacity-60' : ''}`}>
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded mr-1.5 accent-indigo-600 cursor-pointer disabled:opacity-50" checked={form.noExamScope} onChange={e => setForm(f => ({...f, noExamScope: e.target.checked}))} disabled={isArchived} />
                  <span className="text-gray-500 text-xs">無範圍</span>
                </div>
              </label>
              {!form.noExamScope && (
                <textarea className={`w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-indigo-500 resize-none bg-gray-50 ${isArchived ? 'text-gray-500' : ''}`} rows={2} value={form.examScope} onChange={e => setForm(f => ({...f, examScope: e.target.value}))} disabled={isArchived} placeholder="請輸入考試範圍..." />
              )}
            </div>

            <div className="border-t border-gray-100 pt-4">
              <label className="flex items-center justify-between text-sm font-bold text-gray-700 mb-3">
                <span className="flex items-center">
                  <InformationCircleIcon className="w-4 h-4 mr-1.5" />
                  注意事項
                </span>
                <div className={`flex items-center font-normal ${isArchived ? 'opacity-60' : ''}`}>
                  <input type="checkbox" className="w-4 h-4 text-indigo-600 rounded mr-1.5 accent-indigo-600 cursor-pointer disabled:opacity-50" checked={form.noNotes} onChange={e => setForm(f => ({...f, noNotes: e.target.checked}))} disabled={isArchived} />
                  <span className="text-gray-500 text-xs">無事項</span>
                </div>
              </label>
              {!form.noNotes && (
                <textarea className={`w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-indigo-500 resize-none bg-gray-50 ${isArchived ? 'text-gray-500' : ''}`} rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} disabled={isArchived} placeholder="請輸入注意事項..." />
              )}
            </div>

            <div className="flex justify-end pt-4 gap-3 border-t border-gray-100">
                <button onClick={() => setIsModalOpen(false)} className={`px-4 py-2 ${isArchived ? 'bg-indigo-600 text-white rounded-lg hover:bg-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>{isArchived ? '關閉' : '取消'}</button>
                {!isArchived && (
                  <button onClick={handleFormSubmit} disabled={isSubmitting || !form.title || !form.date} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">
                      {isSubmitting ? '處理中...' : '確認儲存'}
                  </button>
                )}
            </div>
         </div>
      </Modal>
    </div>
  );
}

export default function TeacherCourseManager({
  userInfo,
  courses: propCourses,
  courseCodeFromUrl = '',
  tabFromUrl = '',
}: TeacherCourseManagerProps) {
  const router = useRouter();
  const [coursesState, setCourses] = useState<Course[]>([]);
  const courses = propCourses ?? coursesState;
  const [loading, setLoading] = useState(true);
  const [_error, _setError] = useState<string | null>(null);
  const [showCourseDetail, setShowCourseDetail] = useState<Course | null>(null);
  const [showLessonManager, setShowLessonManager] = useState<Course | null>(null);
  const [teacherNamesMap, setTeacherNamesMap] = useState<{ [courseId: string]: string[] }>({});
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [mounted, setMounted] = useState(false);
  const [courseQuizzes, setCourseQuizzes] = useState<Quiz[]>([]);
  const [allTeacherQuizzes, setAllTeacherQuizzes] = useState<Quiz[]>([]);
  const [courseQuizzesLoading, setCourseQuizzesLoading] = useState(false);
  const [examOrderSaving, setExamOrderSaving] = useState(false);
  const [courseSurveys, setCourseSurveys] = useState<Survey[]>([]);
  const [allTeacherSurveys, setAllTeacherSurveys] = useState<Survey[]>([]);
  const [courseSurveysLoading, setCourseSurveysLoading] = useState(false);
  const [surveyOrderSaving, setSurveyOrderSaving] = useState(false);
  const [pullModalOpen, setPullModalOpen] = useState(false);
  const [pullStep, setPullStep] = useState<'course' | 'quiz'>('course');
  const [pullSourceKey, setPullSourceKey] = useState('');
  const [pullQuizCode, setPullQuizCode] = useState('');
  const [pullSubmitting, setPullSubmitting] = useState(false);
  const [pullSurveyModalOpen, setPullSurveyModalOpen] = useState(false);
  const [pullSurveyStep, setPullSurveyStep] = useState<'course' | 'survey'>('course');
  const [pullSurveySourceKey, setPullSurveySourceKey] = useState('');
  const [pullSurveyCode, setPullSurveyCode] = useState('');
  const [pullSurveySubmitting, setPullSurveySubmitting] = useState(false);
  const activeCourseTab = parseTeacherCourseTab(tabFromUrl);

  useEffect(() => { setMounted(true); }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedNature, setSelectedNature] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [showAnnouncementManager, setShowAnnouncementManager] = useState<Course | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<CourseAnnouncement | null>(null);
  const [annIsSubmitting, setAnnIsSubmitting] = useState(false);
  const gradeLeaveConfirmRef = useRef<(() => Promise<boolean>) | null>(null);

  const resolvedCourseFromUrl = useMemo(() => {
    if (!courseCodeFromUrl) return null;
    const decoded = decodeURIComponent(courseCodeFromUrl);
    return courses.find((c) => c.code === decoded || c.id === decoded) ?? null;
  }, [courseCodeFromUrl, courses]);

  const setCourseTab = useCallback(async (tab: TeacherCourseTab) => {
    const code = resolvedCourseFromUrl?.code || courseCodeFromUrl;
    if (!code) return;
    if (activeCourseTab === 'grades' && tab !== 'grades' && gradeLeaveConfirmRef.current) {
      const ok = await gradeLeaveConfirmRef.current();
      if (!ok) return;
    }
    router.replace(buildTeacherCourseTabUrl(code, tab), { scroll: false });
  }, [activeCourseTab, resolvedCourseFromUrl?.code, courseCodeFromUrl, router]);

  const leaveCourseDetail = useCallback(async () => {
    if (activeCourseTab === 'grades' && gradeLeaveConfirmRef.current) {
      const ok = await gradeLeaveConfirmRef.current();
      if (!ok) return;
    }
    router.push('/back-panel/teacher-courses');
  }, [activeCourseTab, router]);

  const openCourseDetail = useCallback((course: Course, tab: TeacherCourseTab = 'lessons') => {
    router.push(buildTeacherCourseTabUrl(course.code, tab));
  }, [router]);

  const pullQuizGroups = useMemo(() => {
    if (!resolvedCourseFromUrl) {
      return { courseOptions: [] as { value: string; label: string }[], quizzesByCourse: new Map<string, Quiz[]>() };
    }
    const currentId = resolvedCourseFromUrl.id;
    const sourceQuizzes = allTeacherQuizzes.filter((q) => {
      const assigned = normalizeAssignedCourses(q);
      if (assigned.length === 0) return true;
      return !assigned.some((c) => c.courseId === currentId);
    });

    const courseLabel = (courseId: string) => {
      const c = courses.find((x) => x.id === courseId);
      return c ? `${c.name}（${c.code}）` : '未指定班級';
    };

    const courseOptions: { value: string; label: string }[] = [];
    const quizzesByCourse = new Map<string, Quiz[]>();
    for (const quiz of sourceQuizzes) {
      const courseId = normalizeAssignedCourses(quiz)[0]?.courseId ?? '';
      const key = courseId || '__unassigned__';
      if (!quizzesByCourse.has(key)) {
        quizzesByCourse.set(key, []);
        courseOptions.push({
          value: key,
          label: courseId ? courseLabel(courseId) : '未指定班級',
        });
      }
      quizzesByCourse.get(key)!.push(quiz);
    }
    courseOptions.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant'));
    return { courseOptions, quizzesByCourse };
  }, [allTeacherQuizzes, courses, resolvedCourseFromUrl]);

  const pullQuizzesInSource = useMemo(() => {
    if (!pullSourceKey) return [] as Quiz[];
    return pullQuizGroups.quizzesByCourse.get(pullSourceKey) ?? [];
  }, [pullQuizGroups.quizzesByCourse, pullSourceKey]);

  const openPullQuizModal = useCallback(() => {
    if (!resolvedCourseFromUrl || resolvedCourseFromUrl.status === '已封存') return;
    if (pullQuizGroups.courseOptions.length === 0) {
      void Swal.fire({
        icon: 'info',
        title: '沒有可複製的測驗',
        text: '其他班級目前沒有可供複製的測驗。',
        confirmButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-2xl' },
      });
      return;
    }
    const firstKey = pullQuizGroups.courseOptions[0]?.value ?? '';
    setPullSourceKey(firstKey);
    setPullQuizCode('');
    setPullStep('course');
    setPullModalOpen(true);
  }, [resolvedCourseFromUrl, pullQuizGroups.courseOptions]);

  const closePullQuizModal = useCallback(() => {
    if (pullSubmitting) return;
    setPullModalOpen(false);
    setPullStep('course');
    setPullSourceKey('');
    setPullQuizCode('');
  }, [pullSubmitting]);

  const pullSurveyGroups = useMemo(() => {
    if (!resolvedCourseFromUrl) {
      return { courseOptions: [] as { value: string; label: string }[], surveysByCourse: new Map<string, Survey[]>() };
    }
    const currentId = resolvedCourseFromUrl.id;
    const sourceSurveys = allTeacherSurveys.filter((s) => {
      const assigned = normalizeSurveyAssignedCourses(s);
      if (assigned.length === 0) return true;
      return !assigned.some((c) => c.courseId === currentId);
    });

    const courseLabel = (courseId: string) => {
      const c = courses.find((x) => x.id === courseId);
      return c ? `${c.name}（${c.code}）` : '未指定班級';
    };

    const courseOptions: { value: string; label: string }[] = [];
    const surveysByCourse = new Map<string, Survey[]>();
    for (const survey of sourceSurveys) {
      const courseId = normalizeSurveyAssignedCourses(survey)[0]?.courseId ?? '';
      const key = courseId || '__unassigned__';
      if (!surveysByCourse.has(key)) {
        surveysByCourse.set(key, []);
        courseOptions.push({
          value: key,
          label: courseId ? courseLabel(courseId) : '未指定班級',
        });
      }
      surveysByCourse.get(key)!.push(survey);
    }
    courseOptions.sort((a, b) => a.label.localeCompare(b.label, 'zh-Hant'));
    return { courseOptions, surveysByCourse };
  }, [allTeacherSurveys, courses, resolvedCourseFromUrl]);

  const pullSurveysInSource = useMemo(() => {
    if (!pullSurveySourceKey) return [] as Survey[];
    return pullSurveyGroups.surveysByCourse.get(pullSurveySourceKey) ?? [];
  }, [pullSurveyGroups.surveysByCourse, pullSurveySourceKey]);

  const openPullSurveyModal = useCallback(() => {
    if (!resolvedCourseFromUrl || resolvedCourseFromUrl.status === '已封存') return;
    if (pullSurveyGroups.courseOptions.length === 0) {
      void Swal.fire({
        icon: 'info',
        title: '沒有可複製的問卷',
        text: '其他班級目前沒有可供複製的問卷。',
        confirmButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-2xl' },
      });
      return;
    }
    const firstKey = pullSurveyGroups.courseOptions[0]?.value ?? '';
    setPullSurveySourceKey(firstKey);
    setPullSurveyCode('');
    setPullSurveyStep('course');
    setPullSurveyModalOpen(true);
  }, [resolvedCourseFromUrl, pullSurveyGroups.courseOptions]);

  const closePullSurveyModal = useCallback(() => {
    if (pullSurveySubmitting) return;
    setPullSurveyModalOpen(false);
    setPullSurveyStep('course');
    setPullSurveySourceKey('');
    setPullSurveyCode('');
  }, [pullSurveySubmitting]);

  const confirmPullSurvey = useCallback(async () => {
    if (!userInfo?.id || !resolvedCourseFromUrl || !pullSurveyCode) return;

    setPullSurveySubmitting(true);
    try {
      Swal.fire({
        title: '複製中…',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await fetch('/api/surveys/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: userInfo.id,
          sourceSurveyCode: pullSurveyCode,
          courseId: resolvedCourseFromUrl.id,
          courseName: `${resolvedCourseFromUrl.name}（${resolvedCourseFromUrl.code}）`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '複製失敗');

      invalidateTeacherSurveys(userInfo.id);

      const surveys = await fetchTeacherSurveys(userInfo.id);
      setAllTeacherSurveys(surveys);
      setCourseSurveys(filterSurveysForCourse(surveys, resolvedCourseFromUrl.id, { publishedOnly: false }));

      setPullSurveyModalOpen(false);
      setPullSurveyStep('course');
      setPullSurveySourceKey('');
      setPullSurveyCode('');

      const openEdit = await Swal.fire({
        icon: 'success',
        title: '已複製到本班',
        text: '已建立獨立草稿，可立即編輯或稍後再調整。',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: '立即編輯',
        cancelButtonText: '稍後',
        customClass: { popup: 'rounded-2xl' },
      });

      if (openEdit.isConfirmed && data.surveyCode) {
        router.push(
          surveyDetailPath(
            data.surveyCode,
            undefined,
            teacherCourseHubPath(resolvedCourseFromUrl.code, 'surveys')
          )
        );
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '複製失敗',
        text: error instanceof Error ? error.message : '請稍後再試',
        confirmButtonColor: '#4f46e5',
      });
    } finally {
      setPullSurveySubmitting(false);
    }
  }, [userInfo?.id, resolvedCourseFromUrl, pullSurveyCode, router]);

  const confirmPullQuiz = useCallback(async () => {
    if (!userInfo?.id || !resolvedCourseFromUrl || !pullQuizCode) return;

    setPullSubmitting(true);
    try {
      Swal.fire({
        title: '複製中…',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await fetch('/api/quizzes/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: userInfo.id,
          sourceQuizCode: pullQuizCode,
          courseId: resolvedCourseFromUrl.id,
          courseName: `${resolvedCourseFromUrl.name}（${resolvedCourseFromUrl.code}）`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '複製失敗');

      invalidateTeacherQuizzes(userInfo.id);

      const quizzes = await fetchTeacherQuizzes(userInfo.id);
      setAllTeacherQuizzes(quizzes);
      setCourseQuizzes(filterQuizzesForCourse(quizzes, resolvedCourseFromUrl.id, { publishedOnly: false }));

      setPullModalOpen(false);
      setPullStep('course');
      setPullSourceKey('');
      setPullQuizCode('');

      const openEdit = await Swal.fire({
        icon: 'success',
        title: '已複製到本班',
        text: '已建立獨立草稿，可立即編輯或稍後再調整。',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: '立即編輯',
        cancelButtonText: '稍後',
        customClass: { popup: 'rounded-2xl' },
      });

      if (openEdit.isConfirmed && data.quizCode) {
        router.push(
          examDetailPath(
            data.quizCode,
            undefined,
            teacherCourseHubPath(resolvedCourseFromUrl.code, 'exams')
          )
        );
      }
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '複製失敗',
        text: error instanceof Error ? error.message : '請稍後再試',
        confirmButtonColor: '#4f46e5',
      });
    } finally {
      setPullSubmitting(false);
    }
  }, [userInfo?.id, resolvedCourseFromUrl, pullQuizCode, router]);

  const handleDeleteCourseQuiz = useCallback(async (quiz: Quiz) => {
    if (!userInfo?.id) return;
    if (quiz.teacherId !== userInfo.id) {
      await Swal.fire({
        icon: 'info',
        title: '無法刪除',
        text: '僅建立者可刪除測驗。',
        confirmButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-2xl' },
      });
      return;
    }

    const result = await Swal.fire({
      title: '確定要刪除此測驗？',
      text: '刪除後無法復原，請確認。',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: '是的，刪除',
      cancelButtonText: '取消',
      customClass: { popup: 'rounded-2xl' },
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch('/api/quizzes/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quiz.id, teacherId: userInfo.id }),
      });
      if (!res.ok) throw new Error('刪除失敗');
      invalidateTeacherQuizzes(userInfo.id);
      invalidateQuizByCode(quiz.quizCode);
      setCourseQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
      setAllTeacherQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
      Swal.fire({ icon: 'success', title: '已刪除', confirmButtonColor: '#4f46e5' });
    } catch {
      Swal.fire({ icon: 'error', title: '刪除失敗', confirmButtonColor: '#4f46e5' });
    }
  }, [userInfo?.id]);

  useEffect(() => {
    if (!resolvedCourseFromUrl || activeCourseTab !== 'exams' || !userInfo?.id) {
      setCourseQuizzes([]);
      setAllTeacherQuizzes([]);
      return;
    }
    let cancelled = false;
    setCourseQuizzesLoading(true);
    fetchTeacherQuizzes(userInfo.id)
      .then((quizzes) => {
        if (!cancelled) {
          setAllTeacherQuizzes(quizzes);
          setCourseQuizzes(filterQuizzesForCourse(quizzes, resolvedCourseFromUrl.id, { publishedOnly: false }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCourseQuizzes([]);
          setAllTeacherQuizzes([]);
        }
      })
      .finally(() => {
        if (!cancelled) setCourseQuizzesLoading(false);
      });
    return () => { cancelled = true; };
  }, [resolvedCourseFromUrl?.id, activeCourseTab, userInfo?.id]);

  useEffect(() => {
    if (!resolvedCourseFromUrl || activeCourseTab !== 'surveys' || !userInfo?.id) {
      setCourseSurveys([]);
      setAllTeacherSurveys([]);
      return;
    }
    let cancelled = false;
    setCourseSurveysLoading(true);
    fetchTeacherSurveys(userInfo.id)
      .then((surveys) => {
        if (!cancelled) {
          setAllTeacherSurveys(surveys);
          setCourseSurveys(filterSurveysForCourse(surveys, resolvedCourseFromUrl.id, { publishedOnly: false }));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCourseSurveys([]);
          setAllTeacherSurveys([]);
        }
      })
      .finally(() => {
        if (!cancelled) setCourseSurveysLoading(false);
      });
    return () => { cancelled = true; };
  }, [resolvedCourseFromUrl?.id, activeCourseTab, userInfo?.id]);

  const handleDeleteCourseSurvey = useCallback(async (survey: Survey) => {
    if (!userInfo?.id) return;
    const result = await Swal.fire({
      title: '確定要刪除此問卷？',
      text: '刪除後無法復原，相關回應也會一併刪除。',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: '是的，刪除',
      cancelButtonText: '取消',
      customClass: { popup: 'rounded-2xl' },
    });
    if (!result.isConfirmed) return;
    try {
      const res = await fetch('/api/surveys/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ surveyId: survey.id, teacherId: userInfo.id }),
      });
      if (!res.ok) throw new Error('刪除失敗');
      invalidateTeacherSurveys(userInfo.id);
      invalidateSurveyByCode(survey.surveyCode);
      setCourseSurveys((prev) => prev.filter((s) => s.id !== survey.id));
      setAllTeacherSurveys((prev) => prev.filter((s) => s.id !== survey.id));
      Swal.fire({ icon: 'success', title: '已刪除', confirmButtonColor: '#4f46e5' });
    } catch {
      Swal.fire({ icon: 'error', title: '刪除失敗', confirmButtonColor: '#4f46e5' });
    }
  }, [userInfo?.id]);

  const handleToggleCourseQuizVisibility = useCallback(async (quiz: Quiz) => {
    if (!userInfo?.id || resolvedCourseFromUrl?.status === '已封存') return;
    const nextStatus = quiz.status === 'published' ? 'draft' : 'published';
    if (nextStatus === 'published') {
      const err = validateQuizForPublish(quiz);
      if (err) {
        await Swal.fire({
          icon: 'warning',
          title: '尚無法開放',
          text: err,
          confirmButtonColor: '#4f46e5',
        });
        return;
      }
    }
    try {
      const res = await fetch('/api/quizzes/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          teacherId: userInfo.id,
          status: nextStatus,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '更新失敗');
      invalidateTeacherQuizzes(userInfo.id);
      invalidateQuizByCode(quiz.quizCode);
      setCourseQuizzes((prev) =>
        prev.map((q) => (q.id === quiz.id ? { ...q, status: nextStatus } : q))
      );
      Swal.fire({
        icon: 'success',
        title: nextStatus === 'published' ? '已開放' : '已隱藏',
        text:
          nextStatus === 'published'
            ? '學生端現在可以看到此測驗。'
            : '學生端將無法看到此測驗。',
        confirmButtonColor: '#4f46e5',
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: error instanceof Error ? error.message : '更新失敗',
        confirmButtonColor: '#4f46e5',
      });
    }
  }, [userInfo?.id, resolvedCourseFromUrl?.status]);

  const handleToggleCourseSurveyVisibility = useCallback(async (survey: Survey) => {
    if (!userInfo?.id || resolvedCourseFromUrl?.status === '已封存') return;
    const nextStatus = survey.status === 'published' ? 'draft' : 'published';
    if (nextStatus === 'published') {
      const err = validateSurveyForPublish(survey);
      if (err) {
        await Swal.fire({
          icon: 'warning',
          title: '尚無法開放',
          text: err,
          confirmButtonColor: '#4f46e5',
        });
        return;
      }
    }
    try {
      const res = await fetch('/api/surveys/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          surveyId: survey.id,
          teacherId: userInfo.id,
          status: nextStatus,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '更新失敗');
      invalidateTeacherSurveys(userInfo.id);
      invalidateSurveyByCode(survey.surveyCode);
      setCourseSurveys((prev) =>
        prev.map((s) => (s.id === survey.id ? { ...s, status: nextStatus } : s))
      );
      Swal.fire({
        icon: 'success',
        title: nextStatus === 'published' ? '已開放' : '已隱藏',
        text:
          nextStatus === 'published'
            ? '學生端現在可以看到此問卷。'
            : '學生端將無法看到此問卷。',
        confirmButtonColor: '#4f46e5',
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: error instanceof Error ? error.message : '更新失敗',
        confirmButtonColor: '#4f46e5',
      });
    }
  }, [userInfo?.id, resolvedCourseFromUrl?.status]);

  const handleToggleAnnouncementVisibility = useCallback(async (ann: CourseAnnouncement) => {
    if (!showAnnouncementManager || showAnnouncementManager.status === '已封存') return;
    const nextVisible = !isStudentVisible(ann.visibleToStudents);
    const newAnns = (showAnnouncementManager.announcements || []).map((a) =>
      a.id === ann.id
        ? {
            ...a,
            visibleToStudents: nextVisible,
            ...(nextVisible
              ? { visiblePublishedAt: new Date().toISOString() }
              : { visiblePublishedAt: undefined }),
          }
        : a
    );
    try {
      const res = await fetch('/api/courses/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: showAnnouncementManager.id, announcements: newAnns }),
      });
      if (!res.ok) throw new Error('更新失敗');
      const updatedCourse = { ...showAnnouncementManager, announcements: newAnns };
      setShowAnnouncementManager(updatedCourse);
      setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
      Swal.fire({
        icon: 'success',
        title: nextVisible ? '已開放' : '已隱藏',
        text: nextVisible ? '學生端現在可以看到此公告。' : '學生端將無法看到此公告。',
        confirmButtonColor: '#4f46e5',
      });
    } catch {
      Swal.fire({ icon: 'error', title: '更新失敗', confirmButtonColor: '#4f46e5' });
    }
  }, [showAnnouncementManager]);

  const handleCourseSurveyDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;
    if (!userInfo?.id || !resolvedCourseFromUrl || resolvedCourseFromUrl.status === '已封存') return;

    const items = Array.from(courseSurveys);
    const [moved] = items.splice(source.index, 1);
    items.splice(destination.index, 0, moved);
    const next = items.map((item, index) => ({ ...item, order: index }));
    setCourseSurveys(next);
    setSurveyOrderSaving(true);
    try {
      const res = await fetch('/api/surveys/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: userInfo.id,
          courseId: resolvedCourseFromUrl.id,
          order: next.map((s) => s.id),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '儲存順序失敗');
      invalidateTeacherSurveys(userInfo.id);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: error instanceof Error ? error.message : '儲存順序失敗',
        confirmButtonColor: '#4f46e5',
      });
    } finally {
      setSurveyOrderSaving(false);
    }
  }, [courseSurveys, userInfo?.id, resolvedCourseFromUrl]);

  const handleCourseExamDragEnd = useCallback(async (result: DropResult) => {
    const { source, destination } = result;
    if (!destination || source.index === destination.index) return;
    if (!userInfo?.id || !resolvedCourseFromUrl || resolvedCourseFromUrl.status === '已封存') return;

    const items = Array.from(courseQuizzes);
    const [moved] = items.splice(source.index, 1);
    items.splice(destination.index, 0, moved);
    const next = items.map((item, index) => ({ ...item, order: index }));
    setCourseQuizzes(next);
    setExamOrderSaving(true);
    try {
      const res = await fetch('/api/quizzes/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: userInfo.id,
          courseId: resolvedCourseFromUrl.id,
          order: next.map((q) => q.id),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '儲存順序失敗');
      invalidateTeacherQuizzes(userInfo.id);
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '儲存順序失敗',
        text: error instanceof Error ? error.message : '請稍後再試',
        confirmButtonColor: '#4f46e5',
      });
      setCourseQuizzesLoading(true);
      try {
        const quizzes = await fetchTeacherQuizzes(userInfo.id);
        setCourseQuizzes(filterQuizzesForCourse(quizzes, resolvedCourseFromUrl.id, { publishedOnly: false }));
      } catch {
        /* ignore */
      } finally {
        setCourseQuizzesLoading(false);
      }
    } finally {
      setExamOrderSaving(false);
    }
  }, [courseQuizzes, userInfo?.id, resolvedCourseFromUrl]);

  const handleShowAnnouncementManager = async (course: Course) => {
      // 先立刻開啟視窗 (使用目前已有的資料)
      setShowAnnouncementManager({ ...course });
      try {
          const res = await fetch(`/api/courses/classdata?courseId=${course.id}`);
          if (res.ok) {
              const data = await res.json();
              // 在背景取得最新資料後，無縫更新視窗內的公告清單
              setShowAnnouncementManager(prev => {
                  if (prev && prev.id === course.id) {
                      return { ...prev, announcements: data.announcements ?? prev.announcements ?? [] };
                  }
                  return prev;
              });
          }
      } catch (e) {}
  };

  useEffect(() => {
    if (activeCourseTab === 'announcements' && resolvedCourseFromUrl) {
      void handleShowAnnouncementManager(resolvedCourseFromUrl);
    } else {
      setShowAnnouncementManager(null);
      setEditingAnnouncement(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- open announcement panel when tab selected
  }, [activeCourseTab, resolvedCourseFromUrl?.id]);

  const handleUpdateCourseDescription = async () => {
    if (!showCourseDetail) return;
    setIsSavingCourse(true);
    try {
        const res = await fetch('/api/courses/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: showCourseDetail.id,
                description: showCourseDetail.description,
                customLinks: showCourseDetail.customLinks
            })
        });
        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: '儲存成功',
                text: '課程資訊已更新',
                confirmButtonColor: '#4f46e5',
                customClass: { popup: 'rounded-2xl' }
            });
            setCourses(prev => prev.map(c => c.id === showCourseDetail.id ? { 
                ...c, 
                description: showCourseDetail.description || '',
                customLinks: showCourseDetail.customLinks || []
            } : c));
            setShowCourseDetail(null);
        } else {
            Swal.fire('錯誤', '更新失敗', 'error');
        }
    } catch (e) {
        Swal.fire('錯誤', '更新失敗', 'error');
    } finally {
        setIsSavingCourse(false);
    }
  };

  const fetchTeacherNamesCallback = useCallback(async (teacherIds: string[]): Promise<{ [id: string]: string }> => {
    if (!teacherIds.length) return {};
    try {
      const res = await fetch('/api/teacher/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: teacherIds })
      });
      if (!res.ok) return {};
      const teachers = await res.json();
      const map: { [id: string]: string } = {};
      teachers.forEach((t: { id: string, name: string }) => { map[t.id] = t.name; });
      return map;
    } catch { return {}; }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/teacher/list');
      if (res.ok) { const teachersData = await res.json(); setTeachers(teachersData); }
    } catch {}
  }, []);

  const hydrateCoursesMetadata = useCallback(async (allCourses: Course[]) => {
    if (!allCourses.length) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const allTeacherIds = Array.from(new Set((allCourses.flatMap((c: Course) => (c.teachers || [])).filter((id: unknown): id is string => typeof id === 'string')) as string[]));
      const teacherNameMap = await fetchTeacherNamesCallback(allTeacherIds);
      const newTeacherNamesMap: { [courseId: string]: string[] } = {};
      allCourses.forEach((course: Course) => { newTeacherNamesMap[course.id] = (course.teachers || []).map((id: string) => teacherNameMap[id]).filter(Boolean) as string[]; });
      setTeacherNamesMap(newTeacherNamesMap);
      setLoading(false);
      _setError(null);
    } catch {
      setLoading(false);
    }
  }, [fetchTeacherNamesCallback]);

  const fetchCourses = useCallback(async () => {
    if (!userInfo?.id) { 
      setLoading(true); 
      return; 
    }
    setLoading(true);
    try {
      const allCourses = await fetchCoursesByTeacherId<Course>(userInfo.id);
      setCourses(allCourses);
      await hydrateCoursesMetadata(allCourses);
    } catch { setCourses([]); setLoading(false); }
  }, [userInfo?.id, hydrateCoursesMetadata]);

  useEffect(() => {
    if (propCourses !== undefined) {
      if (!userInfo?.id) {
        setLoading(true);
        return;
      }
      if (propCourses.length > 0) {
        void hydrateCoursesMetadata(propCourses);
      } else {
        setLoading(false);
      }
      return;
    }
    void fetchCourses();
  }, [propCourses, userInfo?.id, fetchCourses, hydrateCoursesMetadata]);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const handleShowCourseDetail = async (course: Course) => {
    let fullCourse = courses.find((c) => c.id === course.id) ?? course;
    setShowCourseDetail(fullCourse);

    try {
      const classDataRes = await fetch(`/api/courses/classdata?courseId=${course.id}`);
      if (classDataRes.ok) {
        const classData = await classDataRes.json();
        setShowCourseDetail({
          ...fullCourse,
          location: classData.location || fullCourse.location,
          description: classData.description || fullCourse.description,
          liveStreamURL: classData.liveStreamURL || fullCourse.liveStreamURL,
          customLinks: classData.customLinks || fullCourse.customLinks || [],
          startDate: classData.startDate || fullCourse.startDate,
          endDate: classData.endDate || fullCourse.endDate,
        });
      }
    } catch (e) {
      console.log('無法獲取課程額外資料:', e);
    }
  };

  const getTeacherNames = (teacherIds: string[] | undefined | null) => {
    if (!teacherIds || !Array.isArray(teacherIds)) return '未指定';
    return teacherIds
      .map(id => teachers.find(t => t.id === id || t.account === id || t.uid === id)?.name)
      .filter(name => name)
      .join(', ') || '未指定';
  };

  const getGradeTags = (gradeTags: string[] | undefined | null) => {
    if (!gradeTags || !Array.isArray(gradeTags)) return '未指定';
    return gradeTags.join(', ');
  };

  const filteredCourses = filterAndSortCoursesForList(courses, {
    searchTerm,
    selectedGrade,
    selectedSubject,
    selectedNature,
    selectedStatus,
  });

  const saveEditingAnnouncement = async () => {
    if (!showAnnouncementManager || !editingAnnouncement) return;
    if (!editingAnnouncement.title || !editingAnnouncement.content) {
      Swal.fire('警告', '標題與內容為必填', 'warning');
      return;
    }
    setAnnIsSubmitting(true);
    try {
      const nowIso = new Date().toISOString();
      const withPublishStamp: CourseAnnouncement =
        isStudentVisible(editingAnnouncement.visibleToStudents)
          ? {
              ...editingAnnouncement,
              visiblePublishedAt:
                editingAnnouncement.visiblePublishedAt ||
                (editingAnnouncement.id === 'new' ? nowIso : editingAnnouncement.createdAt) ||
                nowIso,
            }
          : { ...editingAnnouncement, visiblePublishedAt: undefined };
      const currentAnns = showAnnouncementManager.announcements || [];
      const newAnns =
        withPublishStamp.id === 'new'
          ? [{ ...withPublishStamp, id: Date.now().toString(), createdAt: nowIso }, ...currentAnns]
          : currentAnns.map((a) => (a.id === withPublishStamp.id ? withPublishStamp : a));
      const res = await fetch('/api/courses/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: showAnnouncementManager.id, announcements: newAnns })
      });
      if (res.ok) {
        const updatedCourse = { ...showAnnouncementManager, announcements: newAnns };
        setShowAnnouncementManager(updatedCourse);
        setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
        setEditingAnnouncement(null);
        Swal.fire({icon: 'success', title: '儲存成功', customClass: { popup: 'rounded-2xl' }});
      } else {
        throw new Error('Update failed');
      }
    } catch (e) {
      Swal.fire('錯誤', '儲存失敗', 'error');
    } finally {
      setAnnIsSubmitting(false);
    }
  };

  const announcementEditorModal = editingAnnouncement && showAnnouncementManager ? (
    <Modal
      open={true}
      onClose={() => setEditingAnnouncement(null)}
      title={editingAnnouncement.id === 'new' ? '新增公告' : '編輯公告'}
      size="lg"
    >
      <div className="flex flex-col">
        <div className="mb-4">
          <label className="block text-sm font-bold text-gray-700 mb-1">公告標題 <span className="text-red-500">*</span></label>
          <input type="text" value={editingAnnouncement.title} onChange={e => setEditingAnnouncement(prev => ({...prev!, title: e.target.value}))} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="輸入標題..." />
        </div>
        <div className="mb-4">
          <label className="block text-sm font-bold text-gray-700 mb-1.5">公告內容 <span className="text-red-500">*</span></label>
          <RichTextEditor
            instanceKey={editingAnnouncement.id}
            value={editingAnnouncement.content}
            onChange={content => setEditingAnnouncement(prev => ({...prev!, content}))}
            placeholder="輸入內容..."
          />
        </div>
        <div className="mb-4">
          <label className="inline-flex items-center text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              className="w-4 h-4 text-indigo-600 rounded mr-2 accent-indigo-600"
              checked={isStudentVisible(editingAnnouncement.visibleToStudents)}
              onChange={(e) =>
                setEditingAnnouncement((prev) =>
                  prev ? { ...prev, visibleToStudents: e.target.checked } : prev
                )
              }
            />
            開放學生查看
          </label>
        </div>
        <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
          <div className="flex justify-between items-center mb-3">
            <label className="block text-sm font-bold text-gray-700">相關連結</label>
            <button type="button" onClick={() => setEditingAnnouncement(prev => ({...prev!, links: [...(prev!.links || []), {name:'', url:''}]}))} className="text-indigo-600 text-xs font-bold hover:text-indigo-800 flex items-center"><PlusIcon className="w-4 h-4 mr-1"/>新增連結</button>
          </div>
          <div className="space-y-2">
            {(editingAnnouncement.links || []).map((link, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input type="text" placeholder="連結名稱" value={link.name} onChange={e => {
                  const newLinks = [...editingAnnouncement.links];
                  newLinks[idx].name = e.target.value;
                  setEditingAnnouncement(prev => ({...prev!, links: newLinks}));
                }} className="w-1/3 border border-gray-300 rounded-lg px-3 py-2 h-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                <input type="url" placeholder="網址 (URL)" value={link.url} onChange={e => {
                  const newLinks = [...editingAnnouncement.links];
                  newLinks[idx].url = e.target.value;
                  setEditingAnnouncement(prev => ({...prev!, links: newLinks}));
                }} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 h-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                <button type="button" onClick={() => {
                  const newLinks = editingAnnouncement.links.filter((_, i) => i !== idx);
                  setEditingAnnouncement(prev => ({...prev!, links: newLinks}));
                }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="移除連結"><TrashIcon className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-100 pt-4">
          <button type="button" onClick={() => setEditingAnnouncement(null)} className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">取消</button>
          <button type="button" onClick={() => void saveEditingAnnouncement()} disabled={annIsSubmitting} className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 flex items-center shadow-sm">
            {annIsSubmitting ? <LoadingSpinner size={16} color="white" className="mr-2" /> : null}儲存
          </button>
        </div>
      </div>
    </Modal>
  ) : null;

  const announcementPanel = showAnnouncementManager ? (
      <div className="animate-fade-in flex flex-col">
        {showAnnouncementManager.status === '已封存' && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-4">
            <span className="font-bold mr-2">提示：</span>
            此課程已封存，您只能查看公告，無法新增或修改。
          </div>
        )}
        {showAnnouncementManager.status !== '已封存' && (
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={() => setEditingAnnouncement({ id: 'new', title: '', content: '', links: [], createdAt: '', visibleToStudents: false })}
              className={btnWithIconStyle(btnStyles.primary)}
            >
              <PlusIcon className="w-4 h-4 mr-2" /> 新增公告
            </button>
          </div>
        )}
        {(showAnnouncementManager.announcements || []).length === 0 ? (
          <div className="text-center min-h-[280px] flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <MegaphoneIcon className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-gray-500 font-medium">目前沒有課程公告</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {(showAnnouncementManager.announcements || [])
              .slice()
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map(ann => (
                <div
                  key={ann.id}
                  className="w-full text-left bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-indigo-200 transition-all duration-300 group"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[2.5rem]">
                    <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                      <div className="hidden sm:flex flex-shrink-0 w-10 h-10 bg-indigo-50 rounded-full items-center justify-center text-indigo-600">
                        <CourseHubFeatureIcon id="announcements" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1 leading-7">
                          {ann.title}
                        </h4>
                        <div className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="inline-flex items-center">
                            <ClockIcon className="w-4 h-4 mr-1 shrink-0" />
                            {new Date(ann.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={tableActionRowWrap}>
                      <StudentVisibilityToggle
                        open={isStudentVisible(ann.visibleToStudents)}
                        disabled={showAnnouncementManager.status === '已封存'}
                        onToggle={() => void handleToggleAnnouncementVisibility(ann)}
                      />
                      <button
                        type="button"
                        onClick={() => setEditingAnnouncement(ann)}
                        className={tableActionStyles.primary}
                      >
                        編輯
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          const result = await Swal.fire({ title: '確定刪除？', text: '刪除後無法復原', icon: 'warning', showCancelButton: true, confirmButtonText: '確定', cancelButtonText: '取消', confirmButtonColor: '#ef4444' });
                          if (result.isConfirmed) {
                            const newAnns = showAnnouncementManager.announcements!.filter(a => a.id !== ann.id);
                            const res = await fetch('/api/courses/update', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: showAnnouncementManager.id, announcements: newAnns })
                            });
                            if (res.ok) {
                              const updatedCourse = { ...showAnnouncementManager, announcements: newAnns };
                              setShowAnnouncementManager(updatedCourse);
                              setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
                            }
                          }
                        }}
                        className={tableActionStyles.danger}
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
        {announcementEditorModal}
      </div>
  ) : (
    <div className="min-h-[280px] flex items-center justify-center">
      <PageLoadingArea />
    </div>
  );

  if (courseCodeFromUrl) {
    if (loading && !resolvedCourseFromUrl) {
      return (
        <div className="page-shell w-full min-w-0 flex flex-col h-full animate-fade-in">
          <PageLoadingArea />
        </div>
      );
    }

    if (!resolvedCourseFromUrl) {
      return (
        <div className="page-shell w-full min-w-0 flex flex-col h-full animate-fade-in">
          <div className="flex flex-col gap-4">
            <BackButton label="返回授課清單" onClick={() => void leaveCourseDetail()} withSpacing={false} />
            <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
              <h3 className="text-xl font-bold text-gray-900">找不到此課程</h3>
              <p className="text-gray-500 text-sm mt-2">請確認課程代碼是否正確，或返回清單重新選擇。</p>
            </div>
          </div>
        </div>
      );
    }

    const course = resolvedCourseFromUrl;
    const featureEmptyState =
      'text-center min-h-[280px] flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200';

    return (
      <>
      <div className="page-shell w-full min-w-0 flex flex-col h-full animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-0">
          <div className="border-l-4 border-indigo-500 pl-4 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
              <BookOpenIcon className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-600 shrink-0" />
              <span className="break-words">{course.name}</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1 break-all">{course.code}</p>
          </div>
        </div>
        <div className="mt-4 mb-6 flex flex-wrap items-center justify-between gap-3">
          <BackButton label="返回授課清單" onClick={() => void leaveCourseDetail()} withSpacing={false} />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                try {
                  openTeacherCoursePreviewInNewTab(course.code);
                } catch (e) {
                  void Swal.fire({
                    icon: 'error',
                    title: '無法開啟預覽',
                    text: e instanceof Error ? e.message : '請允許此網站開啟彈出式視窗',
                  });
                }
              }}
              className="inline-flex items-center px-4 py-2 bg-white border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-50 transition-colors shadow-sm font-medium text-sm"
            >
              <EyeIcon className="w-4 h-4 mr-1.5" />
              學生端預覽
            </button>
            <button
              type="button"
              onClick={() => {
                try {
                  openTeacherCourseInteractInNewTab(course.code);
                } catch (e) {
                  void Swal.fire({
                    icon: 'error',
                    title: '無法開啟課程互動',
                    text: e instanceof Error ? e.message : '請允許此網站開啟彈出式視窗',
                  });
                }
              }}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm font-medium text-sm"
            >
              <BoltIcon className="w-4 h-4 mr-1.5" />
              課程互動
            </button>
          </div>
        </div>

        <div className="space-y-4 mb-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-3 sm:px-6">
            <CourseHubTabNav
              tabs={TEACHER_COURSE_HUB_TAB_IDS}
              active={activeCourseTab}
              audience="teacher"
              onChange={(tab) => void setCourseTab(tab as TeacherCourseTab)}
            />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8">
          {activeCourseTab === 'lessons' && (
            <LessonManager
              courseId={course.id}
              courseName={course.name}
              courseCode={course.code}
              teacherId={userInfo?.id ?? ''}
              isArchived={course.status === '已封存'}
              embedded
              onClose={() => router.push('/back-panel/teacher-courses')}
            />
          )}

          {activeCourseTab === 'announcements' && announcementPanel}

          {activeCourseTab === 'exams' && (
            <div className="animate-fade-in">
              {course.status === '已封存' ? (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-4">
                  <span className="font-bold mr-2">提示：</span>
                  此課程已封存，您只能查看測驗，無法新增或修改。
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
                  {examOrderSaving ? (
                    <p className="text-sm text-gray-500 mr-auto">正在儲存順序…</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openPullQuizModal()}
                    className={btnWithIconStyle(btnStyles.secondary)}
                    disabled={examOrderSaving || courseQuizzesLoading}
                  >
                    <DocumentDuplicateIcon className="w-4 h-4 mr-2" /> 從其他班複製
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(examCreatePath(course.id, teacherCourseHubPath(course.code, 'exams')))}
                    className={btnWithIconStyle(btnStyles.primary)}
                    disabled={examOrderSaving}
                  >
                    <PlusIcon className="w-4 h-4 mr-2" /> 新增測驗
                  </button>
                </div>
              )}
              {courseQuizzesLoading ? (
                <div className="min-h-[280px] flex items-center justify-center">
                  <PageLoadingArea />
                </div>
              ) : courseQuizzes.length === 0 ? (
                <div className={featureEmptyState}>
                  <ClipboardDocumentCheckIcon className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-gray-500 font-medium">此課程尚無關聯的線上測驗</p>
                  <p className="text-sm text-gray-400 mt-1">新增後預設隱藏，點「開放」後學生才能看到並作答</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={(result) => { void handleCourseExamDragEnd(result); }}>
                  <Droppable droppableId="course-exam-list">
                    {(provided: DroppableProvided) => (
                      <div className="grid grid-cols-1 gap-4" ref={provided.innerRef} {...provided.droppableProps}>
                        {courseQuizzes.map((quiz, idx) => {
                          const isPublished = quiz.status === 'published';
                          const canDrag = course.status !== '已封存' && !examOrderSaving;
                          const examsReturnTo = teacherCourseHubPath(course.code, 'exams');
                          return (
                            <Draggable key={quiz.id} draggableId={quiz.id} index={idx} isDragDisabled={!canDrag}>
                              {(dragProvided: DraggableProvided, snapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  style={fixDraggableStyle(dragProvided.draggableProps.style)}
                                  className={`w-full text-left bg-white border rounded-xl p-5 hover:shadow-md transition-shadow duration-200 group ${
                                    snapshot.isDragging ? 'shadow-lg' : ''
                                  } ${
                                    isPublished
                                      ? 'border-gray-100 hover:border-indigo-200'
                                      : 'border-amber-100 hover:border-amber-200'
                                  }`}
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[2.5rem]">
                                    <div className="min-w-0 flex items-start sm:items-center gap-3">
                                      {canDrag ? (
                                        <div
                                          className="cursor-move text-gray-300 hover:text-gray-500 shrink-0 mt-1 sm:mt-0"
                                          {...dragProvided.dragHandleProps}
                                          title="拖曳排序"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Bars3Icon className="w-5 h-5" />
                                        </div>
                                      ) : (
                                        <div className="hidden" {...dragProvided.dragHandleProps} />
                                      )}
                                      <div
                                        className={`hidden sm:flex flex-shrink-0 w-10 h-10 rounded-full items-center justify-center ${
                                          isPublished ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                                        }`}
                                      >
                                        <CourseHubFeatureIcon id="exams" />
                                      </div>
                                      <div className="min-w-0">
                                        <h4 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1 leading-7">
                                          {quiz.title}
                                        </h4>
                                        <div className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                                          <span>滿分 {quiz.totalPoints} 分</span>
                                          {!isPublished && (
                                            <span className="text-amber-600">學生端不可見</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className={tableActionRowWrap}>
                                      <StudentVisibilityToggle
                                        open={isPublished}
                                        disabled={course.status === '已封存' || examOrderSaving}
                                        onToggle={() => void handleToggleCourseQuizVisibility(quiz)}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => router.push(examDetailPath(quiz.quizCode, undefined, examsReturnTo))}
                                        className={tableActionStyles.primary}
                                        disabled={examOrderSaving}
                                      >
                                        編輯
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => router.push(examDetailPath(quiz.quizCode, 'grading', examsReturnTo))}
                                        className={tableActionStyles.success}
                                        disabled={examOrderSaving}
                                      >
                                        批改
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => router.push(examDetailPath(quiz.quizCode, 'analytics', examsReturnTo))}
                                        className={tableActionStyles.secondary}
                                        disabled={examOrderSaving}
                                      >
                                        分析
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleDeleteCourseQuiz(quiz)}
                                        className={tableActionStyles.danger}
                                        disabled={examOrderSaving || quiz.teacherId !== userInfo?.id}
                                        title={quiz.teacherId !== userInfo?.id ? '僅建立者可刪除測驗' : '刪除測驗'}
                                      >
                                        刪除
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>
          )}

          {activeCourseTab === 'surveys' && (
            <div className="animate-fade-in">
              {course.status === '已封存' ? (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-4">
                  <span className="font-bold mr-2">提示：</span>
                  此課程已封存，您只能查看問卷，無法新增或修改。
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-2 mb-4">
                  {surveyOrderSaving ? (
                    <p className="text-sm text-gray-500 mr-auto">正在儲存順序…</p>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => openPullSurveyModal()}
                    className={btnWithIconStyle(btnStyles.secondary)}
                    disabled={surveyOrderSaving || courseSurveysLoading}
                  >
                    <DocumentDuplicateIcon className="w-4 h-4 mr-2" /> 從其他班複製
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(surveyCreatePath(course.id, teacherCourseHubPath(course.code, 'surveys')))}
                    className={btnWithIconStyle(btnStyles.primary)}
                    disabled={surveyOrderSaving}
                  >
                    <PlusIcon className="w-4 h-4 mr-2" /> 新增問卷
                  </button>
                </div>
              )}
              {courseSurveysLoading ? (
                <div className="min-h-[280px] flex items-center justify-center">
                  <PageLoadingArea />
                </div>
              ) : courseSurveys.length === 0 ? (
                <div className={featureEmptyState}>
                  <ClipboardDocumentListIcon className="w-12 h-12 mb-3 text-gray-300" />
                  <p className="text-gray-500 font-medium">此課程尚無關聯的課程問卷</p>
                  <p className="text-sm text-gray-400 mt-1">新增後預設隱藏，點「開放」後學生才能填寫</p>
                </div>
              ) : (
                <DragDropContext onDragEnd={(result) => { void handleCourseSurveyDragEnd(result); }}>
                  <Droppable droppableId="course-survey-list">
                    {(provided: DroppableProvided) => (
                      <div className="grid grid-cols-1 gap-4" ref={provided.innerRef} {...provided.droppableProps}>
                        {courseSurveys.map((survey, idx) => {
                          const isPublished = survey.status === 'published';
                          const canDrag = course.status !== '已封存' && !surveyOrderSaving;
                          const surveysReturnTo = teacherCourseHubPath(course.code, 'surveys');
                          return (
                            <Draggable key={survey.id} draggableId={survey.id} index={idx} isDragDisabled={!canDrag}>
                              {(dragProvided: DraggableProvided, snapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  style={fixDraggableStyle(dragProvided.draggableProps.style)}
                                  className={`w-full text-left bg-white border rounded-xl p-5 hover:shadow-md transition-shadow duration-200 group ${
                                    snapshot.isDragging ? 'shadow-lg' : ''
                                  } ${
                                    isPublished
                                      ? 'border-gray-100 hover:border-indigo-200'
                                      : 'border-amber-100 hover:border-amber-200'
                                  }`}
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 min-h-[2.5rem]">
                                    <div className="min-w-0 flex items-start sm:items-center gap-3">
                                      {canDrag ? (
                                        <div
                                          className="cursor-move text-gray-300 hover:text-gray-500 shrink-0 mt-1 sm:mt-0"
                                          {...dragProvided.dragHandleProps}
                                          title="拖曳排序"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Bars3Icon className="w-5 h-5" />
                                        </div>
                                      ) : (
                                        <div className="hidden" {...dragProvided.dragHandleProps} />
                                      )}
                                      <div
                                        className={`hidden sm:flex flex-shrink-0 w-10 h-10 rounded-full items-center justify-center ${
                                          isPublished ? 'bg-indigo-50 text-indigo-600' : 'bg-amber-50 text-amber-600'
                                        }`}
                                      >
                                        <CourseHubFeatureIcon id="surveys" />
                                      </div>
                                      <button
                                        type="button"
                                        className="min-w-0 text-left"
                                        onClick={() => router.push(surveyDetailPath(survey.surveyCode, undefined, surveysReturnTo))}
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <h4 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1 leading-7">
                                            {survey.title}
                                          </h4>
                                          <span className="inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-700">
                                            {formatSurveyResponseMode(survey.responseMode)}
                                          </span>
                                        </div>
                                        <div className="text-sm text-gray-500 mt-1">
                                          {!isPublished ? (
                                            <span className="text-amber-600">學生端不可見</span>
                                          ) : (
                                            <span>學生端可見</span>
                                          )}
                                        </div>
                                      </button>
                                    </div>
                                    <div className={tableActionRowWrap}>
                                      <StudentVisibilityToggle
                                        open={isPublished}
                                        disabled={course.status === '已封存' || surveyOrderSaving}
                                        onToggle={() => void handleToggleCourseSurveyVisibility(survey)}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => router.push(surveyDetailPath(survey.surveyCode, undefined, surveysReturnTo))}
                                        className={tableActionStyles.primary}
                                        disabled={surveyOrderSaving}
                                      >
                                        編輯
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => router.push(surveyDetailPath(survey.surveyCode, 'analytics', surveysReturnTo))}
                                        className={tableActionStyles.secondary}
                                        disabled={surveyOrderSaving}
                                      >
                                        分析
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void handleDeleteCourseSurvey(survey)}
                                        className={tableActionStyles.danger}
                                        disabled={surveyOrderSaving || survey.teacherId !== userInfo?.id}
                                        title={survey.teacherId !== userInfo?.id ? '僅建立者可刪除問卷' : '刪除問卷'}
                                      >
                                        刪除
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </div>
          )}

          {activeCourseTab === 'attendance' && (
            <AttendanceManagementComponent
              courses={courses}
              userInfo={userInfo}
              courseCodeFromUrl={course.code}
              embedded
              returnTo={teacherCourseHubPath(course.code, 'attendance')}
            />
          )}

          {activeCourseTab === 'grades' && (
            <GradeManager
              userInfo={userInfo}
              courseCodeFromUrl={course.code}
              embedded
              leaveConfirmRef={gradeLeaveConfirmRef}
            />
          )}
          </div>
        </div>
      </div>

      <Modal open={pullModalOpen} onClose={closePullQuizModal} title="從其他班複製測驗" size="lg">
        <div className="space-y-5">
          <p className="text-sm text-gray-500">
            選擇來源班級與測驗後，會複製成<strong>本班獨立草稿</strong>，作答紀錄不會帶入。
          </p>
          <TabNav
            variant="segmented"
            size="compact"
            withMargin={false}
            activeId={pullStep}
            onChange={(id) => {
              if (pullSubmitting) return;
              setPullStep(id as 'course' | 'quiz');
              if (id === 'course') setPullQuizCode('');
            }}
            items={[
              { id: 'course', label: '1. 來源班級' },
              { id: 'quiz', label: '2. 選擇測驗' },
            ]}
          />

          {pullStep === 'course' ? (
            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700 block">來源班級</label>
              <Dropdown
                options={pullQuizGroups.courseOptions}
                value={pullSourceKey}
                onChange={(value) => {
                  setPullSourceKey(value);
                  setPullQuizCode('');
                }}
                placeholder="選擇來源班級"
                className="w-full"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closePullQuizModal} className={btnStyles.ghost} disabled={pullSubmitting}>
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!pullSourceKey) return;
                    setPullStep('quiz');
                  }}
                  className={btnStyles.primary}
                  disabled={!pullSourceKey || pullSubmitting}
                >
                  下一步
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-bold text-gray-700">選擇測驗</label>
                <button
                  type="button"
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  onClick={() => {
                    setPullStep('course');
                    setPullQuizCode('');
                  }}
                  disabled={pullSubmitting}
                >
                  返回上一步
                </button>
              </div>
              {pullQuizzesInSource.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  此班級沒有可複製的測驗
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                  {pullQuizzesInSource.map((quiz) => {
                    const selected = pullQuizCode === quiz.quizCode;
                    const isPublished = quiz.status === 'published';
                    return (
                      <button
                        key={quiz.id}
                        type="button"
                        onClick={() => setPullQuizCode(quiz.quizCode)}
                        disabled={pullSubmitting}
                        className={`w-full text-left rounded-xl border p-4 transition-colors ${
                          selected
                            ? 'border-indigo-400 bg-indigo-50'
                            : 'border-gray-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 line-clamp-1">{quiz.title}</p>
                            <p className="text-sm text-gray-500 mt-1">滿分 {quiz.totalPoints} 分</p>
                          </div>
                          <span
                            className={`shrink-0 inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                              isPublished
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isPublished ? '開放' : '隱藏'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closePullQuizModal} className={btnStyles.ghost} disabled={pullSubmitting}>
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void confirmPullQuiz()}
                  className={btnStyles.primary}
                  disabled={!pullQuizCode || pullSubmitting}
                >
                  {pullSubmitting ? '複製中…' : '複製到本班'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal open={pullSurveyModalOpen} onClose={closePullSurveyModal} title="從其他班複製問卷" size="lg">
        <div className="space-y-5">
          <p className="text-sm text-gray-500">
            選擇來源班級與問卷後，會複製成<strong>本班獨立草稿</strong>，填答紀錄不會帶入。
          </p>
          <TabNav
            variant="segmented"
            size="compact"
            withMargin={false}
            activeId={pullSurveyStep}
            onChange={(id) => {
              if (pullSurveySubmitting) return;
              setPullSurveyStep(id as 'course' | 'survey');
              if (id === 'course') setPullSurveyCode('');
            }}
            items={[
              { id: 'course', label: '1. 來源班級' },
              { id: 'survey', label: '2. 選擇問卷' },
            ]}
          />

          {pullSurveyStep === 'course' ? (
            <div className="space-y-3">
              <label className="text-sm font-bold text-gray-700 block">來源班級</label>
              <Dropdown
                options={pullSurveyGroups.courseOptions}
                value={pullSurveySourceKey}
                onChange={(value) => {
                  setPullSurveySourceKey(value);
                  setPullSurveyCode('');
                }}
                placeholder="選擇來源班級"
                className="w-full"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closePullSurveyModal} className={btnStyles.ghost} disabled={pullSurveySubmitting}>
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!pullSurveySourceKey) return;
                    setPullSurveyStep('survey');
                  }}
                  className={btnStyles.primary}
                  disabled={!pullSurveySourceKey || pullSurveySubmitting}
                >
                  下一步
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-bold text-gray-700">選擇問卷</label>
                <button
                  type="button"
                  className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                  onClick={() => {
                    setPullSurveyStep('course');
                    setPullSurveyCode('');
                  }}
                  disabled={pullSurveySubmitting}
                >
                  返回上一步
                </button>
              </div>
              {pullSurveysInSource.length === 0 ? (
                <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                  此班級沒有可複製的問卷
                </div>
              ) : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto custom-scrollbar pr-1">
                  {pullSurveysInSource.map((survey) => {
                    const selected = pullSurveyCode === survey.surveyCode;
                    const isPublished = survey.status === 'published';
                    return (
                      <button
                        key={survey.id}
                        type="button"
                        onClick={() => setPullSurveyCode(survey.surveyCode)}
                        disabled={pullSurveySubmitting}
                        className={`w-full text-left rounded-xl border p-4 transition-colors ${
                          selected
                            ? 'border-indigo-400 bg-indigo-50'
                            : 'border-gray-100 bg-white hover:border-indigo-200 hover:bg-indigo-50/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 line-clamp-1">{survey.title}</p>
                            <p className="text-sm text-gray-500 mt-1">{formatSurveyResponseMode(survey.responseMode)}</p>
                          </div>
                          <span
                            className={`shrink-0 inline-flex text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                              isPublished
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {isPublished ? '開放' : '隱藏'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closePullSurveyModal} className={btnStyles.ghost} disabled={pullSurveySubmitting}>
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void confirmPullSurvey()}
                  className={btnStyles.primary}
                  disabled={!pullSurveyCode || pullSurveySubmitting}
                >
                  {pullSurveySubmitting ? '複製中…' : '複製到本班'}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>
      </>
    );
  }

  if (showLessonManager) {
    return (
      <LessonManager
        courseId={showLessonManager.id}
        courseName={showLessonManager.name}
        courseCode={showLessonManager.code}
        teacherId={userInfo?.id ?? ''}
        isArchived={showLessonManager.status === '已封存'}
        onClose={() => setShowLessonManager(null)}
      />
    );
  }

  return (
    <div className="page-shell w-full min-w-0 flex flex-col h-full animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <BookOpenIcon className="h-8 w-8 text-indigo-600" />
            授課管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">管理您的授課課程、學生與內容</p>
        </div>
      </div>

      {/* 篩選器 */}
      {!loading && courses.length > 0 && (
        <CourseFilter
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          selectedGrade={selectedGrade}
          onGradeChange={setSelectedGrade}
          selectedSubject={selectedSubject}
          onSubjectChange={setSelectedSubject}
          selectedNature={selectedNature}
          onNatureChange={setSelectedNature}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          onReset={() => {
            setSearchTerm('');
            setSelectedGrade('all');
            setSelectedSubject('all');
            setSelectedNature('all');
            setSelectedStatus('all');
          }}
        />
      )}

       {loading ? (
           <PageLoadingArea />
       ) : filteredCourses.length === 0 ? (
           <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
               <h3 className="mt-2 text-xl font-bold text-gray-900">尚無授課課程</h3>
           </div>
       ) : (
           <>
             <div className={courseListTableStyles.desktop.wrapper}>
              <table className={courseListTableStyles.desktop.table}>
                  <thead className={courseListTableStyles.desktop.thead}>
                      <tr>
                          <th className={`${courseListTableStyles.desktop.th} min-w-[200px]`}>課程名稱</th>
                          <th className={`${courseListTableStyles.desktop.th} min-w-[150px]`}>授課老師</th>
                          <th className={`${courseListTableStyles.desktop.th} min-w-[180px]`}>上課時間</th>
                          <th className={`${courseListTableStyles.desktop.th} text-center whitespace-nowrap`}>狀態</th>
                          <th className={`${courseListTableStyles.desktop.th} text-right min-w-[180px]`}>操作</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {filteredCourses.map(course => (
                          <tr key={course.id} className={courseListTableStyles.desktop.row}>
                              <td className="px-6 py-4">
                                  <div className={`${courseListTableStyles.desktop.courseName} whitespace-nowrap overflow-hidden text-ellipsis`}>{course.name}</div>
                                  <div className={courseListTableStyles.desktop.courseCode}>{course.code}</div>
                              </td>
                              <td className="px-6 py-4 max-w-[200px]">
                                  <div className="flex items-center w-full">
                                      <div className={courseListTableStyles.desktop.teacherAvatar}>{teacherNamesMap[course.id]?.[0]?.[0] || '師'}</div>
                                      <div className={courseListTableStyles.desktop.teacherName} title={teacherNamesMap[course.id] ? (teacherNamesMap[course.id].length > 0 ? teacherNamesMap[course.id].join('、') : '未指定') : '載入中...'}>
                                          {teacherNamesMap[course.id] ? (teacherNamesMap[course.id].length > 0 ? teacherNamesMap[course.id].join('、') : '未指定') : '載入中...'}
                                      </div>
                                  </div>
                              </td>
                              <td className={courseListTableStyles.desktop.classTimesCell}>
                                  <div className={courseListTableStyles.desktop.classTimes}>
                                      {(course.classTimes || []).map((ct, i) => <div key={i}>{`${(ct as unknown as ClassTime).day} ${(ct as unknown as ClassTime).startTime}-${(ct as unknown as ClassTime).endTime}`}</div>)}
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                  <span className={`${courseListTableStyles.desktop.statusBadge} ${getCourseStatusColor(course.status)}`}>{course.status}</span>
                              </td>
                              <td className="px-6 py-4 text-right whitespace-nowrap">
                                  <div className={courseListTableStyles.desktop.actionRow}>
                                      <button className={courseListTableStyles.desktop.actionPrimary} onClick={() => openCourseDetail(course, 'lessons')}>管理</button>
                                      <button className={courseListTableStyles.desktop.actionSecondary} onClick={() => handleShowCourseDetail(course)}>詳情</button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
             </div>
             
             <div className={courseListTableStyles.mobile.wrapper}>
                {filteredCourses.map(course => (
                    <div key={course.id} className={courseListTableStyles.mobile.card}>
                        <div className="mb-2">
                            <div className={courseListTableStyles.mobile.courseName}>{course.name}</div>
                        </div>
                        <div className={courseListTableStyles.mobile.courseCode}>{course.code}</div>
                        <div className="mb-4">
                            <span className={`${courseListTableStyles.mobile.statusBadge} ${getCourseStatusColor(course.status)}`}>{course.status}</span>
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                            <button className={courseListTableStyles.mobile.actionPrimary} onClick={() => openCourseDetail(course, 'lessons')}>管理</button>
                            <button className={courseListTableStyles.mobile.actionSecondary} onClick={() => handleShowCourseDetail(course)}>詳情</button>
                        </div>
                    </div>
                ))}
             </div>
           </>
       )}

       {showCourseDetail && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCourseDetail(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-full sm:max-h-[90vh] overflow-hidden flex flex-col animate-bounce-in">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 flex justify-between items-center text-white flex-shrink-0">
              <h2 className="text-xl font-bold pr-8 line-clamp-1 flex items-center">
                編輯課程資訊
              </h2>
              <button 
                onClick={() => setShowCourseDetail(null)}
                className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Form Layout */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              {/* Section 1: Basic Info (Read-only) */}
              <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                  <span className="w-1 h-4 bg-indigo-500 rounded-full mr-2"></span>
                  基本資訊 (僅供檢視)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">課程名稱</label>
                    <input type="text" value={showCourseDetail.name} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">課程代碼</label>
                    <input type="text" value={showCourseDetail.code} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">授課老師</label>
                    <input type="text" value={getTeacherNames(showCourseDetail.teachers)} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                </div>
              </div>

              {/* Section 2: Content & Categorization (Partially Editable) */}
              <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                  <span className="w-1 h-4 bg-purple-500 rounded-full mr-2"></span>
                  內容與分類
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">課程性質</label>
                    <input type="text" value={showCourseDetail.courseNature || '未指定'} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">科目</label>
                    <input type="text" value={showCourseDetail.subjectTag || '未指定'} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">適用年級</label>
                    <input type="text" value={getGradeTags(showCourseDetail.gradeTags)} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">課程描述 <span className="text-indigo-500 text-xs ml-2 font-normal">(可編輯)</span></label>
                    <textarea 
                      value={showCourseDetail.description || ''} 
                      onChange={e => setShowCourseDetail(prev => prev ? { ...prev, description: e.target.value } : null)} 
                      className="w-full p-3 border border-gray-300 rounded-lg h-48 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none" 
                      placeholder="請描述課程內容、目標等..."
                    ></textarea>
                  </div>
                  <div className="md:col-span-2 mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
                      <span>自訂連結按鈕 <span className="text-indigo-500 text-xs ml-2 font-normal">(可編輯)</span></span>
                      <button type="button" onClick={() => setShowCourseDetail(prev => prev ? { ...prev, customLinks: [...(prev.customLinks || []), { name: '', url: '', icon: 'LinkIcon' }] } : null)} className="text-indigo-600 text-xs hover:text-indigo-800 flex items-center">
                        <PlusIcon className="w-4 h-4 mr-1" /> 新增連結
                      </button>
                    </label>
                    <div className="space-y-3 bg-white p-3 rounded-xl border border-gray-200">
                      {(showCourseDetail.customLinks || []).map((link, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <div className="w-full sm:w-36">
                            <Dropdown
                              value={link.icon}
                              onChange={(icon) => {
                                const newLinks = [...(showCourseDetail.customLinks || [])];
                                newLinks[idx] = { ...newLinks[idx], icon };
                                setShowCourseDetail(prev => prev ? { ...prev, customLinks: newLinks } : null);
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
                            onChange={(e) => {
                              const newLinks = [...(showCourseDetail.customLinks || [])];
                              newLinks[idx] = { ...newLinks[idx], name: e.target.value };
                              setShowCourseDetail(prev => prev ? { ...prev, customLinks: newLinks } : null);
                            }}
                            className="w-full sm:w-1/4 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 outline-none h-10"
                          />
                          <input 
                            type="url" 
                            placeholder="網址 (URL)" 
                            value={link.url} 
                            onChange={(e) => {
                              const newLinks = [...(showCourseDetail.customLinks || [])];
                              newLinks[idx] = { ...newLinks[idx], url: e.target.value };
                              setShowCourseDetail(prev => prev ? { ...prev, customLinks: newLinks } : null);
                            }}
                            className="w-full sm:flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 outline-none h-10"
                          />
                          <button type="button" onClick={() => {
                              const newLinks = [...(showCourseDetail.customLinks || [])];
                              newLinks.splice(idx, 1);
                              setShowCourseDetail(prev => prev ? { ...prev, customLinks: newLinks } : null);
                          }} className="text-red-500 hover:bg-red-50 p-2 rounded-lg shrink-0">
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                      {!(showCourseDetail.customLinks && showCourseDetail.customLinks.length > 0) && (
                        <div className="text-sm text-gray-400 italic py-1">尚無自訂連結</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Time & Location (Read-only) */}
              <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                  <span className="w-1 h-4 bg-green-500 rounded-full mr-2"></span>
                  時間與地點 (僅供檢視)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
                    <input type="text" value={formatCourseDateForDisplay(showCourseDetail.startDate)} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
                    <input type="text" value={formatCourseDateForDisplay(showCourseDetail.endDate)} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">授課方式</label>
                    <input type="text" value={showCourseDetail.teachingMethod || '未指定'} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">上課地點 / 直播網址</label>
                    <input type="text" value={showCourseDetail.location || showCourseDetail.liveStreamURL || '未指定'} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="md:col-span-2">
                     <label className="block text-sm font-medium text-gray-700 mb-2">上課時段</label>
                     {Array.isArray(showCourseDetail.classTimes) && showCourseDetail.classTimes.length > 0 ? (
                        <div className="bg-gray-100 border border-gray-200 rounded-lg overflow-hidden"> 
                           {showCourseDetail.classTimes.map((time: unknown, idx: number) => (
                             <div key={idx} className="px-4 py-3 border-b border-gray-200 last:border-0 flex items-center text-gray-500 text-sm">
                                <ClockIcon className="w-4 h-4 mr-3 text-gray-400" />
                                {typeof time === 'object' && time !== null
                                  ? `${(time as ClassTime).day} ${(time as ClassTime).startTime} ~ ${(time as ClassTime).endTime}`
                                  : String(time)}
                             </div>
                           ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm p-2.5 bg-gray-100 rounded-lg border border-gray-200">未設定上課時段</p>
                      )}
                  </div>
                </div>
              </div>

              {/* Section 4: Status (Read-only) */}
              <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                  <span className="w-1 h-4 bg-yellow-500 rounded-full mr-2"></span>
                  狀態 (僅供檢視)
                </h3>
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">課程狀態</label>
                    <input type="text" value={showCourseDetail.status || '未指定'} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                </div>
              </div>
              
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/50">
              <button
                onClick={() => setShowCourseDetail(null)}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-medium transition-colors shadow-sm"
                disabled={isSavingCourse}
              >
                取消
              </button>
              <button
                onClick={handleUpdateCourseDescription}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium shadow-sm transition-colors flex items-center justify-center disabled:opacity-50"
                disabled={isSavingCourse}
              >
                {isSavingCourse && <LoadingSpinner size={16} color="white" className="mr-2" />}
                儲存變更
              </button>
            </div>
          </div>
        </div>, document.body
       )}
    </div>
  );
}