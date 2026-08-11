'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import "react-datepicker/dist/react-datepicker.css";
import Swal from '@/utils/swalTheme';
import { LoadingSpinner, PageLoadingArea, BackButton, btnStyles, btnWithIconStyle, tableActionStyles, tableActionRowWrap, TabNav } from './ui';
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided } from '@hello-pangea/dnd';
import { fixDraggableStyle } from '@/utils/dndStyle';
import { 
  PlusIcon, 
  TrashIcon, 
  BookOpenIcon,
  CloudArrowUpIcon,
  Bars3Icon,
  XMarkIcon,
  LinkIcon,
  VideoCameraIcon,
  ClockIcon,
  EyeIcon,
  MegaphoneIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  DocumentDuplicateIcon,
  BoltIcon,
  ChevronDownIcon,
  ChartBarIcon,
  ChatBubbleLeftRightIcon,
  InformationCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import CourseFilter from './CourseFilter';
import Dropdown from './ui/Dropdown';
import StatCard from './console/StatCard';
import { courseListTableStyles, filterAndSortCoursesForList, getTeacherCourseBucket, getTeacherCourseBucketBadgeClass } from './studentCourseListShared';
import { isCourseArchived } from '@/services/courseArchive';
import { formatCourseDateForDisplay } from '@/services/courseDate';
import { filterQuizzesForCourse } from '@/services/gradeQuizImport';
import type { Quiz } from '@/services/quizTypes';
import { normalizeAssignedCourses, validateQuizForPublish } from '@/services/quizTypes';
import { getLessonAssignedQuizCodes } from '@/services/lessonQuiz';
import { examDetailPath, examCreatePath } from '@/utils/examRoutes';
import { surveyDetailPath, surveyCreatePath } from '@/utils/surveyRoutes';
import {
  teacherCourseHubPath,
  parseTeacherCourseTab,
  type TeacherCourseHubTab,
} from '@/utils/teacherCourseHub';
import { teacherLessonCreatePath, teacherLessonEditPath } from '@/utils/lessonRoutes';
import {
  teacherAnnouncementCreatePath,
  teacherAnnouncementEditPath,
} from '@/utils/announcementRoutes';
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
  courseHubFeatureListStyles,
} from './CourseHubTabNav';
import StudentVisibilityToggle, { isStudentVisible } from './StudentVisibilityToggle';
import TeacherLessonEditor, { type LessonData } from './TeacherLessonEditor';
import TeacherAnnouncementEditor, { type CourseAnnouncement } from './TeacherAnnouncementEditor';
import TeacherAnnouncementList from './TeacherAnnouncementList';
import TeacherExamList from './TeacherExamList';
import TeacherSurveyList from './TeacherSurveyList';

const GradeManager = dynamic(() => import('./GradeManager'), { ssr: false });
const AttendanceManagementComponent = dynamic(() => import('./AttendanceManagementComponent'), { ssr: false });

const TEACHER_COURSE_TABS = TEACHER_COURSE_HUB_TAB_IDS;
type TeacherCourseTab = (typeof TEACHER_COURSE_TABS)[number];

function buildTeacherCourseTabUrl(courseCode: string, tab: TeacherCourseTab): string {
  return teacherCourseHubPath(courseCode, tab as TeacherCourseHubTab);
}

const customLinkIconOptions = [
  { value: 'LinkIcon', label: '預設連結' },
  { value: 'VideoCameraIcon', label: '視訊會議' },
  { value: 'DocumentTextIcon', label: '文件' },
  { value: 'FolderIcon', label: '資料夾' },
  { value: 'ChatBubbleLeftRightIcon', label: '討論區' },
];

