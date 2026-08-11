'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Swal from '@/utils/swalTheme';
import { PageLoadingArea, BackButton, btnStyles, btnWithIconStyle, LoadingSpinner } from './ui';
import {
  BookOpenIcon,
  PlusIcon,
  XMarkIcon,
  LinkIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  ClipboardDocumentCheckIcon,
  CalendarDaysIcon,
  InformationCircleIcon,
  TrashIcon,
  Bars3Icon,
  ChevronRightIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { fixDraggableStyle } from '@/utils/dndStyle';
import { filterQuizzesForCourse } from '@/services/gradeQuizImport';
import {
  normalizeLessonAssignedQuizzes,
  getOrphanedLessonQuizzes,
  filterLessonAssignedQuizzes,
  type LessonAssignedQuiz,
} from '@/services/lessonQuiz';
import type { Quiz } from '@/services/quizTypes';
import {
  fetchTeacherQuizzes,
  fetchTeacherCourseLessons,
  invalidateTeacherCourseLessons,
} from '@/utils/teacherClientApi';
import { teacherCourseHubPath, resolveReturnTo } from '@/utils/teacherCourseHub';
import { isStudentVisible } from './StudentVisibilityToggle';
import type { Course } from './TeacherCourseManager';

/** YouTube 連結轉 embed（預覽用）；非 YouTube 則無法內嵌 */
function getVideoEmbedUrl(url: string): string | null {
  if (!url || typeof url !== 'string' || !url.trim().startsWith('http')) return null;
  try {
    const urlObj = new URL(url.trim());
    let videoId = '';
    if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) {
      videoId = urlObj.searchParams.get('v') || '';
    } else if (urlObj.hostname.includes('youtu.be')) {
      videoId = urlObj.pathname.slice(1).split('/')[0] || '';
    }
    if (!videoId) return null;
    return `https://www.youtube.com/embed/${videoId}?rel=0&autoplay=0`;
  } catch {
    return null;
  }
}

