'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useStudentInfo } from '../StudentInfoContext';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import LoadingSpinner from '@/components/LoadingSpinner';
import StudentCourseSelector, { getCourseDisplayKey } from '@/components/StudentCourseSelector';
import { BookOpenIcon, ClockIcon, MapPinIcon, UserIcon, VideoCameraIcon, MegaphoneIcon, LinkIcon, DocumentTextIcon, FolderIcon, ChatBubbleLeftRightIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import 'react-quill-new/dist/quill.snow.css';

// Interfaces
interface ClassTime { day: string; startTime: string; endTime: string; }
interface CustomLink { name: string; url: string; icon: string; }
interface CourseAnnouncement { id: string; title: string; content: string; links: { name: string; url: string }[]; createdAt: string; }
interface Course { id: string; name: string; code: string; status: string; archived?: boolean; gradeTags: string[]; subjectTag: string; startDate: string; endDate: string; teachers: string[]; teacherName?: string; description: string; teachingMethod: string; courseNature: string; location?: string; liveStreamURL?: string; coverImageURL?: string; classTimes?: ClassTime[]; customLinks?: CustomLink[]; announcements?: CourseAnnouncement[]; }
interface Lesson { id: string; title: string; date: string; progress: string; attachments: Array<string | { url: string; name?: string; visibleToStudents?: boolean }>; videos: string[]; homework: string; noHomework?: boolean; onlineExam: string; noOnlineExam?: boolean; examScope: string; noExamScope?: boolean; notes: string; noNotes?: boolean; createdAt: string | number | { toDate: () => Date }; order?: number; }

const isCourseArchived = (course: Course): boolean => course.archived === true || String(course.archived) === 'true';

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

function LessonDetail({ lesson, index, resolvedCourse, router }: { lesson: Lesson; index: number; resolvedCourse: Course | null; router: ReturnType<typeof useRouter> }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-indigo-200 transition-all duration-300 group">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
           <div className="hidden sm:flex flex-shrink-0 w-10 h-10 bg-indigo-50 rounded-full items-center justify-center text-indigo-600 font-bold">
              {index + 1}
           </div>
           <div className="sm:hidden inline-block w-fit bg-indigo-50 text-indigo-600 font-bold text-xs px-2.5 py-1 rounded-md mb-1">
              第 {index + 1} 堂
           </div>
           <div>
              <h4 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
              {lesson.title}
              </h4>
              <p className="text-sm text-gray-500 mt-1 flex items-center">
                  <ClockIcon className="w-4 h-4 mr-1" />
                  {lesson.date}
              </p>
           </div>
        </div>
        <button
          onClick={() => {
            const lessonData = { ...lesson, courseName: resolvedCourse?.name, courseCode: resolvedCourse?.code, courseId: resolvedCourse?.id, lessonIndex: index + 1 };
            localStorage.setItem('currentLesson', JSON.stringify(lessonData));
            const courseCode = resolvedCourse?.code || resolvedCourse?.id;
            const currentUrl = courseCode ? `/student/courses/${encodeURIComponent(courseCode)}` : '/student/courses';
            router.push(`/student/lesson-detail?returnTo=${encodeURIComponent(currentUrl)}`);
          }}
          className="w-full sm:w-auto bg-white border-2 border-gray-100 text-gray-600 px-5 py-2 rounded-xl hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-sm font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap"
        >
          查看內容
        </button>
      </div>
    </div>
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
    <div className="flex items-center justify-center space-x-2 mt-8">
      <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm ${currentPage === 1 ? 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed shadow-none' : 'bg-white text-gray-600 hover:bg-indigo-50 border border-gray-200 hover:text-indigo-600'}`}><ChevronLeftIcon className="w-5 h-5 stroke-2" /></button>
      {startPage > 1 && (<><button onClick={() => setCurrentPage(1)} className="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200">1</button>{startPage > 2 && <span className="px-2 text-gray-400">...</span>}</>)}
      {pageNumbers.map(number => (<button key={number} onClick={() => setCurrentPage(number)} className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm ${currentPage === number ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 border border-indigo-600' : 'bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200'}`}>{number}</button>))}
      {endPage < totalPages && (<>{endPage < totalPages - 1 && <span className="px-2 text-gray-400">...</span>}<button onClick={() => setCurrentPage(totalPages)} className="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200">{totalPages}</button></>)}
      <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm ${currentPage === totalPages ? 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed shadow-none' : 'bg-white text-gray-600 hover:bg-indigo-50 border border-gray-200 hover:text-indigo-600'}`}><ChevronRightIcon className="w-5 h-5 stroke-2" /></button>
    </div>
  );
};

interface StudentCoursesContentProps {
  courseCodeFromUrl?: string;
}

export default function StudentCoursesContent({ courseCodeFromUrl = '' }: StudentCoursesContentProps) {
  const router = useRouter();
  const { studentInfo } = useStudentInfo();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseKey, setSelectedCourseKey] = useState<string>('');
  const [loadingCourses, setLoadingCourses] = useState(true);
  const hasLoadedCoursesRef = useRef(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [announcementPage, setAnnouncementPage] = useState<number>(1);
  const [activeCourseTab, setActiveCourseTab] = useState<'info' | 'announcements'>('info');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<CourseAnnouncement | null>(null);
  const [courseDetails, setCourseDetails] = useState<{ customLinks?: CustomLink[], announcements?: CourseAnnouncement[] }>({});
  const lessonsPerPage = 5;
  const announcementsPerPage = 3;

  const fetchCourses = useCallback(async (options?: { silent?: boolean }) => {
    if (!studentInfo) return;
    const isInitialLoad = !hasLoadedCoursesRef.current;
    if (!options?.silent && isInitialLoad) setLoadingCourses(true);

    // 安全機制：設定 8 秒後強制停止 Loading，避免畫面卡死
    const safetyTimer = setTimeout(() => {
      console.warn("Course fetch timed out");
      setLoadingCourses(false);
    }, 8000);

    try {
      const res = await fetch('/api/student/dashboard-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ studentId: studentInfo.studentId || studentInfo.account || studentInfo.id }),
      });
      if (res.ok) {
        const data = await res.json();
        // 過濾已封存課程，確保後續 logic (如 URL 自動選課) 不會選到舊課
        const activeCourses = (data.courses || [])
          .filter((c: Course) => c && c.status !== '已封存' && !isCourseArchived(c));
        setCourses(activeCourses);
        hasLoadedCoursesRef.current = true;
        setCachedActiveCourseCount(activeCourses.length);
      } else {
        setCourses([]);
        setCachedActiveCourseCount(0);
      }
      clearTimeout(safetyTimer);
    } catch (error) {
      console.warn('載入課程時發生網路連線錯誤 (Failed to fetch)，伺服器可能正在重啟或無回應:', error instanceof Error ? error.message : error);
      setCourses([]);
      clearTimeout(safetyTimer);
    } finally {
      clearTimeout(safetyTimer);
      setLoadingCourses(false);
    }
  }, [studentInfo]);

  useEffect(() => {
    if (studentInfo) {
      fetchCourses();
    }
  }, [studentInfo, fetchCourses]);

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

  const coursesForSelector = useMemo(() => {
    const displayKey = effectiveSelectedCourse;
    if (!displayKey) return courses;

    const exists = courses.some((c) => getCourseDisplayKey(c) === displayKey);
    if (exists) return courses;

    const lastOpenIdx = displayKey.lastIndexOf('(');
    const lastCloseIdx = displayKey.lastIndexOf(')');
    if (lastOpenIdx !== -1 && lastCloseIdx > lastOpenIdx) {
      const name = displayKey.substring(0, lastOpenIdx);
      const code = displayKey.substring(lastOpenIdx + 1, lastCloseIdx);
      return [{ id: '', name, code } as Course, ...courses];
    }
    return courses;
  }, [courses, effectiveSelectedCourse]);

  useEffect(() => {
    let isCurrent = true;

    const fetchCourseDetails = async () => {
      if (!resolvedCourse) {
        setCourseDetails({});
        return;
      }
      
      // 切換課程時，先清空舊的詳細資料，避免畫面短暫殘留
      setCourseDetails({});
      setAnnouncementPage(1);
      setActiveCourseTab('info');
      
      try {
        const res = await fetch(`/api/courses/classdata?courseId=${resolvedCourse.id}`);
        if (res.ok) {
          const data = await res.json();
          if (isCurrent) {
            setCourseDetails({
              customLinks: data.customLinks || [],
              announcements: data.announcements || []
            });
          }
        }
      } catch (e) {}
    };
    fetchCourseDetails();
    return () => { isCurrent = false; };
  }, [resolvedCourse?.id]);

  useEffect(() => {
    const fetchLessons = async () => {
      if (!resolvedCourse) {
        setLessons([]);
        return;
      }
      setLoadingLessons(true);
      try {
        const res = await fetch('/api/courses/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId: resolvedCourse.id }),
        });
        const lessons = await res.json();
        const sortedLessons = Array.isArray(lessons)
          ? [...lessons].sort((a, b) => {
              const aOrder = typeof a.order === 'number' ? a.order : 9999;
              const bOrder = typeof b.order === 'number' ? b.order : 9999;
              if (aOrder === 9999 && bOrder === 9999) {
                const aDate = a.date ? new Date(a.date).getTime() : 0;
                const bDate = b.date ? new Date(b.date).getTime() : 0;
                return aDate - bDate;
              }
              return aOrder - bOrder;
            })
          : [];
        setLessons(sortedLessons);
        setCurrentPage(1);
      } catch (error) {
        console.warn('載入單元內容時發生網路連線錯誤:', error instanceof Error ? error.message : error);
        setLessons([]);
        setCurrentPage(1);
      } finally {
        setLoadingLessons(false);
      }
    };
    fetchLessons();
  }, [resolvedCourse]);

  const showMainLoading =
    (loadingCourses && courses.length === 0) ||
    Boolean((effectiveSelectedCourse || courseCodeFromUrl) && resolvedCourse && loadingLessons);

  const indexOfLastLesson = currentPage * lessonsPerPage;
  const indexOfFirstLesson = indexOfLastLesson - lessonsPerPage;
  const currentLessons = lessons.slice(indexOfFirstLesson, indexOfLastLesson);
  const totalPages = Math.ceil(lessons.length / lessonsPerPage);

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
  const activeAnnouncements = (courseDetails.announcements && courseDetails.announcements.length > 0 ? courseDetails.announcements : resolvedCourse?.announcements) || [];

  const sortedAnnouncements = [...activeAnnouncements].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const indexOfLastAnnouncement = announcementPage * announcementsPerPage;
  const indexOfFirstAnnouncement = indexOfLastAnnouncement - announcementsPerPage;
  const currentAnnouncements = sortedAnnouncements.slice(indexOfFirstAnnouncement, indexOfLastAnnouncement);
  const totalAnnouncementPages = Math.ceil(sortedAnnouncements.length / announcementsPerPage);

  const displayCourseCount = courses.length > 0 ? courses.length : getCachedActiveCourseCount();
  const showCourseCountBadge = displayCourseCount > 0;

  return (
    <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10 flex flex-col min-h-full animate-fade-in">
      <style>{quillDisplayStyles}</style>

      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <BookOpenIcon className="h-8 w-8 text-indigo-600" />
            我的課程
          </h1>
          <p className="text-gray-500 text-sm mt-1">查看並進入您所選修的課程與教材內容。</p>
        </div>
        {showCourseCountBadge && (
          <span className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-bold border border-indigo-100 shadow-sm self-start md:self-auto">
            目前選修 {displayCourseCount} 門有效課程
          </span>
        )}
      </div>
      <StudentCourseSelector
        courses={coursesForSelector}
        selectedCourse={effectiveSelectedCourse}
        loadingCourses={loadingCourses}
        onChange={(value) => {
          setSelectedCourseKey(value);
          if (value) {
            const course = courses.find((c) => getCourseDisplayKey(c) === value);
            if (course) {
              setPendingCourseSelection(course.code, value);
              router.push(`/student/courses/${encodeURIComponent(course.code)}`);
            }
          } else {
            clearPendingCourseSelection();
            router.push('/student/courses');
          }
        }}
      />

      {showMainLoading && (
        <div className="flex flex-col justify-center items-center py-20">
          <LoadingSpinner size={40} />
          <p className="text-gray-500 mt-4 font-medium">資料讀取中...</p>
        </div>
      )}

      {!showMainLoading && !effectiveSelectedCourse && !loadingCourses && courses.length === 0 && (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-dashed border-gray-300">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-4xl text-gray-300 shadow-sm">📚</div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">尚無課程</h3>
          <p className="text-gray-500">您目前還沒有選擇任何課程</p>
        </div>
      )}

      {!showMainLoading && !effectiveSelectedCourse && !loadingCourses && courses.length > 0 && !courseCodeFromUrl && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <BookOpenIcon className="w-8 h-8" />
          </div>
          <p className="text-indigo-800 font-medium text-lg">請選擇一個課程來查看課程內容</p>
        </div>
      )}

      {!showMainLoading && resolvedCourse && courseCodeFromUrl && (
            <div className="animate-fade-in space-y-8">
              {/* 課程資訊卡 */}
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mt-20 -mr-20"></div>
                
                <div className="relative z-10">
                    <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-3xl font-bold mb-2 tracking-tight">{resolvedCourse.name}</h3>
                        <p className="text-indigo-100 font-mono text-lg opacity-80">{resolvedCourse.code}</p>
                    </div>
                    <div>
                        <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-white/20 backdrop-blur-md text-white border border-white/30 shadow-sm">
                            {resolvedCourse.status}
                        </span>
                    </div>
                    </div>

                    <div className="flex gap-6 border-b border-white/20 mb-6">
                      <button
                        onClick={() => setActiveCourseTab('info')}
                        className={`pb-3 font-bold text-lg transition-all border-b-2 ${activeCourseTab === 'info' ? 'border-white text-white' : 'border-transparent text-white/60 hover:text-white/90'}`}
                      >
                        課程資訊
                      </button>
                      <button
                        onClick={() => setActiveCourseTab('announcements')}
                        className={`pb-3 font-bold text-lg transition-all border-b-2 ${activeCourseTab === 'announcements' ? 'border-white text-white' : 'border-transparent text-white/60 hover:text-white/90'}`}
                      >
                        課程公告
                      </button>
                    </div>

                    {activeCourseTab === 'info' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-indigo-50">
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
                    {resolvedCourse.classTimes?.length > 0 && (
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
                    <div className="flex flex-wrap items-center col-span-1 md:col-span-2 lg:col-span-3 mt-3 gap-3">
                        {resolvedCourse.liveStreamURL && (
                             <a 
                                href={resolvedCourse.liveStreamURL} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center gap-2 min-w-[160px] px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors shadow-lg shadow-indigo-900/20"
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
                                className="inline-flex items-center gap-2 min-w-[160px] px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-50 transition-colors shadow-lg shadow-indigo-900/20"
                             >
                                {renderIcon(link.icon, "w-5 h-5 shrink-0")}
                                <span className="flex-1 text-center">{link.name}</span>
                             </a>
                        ))}
                    </div>
                    </div>
                    )}

                    {activeCourseTab === 'announcements' && (
                      <div className="animate-fade-in">
                        {activeAnnouncements.length > 0 ? (
                          <>
                            <div className="space-y-3">
                              {currentAnnouncements.map(ann => (
                                <div key={ann.id} onClick={() => setSelectedAnnouncement(ann)} className="cursor-pointer bg-white/10 hover:bg-white/20 backdrop-blur-sm p-4 rounded-xl border border-white/10 transition-colors flex justify-between items-center group shadow-sm">
                                   <div className="flex items-center gap-3">
                                     <div className="w-8 h-8 rounded-full bg-white/20 text-white flex items-center justify-center shrink-0">
                                       <MegaphoneIcon className="w-4 h-4" />
                                     </div>
                                     <h4 className="font-bold text-white group-hover:text-indigo-50 transition-colors line-clamp-1">{ann.title}</h4>
                                   </div>
                                   <span className="text-xs text-indigo-100 font-mono ml-4 shrink-0 hidden sm:block opacity-80">{new Date(ann.createdAt).toLocaleDateString()}</span>
                                </div>
                              ))}
                            </div>
                            <Pagination currentPage={announcementPage} totalPages={totalAnnouncementPages} setCurrentPage={setAnnouncementPage} />
                          </>
                        ) : (
                          <div className="text-center py-10 bg-white/10 rounded-xl border border-white/20 text-white/80 backdrop-blur-sm shadow-sm">
                            <MegaphoneIcon className="w-12 h-12 mx-auto mb-3 opacity-60" />
                            目前沒有課程公告
                          </div>
                        )}
                      </div>
                    )}
                </div>
              </div>

              {/* 課程列表區塊 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8 mb-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center">
                    <span className="w-1.5 h-6 bg-indigo-500 rounded-full mr-3"></span>
                    課程清單
                  </h3>
                  {lessons.length > 0 && <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">共 {lessons.length} 堂</span>}
                </div>
                
                {loadingLessons ? (
                  <PageLoadingArea />
                ) : lessons.length === 0 ? (
                  <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 text-4xl text-gray-300 shadow-sm">📝</div>
                      <p className="text-gray-500 font-medium">此課程尚未發布任何內容</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {currentLessons.map((lesson, index) => <LessonDetail key={lesson.id} lesson={lesson} index={indexOfFirstLesson + index} resolvedCourse={resolvedCourse} router={router} />)}
                  </div>
                )}
                <Pagination currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} />
              </div>
            </div>
      )}

      {selectedAnnouncement && createPortal(
        <div className="fixed inset-0 z-[99999] flex justify-center items-center p-4 animate-fade-in">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedAnnouncement(null)}></div>
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
                  <div
                    className="ql-editor text-gray-700 mb-6"
                    dangerouslySetInnerHTML={{ __html: selectedAnnouncement.content }}
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
    </div>
  );
}