'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { fetchStudentDashboardData, fetchCourseClassData, fetchCourseLessons, fetchStudentExamList, fetchStudentSurveyList, fetchStudentAttendanceActivities, prefetchCourseDetail, StudentApiError, type StudentExamListItem, type StudentSurveyListItem } from '@/utils/studentClientApi';
import { createPortal } from 'react-dom';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStudentInfo } from '../StudentInfoContext';
import RichHtmlContent from '@/components/RichHtmlContent';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import { getCourseDisplayKey } from '@/components/StudentCourseSelector';
import { isCourseArchived } from '@/services/courseArchive';
import { mergeCoursesFromEnrolledKeys } from '@/components/studentCourseListShared';
import StudentCourseTable from '@/components/StudentCourseTable';
import StudentExamStartModal from '@/components/student-exam/StudentExamStartModal';
import StudentExamAttemptPickerModal from '@/components/student-exam/StudentExamAttemptPickerModal';
import StudentSurveyStartModal from '@/components/student-survey/StudentSurveyStartModal';
import StudentGradeViewer from '@/components/StudentGradeViewer';
import { sortQuizzesByOrder } from '@/services/quizTypes';
import { sortSurveysByOrder } from '@/services/surveyTypes';
import { canStartExamTake } from '@/utils/examDraftStorage';
import { openStudentExamReviewInNewTab } from '@/utils/examAttemptLabel';
import { openStudentSurveyReviewInNewTab } from '@/utils/surveyAttemptLabel';
import { showExamTakeBlockedAlert } from '@/utils/examTakeAlerts';
import { fetchQuizByCode, fetchSurveyByCode } from '@/utils/teacherClientApi';
import { openBlankPreviewTab, openTeacherExamPreviewInNewTab } from '@/utils/teacherExamPreview';
import { openTeacherSurveyPreviewInNewTab } from '@/utils/teacherSurveyPreview';
import Swal from '@/utils/swalTheme';
import { BookOpenIcon, ClockIcon, MapPinIcon, UserIcon, VideoCameraIcon, MegaphoneIcon, LinkIcon, DocumentTextIcon, FolderIcon, ChatBubbleLeftRightIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, ClipboardDocumentCheckIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline';
import BackButton from '@/components/ui/BackButton';
import CourseHubTabNav, {
  STUDENT_COURSE_HUB_TAB_IDS,
  CourseHubFeatureIcon,
} from '@/components/CourseHubTabNav';
import 'react-quill-new/dist/quill.snow.css';

// Interfaces
interface ClassTime { day: string; startTime: string; endTime: string; }
interface CustomLink { name: string; url: string; icon: string; }
interface CourseAnnouncement { id: string; title: string; content: string; links: { name: string; url: string }[]; createdAt: string; }
interface Course { id: string; name: string; code: string; status: string; archived?: boolean; gradeTags: string[]; subjectTag: string; startDate: string; endDate: string; teachers: string[]; teacherName?: string; description: string; teachingMethod: string; courseNature: string; location?: string; liveStreamURL?: string; coverImageURL?: string; classTimes?: ClassTime[]; customLinks?: CustomLink[]; announcements?: CourseAnnouncement[]; }
interface Lesson { id: string; title: string; date: string; progress: string; attachments: Array<string | { url: string; name?: string; visibleToStudents?: boolean }>; videos: string[]; homework: string; noHomework?: boolean; onlineExam: string; assignedQuizzes?: { quizCode: string; requireBeforeVideo?: boolean }[]; assignedQuizCodes?: string[]; requireQuizBeforeVideo?: boolean; noOnlineExam?: boolean; examScope: string; noExamScope?: boolean; notes: string; noNotes?: boolean; createdAt: string | number | { toDate: () => Date }; order?: number; }
interface CourseAttendanceActivity {
  id: string;
  courseId: string;
  firestoreCourseId: string;
  title: string;
  courseName: string;
  startTime: string;
  endTime: string;
  status: 'upcoming' | 'active' | 'past';
  studentStatus?: string;
  studentLeaveType?: string;
}

const COURSE_TABS = STUDENT_COURSE_HUB_TAB_IDS;
type CourseTab = (typeof COURSE_TABS)[number];

function parseCourseTab(value: string | null | undefined): CourseTab {
  if (value && (COURSE_TABS as readonly string[]).includes(value)) {
    return value as CourseTab;
  }
  return 'info';
}

function buildCourseTabUrl(
  courseCode: string,
  tab: CourseTab,
  previewMode = false,
  extras?: Record<string, string | undefined>
): string {
  const params = new URLSearchParams();
  if (tab !== 'info') params.set('tab', tab);
  if (extras) {
    for (const [key, value] of Object.entries(extras)) {
      if (value) params.set(key, value);
    }
  }
  const qs = params.toString();
  if (previewMode) {
    const base = `/back-panel/teacher-courses/preview?code=${encodeURIComponent(courseCode)}`;
    return qs ? `${base}&${qs}` : base;
  }
  const base = `/student/courses/${encodeURIComponent(courseCode)}`;
  return qs ? `${base}?${qs}` : base;
}

const PENDING_COURSE_SELECTION_KEY = 'student-courses-pending-selection';
const ACTIVE_COURSE_COUNT_KEY = 'student-courses-active-count';

function getCachedActiveCourseCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = sessionStorage.getItem(ACTIVE_COURSE_COUNT_KEY);
    const parsed = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function setCachedActiveCourseCount(count: number) {
  if (typeof window === 'undefined') return;
  try {
    if (count > 0) {
      sessionStorage.setItem(ACTIVE_COURSE_COUNT_KEY, String(count));
    } else {
      sessionStorage.removeItem(ACTIVE_COURSE_COUNT_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function getPendingCourseSelection(courseCode: string): string {
  if (typeof window === 'undefined' || !courseCode) return '';
  try {
    const raw = sessionStorage.getItem(PENDING_COURSE_SELECTION_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as { code?: string; displayKey?: string };
    return parsed.code === courseCode && parsed.displayKey ? parsed.displayKey : '';
  } catch {
    return '';
  }
}

function setPendingCourseSelection(courseCode: string, displayKey: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      PENDING_COURSE_SELECTION_KEY,
      JSON.stringify({ code: courseCode, displayKey })
    );
  } catch {
    // ignore storage errors
  }
}

function clearPendingCourseSelection() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_COURSE_SELECTION_KEY);
  } catch {
    // ignore storage errors
  }
}

const quillDisplayStyles = `
  .ql-snow .ql-editor {
    padding: 0;
  }
  .ql-snow .ql-size-small {
    font-size: 0.85em;
  }
  .ql-snow .ql-size-large {
    font-size: 1.5em;
  }
  .ql-snow .ql-size-huge {
    font-size: 2.5em;
  }
  .ql-snow .ql-editor ol, .ql-snow .ql-editor ul {
    padding-left: 1.5em;
  }
  .ql-snow .ql-editor ol > li, .ql-snow .ql-editor ul > li {
    list-style-type: none;
  }
  .ql-snow .ql-editor ol {
    counter-reset: list-1;
  }
  .ql-snow .ql-editor ol > li::before {
    counter-increment: list-1;
    content: counter(list-1, decimal) ". ";
    margin-left: -1.5em;
    margin-right: 0.3em;
    text-align: right;
    white-space: nowrap;
    width: 1.2em;
    display: inline-block;
    line-height: inherit;
  }
  .ql-snow .ql-editor ul > li::before {
    content: '•';
    margin-left: -1.5em;
    margin-right: 0.3em;
    text-align: center;
    white-space: nowrap;
    width: 1.2em;
    display: inline-block;
    line-height: inherit;
  }
`;

function FeatureListCard({
  icon,
  mobileIcon,
  title,
  meta,
  actions,
  onClick,
}: {
  icon: React.ReactNode;
  mobileIcon?: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`w-full text-left bg-white border border-gray-100 rounded-xl p-4 sm:p-5 hover:shadow-md hover:border-indigo-200 transition-all duration-300 group ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 min-h-[2.5rem]">
        <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
          <div className="hidden sm:flex flex-shrink-0 w-10 h-10 bg-indigo-50 rounded-full items-center justify-center text-indigo-600 font-bold">
            {icon}
          </div>
          {mobileIcon && (
            <div className="sm:hidden inline-block w-fit bg-indigo-50 text-indigo-600 font-bold text-xs px-2.5 py-1 rounded-md mb-1">
              {mobileIcon}
            </div>
          )}
          {!mobileIcon && (
            <div className="sm:hidden inline-flex w-fit bg-indigo-50 text-indigo-600 items-center justify-center rounded-md p-1.5 mb-1">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h4 className="text-base sm:text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-2 sm:line-clamp-1 leading-7">
              {title}
            </h4>
            <div className="text-sm text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 min-h-[1.25rem]">
              {meta}
            </div>
          </div>
        </div>
        {actions && (
          <div
            className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 shrink-0 w-full sm:w-auto min-h-[2.5rem] [&_button]:w-full sm:[&_button]:w-auto [&_span]:w-full sm:[&_span]:w-auto [&_span]:justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}

const featurePrimaryBtn =
  'inline-flex items-center justify-center bg-white border-2 border-gray-100 text-gray-600 px-5 py-2.5 sm:py-2 rounded-xl hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-sm font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap';
const featureSecondaryBtn =
  'inline-flex items-center justify-center bg-white border-2 border-gray-100 text-gray-600 px-5 py-2.5 sm:py-2 rounded-xl hover:bg-gray-50 hover:border-gray-200 text-sm font-bold transition-all shadow-sm whitespace-nowrap';
const featureDisabledBtn =
  'inline-flex items-center justify-center bg-gray-50 border-2 border-gray-100 text-gray-300 px-5 py-2.5 sm:py-2 rounded-xl text-sm font-bold cursor-not-allowed whitespace-nowrap';
const featureEmptyState =
  'text-center min-h-[220px] sm:min-h-[280px] flex flex-col items-center justify-center bg-gray-50 rounded-xl border border-dashed border-gray-200 px-4';

function LessonDetail({
  lesson,
  index,
  resolvedCourse,
  router,
  previewMode = false,
}: {
  lesson: Lesson;
  index: number;
  resolvedCourse: Course | null;
  router: ReturnType<typeof useRouter>;
  previewMode?: boolean;
}) {
  return (
    <FeatureListCard
      icon={<CourseHubFeatureIcon id="lessons" />}
      mobileIcon={
        <span className="inline-flex items-center gap-1">
          <CourseHubFeatureIcon id="lessons" className="w-3.5 h-3.5" />
          第 {index + 1} 堂
        </span>
      }
      title={lesson.title}
      meta={
        <span className="inline-flex items-center">
          <ClockIcon className="w-4 h-4 mr-1 shrink-0" />
          {lesson.date || '日期未定'}
        </span>
      }
      actions={
        <button
          type="button"
          onClick={() => {
            const lessonData = { ...lesson, courseName: resolvedCourse?.name, courseCode: resolvedCourse?.code, courseId: resolvedCourse?.id, lessonIndex: index + 1 };
            localStorage.setItem('currentLesson', JSON.stringify(lessonData));
            const courseCode = resolvedCourse?.code || resolvedCourse?.id;
            const currentUrl = courseCode
              ? buildCourseTabUrl(courseCode, 'lessons', previewMode)
              : previewMode
                ? '/back-panel/teacher-courses'
                : '/student/courses';
            const detailPath = previewMode
              ? `/back-panel/teacher-courses/preview/lesson?returnTo=${encodeURIComponent(currentUrl)}`
              : `/student/lesson-detail?returnTo=${encodeURIComponent(currentUrl)}`;
            router.push(detailPath);
          }}
          className={featurePrimaryBtn}
        >
          查看內容
        </button>
      }
    />
  );
}

const Pagination = ({ currentPage, totalPages, setCurrentPage }: { currentPage: number; totalPages: number; setCurrentPage: (page: number) => void }) => {
  if (totalPages <= 1) return null;
  const pageNumbers = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }
  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-6 sm:mt-8 flex-wrap">
      <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm ${currentPage === 1 ? 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed shadow-none' : 'bg-white text-gray-600 hover:bg-indigo-50 border border-gray-200 hover:text-indigo-600'}`}><ChevronLeftIcon className="w-5 h-5 stroke-2" /></button>
      {startPage > 1 && (<><button onClick={() => setCurrentPage(1)} className="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200">1</button>{startPage > 2 && <span className="px-1 sm:px-2 text-gray-400">...</span>}</>)}
      {pageNumbers.map(number => (<button key={number} onClick={() => setCurrentPage(number)} className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm ${currentPage === number ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 border border-indigo-600' : 'bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200'}`}>{number}</button>))}
      {endPage < totalPages && (<>{endPage < totalPages - 1 && <span className="px-1 sm:px-2 text-gray-400">...</span>}<button onClick={() => setCurrentPage(totalPages)} className="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200">{totalPages}</button></>)}
      <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm ${currentPage === totalPages ? 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed shadow-none' : 'bg-white text-gray-600 hover:bg-indigo-50 border border-gray-200 hover:text-indigo-600'}`}><ChevronRightIcon className="w-5 h-5 stroke-2" /></button>
    </div>
  );
};

export type StudentCoursePreviewData = {
  course: Course;
  exams: StudentExamListItem[];
  surveys: StudentSurveyListItem[];
  attendance: CourseAttendanceActivity[];
};

interface StudentCoursesContentProps {
  courseCodeFromUrl?: string;
  /** 老師端學生畫面預覽（不依賴學生 session） */
  previewMode?: boolean;
  previewData?: StudentCoursePreviewData | null;
  onExitPreview?: () => void;
}

export default function StudentCoursesContent({
  courseCodeFromUrl = '',
  previewMode = false,
  previewData = null,
  onExitPreview,
}: StudentCoursesContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { studentInfo } = useStudentInfo();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseKey, setSelectedCourseKey] = useState<string>('');
  const [loadingCourses, setLoadingCourses] = useState(!previewMode);
  const hasLoadedCoursesRef = useRef(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState<boolean>(false);
  const [examPage, setExamPage] = useState<number>(1);
  const [attendancePage, setAttendancePage] = useState<number>(1);
  const [activeCourseTab, setActiveCourseTab] = useState<CourseTab>(() => parseCourseTab(searchParams.get('tab')));
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<CourseAnnouncement | null>(null);
  const [courseDetails, setCourseDetails] = useState<{ customLinks?: CustomLink[], announcements?: CourseAnnouncement[] }>({});
  const [loadingCourseDetails, setLoadingCourseDetails] = useState(false);
  const [courseExams, setCourseExams] = useState<StudentExamListItem[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [courseSurveys, setCourseSurveys] = useState<StudentSurveyListItem[]>([]);
  const [loadingSurveys, setLoadingSurveys] = useState(false);
  const [courseAttendance, setCourseAttendance] = useState<CourseAttendanceActivity[]>([]);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [startModal, setStartModal] = useState<{ exam: StudentExamListItem; mode: 'start' | 'retake' } | null>(null);
  const [surveyStartModal, setSurveyStartModal] = useState<{
    survey: StudentSurveyListItem;
    mode: 'start' | 'retake';
  } | null>(null);
  const [historyModal, setHistoryModal] = useState<StudentExamListItem | null>(null);
  const examsPerPage = 5;
  const attendancePerPage = 5;

  const tabFromUrl = parseCourseTab(searchParams.get('tab'));

  useEffect(() => {
    setActiveCourseTab(tabFromUrl);
  }, [tabFromUrl]);

  // 老師預覽：直接注入課程與列表資料
  useEffect(() => {
    if (!previewMode || !previewData?.course) return;
    setCourses([previewData.course]);
    setCourseExams(sortQuizzesByOrder(previewData.exams ?? []));
    setCourseSurveys(sortSurveysByOrder(previewData.surveys ?? []));
    const attendance = [...(previewData.attendance ?? [])].sort((a, b) => {
      const order = { active: 0, upcoming: 1, past: 2 };
      const statusDiff = order[a.status] - order[b.status];
      if (statusDiff !== 0) return statusDiff;
      return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
    });
    setCourseAttendance(attendance);
    setLoadingCourses(false);
    hasLoadedCoursesRef.current = true;
    const key = getCourseDisplayKey(previewData.course);
    setSelectedCourseKey(key);
  }, [previewMode, previewData]);

  const fetchCourses = useCallback(async (options?: { silent?: boolean }) => {
    if (previewMode) return;
    if (!studentInfo) return;
    const isInitialLoad = !hasLoadedCoursesRef.current;
    if (!options?.silent && isInitialLoad) setLoadingCourses(true);

    // 安全機制：設定 8 秒後強制停止 Loading，避免畫面卡死
    const safetyTimer = setTimeout(() => {
      console.warn("Course fetch timed out");
      setLoadingCourses(false);
    }, 8000);

    try {
      const studentId = studentInfo.id;
      const data = await fetchStudentDashboardData(studentId, { coursesOnly: true });
      const mergedCourses = mergeCoursesFromEnrolledKeys(
        (data.courses ?? []).filter((c) => c) as Course[],
        studentInfo.enrolledCourses ?? []
      );
      setCourses(mergedCourses);
      hasLoadedCoursesRef.current = true;
      setCachedActiveCourseCount(
        mergedCourses.filter((c) => !isCourseArchived(c)).length
      );
      clearTimeout(safetyTimer);
    } catch (error) {
      if (error instanceof StudentApiError) {
        // session 已清除，layout 會導向登入頁
      } else {
        console.warn('載入課程時發生錯誤:', error instanceof Error ? error.message : error);
      }
      setCourses([]);
      setCachedActiveCourseCount(0);
      clearTimeout(safetyTimer);
    } finally {
      clearTimeout(safetyTimer);
      setLoadingCourses(false);
    }
  }, [studentInfo, previewMode]);

  useEffect(() => {
    if (previewMode) return;
    if (studentInfo) {
      fetchCourses();
    }
  }, [studentInfo, fetchCourses, previewMode]);

  // profile 載入 enrolledCourses 後，補齊 API 可能遺漏的封存課程
  useEffect(() => {
    if (previewMode) return;
    if (!studentInfo || loadingCourses) return;
    const enrolled = studentInfo.enrolledCourses ?? [];
    if (enrolled.length === 0) return;
    setCourses((prev) => {
      const merged = mergeCoursesFromEnrolledKeys(prev, enrolled);
      return merged.length === prev.length ? prev : merged;
    });
  }, [studentInfo?.enrolledCourses, loadingCourses, previewMode]);

  useEffect(() => {
    if (!courseCodeFromUrl) {
      setSelectedCourseKey('');
      clearPendingCourseSelection();
      return;
    }

    const decoded = decodeURIComponent(courseCodeFromUrl);
    const course = courses.find((c) => c.code === decoded || c.id === decoded);
    if (course) {
      const courseKey = getCourseDisplayKey(course);
      setSelectedCourseKey(courseKey);
      setPendingCourseSelection(courseCodeFromUrl, courseKey);
    }
  }, [courseCodeFromUrl, courses]);

  const effectiveSelectedCourse = useMemo(() => {
    if (selectedCourseKey) return selectedCourseKey;
    if (!courseCodeFromUrl) return '';
    const decoded = decodeURIComponent(courseCodeFromUrl);
    const matched = courses.find((c) => c.code === decoded || c.id === decoded);
    if (matched) return getCourseDisplayKey(matched);
    return getPendingCourseSelection(courseCodeFromUrl);
  }, [selectedCourseKey, courseCodeFromUrl, courses]);

  const resolvedCourse = useMemo(() => {
    if (!effectiveSelectedCourse) return null;
    return courses.find((c) => getCourseDisplayKey(c) === effectiveSelectedCourse) ?? null;
  }, [courses, effectiveSelectedCourse]);

  const handleSelectCourse = useCallback(
    (course: Course) => {
      if (isCourseArchived(course)) return;
      const courseKey = getCourseDisplayKey(course);
      setSelectedCourseKey(courseKey);
      setPendingCourseSelection(course.code, courseKey);
      router.push(`/student/courses/${encodeURIComponent(course.code)}`);
    },
    [router]
  );

  const isResolvedCourseArchived = resolvedCourse ? isCourseArchived(resolvedCourse) : false;

  // 切換課程時清空分頁狀態，避免殘留（須在各 tab fetch 之前）
  useEffect(() => {
    setExamPage(1);
    setAttendancePage(1);
    setLessons([]);
    setCourseDetails({});
    setLoadingCourseDetails(false);
    setStartModal(null);
    setSurveyStartModal(null);
    setHistoryModal(null);
    if (!previewMode) {
      setCourseExams([]);
      setCourseAttendance([]);
      setCourseSurveys([]);
    }
  }, [resolvedCourse?.id, previewMode]);

  // 列表頁 idle 時預熱第一門課，進入詳情更快
  useEffect(() => {
    if (courseCodeFromUrl || loadingCourses || courses.length === 0) return;
    const first = courses.find((c) => !isCourseArchived(c));
    if (!first?.id) return;
    let cancelled = false;
    const run = () => {
      if (!cancelled) prefetchCourseDetail(first.id);
    };
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(run, { timeout: 2000 });
    } else {
      timeoutId = setTimeout(run, 600);
    }
    return () => {
      cancelled = true;
      if (idleId !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [courseCodeFromUrl, loadingCourses, courses]);

  // 課程資訊／公告：才載入 classdata
  useEffect(() => {
    let isCurrent = true;

    const fetchCourseDetails = async () => {
      if (!resolvedCourse || isResolvedCourseArchived) {
        setCourseDetails({});
        return;
      }
      if (activeCourseTab !== 'info' && activeCourseTab !== 'announcements') {
        return;
      }

      setLoadingCourseDetails(true);
      try {
        const data = await fetchCourseClassData(resolvedCourse.id);
        if (isCurrent) {
          setCourseDetails({
            customLinks: data.customLinks || [],
            announcements: data.announcements || [],
          });
        }
      } catch {
        // 保留 resolvedCourse 上已有的欄位作為 fallback
      } finally {
        if (isCurrent) setLoadingCourseDetails(false);
      }
    };
    void fetchCourseDetails();
    return () => { isCurrent = false; };
  }, [resolvedCourse?.id, isResolvedCourseArchived, activeCourseTab]);

  // 課程清單 tab：才載入課堂
  useEffect(() => {
    let cancelled = false;
    const fetchLessons = async () => {
      if (!resolvedCourse || isResolvedCourseArchived || activeCourseTab !== 'lessons') {
        return;
      }
      setLoadingLessons(true);
      try {
        const list = await fetchCourseLessons(resolvedCourse.id);
        let filtered = list as Lesson[];
        if (previewMode) {
          // 老師 session 會拿到全部課堂；預覽時比照學生僅顯示開放項
          filtered = filtered
            .filter((lesson) => (lesson as { visibleToStudents?: boolean }).visibleToStudents !== false)
            .map((lesson) => {
              const attachments = Array.isArray(lesson.attachments)
                ? lesson.attachments.filter((att) => {
                    if (typeof att === 'string') return att.trim() !== '';
                    if (att && typeof att === 'object' && 'url' in att) {
                      const typed = att as { url?: string; visibleToStudents?: boolean };
                      return !!typed.url && typed.visibleToStudents !== false;
                    }
                    return false;
                  })
                : [];
              return { ...lesson, attachments };
            });
        }
        const sortedLessons = [...filtered].sort((a, b) => {
          const aOrder = typeof a.order === 'number' ? a.order : 9999;
          const bOrder = typeof b.order === 'number' ? b.order : 9999;
          if (aOrder === 9999 && bOrder === 9999) {
            const aDate = a.date ? new Date(a.date).getTime() : 0;
            const bDate = b.date ? new Date(b.date).getTime() : 0;
            return aDate - bDate;
          }
          return aOrder - bOrder;
        });
        if (!cancelled) setLessons(sortedLessons);
      } catch (error) {
        console.warn('載入單元內容時發生網路連線錯誤:', error instanceof Error ? error.message : error);
        if (!cancelled) setLessons([]);
      } finally {
        if (!cancelled) setLoadingLessons(false);
      }
    };
    void fetchLessons();
    return () => { cancelled = true; };
  }, [resolvedCourse?.id, isResolvedCourseArchived, activeCourseTab, previewMode]);

  // 線上測驗：切到 exams tab 才載入
  useEffect(() => {
    let cancelled = false;
    const fetchExams = async () => {
      if (previewMode) return;
      if (!resolvedCourse || isResolvedCourseArchived || !studentInfo?.id || !courseCodeFromUrl) {
        return;
      }
      if (activeCourseTab !== 'exams') return;
      setLoadingExams(true);
      try {
        const exams = await fetchStudentExamList(studentInfo.id, {
          courseId: resolvedCourse.id,
          courseName: resolvedCourse.name,
          courseCode: resolvedCourse.code,
        });
        if (cancelled) return;
        setCourseExams(sortQuizzesByOrder(exams));
        setExamPage(1);
      } catch {
        if (!cancelled) setCourseExams([]);
      } finally {
        if (!cancelled) setLoadingExams(false);
      }
    };
    void fetchExams();
    return () => { cancelled = true; };
  }, [resolvedCourse?.id, resolvedCourse?.name, resolvedCourse?.code, isResolvedCourseArchived, studentInfo?.id, courseCodeFromUrl, activeCourseTab, previewMode]);

  // 課程問卷：切到 surveys tab 才載入
  useEffect(() => {
    let cancelled = false;
    const fetchSurveys = async () => {
      if (previewMode) return;
      if (!resolvedCourse || isResolvedCourseArchived || !studentInfo?.id || !courseCodeFromUrl) {
        return;
      }
      if (activeCourseTab !== 'surveys') return;
      setLoadingSurveys(true);
      try {
        const surveys = await fetchStudentSurveyList(studentInfo.id, {
          courseId: resolvedCourse.id,
          courseName: resolvedCourse.name,
          courseCode: resolvedCourse.code,
        });
        if (cancelled) return;
        setCourseSurveys(sortSurveysByOrder(surveys));
      } catch {
        if (!cancelled) setCourseSurveys([]);
      } finally {
        if (!cancelled) setLoadingSurveys(false);
      }
    };
    void fetchSurveys();
    return () => { cancelled = true; };
  }, [resolvedCourse?.id, resolvedCourse?.name, resolvedCourse?.code, isResolvedCourseArchived, studentInfo?.id, courseCodeFromUrl, activeCourseTab, previewMode]);

  // 線上點名：切到 attendance tab 才載入
  useEffect(() => {
    let cancelled = false;
    const fetchAttendance = async () => {
      if (previewMode) return;
      if (!resolvedCourse || isResolvedCourseArchived || !courseCodeFromUrl) {
        return;
      }
      if (activeCourseTab !== 'attendance') return;
      setLoadingAttendance(true);
      try {
        const list = await fetchStudentAttendanceActivities({ courseId: resolvedCourse.id });
        if (cancelled) return;
        const filtered = [...list].sort((a, b) => {
          const order = { active: 0, upcoming: 1, past: 2 };
          const statusDiff = order[a.status] - order[b.status];
          if (statusDiff !== 0) return statusDiff;
          return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        });
        setCourseAttendance(filtered);
        setAttendancePage(1);
      } catch {
        if (!cancelled) setCourseAttendance([]);
      } finally {
        if (!cancelled) setLoadingAttendance(false);
      }
    };
    void fetchAttendance();
    return () => { cancelled = true; };
  }, [resolvedCourse?.id, isResolvedCourseArchived, courseCodeFromUrl, activeCourseTab, previewMode]);

  // 進入詳情後，idle 預熱其他常用 tab（含 exams/surveys/attendance）
  useEffect(() => {
    if (previewMode) return;
    if (!resolvedCourse || isResolvedCourseArchived || !courseCodeFromUrl) return;
    let cancelled = false;
    const run = () => {
      if (cancelled || !studentInfo?.id) return;
      if (activeCourseTab !== 'lessons') void fetchCourseLessons(resolvedCourse.id).catch(() => {});
      if (activeCourseTab !== 'info' && activeCourseTab !== 'announcements') {
        void fetchCourseClassData(resolvedCourse.id).catch(() => {});
      }
      if (activeCourseTab !== 'exams') {
        void fetchStudentExamList(studentInfo.id, {
          courseId: resolvedCourse.id,
          courseName: resolvedCourse.name,
          courseCode: resolvedCourse.code,
        }).catch(() => {});
      }
      if (activeCourseTab !== 'surveys') {
        void fetchStudentSurveyList(studentInfo.id, {
          courseId: resolvedCourse.id,
          courseName: resolvedCourse.name,
          courseCode: resolvedCourse.code,
        }).catch(() => {});
      }
      if (activeCourseTab !== 'attendance') {
        void fetchStudentAttendanceActivities({ courseId: resolvedCourse.id }).catch(() => {});
      }
    };
    let idleId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      idleId = window.requestIdleCallback(run, { timeout: 2500 });
    } else {
      timeoutId = setTimeout(run, 800);
    }
    return () => {
      cancelled = true;
      if (idleId !== undefined && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [resolvedCourse?.id, isResolvedCourseArchived, courseCodeFromUrl, studentInfo?.id, activeCourseTab, previewMode]);

  const setCourseTab = useCallback((tab: CourseTab) => {
    setActiveCourseTab(tab);
    const code = resolvedCourse?.code || courseCodeFromUrl;
    if (!code) return;
    router.replace(buildCourseTabUrl(code, tab, previewMode), { scroll: false });
  }, [resolvedCourse?.code, courseCodeFromUrl, router, previewMode]);

  const resolveExamTitle = useCallback(
    (quizCode: string) => courseExams.find((e) => e.quizCode === quizCode)?.title,
    [courseExams]
  );

  const openStartModal = useCallback(
    async (exam: StudentExamListItem, mode: 'start' | 'retake') => {
      if (previewMode) {
        const blank = openBlankPreviewTab();
        try {
          const quiz = await fetchQuizByCode(exam.quizCode);
          openTeacherExamPreviewInNewTab(quiz, { targetWindow: blank });
        } catch (e) {
          blank?.close();
          await Swal.fire({
            icon: 'error',
            title: '無法開啟預覽',
            text: e instanceof Error ? e.message : '請稍後再試',
          });
        }
        return;
      }
      if (!studentInfo?.id) return;
      const check = canStartExamTake(studentInfo.id, exam.quizCode);
      if (!check.allowed) {
        const alertResult = await showExamTakeBlockedAlert(check, {
          blockingTitle: check.blockingQuizCode
            ? resolveExamTitle(check.blockingQuizCode)
            : undefined,
          studentId: studentInfo.id,
          targetQuizCode: exam.quizCode,
        });
        if (alertResult !== 'retry-allowed') return;
      }
      setStartModal({ exam, mode });
    },
    [studentInfo?.id, resolveExamTitle, previewMode]
  );

  const openSurveyStart = useCallback(
    async (survey: StudentSurveyListItem, mode: 'start' | 'retake') => {
      if (previewMode) {
        const blank = openBlankPreviewTab();
        try {
          const full = await fetchSurveyByCode(survey.surveyCode);
          openTeacherSurveyPreviewInNewTab(full, { targetWindow: blank });
        } catch (e) {
          blank?.close();
          await Swal.fire({
            icon: 'error',
            title: '無法開啟預覽',
            text: e instanceof Error ? e.message : '請稍後再試',
          });
        }
        return;
      }
      setSurveyStartModal({ survey, mode });
    },
    [previewMode]
  );

  const openHistory = useCallback((exam: StudentExamListItem) => {
    if (previewMode) {
      void Swal.fire({
        icon: 'info',
        title: '預覽模式',
        text: '學生端預覽沒有作答紀錄可查看。',
      });
      return;
    }
    if (exam.attempts && exam.attempts.length > 0) {
      setHistoryModal(exam);
      return;
    }
    if (exam.latestSubmissionId) {
      openStudentExamReviewInNewTab(exam.quizCode, { submissionId: exam.latestSubmissionId });
      return;
    }
    openStudentExamReviewInNewTab(exam.quizCode, { review: true });
  }, [previewMode]);

  const deepLinkHandledRef = useRef('');
  const annIdFromUrl = searchParams.get('ann');
  const examIdFromUrl = searchParams.get('exam');
  const surveyIdFromUrl = searchParams.get('survey');
  const reviewFromUrl = searchParams.get('review') === '1';

  const showMainLoading = Boolean(courseCodeFromUrl && loadingCourses && !resolvedCourse);

  const renderIcon = (iconName: string, className: string) => {
    switch (iconName) {
      case 'VideoCameraIcon': return <VideoCameraIcon className={className} />;
      case 'DocumentTextIcon': return <DocumentTextIcon className={className} />;
      case 'FolderIcon': return <FolderIcon className={className} />;
      case 'ChatBubbleLeftRightIcon': return <ChatBubbleLeftRightIcon className={className} />;
      case 'LinkIcon':
      default: return <LinkIcon className={className} />;
    }
  };

  const activeLinks = (courseDetails.customLinks && courseDetails.customLinks.length > 0 ? courseDetails.customLinks : resolvedCourse?.customLinks) || [];
  const activeAnnouncements = ((courseDetails.announcements && courseDetails.announcements.length > 0 ? courseDetails.announcements : resolvedCourse?.announcements) || []).filter(
    (ann) => (ann as { visibleToStudents?: boolean }).visibleToStudents !== false
  );
  const sortedAnnouncements = [...activeAnnouncements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  useEffect(() => {
    if (previewMode || !resolvedCourse?.code || !studentInfo?.id) return;
    const handleKey = [
      resolvedCourse.code,
      activeCourseTab,
      annIdFromUrl || '',
      examIdFromUrl || '',
      surveyIdFromUrl || '',
      reviewFromUrl ? '1' : '',
    ].join('|');
    if (!annIdFromUrl && !examIdFromUrl && !surveyIdFromUrl) return;
    if (deepLinkHandledRef.current === handleKey) return;

    if (activeCourseTab === 'announcements' && annIdFromUrl && !loadingCourseDetails) {
      const target = activeAnnouncements.find((a) => a.id === annIdFromUrl);
      if (target) {
        deepLinkHandledRef.current = handleKey;
        setSelectedAnnouncement(target);
        router.replace(buildCourseTabUrl(resolvedCourse.code, 'announcements', previewMode), { scroll: false });
      } else if (!loadingCourseDetails) {
        deepLinkHandledRef.current = handleKey;
        router.replace(buildCourseTabUrl(resolvedCourse.code, 'announcements', previewMode), { scroll: false });
      }
      return;
    }

    if (activeCourseTab === 'exams' && examIdFromUrl && !loadingExams) {
      const target = courseExams.find((e) => e.id === examIdFromUrl);
      if (target) {
        deepLinkHandledRef.current = handleKey;
        if (reviewFromUrl && target.submitted) {
          openHistory(target);
        } else {
          const isRetake = target.submitted && target.canRetake;
          void openStartModal(target, isRetake ? 'retake' : 'start');
        }
        router.replace(buildCourseTabUrl(resolvedCourse.code, 'exams', previewMode), { scroll: false });
      } else if (!loadingExams) {
        deepLinkHandledRef.current = handleKey;
        router.replace(buildCourseTabUrl(resolvedCourse.code, 'exams', previewMode), { scroll: false });
      }
      return;
    }

    if (activeCourseTab === 'surveys' && surveyIdFromUrl && !loadingSurveys) {
      const target = courseSurveys.find((s) => s.id === surveyIdFromUrl);
      if (target) {
        deepLinkHandledRef.current = handleKey;
        const isRetake = target.submitted && target.canRetake;
        void openSurveyStart(target, isRetake ? 'retake' : 'start');
        router.replace(buildCourseTabUrl(resolvedCourse.code, 'surveys', previewMode), { scroll: false });
      } else if (!loadingSurveys) {
        deepLinkHandledRef.current = handleKey;
        router.replace(buildCourseTabUrl(resolvedCourse.code, 'surveys', previewMode), { scroll: false });
      }
    }
  }, [
    previewMode,
    resolvedCourse?.code,
    studentInfo?.id,
    activeCourseTab,
    annIdFromUrl,
    examIdFromUrl,
    surveyIdFromUrl,
    reviewFromUrl,
    loadingCourseDetails,
    loadingExams,
    loadingSurveys,
    activeAnnouncements,
    courseExams,
    courseSurveys,
    openHistory,
    openStartModal,
    openSurveyStart,
    router,
  ]);

  const indexOfLastExam = examPage * examsPerPage;
  const indexOfFirstExam = indexOfLastExam - examsPerPage;
  const currentExams = courseExams.slice(indexOfFirstExam, indexOfLastExam);
  const totalExamPages = Math.ceil(courseExams.length / examsPerPage);

  const indexOfLastAttendance = attendancePage * attendancePerPage;
  const indexOfFirstAttendance = indexOfLastAttendance - attendancePerPage;
  const currentAttendance = courseAttendance.slice(indexOfFirstAttendance, indexOfLastAttendance);
  const totalAttendancePages = Math.ceil(courseAttendance.length / attendancePerPage);

  const openAttendanceCheckIn = useCallback((activity: CourseAttendanceActivity) => {
    if (previewMode) {
      void Swal.fire({
        icon: 'info',
        title: '預覽模式',
        text: '學生端預覽不會真正執行點名。',
      });
      return;
    }
    if (!resolvedCourse) return;
    const returnTo = buildCourseTabUrl(resolvedCourse.code, 'attendance', previewMode);
    router.push(
      `/student/attendance?courseId=${encodeURIComponent(activity.firestoreCourseId)}&activity=${encodeURIComponent(activity.id)}&returnTo=${encodeURIComponent(returnTo)}`
    );
  }, [resolvedCourse, router, previewMode]);

  const getAttendanceStatusPill = (status: string | undefined, leaveType?: string) => {
    if (!status) {
      return (
        <span className="inline-flex items-center justify-center px-5 py-2 text-sm font-bold text-gray-400">
          未記錄
        </span>
      );
    }
    const statusMap: Record<string, { text: string; styles: string }> = {
      present: { text: '出席', styles: 'text-green-700 bg-green-50 border-green-100' },
      late: { text: '遲到', styles: 'text-yellow-700 bg-yellow-50 border-yellow-100' },
      absent: { text: '曠課', styles: 'text-red-700 bg-red-50 border-red-100' },
      leave: { text: '請假', styles: 'text-purple-700 bg-purple-50 border-purple-100' },
    };
    const config = statusMap[status] || { text: status, styles: 'text-gray-700 bg-gray-50 border-gray-100' };
    const displayText = status === 'leave' && leaveType ? leaveType : config.text;
    return (
      <span className={`inline-flex items-center justify-center px-5 py-2 text-sm font-bold border-2 rounded-xl ${config.styles}`}>
        {displayText}
      </span>
    );
  };

  return (
    <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10 flex flex-col min-h-full animate-fade-in">
      <style>{quillDisplayStyles}</style>

      {/* Header Area */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 ${courseCodeFromUrl ? 'mb-0' : 'mb-8'}`}>
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3 min-w-0">
            <BookOpenIcon className="h-7 w-7 sm:h-8 sm:w-8 text-indigo-600 shrink-0" />
            <span className="truncate">
              {courseCodeFromUrl && resolvedCourse ? resolvedCourse.name : '我的課程'}
            </span>
          </h1>
          <p className="text-gray-500 text-sm mt-1 break-all">
            {courseCodeFromUrl && resolvedCourse
              ? resolvedCourse.code
              : '查看課程內容與進度'}
          </p>
        </div>
      </div>

      {courseCodeFromUrl && (
        <BackButton
          label={previewMode ? '關閉預覽' : '返回課程列表'}
          onClick={() => {
            if (previewMode) {
              onExitPreview?.();
              return;
            }
            setSelectedCourseKey('');
            clearPendingCourseSelection();
            router.push('/student/courses');
          }}
        />
      )}

      {!courseCodeFromUrl && loadingCourses && courses.length === 0 && <PageLoadingArea />}

      {!courseCodeFromUrl && !loadingCourses && courses.length === 0 && (
        <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
          <h3 className="mt-2 text-xl font-bold text-gray-900">尚無課程</h3>
          <p className="text-gray-500 mt-2">您目前還沒有選擇任何課程</p>
        </div>
      )}

      {!courseCodeFromUrl && courses.length > 0 && (
        <StudentCourseTable
          courses={courses}
          showFilter
          blockArchivedEntry
          onSelectCourse={handleSelectCourse}
        />
      )}

      {showMainLoading && <PageLoadingArea />}

      {!showMainLoading && !effectiveSelectedCourse && !loadingCourses && courses.length === 0 && courseCodeFromUrl && (
        <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
          <h3 className="mt-2 text-xl font-bold text-gray-900">尚無課程</h3>
          <p className="text-gray-500 mt-2">您目前還沒有選擇任何課程</p>
        </div>
      )}

      {!showMainLoading && isResolvedCourseArchived && courseCodeFromUrl && (
        <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
          <h3 className="mt-2 text-xl font-bold text-gray-900">此課程已封存</h3>
          <p className="text-gray-500 mt-2">您可以在課程清單中查看此課程，但無法進入課程內容。</p>
        </div>
      )}

      {!showMainLoading && resolvedCourse && courseCodeFromUrl && !isResolvedCourseArchived && (
            <div className="animate-fade-in space-y-6">
              {/* 分頁列（獨立） */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-3 sm:px-6">
                <CourseHubTabNav
                  tabs={STUDENT_COURSE_HUB_TAB_IDS}
                  active={activeCourseTab}
                  audience="student"
                  onChange={(tab) => setCourseTab(tab as CourseTab)}
                />
              </div>

              {activeCourseTab === 'info' && (
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl shadow-xl p-4 sm:p-6 md:p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mt-20 -mr-20"></div>
                
                <div className="relative z-10">
                    <div className="mb-4 sm:mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
                    <div className="min-w-0">
                        <h3 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 tracking-tight break-words">{resolvedCourse.name}</h3>
                        <p className="text-indigo-100 font-mono text-sm sm:text-lg opacity-80 break-all">{resolvedCourse.code}</p>
                    </div>
                    <div>
                        <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-white/20 backdrop-blur-md text-white border border-white/30 shadow-sm">
                            {resolvedCourse.status}
                        </span>
                    </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 text-indigo-50">
                    <div className="flex items-start">
                        <ClockIcon className="w-5 h-5 mr-3 mt-0.5 opacity-70" />
                        <div>
                            <p className="text-xs uppercase tracking-wider opacity-70 mb-1">課程期間</p>
                            <p className="font-medium">{resolvedCourse.startDate || '未定'} ~ {resolvedCourse.endDate || '未定'}</p>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <UserIcon className="w-5 h-5 mr-3 mt-0.5 opacity-70" />
                        <div>
                            <p className="text-xs uppercase tracking-wider opacity-70 mb-1">授課老師</p>
                            <p className="font-medium">{resolvedCourse.teacherName || '未指定教師'}</p>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <MapPinIcon className="w-5 h-5 mr-3 mt-0.5 opacity-70" />
                        <div>
                            <p className="text-xs uppercase tracking-wider opacity-70 mb-1">上課地點</p>
                            <p className="font-medium">{resolvedCourse.location || '線上/未定'}</p>
                        </div>
                    </div>
                    {resolvedCourse.classTimes && resolvedCourse.classTimes.length > 0 && (
                        <div className="flex items-start col-span-1 md:col-span-2 lg:col-span-3 bg-white/10 p-3 rounded-lg border border-white/10">
                            <ClockIcon className="w-5 h-5 mr-3 mt-0.5 opacity-70" />
                            <div>
                                <p className="text-xs uppercase tracking-wider opacity-70 mb-1">上課時間</p>
                                <div className="font-medium">
                                    {resolvedCourse.classTimes.map((time, idx, arr) => (
                                        <React.Fragment key={idx}>
                                            <span className="block sm:inline">{`${time.day} ${time.startTime}-${time.endTime}`}</span>
                                            {idx < arr.length - 1 && <span className="hidden sm:inline">、</span>}
                                        </React.Fragment>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                    <div className="flex flex-wrap items-center col-span-1 md:col-span-2 lg:col-span-3 mt-3 gap-2 sm:gap-3">
                        {resolvedCourse.liveStreamURL && (
                             <a 
                                href={resolvedCourse.liveStreamURL} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-2 w-full sm:w-auto sm:min-w-[160px] px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors shadow-lg shadow-indigo-900/20"
                             >
                                <VideoCameraIcon className="w-5 h-5 shrink-0" />
                                <span className="flex-1 text-center">進入線上會議</span>
                             </a>
                        )}
                        {activeLinks.map((link, idx) => (
                             <a 
                                key={idx}
                                href={link.url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-2 w-full sm:w-auto sm:min-w-[160px] px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors shadow-lg shadow-indigo-900/20"
                             >
                                {renderIcon(link.icon, "w-5 h-5 shrink-0")}
                                <span className="flex-1 text-center">{link.name}</span>
                             </a>
                        ))}
                    </div>
                    </div>
                </div>
              </div>
              )}

              {activeCourseTab !== 'info' && activeCourseTab !== 'grades' && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8 mb-4">
                {activeCourseTab === 'lessons' && (
                  <>
                    {loadingLessons ? (
                      <div className="min-h-[220px] sm:min-h-[280px] flex items-center justify-center">
                        <PageLoadingArea />
                      </div>
                    ) : lessons.length === 0 ? (
                      <div className={featureEmptyState}>
                        <BookOpenIcon className="w-12 h-12 mb-3 text-gray-300" />
                        <p className="text-gray-500 font-medium">此課程尚未發布任何內容</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {lessons.map((lesson, index) => (
                          <LessonDetail
                            key={lesson.id}
                            lesson={lesson}
                            index={index}
                            resolvedCourse={resolvedCourse}
                            router={router}
                            previewMode={previewMode}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {activeCourseTab === 'announcements' && (
                  <div className="animate-fade-in">
                    {loadingCourseDetails ? (
                      <div className="min-h-[220px] sm:min-h-[280px] flex items-center justify-center">
                        <PageLoadingArea />
                      </div>
                    ) : activeAnnouncements.length > 0 ? (
                      <div className="grid grid-cols-1 gap-4">
                          {sortedAnnouncements.map(ann => (
                            <FeatureListCard
                              key={ann.id}
                              icon={<CourseHubFeatureIcon id="announcements" />}
                              title={ann.title}
                              meta={
                                <span className="inline-flex items-center">
                                  <ClockIcon className="w-4 h-4 mr-1" />
                                  {new Date(ann.createdAt).toLocaleDateString()}
                                </span>
                              }
                              actions={
                                <button
                                  type="button"
                                  onClick={() => setSelectedAnnouncement(ann)}
                                  className={featurePrimaryBtn}
                                >
                                  查看公告
                                </button>
                              }
                            />
                          ))}
                      </div>
                    ) : (
                      <div className={featureEmptyState}>
                        <MegaphoneIcon className="w-12 h-12 mb-3 text-gray-300" />
                        <p className="text-gray-500 font-medium">目前沒有課程公告</p>
                      </div>
                    )}
                  </div>
                )}

                {activeCourseTab === 'exams' && (
                  <div className="animate-fade-in">
                    {loadingExams ? (
                      <div className="min-h-[220px] sm:min-h-[280px] flex items-center justify-center">
                        <PageLoadingArea />
                      </div>
                    ) : courseExams.length === 0 ? (
                      <div className={featureEmptyState}>
                        <ClipboardDocumentCheckIcon className="w-12 h-12 mb-3 text-gray-300" />
                        <p className="text-gray-500 font-medium">目前沒有線上測驗</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-4">
                          {currentExams.map((exam) => {
                            const canStart = exam.accessible && (!exam.submitted || exam.canRetake);
                            const isRetake = exam.submitted && exam.canRetake;
                            const windowEnded = !!exam.windowEnded || exam.windowPhase === 'ended';
                            const windowUpcoming = exam.windowPhase === 'upcoming';
                            const statusText = exam.submitted
                              ? exam.resultsPublished
                                ? `已完成 · 得分 ${exam.submissionScore ?? '—'} 分`
                                : '已完成 · 成績尚未公布'
                              : windowEnded
                                ? '作答期間已截止'
                                : windowUpcoming
                                  ? '作答期間尚未開始'
                                  : exam.accessible
                                    ? '尚未完成'
                                    : (exam.inaccessibleReason || '測驗尚未開放');
                            return (
                              <FeatureListCard
                                key={exam.id}
                                icon={<CourseHubFeatureIcon id="exams" />}
                                title={exam.title}
                                meta={
                                  <>
                                    <span>作答期間 {exam.answerWindowLabel}</span>
                                    <span className={exam.submitted ? 'text-emerald-600 font-medium' : exam.accessible && !windowEnded ? 'text-amber-600 font-medium' : ''}>
                                      {statusText}
                                    </span>
                                  </>
                                }
                                actions={
                                  <>
                                    {exam.submitted && (
                                      <button type="button" onClick={() => openHistory(exam)} className={featureSecondaryBtn}>
                                        作答紀錄
                                      </button>
                                    )}
                                    {canStart && !windowEnded ? (
                                      <button
                                        type="button"
                                        onClick={() => void openStartModal(exam, isRetake ? 'retake' : 'start')}
                                        className={featurePrimaryBtn}
                                      >
                                        {isRetake ? '再次作答' : '開始作答'}
                                      </button>
                                    ) : windowUpcoming && !exam.submitted ? (
                                      <button
                                        type="button"
                                        onClick={() => void openStartModal(exam, 'start')}
                                        className={featurePrimaryBtn}
                                      >
                                        查看詳情
                                      </button>
                                    ) : !exam.submitted ? (
                                      <button type="button" disabled className={featureDisabledBtn}>
                                        {windowEnded ? '已截止' : '無法作答'}
                                      </button>
                                    ) : null}
                                  </>
                                }
                              />
                            );
                          })}
                        </div>
                        <Pagination currentPage={examPage} totalPages={totalExamPages} setCurrentPage={setExamPage} />
                      </>
                    )}
                  </div>
                )}

                {activeCourseTab === 'surveys' && (
                  <div className="animate-fade-in">
                    {loadingSurveys ? (
                      <div className="min-h-[220px] sm:min-h-[280px] flex items-center justify-center">
                        <PageLoadingArea />
                      </div>
                    ) : courseSurveys.length === 0 ? (
                      <div className={featureEmptyState}>
                        <ClipboardDocumentListIcon className="w-12 h-12 mb-3 text-gray-300" />
                        <p className="text-gray-500 font-medium">目前沒有課程問卷</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 gap-4">
                        {courseSurveys.map((survey) => {
                          const canFill = survey.accessible && (!survey.submitted || survey.canRetake);
                          const windowEnded = !!survey.windowEnded || survey.windowPhase === 'ended';
                          const windowUpcoming = survey.windowPhase === 'upcoming';
                          const isRetake = survey.submitted && survey.canRetake;
                          const statusText = survey.submitted
                            ? '已完成填寫'
                            : windowEnded
                              ? '填答期間已截止'
                              : windowUpcoming
                                ? '填答期間尚未開始'
                                : survey.accessible
                                  ? '尚未填寫'
                                  : (survey.inaccessibleReason || '問卷尚未開放');
                          return (
                            <FeatureListCard
                              key={survey.id}
                              icon={<CourseHubFeatureIcon id="surveys" />}
                              title={survey.title}
                              meta={
                                <>
                                  <span>{survey.responseModeLabel}</span>
                                  <span>填答期間 {survey.answerWindowLabel}</span>
                                  <span className={survey.submitted ? 'text-emerald-600 font-medium' : survey.accessible && !windowEnded ? 'text-amber-600 font-medium' : ''}>
                                    {statusText}
                                  </span>
                                </>
                              }
                              actions={
                                <>
                                  {survey.canViewResponse && (
                                    <button
                                      type="button"
                                      onClick={() => openStudentSurveyReviewInNewTab(survey.surveyCode)}
                                      className={featureSecondaryBtn}
                                    >
                                      查看填寫
                                    </button>
                                  )}
                                  {canFill && !windowEnded ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void openSurveyStart(survey, isRetake ? 'retake' : 'start')
                                      }
                                      className={featurePrimaryBtn}
                                    >
                                      {isRetake ? '再次填寫' : '開始填寫'}
                                    </button>
                                  ) : windowUpcoming && !survey.submitted ? (
                                    <button
                                      type="button"
                                      onClick={() => void openSurveyStart(survey, 'start')}
                                      className={featurePrimaryBtn}
                                    >
                                      查看詳情
                                    </button>
                                  ) : !survey.submitted ? (
                                    <button type="button" disabled className={featureDisabledBtn}>
                                      {windowEnded ? '已截止' : '無法填寫'}
                                    </button>
                                  ) : !survey.canViewResponse ? (
                                    <button type="button" disabled className={featureDisabledBtn}>
                                      已完成
                                    </button>
                                  ) : null}
                                </>
                              }
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {activeCourseTab === 'attendance' && (
                  <div className="animate-fade-in">
                    {loadingAttendance ? (
                      <div className="min-h-[220px] sm:min-h-[280px] flex items-center justify-center">
                        <PageLoadingArea />
                      </div>
                    ) : courseAttendance.length === 0 ? (
                      <div className={featureEmptyState}>
                        <ClockIcon className="w-12 h-12 mb-3 text-gray-300" />
                        <p className="text-gray-500 font-medium">目前沒有點名紀錄</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-4">
                          {currentAttendance.map((activity) => {
                            const hasCheckedIn = activity.studentStatus === 'present' || activity.studentStatus === 'late';
                            const phaseText =
                              activity.status === 'active'
                                ? '進行中'
                                : activity.status === 'upcoming'
                                  ? '即將開始'
                                  : '已結束';
                            return (
                              <FeatureListCard
                                key={activity.id}
                                icon={<CourseHubFeatureIcon id="attendance" />}
                                title={activity.title}
                                meta={
                                  <>
                                    <span className="inline-flex items-center">
                                      <ClockIcon className="w-4 h-4 mr-1 shrink-0" />
                                      {new Date(activity.startTime).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      {' ~ '}
                                      {new Date(activity.endTime).toLocaleString('zh-TW', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                    <span className={
                                      activity.status === 'active'
                                        ? 'text-green-700 font-medium'
                                        : activity.status === 'upcoming'
                                          ? 'text-blue-700 font-medium'
                                          : 'text-gray-500 font-medium'
                                    }>
                                      {phaseText}
                                    </span>
                                  </>
                                }
                                actions={
                                  activity.status === 'past' ? (
                                    getAttendanceStatusPill(activity.studentStatus, activity.studentLeaveType)
                                  ) : hasCheckedIn ? (
                                    <span className="inline-flex items-center justify-center px-5 py-2 text-sm font-bold border-2 rounded-xl text-emerald-700 bg-emerald-50 border-emerald-100">
                                      已簽到
                                    </span>
                                  ) : activity.status === 'active' ? (
                                    <button type="button" onClick={() => openAttendanceCheckIn(activity)} className={featurePrimaryBtn}>
                                      簽到
                                    </button>
                                  ) : (
                                    <span className="inline-flex items-center justify-center px-5 py-2 text-sm font-bold text-gray-400">
                                      尚未開始
                                    </span>
                                  )
                                }
                              />
                            );
                          })}
                        </div>
                        <Pagination currentPage={attendancePage} totalPages={totalAttendancePages} setCurrentPage={setAttendancePage} />
                      </>
                    )}
                  </div>
                )}

              </div>
              )}

              {/* 課程成績：進入課程即掛載預載，非成績 tab 時隱藏 */}
              {previewMode ? (
                activeCourseTab === 'grades' ? (
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8 mb-4">
                    <div className={featureEmptyState}>
                      <ClipboardDocumentListIcon className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="text-gray-500 font-medium">預覽模式不顯示個人成績</p>
                      <p className="text-sm text-gray-400 mt-1">成績需以實際學生帳號登入後查看</p>
                    </div>
                  </div>
                ) : null
              ) : studentInfo ? (
                <div
                  className={
                    activeCourseTab === 'grades'
                      ? 'bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8 mb-4 animate-fade-in min-h-[280px]'
                      : 'hidden'
                  }
                  aria-hidden={activeCourseTab !== 'grades'}
                >
                  <StudentGradeViewer
                    studentInfo={studentInfo}
                    courseCodeFromUrl={resolvedCourse.code}
                    embedded
                    active={activeCourseTab === 'grades'}
                  />
                </div>
              ) : activeCourseTab === 'grades' ? (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 sm:p-6 md:p-8 mb-4">
                  <div className={featureEmptyState}>
                    <ClipboardDocumentListIcon className="w-12 h-12 mb-3 text-gray-300" />
                    <p className="text-gray-500 font-medium">找不到學生資料，請重新登入</p>
                  </div>
                </div>
              ) : null}
            </div>
      )}

      {selectedAnnouncement && createPortal(
        <div className="fixed inset-0 z-[99999] flex justify-center items-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelectedAnnouncement(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-bounce-in">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 flex justify-between items-center text-white flex-shrink-0">
              <h3 className="text-xl font-bold flex items-center pr-8 line-clamp-1">
                {selectedAnnouncement.title}
              </h3>
              <button onClick={() => setSelectedAnnouncement(null)} className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20">
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-white">
              <div className="text-xs text-gray-500 mb-4 font-mono pb-4 border-b border-gray-100">發布日期：{new Date(selectedAnnouncement.createdAt).toLocaleDateString()}</div>
              {/<[a-z][\s\S]*>/i.test(selectedAnnouncement.content) ? (
                <div className="ql-snow">
                  <RichHtmlContent
                    html={selectedAnnouncement.content}
                    className="ql-editor text-gray-700 mb-6"
                  />
                </div>
              ) : (
                <div className="prose prose-sm text-gray-700 whitespace-pre-line mb-6">{selectedAnnouncement.content}</div>
              )}
              {selectedAnnouncement.links && selectedAnnouncement.links.length > 0 && (
                <div className="space-y-2 mt-6 pt-4 border-t border-gray-100">
                  <h5 className="font-bold text-gray-800 text-sm mb-3">相關連結</h5>
                  {selectedAnnouncement.links.map((link, idx) => (
                    <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center text-indigo-600 hover:text-indigo-800 text-sm bg-indigo-50 hover:bg-indigo-100 p-3 rounded-lg transition-colors font-medium">
                      <LinkIcon className="w-4 h-4 mr-2" />
                      {link.name || link.url}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {startModal && studentInfo?.id && (
        <StudentExamStartModal
          open
          onClose={() => setStartModal(null)}
          exam={startModal.exam}
          studentId={studentInfo.id}
          mode={startModal.mode}
          resolveExamTitle={resolveExamTitle}
        />
      )}

      {surveyStartModal && (
        <StudentSurveyStartModal
          open
          onClose={() => setSurveyStartModal(null)}
          survey={surveyStartModal.survey}
          mode={surveyStartModal.mode}
        />
      )}

      {historyModal && (
        <StudentExamAttemptPickerModal
          open
          onClose={() => setHistoryModal(null)}
          quizCode={historyModal.quizCode}
          examTitle={historyModal.title}
          attempts={historyModal.attempts ?? []}
          resultsPublished={historyModal.resultsPublished}
        />
      )}
    </div>
  );
}