function todayDateInput(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
interface LessonAttachment {
  name: string;
  url: string;
  visibleToStudents?: boolean;
}

export interface LessonData {
  id: string;
  title: string;
  date: string;
  visibleToStudents?: boolean;
  visiblePublishedAt?: string;
  progress: string;
  attachments?: LessonAttachment[];
  noAttachment?: boolean;
  videos?: string[];
  homework?: string;
  noHomework?: boolean;
  onlineExam?: string;
  assignedQuizzes?: LessonAssignedQuiz[];
  assignedQuizCodes?: string[];
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

type LessonForm = Omit<LessonData, 'id' | 'order' | 'createdAt' | 'updatedAt'>;

const emptyLessonForm = (): LessonForm => ({
  title: '',
  date: '',
  visibleToStudents: true,
  progress: '',
  attachments: [],
  noAttachment: true,
  videos: [],
  homework: '',
  noHomework: true,
  onlineExam: '',
  assignedQuizzes: [],
  noOnlineExam: true,
  examScope: '',
  noExamScope: true,
  notes: '',
  noNotes: true,
});

function lessonToForm(lesson: LessonData): LessonForm {
  const rawAtt = Array.isArray(lesson.attachments) ? lesson.attachments : [];
  const normalizedAttachments = rawAtt.map((att, idx) => {
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
  return {
    title: lesson.title,
    date: lesson.date,
    visibleToStudents: lesson.visibleToStudents !== false,
    progress: lesson.progress,
    attachments: normalizedAttachments,
    noAttachment: lesson.noAttachment || normalizedAttachments.length === 0,
    videos: (() => {
      const list = (lesson.videos || []).filter((v) => typeof v === 'string' && v.trim());
      return list.length > 0 ? [list[0]] : [];
    })(),
    homework: lesson.homework || '',
    noHomework: lesson.noHomework || !lesson.homework?.trim(),
    onlineExam: lesson.onlineExam || '',
    assignedQuizzes,
    noOnlineExam: lesson.noOnlineExam || (assignedQuizzes.length === 0 && !lesson.onlineExam?.trim()),
    examScope: lesson.examScope || '',
    noExamScope: lesson.noExamScope || !lesson.examScope?.trim(),
    notes: lesson.notes || '',
    noNotes: lesson.noNotes || !lesson.notes?.trim(),
  };
}

interface TeacherLessonEditorProps {
  course: Course;
  /** null 或 'new' 表示新增 */
  lessonId: string | null;
  teacherId: string;
  isArchived?: boolean;
  returnTo?: string | null;
}

export default function TeacherLessonEditor({
  course,
  lessonId,
  teacherId,
  isArchived = false,
  returnTo,
}: TeacherLessonEditorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contentType = searchParams.get('contentType');
  const isVideoMode = contentType === 'video';
  const isNew = !lessonId || lessonId === 'new';
  const backPath = resolveReturnTo(returnTo, teacherCourseHubPath(course.code, 'lessons'));

  const [form, setForm] = useState<LessonForm>(() => ({
    ...emptyLessonForm(),
    ...(isVideoMode ? { date: todayDateInput() } : {}),
  }));
  const [editingLesson, setEditingLesson] = useState<LessonData | null>(null);
  const [courseQuizzes, setCourseQuizzes] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [quizPickerOpen, setQuizPickerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(isNew);

  const goBack = useCallback(() => {
    router.push(backPath);
  }, [router, backPath]);

  useEffect(() => {
    let cancelled = false;
    if (isNew) {
      setForm({
        ...emptyLessonForm(),
        ...(isVideoMode ? { date: todayDateInput() } : {}),
      });
      setEditingLesson(null);
      setIsLoading(false);
      setNotFound(false);
      return;
    }

    setIsLoading(true);
    fetchTeacherCourseLessons(course.id)
      .then((lessons) => {
        if (cancelled) return;
        const list = Array.isArray(lessons) ? (lessons as LessonData[]) : [];
        const found = list.find((l) => l.id === lessonId) ?? null;
        if (!found) {
          setNotFound(true);
          return;
        }
        setEditingLesson(found);
        setForm(lessonToForm(found));
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [course.id, isNew, lessonId, isVideoMode]);

  useEffect(() => {
    if (!teacherId || !course.id) return;
    let cancelled = false;
    setQuizzesLoading(true);
    fetchTeacherQuizzes(teacherId)
      .then((quizzes) => {
        if (!cancelled) {
          setCourseQuizzes(filterQuizzesForCourse(quizzes, course.id, { publishedOnly: false }));
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
  }, [teacherId, course.id]);

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

  const handleAttachmentChange = (idx: number, key: 'name' | 'url', value: string) =>
    setForm((f) => {
      const att = [...(f.attachments || [])];
      att[idx] = { ...att[idx], [key]: value };
      return { ...f, attachments: att };
    });

  const handleAttachmentVisibilityChange = (idx: number, visible: boolean) =>
    setForm((f) => {
      const att = [...(f.attachments || [])];
      att[idx] = { ...att[idx], visibleToStudents: visible };
      return { ...f, attachments: att };
    });

  const handleVideoUrlChange = (value: string) =>
    setForm((f) => ({
      ...f,
      videos: value.trim() ? [value] : [],
    }));

  const handleFormSubmit = async () => {
    const title = form.title?.trim() || '';
    const date = form.date || (isVideoMode ? todayDateInput() : '');
    if (!title || !date) {
      void Swal.fire('警告', isVideoMode ? '請填寫影片標題' : '課堂標題與日期為必填', 'warning');
      return;
    }
    if (isVideoMode && !(form.videos?.[0] || '').trim()) {
      void Swal.fire('警告', '請貼上影片連結', 'warning');
      return;
    }
    setIsSubmitting(true);
    try {
      const singleVideo = (form.videos?.[0] || '').trim();
      const assignedQuizzes = form.noOnlineExam
        ? []
        : filterLessonAssignedQuizzes(
            (form.assignedQuizzes ?? []).filter((q) => q.quizCode?.trim()),
            validCourseQuizCodes
          );
      const assignedQuizCodes = assignedQuizzes.map((q) => q.quizCode);
      const lessonData = {
        ...form,
        title,
        date,
        videos: singleVideo ? [singleVideo] : [],
        attachments: isVideoMode
          ? []
          : (form.attachments || [])
              .filter((a) => a.url && a.url.trim() !== '')
              .map((a, idx) => ({
                name: a.name?.trim() ? a.name.trim() : `附件${idx + 1}`,
                url: a.url.trim(),
                visibleToStudents: a.visibleToStudents !== false,
              })),
        assignedQuizzes: isVideoMode ? [] : assignedQuizzes,
        assignedQuizCodes: isVideoMode ? [] : assignedQuizCodes,
        requireQuizBeforeVideo: isVideoMode
          ? false
          : assignedQuizzes.some((q) => q.requireBeforeVideo),
        onlineExam: isVideoMode
          ? ''
          : assignedQuizzes.length > 0
            ? ''
            : form.onlineExam?.trim() ?? '',
        noOnlineExam: isVideoMode
          ? true
          : form.noOnlineExam || (assignedQuizzes.length === 0 && !form.onlineExam?.trim()),
        noAttachment: isVideoMode ? true : form.noAttachment,
        noHomework: isVideoMode ? true : form.noHomework,
        homework: isVideoMode ? '' : form.homework,
        noExamScope: isVideoMode ? true : form.noExamScope,
        examScope: isVideoMode ? '' : form.examScope,
        noNotes: isVideoMode ? true : form.noNotes,
        notes: isVideoMode ? '' : form.notes,
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
        await fetch('/api/lessons/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId: course.id, lessonId: editingLesson.id, ...lessonData }),
        });
      } else {
        await fetch('/api/lessons/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId: course.id,
            ...lessonData,
            createdAt: new Date().toISOString(),
          }),
        });
      }
      invalidateTeacherCourseLessons(course.id);
      await Swal.fire('成功', editingLesson ? '已更新' : '已新增', 'success');
      goBack();
    } catch {
      void Swal.fire('錯誤', '操作失敗', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page-shell w-full min-w-0 flex flex-col h-full animate-fade-in">
        <PageLoadingArea />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="page-shell w-full min-w-0 flex flex-col h-full animate-fade-in">
        <div className="flex flex-col gap-4">
          <BackButton label="返回課程清單" onClick={goBack} withSpacing={false} />
          <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
            <h3 className="text-xl font-bold text-gray-900">找不到此課堂</h3>
            <p className="text-gray-500 text-sm mt-2">請返回課程清單重新選擇。</p>
          </div>
        </div>
      </div>
    );
  }

  const videoUrl = form.videos?.[0] ?? '';
  const videoEmbedUrl = getVideoEmbedUrl(videoUrl);
  const attachmentList = (form.attachments || []).filter((a) => a); // keep empties while editing
  const assignedList = form.assignedQuizzes ?? [];

  const moduleCount =
    (videoUrl.trim() ? 1 : 0) +
    attachmentList.filter((a) => a.url?.trim()).length +
    assignedList.length +
    (!form.noHomework && form.homework?.trim() ? 1 : 0) +
    (!form.noExamScope && form.examScope?.trim() ? 1 : 0) +
    (!form.noNotes && form.notes?.trim() ? 1 : 0);

  const displayModuleCount = Math.max(
    moduleCount,
    (videoUrl.trim() ? 1 : 0) +
      attachmentList.length +
      assignedList.length +
      (!form.noHomework ? 1 : 0) +
      (!form.noExamScope ? 1 : 0) +
      (!form.noNotes ? 1 : 0)
  );

  const onAttachmentDragEnd = (result: DropResult) => {
    if (!result.destination || isArchived) return;
    const items = Array.from(form.attachments || []);
    const [moved] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, moved);
    setForm((f) => ({ ...f, attachments: items, noAttachment: items.length === 0 }));
  };

  const addAttachment = () => {
    setForm((f) => ({
      ...f,
      noAttachment: false,
      attachments: [...(f.attachments || []), { name: '', url: '', visibleToStudents: true }],
    }));
  };

  const addHomework = () => {
    setForm((f) => ({ ...f, noHomework: false, homework: f.homework || '' }));
  };

  const addExamScope = () => {
    setForm((f) => ({ ...f, noExamScope: false, examScope: f.examScope || '' }));
  };

  const addNotes = () => {
    setForm((f) => ({ ...f, noNotes: false, notes: f.notes || '' }));
  };

  const previewUnit = () => {
    if (!editingLesson && isNew) {
      void Swal.fire('提示', '請先儲存內容後再預覽。', 'info');
      return;
    }
    const lessonPayload = {
      ...editingLesson,
      ...form,
      videos: (form.videos?.[0] || '').trim() ? [(form.videos![0] || '').trim()] : [],
      id: editingLesson?.id || 'preview',
      courseName: course.name,
      courseCode: course.code,
      courseId: course.id,
      lessonIndex: 1,
    };
    try {
      localStorage.setItem('currentLesson', JSON.stringify(lessonPayload));
      const returnToPath = `/back-panel/teacher-courses/${encodeURIComponent(course.code)}/lessons/${encodeURIComponent(
        editingLesson?.id || 'new'
      )}`;
      window.open(
        `/back-panel/teacher-courses/preview/lesson?returnTo=${encodeURIComponent(returnToPath)}`,
        '_blank'
      );
    } catch (e) {
      void Swal.fire({
        icon: 'error',
        title: '無法開啟預覽',
        text: e instanceof Error ? e.message : '請允許彈出式視窗',
      });
    }
  };

  const fieldClass = `w-full px-4 py-2.5 border border-outline-variant rounded-xl focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none bg-surface-containerLowest ${
    isArchived ? 'bg-surface-containerLow text-on-surfaceVariant' : ''
  }`;

  /* —— 新增／編輯影片：僅標題＋連結＋預覽（一次一支） —— */
  if (isVideoMode) {
    return (
      <div className="w-full min-w-0 pb-28 flex flex-col animate-fade-in">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-outline mb-2">
            <button type="button" onClick={goBack} className="hover:text-primary transition-colors">
              課程大綱
            </button>
            <ChevronRightIcon className="w-4 h-4" />
            <span className="text-on-surface">{isNew ? '新增影片' : '編輯影片'}</span>
          </div>
          <h1 className="font-display text-2xl font-bold text-on-surface flex items-center gap-2">
            <VideoCameraIcon className="w-7 h-7 text-tertiary" />
            {isNew ? '新增影片' : '編輯影片'}
          </h1>
          <p className="text-on-surfaceVariant text-sm mt-1">一次一支：填標題、貼上連結，下方可預覽</p>
        </div>

        {isArchived && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl mb-5 text-sm">
            <span className="font-bold mr-2">提示：</span>
            此為封存課程，僅供檢視。
          </div>
        )}

        <div className="bg-surface-containerLowest rounded-2xl border border-outline-variant/40 p-5 md:p-6 space-y-5 shadow-sm mb-8 max-w-3xl">
          <div>
            <label className="block text-sm font-bold text-on-surface mb-1.5">
              影片標題 <span className="text-error">*</span>
            </label>
            <input
              type="text"
              className={fieldClass}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="例如：向量篇-1"
              disabled={isArchived}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-on-surface mb-1.5">
              影片連結 <span className="text-error">*</span>
            </label>
            <div className="flex gap-2 items-center">
              <LinkIcon className="w-4 h-4 text-outline shrink-0" />
              <input
                type="url"
                className={fieldClass}
                value={videoUrl}
                onChange={(e) => handleVideoUrlChange(e.target.value)}
                placeholder="貼上 YouTube 或其他影片連結"
                disabled={isArchived}
              />
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-on-surface mb-2">預覽</p>
            {videoEmbedUrl ? (
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-outline-variant/40">
                <iframe
                  title="影片預覽"
                  src={videoEmbedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="aspect-video w-full rounded-xl border-2 border-dashed border-outline-variant bg-surface-containerLow flex items-center justify-center text-sm text-on-surfaceVariant px-4 text-center">
                {videoUrl.trim()
                  ? '此連結無法內嵌預覽（目前支援 YouTube）。儲存後學生仍可依連結開啟。'
                  : '貼上連結後將顯示預覽'}
              </div>
            )}
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 md:left-64 z-40 bg-surface-containerLowest border-t border-outline-variant/30 px-4 md:px-10 py-4 flex flex-wrap justify-end gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <BackButton label="返回" onClick={goBack} withSpacing={false} />
          {!isArchived && (
            <button
              type="button"
              onClick={() => void handleFormSubmit()}
              disabled={isSubmitting || !form.title.trim() || !videoUrl.trim()}
              className={btnWithIconStyle(btnStyles.primary)}
            >
              {isSubmitting ? <LoadingSpinner size={16} color="white" /> : '儲存'}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 pb-28 flex flex-col animate-fade-in">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-outline mb-2">
          <button type="button" onClick={goBack} className="hover:text-primary transition-colors">
            課程大綱
          </button>
          <ChevronRightIcon className="w-4 h-4" />
          <span className="text-on-surface">編輯內容</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            {isArchived ? (
              <h1 className="font-display text-2xl font-bold text-on-surface mb-1 break-words">
                {form.title || '未命名內容'}
              </h1>
            ) : (
              <input
                type="text"
                className="w-full font-display text-2xl font-bold text-on-surface bg-transparent border-0 border-b border-transparent focus:border-primary focus:ring-0 px-0 py-1 placeholder:text-outline"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="輸入內容標題…"
              />
            )}
            <p className="text-on-surfaceVariant text-sm mt-1">
              編輯此筆內容的資料（影片即為內容本身，底下不再掛模組）
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="text-sm font-medium text-primary hover:underline shrink-0"
          >
            {settingsOpen ? '收合內容設定' : '內容設定'}
          </button>
        </div>
      </div>

      {isArchived && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-xl mb-5 text-sm">
          <span className="font-bold mr-2">提示：</span>
          此為封存課程，僅供檢視。
        </div>
      )}

      {settingsOpen && (
        <div className="mb-6 bg-surface-containerLowest rounded-2xl border border-outline-variant/40 p-5 space-y-4 shadow-sm">
          <h2 className="font-display font-bold text-on-surface text-base">內容設定</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center text-sm font-bold text-on-surface mb-1.5">
                <CalendarDaysIcon className="w-4 h-4 mr-1.5 text-primary" />
                課程日期 <span className="text-error">*</span>
              </label>
              <input
                type="date"
                className={fieldClass}
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                disabled={isArchived}
              />
            </div>
            <div className="flex items-end pb-1">
              <label
                className={`inline-flex items-center text-sm font-medium text-on-surface ${
                  isArchived ? 'opacity-60' : ''
                }`}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 text-primary rounded mr-2 accent-[#2D6DF6]"
                  checked={form.visibleToStudents !== false}
                  onChange={(e) => setForm((f) => ({ ...f, visibleToStudents: e.target.checked }))}
                  disabled={isArchived}
                />
                此內容開放學生查看
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-on-surface mb-1.5">進度說明（選填）</label>
            <textarea
              className={`${fieldClass} resize-none`}
              rows={2}
              value={form.progress}
              onChange={(e) => setForm((f) => ({ ...f, progress: e.target.value }))}
              placeholder="本堂教學重點…"
              disabled={isArchived}
            />
          </div>
        </div>
      )}

      {/* 此內容的欄位（非「底下再掛模組」） */}
      <div className="space-y-4 mb-8">
        {/* Videos — 一次一支 */}
        <div className="mb-1">
          <h2 className="font-display font-bold text-on-surface text-base flex items-center gap-2">
            <VideoCameraIcon className="w-5 h-5 text-tertiary" />
            影片
          </h2>
          <p className="text-sm text-on-surfaceVariant mt-0.5">一次一支：標題請用上方內容標題；此處貼連結並預覽</p>
        </div>
        <div className="bg-surface-containerLowest rounded-xl p-5 md:p-6 shadow-sm border border-outline-variant/30 space-y-4">
          <div className="flex gap-2 items-center">
            <LinkIcon className="w-4 h-4 text-outline shrink-0" />
            <input
              type="url"
              className={fieldClass}
              placeholder="貼上 YouTube 或其他影片連結"
              value={videoUrl}
              onChange={(e) => handleVideoUrlChange(e.target.value)}
              disabled={isArchived}
            />
          </div>
          {videoEmbedUrl ? (
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-black border border-outline-variant/40">
              <iframe
                title="影片預覽"
                src={videoEmbedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : videoUrl.trim() ? (
            <p className="text-xs text-on-surfaceVariant">此連結無法內嵌預覽（目前支援 YouTube）。</p>
          ) : null}
        </div>

        <div className="mb-1 mt-6">
          <h2 className="font-display font-bold text-on-surface text-base flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5 text-secondary" />
            教材
          </h2>
          <p className="text-sm text-on-surfaceVariant mt-0.5">教材與影片同為單元下的內容，互不隸屬</p>
        </div>
        <DragDropContext onDragEnd={onAttachmentDragEnd}>
          <Droppable droppableId="lesson-attachments">
            {(provided) => (
              <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-4">
                {(form.attachments || []).map((att, idx) => {
                  const key = `att-${idx}`;
                  return (
                    <Draggable key={key} draggableId={key} index={idx} isDragDisabled={isArchived}>
                      {(drag, snapshot) => (
                        <div
                          ref={drag.innerRef}
                          {...drag.draggableProps}
                          style={fixDraggableStyle(drag.draggableProps.style)}
                          className={`group bg-surface-containerLowest rounded-xl p-5 md:p-6 shadow-sm border border-transparent hover:border-primary/20 transition-all ${
                            snapshot.isDragging ? 'ring-2 ring-primary/30 shadow-lg' : ''
                          }`}
                        >
                          <div className="flex items-start gap-4 md:gap-6">
                            {!isArchived ? (
                              <div
                                className="text-outline hover:text-primary cursor-grab pt-1"
                                {...drag.dragHandleProps}
                              >
                                <Bars3Icon className="w-5 h-5" />
                              </div>
                            ) : null}
                            <div className="w-12 h-12 rounded-lg bg-secondary-container/30 flex items-center justify-center text-secondary shrink-0">
                              <DocumentTextIcon className="w-6 h-6" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="px-2 py-0.5 rounded-full bg-secondary-container/40 text-secondary font-mono text-[11px] uppercase tracking-wider">
                                  教材
                                </span>
                                <h3 className="font-medium text-on-surface">
                                  {att.name?.trim() || `教材 ${idx + 1}`}
                                </h3>
                              </div>
                              {isArchived ? (
                                <p className="text-sm text-on-surfaceVariant truncate">
                                  {att.url?.trim() || '尚未設定連結'}
                                </p>
                              ) : (
                                <>
                                  <input
                                    type="text"
                                    className={fieldClass}
                                    placeholder="檔案名稱"
                                    value={att.name}
                                    onChange={(e) => handleAttachmentChange(idx, 'name', e.target.value)}
                                  />
                                  <input
                                    type="url"
                                    className={fieldClass}
                                    placeholder="檔案連結 (URL)"
                                    value={att.url}
                                    onChange={(e) => handleAttachmentChange(idx, 'url', e.target.value)}
                                  />
                                  <label className="inline-flex items-center text-sm text-on-surface">
                                    <input
                                      type="checkbox"
                                      className="w-4 h-4 text-primary rounded mr-2 accent-[#2D6DF6]"
                                      checked={att.visibleToStudents !== false}
                                      onChange={(e) =>
                                        handleAttachmentVisibilityChange(idx, e.target.checked)
                                      }
                                    />
                                    學生可見
                                  </label>
                                </>
                              )}
                            </div>
                            {!isArchived && (
                              <button
                                type="button"
                                className="p-2 rounded-full hover:bg-error/10 text-on-surfaceVariant hover:text-error shrink-0"
                                title="移除"
                                onClick={() =>
                                  setForm((f) => {
                                    const next = (f.attachments || []).filter((_, i) => i !== idx);
                                    return { ...f, attachments: next, noAttachment: next.length === 0 };
                                  })
                                }
                              >
                                <TrashIcon className="w-5 h-5" />
                              </button>
                            )}
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
        {!isArchived ? (
          <button
            type="button"
            onClick={addAttachment}
            className="text-sm text-secondary font-medium hover:underline inline-flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" /> 新增教材連結
          </button>
        ) : null}

        {/* Quizzes */}
        {assignedList.map((assignment) => {
          const quiz = courseQuizzes.find((q) => q.quizCode === assignment.quizCode);
          const key = `quiz-${assignment.quizCode}`;
          return (
            <div
              key={key}
              className="group bg-surface-containerLowest rounded-xl p-5 md:p-6 shadow-sm border border-transparent hover:border-primary/20 transition-all"
            >
              <div className="flex items-start gap-4 md:gap-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <ClipboardDocumentCheckIcon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono text-[11px] uppercase tracking-wider">
                      測驗
                    </span>
                    <h3 className="font-medium text-on-surface truncate">
                      {quiz?.title || assignment.quizCode}
                    </h3>
                  </div>
                  <p className="text-sm text-on-surfaceVariant">
                    {quiz ? `滿分 ${quiz.totalPoints} 分` : '測驗資料載入中或已失效'}
                  </p>
                  {!isArchived && (
                    <label className="inline-flex items-center text-sm text-on-surface">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-primary rounded mr-2 accent-[#2D6DF6]"
                        checked={!!assignment.requireBeforeVideo}
                        onChange={(e) =>
                          toggleQuizRequireBeforeVideo(assignment.quizCode, e.target.checked)
                        }
                      />
                      需完成此測驗後才可觀看影片
                    </label>
                  )}
                </div>
                {!isArchived && (
                  <button
                    type="button"
                    className="p-2 rounded-full hover:bg-error/10 text-on-surfaceVariant hover:text-error shrink-0"
                    title="移除"
                    onClick={() => toggleAssignedQuiz(assignment.quizCode, false)}
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {!form.noHomework && (
          <div className="bg-surface-containerLowest rounded-xl p-5 md:p-6 shadow-sm border border-transparent hover:border-primary/20">
            <div className="flex items-start gap-4 md:gap-6">
              <div className="w-12 h-12 rounded-lg bg-warning/15 flex items-center justify-center text-warning shrink-0">
                <QueueListIcon className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-warning/15 text-warning font-mono text-[11px] uppercase tracking-wider">
                    作業
                  </span>
                  <h3 className="font-medium text-on-surface">作業說明</h3>
                </div>
                {isArchived ? (
                  <p className="text-sm text-on-surfaceVariant whitespace-pre-wrap">
                    {form.homework?.trim() || '尚未填寫'}
                  </p>
                ) : (
                  <textarea
                    className={`${fieldClass} resize-none`}
                    rows={3}
                    value={form.homework}
                    onChange={(e) => setForm((f) => ({ ...f, homework: e.target.value }))}
                    placeholder="請輸入作業說明…"
                  />
                )}
              </div>
              {!isArchived && (
                <button
                  type="button"
                  className="p-2 rounded-full hover:bg-error/10 hover:text-error shrink-0"
                  title="移除"
                  onClick={() => setForm((f) => ({ ...f, noHomework: true, homework: '' }))}
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {!form.noExamScope && (
          <div className="bg-surface-containerLowest rounded-xl p-5 md:p-6 shadow-sm">
            <div className="flex items-start gap-4 md:gap-6">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <DocumentTextIcon className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-mono text-[11px] uppercase tracking-wider">
                    範圍
                  </span>
                  <h3 className="font-medium text-on-surface">考試範圍</h3>
                </div>
                {isArchived ? (
                  <p className="text-sm text-on-surfaceVariant whitespace-pre-wrap">
                    {form.examScope?.trim() || '尚未填寫'}
                  </p>
                ) : (
                  <textarea
                    className={`${fieldClass} resize-none`}
                    rows={2}
                    value={form.examScope}
                    onChange={(e) => setForm((f) => ({ ...f, examScope: e.target.value }))}
                  />
                )}
              </div>
              {!isArchived && (
                <button
                  type="button"
                  className="p-2 rounded-full hover:bg-error/10 hover:text-error shrink-0"
                  title="移除"
                  onClick={() => setForm((f) => ({ ...f, noExamScope: true, examScope: '' }))}
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {!form.noNotes && (
          <div className="bg-surface-containerLowest rounded-xl p-5 md:p-6 shadow-sm">
            <div className="flex items-start gap-4 md:gap-6">
              <div className="w-12 h-12 rounded-lg bg-surface-containerHigh flex items-center justify-center text-on-surfaceVariant shrink-0">
                <InformationCircleIcon className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-full bg-surface-variant text-on-surfaceVariant font-mono text-[11px] uppercase tracking-wider">
                    備註
                  </span>
                  <h3 className="font-medium text-on-surface">注意事項</h3>
                </div>
                {isArchived ? (
                  <p className="text-sm text-on-surfaceVariant whitespace-pre-wrap">
                    {form.notes?.trim() || '尚未填寫'}
                  </p>
                ) : (
                  <textarea
                    className={`${fieldClass} resize-none`}
                    rows={2}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                )}
              </div>
              {!isArchived && (
                <button
                  type="button"
                  className="p-2 rounded-full hover:bg-error/10 hover:text-error shrink-0"
                  title="移除"
                  onClick={() => setForm((f) => ({ ...f, noNotes: true, notes: '' }))}
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {!isArchived && form.noHomework ? (
          <button
            type="button"
            onClick={addHomework}
            className="text-sm text-warning font-medium hover:underline inline-flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" /> 新增作業說明
          </button>
        ) : null}
        {!isArchived && form.noExamScope ? (
          <button
            type="button"
            onClick={addExamScope}
            className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" /> 新增考試範圍
          </button>
        ) : null}
        {!isArchived && form.noNotes ? (
          <button
            type="button"
            onClick={addNotes}
            className="text-sm text-on-surfaceVariant font-medium hover:underline inline-flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" /> 新增備註
          </button>
        ) : null}
        {!isArchived ? (
          <button
            type="button"
            onClick={() => setQuizPickerOpen(true)}
            className="text-sm text-primary font-medium hover:underline inline-flex items-center gap-1"
          >
            <PlusIcon className="w-4 h-4" /> 綁定測驗
          </button>
        ) : null}

        {displayModuleCount === 0 && (
          <div className="text-center py-10 text-on-surfaceVariant text-sm">
            尚無影片／教材等欄位，可在上方新增連結；新內容請至課程大綱的單元管理新增。
          </div>
        )}
      </div>

      {/* 測驗選擇 */}
      {quizPickerOpen && !isArchived && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-outline-variant/40 flex items-center justify-between">
              <h3 className="font-display font-bold text-on-surface">選擇要綁定的測驗</h3>
              <button type="button" onClick={() => setQuizPickerOpen(false)} className="p-1 rounded-lg hover:bg-surface-container">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {quizzesLoading ? (
                <PageLoadingArea minHeight="min-h-[6rem]" />
              ) : courseQuizzes.length === 0 ? (
                <p className="text-sm text-on-surfaceVariant text-center py-8">此課程尚無測驗，請先至「測驗設定」建立。</p>
              ) : (
                courseQuizzes.map((quiz) => {
                  const checked = assignedList.some((q) => q.quizCode === quiz.quizCode);
                  return (
                    <button
                      key={quiz.id}
                      type="button"
                      disabled={checked}
                      onClick={() => {
                        toggleAssignedQuiz(quiz.quizCode, true);
                        setForm((f) => ({ ...f, noOnlineExam: false }));
                        setQuizPickerOpen(false);
                      }}
                      className={`w-full text-left p-3 rounded-xl border transition-colors ${
                        checked
                          ? 'border-primary/30 bg-primary/5 opacity-60 cursor-default'
                          : 'border-outline-variant hover:border-primary hover:bg-primary/5'
                      }`}
                    >
                      <p className="font-medium text-on-surface">{quiz.title}</p>
                      <p className="text-xs text-on-surfaceVariant mt-0.5">
                        滿分 {quiz.totalPoints} 分{checked ? ' · 已加入' : ''}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 z-40 bg-surface-containerLowest border-t border-outline-variant/30 px-4 md:px-10 py-4 flex flex-wrap justify-end gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        <BackButton label="返回" onClick={goBack} withSpacing={false} />
        <button
          type="button"
          onClick={previewUnit}
          className="px-5 py-2.5 rounded-xl border-2 border-primary text-primary text-sm font-medium hover:bg-primary/5 transition-colors"
        >
          預覽內容
        </button>
        {!isArchived && (
          <button
            type="button"
            onClick={() => void handleFormSubmit()}
            disabled={isSubmitting || !form.title || !form.date}
            className={btnWithIconStyle(btnStyles.primary)}
          >
            {isSubmitting ? <LoadingSpinner size={16} color="white" /> : '儲存變更'}
          </button>
        )}
      </div>
    </div>
  );
}