// --- 1. 共用 Modal 元件 ---
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
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidthClass} max-h-full sm:max-h-[90vh] flex flex-col overflow-hidden animate-bounce-in border border-outline-variant/40`}>
        <div className="bg-gradient-to-r from-primary to-tertiary p-4 flex justify-between items-center text-white flex-shrink-0">
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

interface CustomLink {
  name: string;
  url: string;
  icon: string;
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
  /** 課堂編輯深連結：new 或 lessonId */
  lessonIdFromUrl?: string;
  /** 公告編輯深連結：new 或 announcementId */
  announcementIdFromUrl?: string;
  returnToFromUrl?: string;
  /** 頂欄搜尋（受控）；未傳則使用元件內狀態 */
  listSearchTerm?: string;
  onListSearchChange?: (value: string) => void;
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

/** 內容列摘要（單元下拉內的一筆內容） */
function getContentBrief(lesson: LessonData): string {
  const bits: string[] = [];
  const videoCount = (lesson.videos || []).some((v) => typeof v === 'string' && v.trim()) ? 1 : 0;
  const attCount = (lesson.attachments || []).filter((a) => a?.url?.trim()).length;
  const quizCount = getLessonAssignedQuizCodes(lesson).length;
  if (videoCount > 0) bits.push(`影片 ${videoCount}`);
  if (attCount > 0) bits.push(`教材 ${attCount}`);
  if (quizCount > 0) bits.push(`測驗 ${quizCount}`);
  if (lesson.noHomework === false || lesson.homework?.trim()) bits.push('作業');
  if (lesson.date) bits.push(lesson.date);
  return bits.length > 0 ? bits.join(' · ') : '尚未設定細節';
}

// 課程大綱：單元（下拉包裝）→ 內容（列在單元內）
function LessonManager({
  courseId,
  courseName,
  courseCode,
  onClose,
  isArchived = false,
  embedded = false,
  onPreviewCourse,
}: {
  courseId: string;
  courseName: string;
  courseCode: string;
  teacherId: string;
  onClose: () => void;
  isArchived?: boolean;
  embedded?: boolean;
  onPreviewCourse?: () => void;
}) {
  const router = useRouter();
  const [lessons, setLessons] = useState<LessonData[]>([]);
  const [isOrderDirty, setIsOrderDirty] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [unitExpanded, setUnitExpanded] = useState(true);

  const lessonsReturnTo = teacherCourseHubPath(courseCode, 'lessons');

  const fetchLessons = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await fetchTeacherCourseLessons(courseId);
      const sortedLessons = Array.isArray(data)
        ? (data as LessonData[]).sort((a, b) => {
            const aOrder = typeof a.order === 'number' ? a.order : 9999;
            const bOrder = typeof b.order === 'number' ? b.order : 9999;
            if (aOrder === 9999 && bOrder === 9999) {
              return (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0);
            }
            return aOrder - bOrder;
          })
        : [];
      setLessons(sortedLessons);
    } catch {
      void Swal.fire('錯誤', '讀取內容失敗', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) void fetchLessons();
  }, [courseId, fetchLessons]);

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
          body: JSON.stringify({ courseId, order: lessons.map((l) => l.id) }),
        });
      }
      void Swal.fire('成功', '變更已儲存', 'success');
      setIsOrderDirty(false);
      invalidateTeacherCourseLessons(courseId);
    } catch {
      void Swal.fire('錯誤', '儲存變更失敗', 'error');
    } finally {
      await fetchLessons();
      setIsSubmitting(false);
    }
  };

  /** 開啟內容編輯；無 id 則新增（可指定 contentType，如 video） */
  const openContent = (contentId?: string, contentType?: 'video') => {
    const path = contentId
      ? teacherLessonEditPath(courseCode, contentId, lessonsReturnTo)
      : teacherLessonCreatePath(
          courseCode,
          lessonsReturnTo,
          contentType ? { contentType } : undefined
        );
    router.push(path);
  };

  /** 單元管理：展開單元以檢視／新增其下內容 */
  const openUnitManage = () => {
    setUnitExpanded(true);
  };

  const handleDeleteContent = async (contentId: string) => {
    const result = await Swal.fire({
      title: '請確認',
      text: '確定要刪除此內容嗎？',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      confirmButtonText: '刪除',
      cancelButtonText: '取消',
      customClass: { popup: 'rounded-2xl' },
    });
    if (!result.isConfirmed) return;
    try {
      await fetch('/api/lessons/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, lessonId: contentId }),
      });
      invalidateTeacherCourseLessons(courseId);
      setLessons((prev) => prev.filter((l) => l.id !== contentId));
      void Swal.fire('已刪除', '內容已移除', 'success');
    } catch {
      void Swal.fire('錯誤', '刪除失敗', 'error');
    }
  };

  const handleToggleContentVisibility = async (lesson: LessonData) => {
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
        }),
      });
      if (!res.ok) throw new Error('update failed');
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
      void Swal.fire('成功', `已${nextVisible ? '開放' : '隱藏'}此內容給學生查看。`, 'success');
    } catch (error) {
      console.error('更新內容可見性失敗:', error);
      void Swal.fire('錯誤', '更新內容可見性失敗', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const visibleCount = lessons.filter((l) => isStudentVisible(l.visibleToStudents)).length;
  const openRate = lessons.length ? Math.round((visibleCount / lessons.length) * 100) : 0;

  return (
    <div
      className={
        embedded
          ? 'w-full min-w-0 flex flex-col animate-fade-in pb-24'
          : 'page-shell w-full min-w-0 pb-10 flex flex-col animate-fade-in'
      }
    >
      {!embedded && (
        <>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-0">
            <div className="border-l-4 border-primary pl-4">
              <h1 className="font-display text-2xl font-bold text-on-surface flex items-center gap-3">
                <BookOpenIcon className="h-8 w-8 text-primary" />
                {courseName}
              </h1>
              <p className="text-on-surfaceVariant text-sm mt-1">{courseCode}</p>
            </div>
          </div>
          {isArchived && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-4">
              <span className="font-bold mr-2">提示：</span>
              此課程已封存，您只能查看資料，無法新增或修改。
            </div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4 mb-6">
            <BackButton label="返回列表" onClick={onClose} withSpacing={false} />
          </div>
        </>
      )}
      {embedded && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-outline-variant mb-5">
            <div>
              <h2 className="font-display text-xl md:text-2xl font-bold text-on-surface">課程大綱</h2>
            </div>
          </div>
          {isArchived && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-4">
              <span className="font-bold mr-2">提示：</span>
              此課程已封存，您只能查看資料，無法新增或修改。
            </div>
          )}
        </>
      )}

      {isLoading ? (
        <PageLoadingArea />
      ) : (
        <div className="bg-surface-containerLowest rounded-xl shadow-sm border border-outline-variant/40 overflow-hidden">
          {/* 單元（下拉包裝） */}
          <div className="flex items-center justify-between gap-2 p-4 hover:bg-surface-containerLow/80 transition-colors group">
            <button
              type="button"
              aria-expanded={unitExpanded}
              onClick={() => setUnitExpanded((v) => !v)}
              className="flex items-center gap-3 min-w-0 flex-1 text-left"
            >
              <Bars3Icon className="w-5 h-5 text-outline shrink-0" aria-hidden />
              <div className="min-w-0">
                <h3 className="font-display font-bold text-on-surface group-hover:text-primary transition-colors truncate">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-primary/80 mr-2">
                    單元
                  </span>
                  {courseName}
                </h3>
                <p className="text-sm text-on-surfaceVariant mt-0.5">
                  {lessons.length} 項內容
                  {lessons.length > 0 ? ` · 開放率 ${openRate}%` : ''}
                </p>
              </div>
            </button>
            <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
              {!isArchived ? (
                <button
                  type="button"
                  aria-label="單元管理"
                  title="單元管理"
                  onClick={openUnitManage}
                  className="text-on-surfaceVariant hover:text-primary transition-colors p-2 rounded-lg hover:bg-primary/5"
                >
                  <i className="fas fa-pen text-sm" aria-hidden />
                </button>
              ) : null}
              <button
                type="button"
                aria-label={unitExpanded ? '收合單元' : '展開單元'}
                onClick={() => setUnitExpanded((v) => !v)}
                className="p-2 rounded-lg text-on-surfaceVariant hover:bg-surface-container transition-colors"
              >
                <ChevronDownIcon
                  className={`w-5 h-5 transition-transform duration-300 ${unitExpanded ? 'rotate-180' : ''}`}
                />
              </button>
            </div>
          </div>

          {/* 內容（在單元下拉內） */}
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-out ${
              unitExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
            }`}
          >
            <div className="overflow-hidden">
              <div className="border-t border-outline-variant/30 p-2 flex flex-col gap-1">
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="lesson-list">
                    {(provided: DroppableProvided) => (
                      <div
                        className="flex flex-col gap-1"
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        {lessons.length === 0 ? (
                          <div className="text-center py-14 px-4">
                            <BookOpenIcon className="w-12 h-12 mb-3 text-outline/40 mx-auto" />
                            <p className="text-on-surfaceVariant font-medium">此單元尚無內容</p>
                            {!isArchived ? (
                              <button
                                type="button"
                                onClick={() => openContent()}
                                className="mt-4 inline-flex items-center gap-2 text-primary font-semibold text-sm hover:underline"
                              >
                                <PlusIcon className="w-4 h-4" /> 新增第一筆內容
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          lessons.map((lesson, idx) => {
                            const visible = isStudentVisible(lesson.visibleToStudents);
                            return (
                              <Draggable
                                key={lesson.id}
                                draggableId={lesson.id}
                                index={idx}
                                isDragDisabled={isArchived}
                              >
                                {(dragProvided: DraggableProvided, snapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    style={fixDraggableStyle(dragProvided.draggableProps.style)}
                                    className={`flex items-center justify-between p-3 rounded-lg hover:bg-surface-containerLow transition-colors group ${
                                      snapshot.isDragging
                                        ? 'shadow-lg ring-2 ring-primary/30 bg-surface-containerLowest'
                                        : ''
                                    } ${!visible ? 'opacity-75' : ''}`}
                                  >
                                    <div className="flex items-center gap-3 min-w-0">
                                      {!isArchived ? (
                                        <div
                                          className="cursor-grab text-outline opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                                          {...dragProvided.dragHandleProps}
                                          title="拖曳排序內容"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <Bars3Icon className="w-5 h-5" />
                                        </div>
                                      ) : (
                                        <span className="w-5 shrink-0" />
                                      )}
                                      <div className="w-10 h-10 rounded-lg bg-secondary-container/40 flex items-center justify-center text-secondary shrink-0">
                                        <DocumentTextIcon className="w-5 h-5" />
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => openContent(lesson.id)}
                                        className="min-w-0 text-left"
                                      >
                                        <h4 className="font-semibold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                                          <span className="font-mono text-[11px] uppercase tracking-wider text-secondary/90 mr-1.5">
                                            內容
                                          </span>
                                          {idx + 1}. {lesson.title}
                                        </h4>
                                        <p className="text-xs text-on-surfaceVariant mt-0.5 line-clamp-1">
                                          {getContentBrief(lesson)}
                                          {!visible ? ' · 對學生隱藏' : ''}
                                        </p>
                                      </button>
                                    </div>
                                    <div
                                      className="flex items-center gap-0.5 shrink-0"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      {!isArchived ? (
                                        <>
                                          <StudentVisibilityToggle
                                            open={visible}
                                            disabled={isSubmitting}
                                            onToggle={() => void handleToggleContentVisibility(lesson)}
                                          />
                                          <button
                                            type="button"
                                            aria-label="刪除內容"
                                            onClick={() => void handleDeleteContent(lesson.id)}
                                            className="text-on-surfaceVariant hover:text-error transition-colors p-2 rounded-lg hover:bg-error/5"
                                          >
                                            <TrashIcon className="w-5 h-5" />
                                          </button>
                                        </>
                                      ) : null}
                                    </div>
                                  </div>
                                )}
                              </Draggable>
                            );
                          })
                        )}
                        {provided.placeholder}
                        {!isArchived ? (
                          <div className="mt-3 mx-1 mb-2 rounded-2xl border-2 border-dashed border-outline-variant bg-surface-containerLow/60 p-5 text-center">
                            <h4 className="font-display font-bold text-on-surface text-base mb-1">
                              新增內容模組
                            </h4>
                            <p className="text-xs text-on-surfaceVariant mb-4">
                              掛在本單元下；影片、教材、測驗、作業為同層內容（影片內不再掛模組）。
                            </p>
                            <div className="flex flex-wrap justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => openContent(undefined, 'video')}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-containerLowest border border-outline-variant hover:border-tertiary text-on-surface text-sm transition-all shadow-sm"
                              >
                                <VideoCameraIcon className="w-4 h-4 text-tertiary" />
                                新增影片
                              </button>
                              <button
                                type="button"
                                onClick={() => openContent()}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-containerLowest border border-outline-variant hover:border-secondary text-on-surface text-sm transition-all shadow-sm"
                              >
                                <DocumentTextIcon className="w-4 h-4 text-secondary" />
                                新增教材
                              </button>
                              <button
                                type="button"
                                onClick={() => openContent()}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-containerLowest border border-outline-variant hover:border-primary text-on-surface text-sm transition-all shadow-sm"
                              >
                                <ClipboardDocumentCheckIcon className="w-4 h-4 text-primary" />
                                新增測驗
                              </button>
                              <button
                                type="button"
                                onClick={() => openContent()}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-containerLowest border border-outline-variant hover:border-warning text-on-surface text-sm transition-all shadow-sm"
                              >
                                <DocumentTextIcon className="w-4 h-4 text-warning" />
                                新增作業
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  void Swal.fire({
                                    icon: 'info',
                                    title: '課程問卷',
                                    text: '問卷請至本課程「問卷分析」分頁建立與管理。',
                                    confirmButtonColor: '#2D6DF6',
                                  })
                                }
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-containerLowest border border-outline-variant hover:border-on-surfaceVariant text-on-surface text-sm transition-all shadow-sm"
                              >
                                <ClipboardDocumentListIcon className="w-4 h-4 text-on-surfaceVariant" />
                                新增問卷
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            </div>
          </div>
        </div>
      )}

      {embedded && isOrderDirty && !isArchived ? (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 lg:left-[calc(50%+1.5rem)] flex items-center gap-4 md:gap-6 rounded-full bg-on-surface/95 backdrop-blur-md text-white px-4 md:px-6 py-3 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            <span className="text-sm text-white/80 whitespace-nowrap">有未儲存的變更</span>
          </div>
          <div className="h-6 w-px bg-white/20" />
          {onPreviewCourse ? (
            <button
              type="button"
              onClick={onPreviewCourse}
              className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-primary-fixed hover:text-white transition-colors"
            >
              <EyeIcon className="w-5 h-5" />
              預覽課程
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSaveChanges()}
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 bg-primary text-on-primary px-4 md:px-5 py-2 rounded-full text-sm font-semibold hover:bg-primary-container transition-colors disabled:opacity-60"
          >
            {isSubmitting ? (
              <LoadingSpinner size={16} color="white" />
            ) : (
              <>
                <CloudArrowUpIcon className="w-5 h-5" />
                儲存變更
              </>
            )}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function TeacherCourseManager({
  userInfo,
  courses: propCourses,
  courseCodeFromUrl = '',
  tabFromUrl = '',
  lessonIdFromUrl = '',
  announcementIdFromUrl = '',
  returnToFromUrl = '',
  listSearchTerm,
  onListSearchChange,
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
  const [internalSearchTerm, setInternalSearchTerm] = useState('');
  const searchControlled = typeof onListSearchChange === 'function';
  const searchTerm = searchControlled ? (listSearchTerm ?? '') : internalSearchTerm;
  const setSearchTerm = searchControlled ? onListSearchChange : setInternalSearchTerm;
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedNature, setSelectedNature] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [showAnnouncementManager, setShowAnnouncementManager] = useState<Course | null>(null);
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
      if (!c) return '未指定班級';
      const archived = isCourseArchived(c);
      return archived
        ? `${c.name}（${c.code}）· 已封存`
        : `${c.name}（${c.code}）`;
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
    courseOptions.sort((a, b) => {
      const aArchived = a.label.includes('已封存') ? 1 : 0;
      const bArchived = b.label.includes('已封存') ? 1 : 0;
      if (aArchived !== bArchived) return aArchived - bArchived;
      return a.label.localeCompare(b.label, 'zh-Hant');
    });
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
        confirmButtonColor: '#2D6DF6',
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
      if (!c) return '未指定班級';
      const archived = isCourseArchived(c);
      return archived
        ? `${c.name}（${c.code}）· 已封存`
        : `${c.name}（${c.code}）`;
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
    courseOptions.sort((a, b) => {
      const aArchived = a.label.includes('已封存') ? 1 : 0;
      const bArchived = b.label.includes('已封存') ? 1 : 0;
      if (aArchived !== bArchived) return aArchived - bArchived;
      return a.label.localeCompare(b.label, 'zh-Hant');
    });
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
        confirmButtonColor: '#2D6DF6',
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
        confirmButtonColor: '#2D6DF6',
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
        confirmButtonColor: '#2D6DF6',
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
        confirmButtonColor: '#2D6DF6',
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
        confirmButtonColor: '#2D6DF6',
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
        confirmButtonColor: '#2D6DF6',
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
      Swal.fire({ icon: 'success', title: '已刪除', confirmButtonColor: '#2D6DF6' });
    } catch {
      Swal.fire({ icon: 'error', title: '刪除失敗', confirmButtonColor: '#2D6DF6' });
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
    // Key off course id only — avoid re-fetch when resolvedCourseFromUrl object identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Key off course id only — avoid re-fetch when resolvedCourseFromUrl object identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      Swal.fire({ icon: 'success', title: '已刪除', confirmButtonColor: '#2D6DF6' });
    } catch {
      Swal.fire({ icon: 'error', title: '刪除失敗', confirmButtonColor: '#2D6DF6' });
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
          confirmButtonColor: '#2D6DF6',
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
        confirmButtonColor: '#2D6DF6',
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: error instanceof Error ? error.message : '更新失敗',
        confirmButtonColor: '#2D6DF6',
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
          confirmButtonColor: '#2D6DF6',
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
        confirmButtonColor: '#2D6DF6',
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: error instanceof Error ? error.message : '更新失敗',
        confirmButtonColor: '#2D6DF6',
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
        confirmButtonColor: '#2D6DF6',
      });
    } catch {
      Swal.fire({ icon: 'error', title: '更新失敗', confirmButtonColor: '#2D6DF6' });
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
        confirmButtonColor: '#2D6DF6',
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
        confirmButtonColor: '#2D6DF6',
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
      } catch {}
  };

  useEffect(() => {
    if (activeCourseTab === 'announcements' && resolvedCourseFromUrl) {
      void handleShowAnnouncementManager(resolvedCourseFromUrl);
    } else {
      setShowAnnouncementManager(null);
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
                confirmButtonColor: '#2D6DF6',
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
    } catch {
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
    const fullCourse = courses.find((c) => c.id === course.id) ?? course;
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

  const listStats = useMemo(() => {
    let students = 0;
    let active = 0;
    let drafts = 0;
    for (const c of courses) {
      const bucket = getTeacherCourseBucket(c);
      if (bucket === '已發布') {
        active += 1;
        students += Array.isArray(c.students) ? c.students.length : 0;
      } else if (bucket === '草稿') {
        drafts += 1;
      }
    }
    return { students, active, drafts };
  }, [courses]);

  const openAnnouncementEditor = (announcementId?: string) => {
    if (!showAnnouncementManager) return;
    const returnTo = teacherCourseHubPath(showAnnouncementManager.code, 'announcements');
    const path = announcementId
      ? teacherAnnouncementEditPath(showAnnouncementManager.code, announcementId, returnTo)
      : teacherAnnouncementCreatePath(showAnnouncementManager.code, returnTo);
    router.push(path);
  };

  const announcementPanel = showAnnouncementManager ? (
    <TeacherAnnouncementList
      courseName={showAnnouncementManager.name}
      announcements={showAnnouncementManager.announcements || []}
      isArchived={showAnnouncementManager.status === '已封存'}
      onCreate={() => openAnnouncementEditor()}
      onEdit={(id) => openAnnouncementEditor(id)}
      onDelete={async (id) => {
        const newAnns = (showAnnouncementManager.announcements || []).filter((a) => a.id !== id);
        const res = await fetch('/api/courses/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: showAnnouncementManager.id, announcements: newAnns }),
        });
        if (res.ok) {
          const updatedCourse = { ...showAnnouncementManager, announcements: newAnns };
          setShowAnnouncementManager(updatedCourse);
          setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
        }
      }}
      onToggleVisibility={(ann) => handleToggleAnnouncementVisibility(ann)}
      onBatchDelete={async (ids) => {
        const idSet = new Set(ids);
        const newAnns = (showAnnouncementManager.announcements || []).filter((a) => !idSet.has(a.id));
        const res = await fetch('/api/courses/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: showAnnouncementManager.id, announcements: newAnns }),
        });
        if (res.ok) {
          const updatedCourse = { ...showAnnouncementManager, announcements: newAnns };
          setShowAnnouncementManager(updatedCourse);
          setCourses((prev) => prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)));
        }
      }}
    />
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

    if (lessonIdFromUrl) {
      return (
        <TeacherLessonEditor
          course={course}
          lessonId={lessonIdFromUrl === 'new' ? null : lessonIdFromUrl}
          teacherId={userInfo?.id ?? ''}
          isArchived={course.status === '已封存'}
          returnTo={returnToFromUrl || teacherCourseHubPath(course.code, 'lessons')}
        />
      );
    }

    if (announcementIdFromUrl) {
      return (
        <TeacherAnnouncementEditor
          course={course}
          announcementId={announcementIdFromUrl === 'new' ? null : announcementIdFromUrl}
          isArchived={course.status === '已封存'}
          returnTo={returnToFromUrl || teacherCourseHubPath(course.code, 'announcements')}
          onCourseUpdated={(updated) => {
            setCourses((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
            setShowAnnouncementManager(updated);
          }}
        />
      );
    }

    const featureEmptyState =
      'text-center min-h-[280px] flex flex-col items-center justify-center bg-white rounded-xl border-2 border-dashed border-gray-300 shadow-sm';

    return (
      <>
      <div className="w-full min-w-0 flex flex-col h-full animate-fade-in">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <BackButton label="返回授課清單" onClick={() => void leaveCourseDetail()} withSpacing={false} />
          <div className="flex flex-wrap items-center gap-2">
            {(() => {
              const bucket = getTeacherCourseBucket(course);
              return (
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wider font-semibold ${
                    bucket === '已發布'
                      ? 'bg-secondary-container/40 text-secondary'
                      : 'bg-surface-containerHigh text-on-surfaceVariant'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      bucket === '已發布' ? 'bg-secondary' : 'bg-outline'
                    }`}
                  />
                  {bucket === '草稿' ? '草稿' : bucket}
                </span>
              );
            })()}
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
              className="inline-flex items-center px-4 py-2 bg-surface-containerLowest border border-outline-variant text-primary rounded-lg hover:bg-primary/5 transition-colors shadow-sm font-medium text-sm"
            >
              <EyeIcon className="w-4 h-4 mr-1.5" />
              預覽課程
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
              className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors shadow-sm font-medium text-sm"
            >
              <BoltIcon className="w-4 h-4 mr-1.5" />
              課程互動
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* 主內容（課程選單已改由左側 Sidebar 替換顯示） */}
          <div className="lg:col-span-9 min-w-0 space-y-4">
            {/* 手機：水平分頁（桌面側欄隱藏時） */}
            <div className="lg:hidden bg-white rounded-2xl shadow-sm border border-gray-200 px-3 sm:px-6">
              <CourseHubTabNav
                tabs={TEACHER_COURSE_HUB_TAB_IDS}
                active={activeCourseTab}
                audience="teacher"
                onChange={(tab) => void setCourseTab(tab as TeacherCourseTab)}
              />
            </div>

            <div className="mb-4">
          {activeCourseTab === 'lessons' && (
            <LessonManager
              courseId={course.id}
              courseName={course.name}
              courseCode={course.code}
              teacherId={userInfo?.id ?? ''}
              isArchived={course.status === '已封存'}
              embedded
              onClose={() => router.push('/back-panel/teacher-courses')}
              onPreviewCourse={() => {
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
            />
          )}

          {activeCourseTab === 'announcements' && announcementPanel}

          {activeCourseTab === 'exams' && (
            <TeacherExamList
              courseName={course.name}
              quizzes={courseQuizzes}
              loading={courseQuizzesLoading}
              isArchived={course.status === '已封存'}
              orderSaving={examOrderSaving}
              canDeleteQuiz={(quiz) => quiz.teacherId === userInfo?.id}
              onCreate={() =>
                router.push(examCreatePath(course.id, teacherCourseHubPath(course.code, 'exams')))
              }
              onCopyFromOther={() => openPullQuizModal()}
              onEdit={(quiz) =>
                router.push(
                  examDetailPath(quiz.quizCode, undefined, teacherCourseHubPath(course.code, 'exams'))
                )
              }
              onAnalytics={(quiz) =>
                router.push(
                  examDetailPath(quiz.quizCode, 'analytics', teacherCourseHubPath(course.code, 'exams'))
                )
              }
              onGrading={(quiz) =>
                router.push(
                  examDetailPath(quiz.quizCode, 'grading', teacherCourseHubPath(course.code, 'exams'))
                )
              }
              onDelete={(quiz) => void handleDeleteCourseQuiz(quiz)}
              onDragEnd={(result) => {
                void handleCourseExamDragEnd(result);
              }}
            />
          )}

          {activeCourseTab === 'surveys' && (
            <TeacherSurveyList
              courseName={course.name}
              surveys={courseSurveys}
              loading={courseSurveysLoading}
              isArchived={course.status === '已封存'}
              orderSaving={surveyOrderSaving}
              canDeleteSurvey={(survey) => survey.teacherId === userInfo?.id}
              onCreate={() =>
                router.push(surveyCreatePath(course.id, teacherCourseHubPath(course.code, 'surveys')))
              }
              onCopyFromOther={() => openPullSurveyModal()}
              onEdit={(survey) =>
                router.push(
                  surveyDetailPath(
                    survey.surveyCode,
                    undefined,
                    teacherCourseHubPath(course.code, 'surveys')
                  )
                )
              }
              onAnalytics={(survey) =>
                router.push(
                  surveyDetailPath(
                    survey.surveyCode,
                    'analytics',
                    teacherCourseHubPath(course.code, 'surveys')
                  )
                )
              }
              onDelete={(survey) => void handleDeleteCourseSurvey(survey)}
              onDragEnd={(result) => {
                void handleCourseSurveyDragEnd(result);
              }}
            />
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

          {/* 右側概況 */}
          <aside className="lg:col-span-3 lg:sticky lg:top-4 space-y-4">
            <div className="grid grid-cols-2 gap-3 md:gap-4">
              <div className="col-span-2 bg-gradient-to-br from-primary-container to-tertiary-container rounded-2xl p-5 md:p-6 text-on-primary shadow-sm relative overflow-hidden">
                <ChartBarIcon className="absolute -right-4 -bottom-4 w-28 h-28 opacity-20 rotate-12" aria-hidden />
                <h4 className="font-mono text-[11px] uppercase tracking-wider text-on-primary/80 mb-2">
                  總修課人數
                </h4>
                <div className="flex items-end gap-2 relative">
                  <span className="font-mono text-3xl md:text-4xl font-bold tabular-nums leading-none">
                    {(Array.isArray(course.students) ? course.students.length : 0).toLocaleString('zh-TW')}
                  </span>
                </div>
              </div>
              <div className="bg-surface-containerLowest rounded-2xl p-4 md:p-5 border border-outline-variant/40 shadow-sm flex flex-col justify-between min-h-[7.5rem]">
                <div className="w-8 h-8 rounded-full bg-secondary-container text-secondary flex items-center justify-center mb-3">
                  <ChartBarIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-mono text-[10px] uppercase tracking-wider text-on-surfaceVariant mb-1">
                    課程狀態
                  </h4>
                  <span className="font-mono text-2xl font-bold text-on-surface">
                    {getTeacherCourseBucket(course)}
                  </span>
                </div>
              </div>
              <div className="bg-surface-containerLowest rounded-2xl p-4 md:p-5 border border-outline-variant/40 shadow-sm flex flex-col justify-between min-h-[7.5rem]">
                <div className="w-8 h-8 rounded-full bg-error/10 text-error flex items-center justify-center mb-3">
                  <ChatBubbleLeftRightIcon className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-mono text-[10px] uppercase tracking-wider text-on-surfaceVariant mb-1">
                    公告數
                  </h4>
                  <span className="font-mono text-2xl font-bold text-error">
                    {(course.announcements || []).length}
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-surface-containerLow rounded-2xl p-4 md:p-5 border border-outline-variant/30">
              <h3 className="font-display font-bold text-base text-on-surface mb-3">課程設定</h3>
              <ul className="flex flex-col gap-1">
                <li>
                  <button
                    type="button"
                    onClick={() => void handleShowCourseDetail(course)}
                    className="flex w-full items-center justify-between p-3 rounded-lg hover:bg-surface-container transition-colors text-left group"
                  >
                    <span className="flex items-center gap-3 text-sm font-medium text-on-surface">
                      <InformationCircleIcon className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
                      基本資訊編輯
                    </span>
                    <span className="text-on-surfaceVariant text-sm">›</span>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => {
                      void Swal.fire({
                        icon: 'info',
                        title: '助教／授課教師',
                        text: '授課教師指派由管理員在課程管理設定，老師端無法自行調整。',
                        confirmButtonColor: '#2D6DF6',
                        customClass: { popup: 'rounded-2xl' },
                      });
                    }}
                    className="flex w-full items-center justify-between p-3 rounded-lg hover:bg-surface-container transition-colors text-left group"
                  >
                    <span className="flex items-center gap-3 text-sm font-medium text-on-surface">
                      <UserGroupIcon className="w-5 h-5 text-tertiary group-hover:scale-110 transition-transform" />
                      助教權限管理
                    </span>
                    <span className="text-on-surfaceVariant text-sm">›</span>
                  </button>
                </li>
              </ul>
            </div>
          </aside>
        </div>
      </div>

      <Modal open={pullModalOpen} onClose={closePullQuizModal} title="從其他班複製測驗" size="lg">
        <p className="text-sm text-gray-500 mb-4 px-1">
          可從其他班級（含已封存課程）複製測驗為本班草稿。封存課會標示「已封存」。
        </p>
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
                  className="text-sm text-primary hover:text-primary font-medium"
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
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-outline-variant/40 bg-surface-containerLowest hover:border-primary/30 hover:bg-primary/10'
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
        <p className="text-sm text-gray-500 mb-4 px-1">
          可從其他班級（含已封存課程）複製問卷為本班草稿。封存課會標示「已封存」。
        </p>
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
                  className="text-sm text-primary hover:text-primary font-medium"
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
                            ? 'border-primary/50 bg-primary/10'
                            : 'border-outline-variant/40 bg-surface-containerLowest hover:border-primary/30 hover:bg-primary/10'
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
    <div className="w-full min-w-0 flex flex-col h-full animate-fade-in space-y-8 md:space-y-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface">
            我的課程
          </h1>
          <p className="text-on-surfaceVariant mt-2 text-base">
            管理您負責的授課課程與教學內容。課程由管理員開設並指派。
          </p>
        </div>
      </div>

      {!loading && (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <StatCard
            tone="primary"
            label="學生總數"
            value={listStats.students.toLocaleString('zh-TW')}
            icon={<i className="fas fa-user-graduate" aria-hidden />}
          />
          <StatCard
            tone="secondary"
            label="進行中課程"
            value={
              <>
                {listStats.active.toLocaleString('zh-TW')}
                <span className="ml-2 text-base font-medium text-on-surfaceVariant">堂</span>
              </>
            }
            icon={<i className="fas fa-book-open" aria-hidden />}
          />
          <StatCard
            tone="tertiary"
            label="草稿箱"
            value={
              <>
                {listStats.drafts.toLocaleString('zh-TW')}
                <span className="ml-2 text-base font-medium text-on-surfaceVariant">堂</span>
              </>
            }
            icon={<i className="fas fa-file-pen" aria-hidden />}
          />
          <StatCard
            tone="neutral"
            label="平均評分"
            value="—"
            hint="即將開放"
            icon={<i className="fas fa-star" aria-hidden />}
          />
        </section>
      )}

      <section>
        <div className="flex flex-col gap-4 mb-6 border-b border-outline-variant pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-display text-xl md:text-2xl font-bold text-on-surface">全部課程</h2>
          </div>
          {!loading && courses.length > 0 ? (
            <CourseFilter
              variant="teacher-publish"
              hideSearch={searchControlled}
              className="mb-0"
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
          ) : null}
        </div>

        {loading ? (
          <PageLoadingArea />
        ) : filteredCourses.length === 0 ? (
          <div className="text-center py-16 px-6 bg-surface-containerLowest rounded-2xl border border-dashed border-outline-variant">
            <h3 className="mt-2 text-xl font-bold text-on-surface">尚無授課課程</h3>
            <p className="mt-2 text-sm text-on-surfaceVariant">
              課程由管理員開設並指派授課老師，請聯繫管理員。
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {filteredCourses.map((course) => {
              const studentCount = Array.isArray(course.students) ? course.students.length : 0;
              const bucket = getTeacherCourseBucket(course);
              const isDraft = bucket === '草稿';
              const isArchived = bucket === '已封存';
              const muted = isDraft || isArchived;
              return (
                <article
                  key={course.id}
                  className={`bg-surface-containerLowest rounded-xl shadow-sm hover:shadow-elevate hover:-translate-y-1 transition-all duration-300 flex flex-col border border-outline-variant/40 overflow-hidden group ${
                    muted ? 'opacity-90' : ''
                  }`}
                >
                  <div
                    className={`relative h-48 overflow-hidden bg-gradient-to-br from-primary/10 via-surface-container to-tertiary/10 ${
                      muted ? 'grayscale-[35%]' : ''
                    }`}
                  >
                    {course.coverImageURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={course.coverImageURL}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-outline/50">
                        {isDraft ? (
                          <i className="fas fa-pen-to-square text-4xl" aria-hidden />
                        ) : (
                          <BookOpenIcon className="w-12 h-12" />
                        )}
                      </div>
                    )}
                    <div
                      className={`absolute top-4 right-4 font-mono text-[11px] uppercase tracking-wider font-semibold px-3 py-1 rounded-full shadow-sm flex items-center gap-1.5 z-10 ${
                        bucket === '已發布'
                          ? 'bg-secondary-container text-secondary'
                          : bucket === '草稿'
                            ? 'bg-surface-containerHigh text-on-surfaceVariant border border-outline-variant'
                            : getTeacherCourseBucketBadgeClass(bucket)
                      }`}
                    >
                      <span
                        className={`w-2 h-2 rounded-full ${
                          bucket === '已發布'
                            ? 'bg-secondary'
                            : bucket === '草稿'
                              ? 'bg-outline'
                              : 'bg-error'
                        }`}
                      />
                      {bucket === '草稿' ? '草稿' : bucket}
                    </div>
                    <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 z-10 max-w-[85%]">
                      {(course.gradeTags || []).slice(0, 2).map((t) => (
                        <span
                          key={t}
                          className="bg-surface-containerLowest/90 backdrop-blur-sm text-primary font-mono text-[10px] px-2 py-1 rounded"
                        >
                          {t}
                        </span>
                      ))}
                      {course.subjectTag ? (
                        <span className="bg-surface-containerLowest/90 backdrop-blur-sm text-tertiary font-mono text-[10px] px-2 py-1 rounded">
                          {course.subjectTag}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="p-5 md:p-6 flex flex-col flex-1">
                    <h3
                      className={`font-display font-bold text-lg md:text-xl leading-tight mb-2 line-clamp-2 ${
                        muted ? 'text-outline' : 'text-on-surface'
                      }`}
                    >
                      {course.name}
                    </h3>
                    <p
                      className={`text-sm mb-6 line-clamp-2 flex-1 ${
                        muted ? 'text-outline' : 'text-on-surfaceVariant'
                      }`}
                    >
                      {course.description?.trim() ||
                        (isDraft ? '（內容編輯中）' : `${course.code} · 尚未填寫課程介紹`)}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-outline-variant/40 gap-3">
                      <div
                        className={`flex items-center gap-2 text-sm ${
                          muted ? 'text-outline' : 'text-on-surfaceVariant'
                        }`}
                      >
                        <i className="fas fa-user-group text-sm" aria-hidden />
                        <span>
                          {isDraft && studentCount === 0
                            ? '— 位學生'
                            : `${studentCount.toLocaleString('zh-TW')} 位學生`}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`shrink-0 font-bold text-sm px-3 py-1.5 rounded-lg transition-colors ${
                          isDraft
                            ? 'text-primary border border-primary hover:bg-primary/5'
                            : 'text-primary hover:bg-primary/10'
                        }`}
                        onClick={() => openCourseDetail(course, 'lessons')}
                      >
                        {isDraft ? '繼續編輯' : '管理課程'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

       {showCourseDetail && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCourseDetail(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-full sm:max-h-[90vh] overflow-hidden flex flex-col animate-bounce-in">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-primary to-tertiary p-4 flex justify-between items-center text-white flex-shrink-0">
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
              <div className="bg-surface-containerLow/60 p-5 rounded-xl border border-outline-variant/40">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                  <span className="w-1 h-4 bg-primary rounded-full mr-2"></span>
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
              <div className="bg-surface-containerLow/60 p-5 rounded-xl border border-outline-variant/40">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                  <span className="w-1 h-4 bg-tertiary rounded-full mr-2"></span>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">課程描述 <span className="text-primary text-xs ml-2 font-normal">(可編輯)</span></label>
                    <textarea 
                      value={showCourseDetail.description || ''} 
                      onChange={e => setShowCourseDetail(prev => prev ? { ...prev, description: e.target.value } : null)} 
                      className="w-full p-3 border border-gray-300 rounded-lg h-48 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all resize-none" 
                      placeholder="請描述課程內容、目標等..."
                    ></textarea>
                  </div>
                  <div className="md:col-span-2 mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
                      <span>自訂連結按鈕 <span className="text-primary text-xs ml-2 font-normal">(可編輯)</span></span>
                      <button type="button" onClick={() => setShowCourseDetail(prev => prev ? { ...prev, customLinks: [...(prev.customLinks || []), { name: '', url: '', icon: 'LinkIcon' }] } : null)} className="text-primary text-xs hover:text-primary flex items-center">
                        <PlusIcon className="w-4 h-4 mr-1" /> 新增連結
                      </button>
                    </label>
                    <div className="space-y-3 bg-white p-3 rounded-xl border border-gray-200">
                      {(showCourseDetail.customLinks || []).map((link, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 p-2 rounded-lg border border-outline-variant/40">
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
                            className="w-full sm:w-1/4 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary outline-none h-10"
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
                            className="w-full sm:flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-primary outline-none h-10"
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
              <div className="bg-surface-containerLow/60 p-5 rounded-xl border border-outline-variant/40">
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
              <div className="bg-surface-containerLow/60 p-5 rounded-xl border border-outline-variant/40">
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
            <div className="p-4 border-t border-outline-variant/40 flex justify-end gap-2 bg-surface-containerLow/60">
              <button
                onClick={() => setShowCourseDetail(null)}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-medium transition-colors shadow-sm"
                disabled={isSavingCourse}
              >
                取消
              </button>
              <button
                onClick={handleUpdateCourseDescription}
                className="px-6 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-hover font-medium shadow-sm transition-colors flex items-center justify-center disabled:opacity-50"
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