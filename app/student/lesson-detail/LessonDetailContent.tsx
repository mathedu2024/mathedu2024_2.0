'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LockClosedIcon, ClipboardDocumentCheckIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
import BackButton from '@/components/ui/BackButton';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import StudentExamStartModal from '@/components/student-exam/StudentExamStartModal';
import StudentExamAttemptPickerModal from '@/components/student-exam/StudentExamAttemptPickerModal';
import { useStudentInfo } from '@/student/StudentInfoContext';
import {
  fetchStudentExamList,
  invalidateStudentExamList,
  type StudentExamListItem,
} from '@/utils/studentClientApi';
import {
  getLessonVideoLockQuizCodes,
  hasLessonOnlineExam,
  hasPendingAccessibleLessonQuizzes,
  normalizeLessonAssignedQuizzes,
  type LessonAssignedQuiz,
} from '@/services/lessonQuiz';
import { canStartExamTake } from '@/utils/examDraftStorage';
import { openStudentExamReviewInNewTab } from '@/utils/examAttemptLabel';
import { showExamTakeBlockedAlert } from '@/utils/examTakeAlerts';
import { fetchQuizByCode } from '@/utils/teacherClientApi';
import { openBlankPreviewTab, openTeacherExamPreviewInNewTab } from '@/utils/teacherExamPreview';
import Swal from '@/utils/swalTheme';

interface LessonDetail {
  id: string;
  title: string;
  date: string;
  progress: string;
  attachments: Array<string | { url: string; name?: string; visibleToStudents?: boolean }>;
  videos: string[];
  homework: string;
  noHomework?: boolean;
  onlineExam: string;
  assignedQuizzes?: LessonAssignedQuiz[];
  assignedQuizCodes?: string[];
  requireQuizBeforeVideo?: boolean;
  noOnlineExam?: boolean;
  examScope: string;
  noExamScope?: boolean;
  notes: string;
  noNotes?: boolean;
  courseName?: string;
  courseCode?: string;
  courseId?: string;
  lessonIndex?: number;
  location?: string;
  description?: string;
  order?: number;
}

export default function LessonDetailPage({
  previewMode = false,
  previewExams = null,
}: {
  previewMode?: boolean;
  previewExams?: StudentExamListItem[] | null;
} = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { studentInfo } = useStudentInfo();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [examList, setExamList] = useState<StudentExamListItem[]>(previewExams ?? []);
  const [examsLoading, setExamsLoading] = useState(false);
  const [startModal, setStartModal] = useState<{
    exam: StudentExamListItem;
    mode: 'start' | 'retake';
  } | null>(null);
  const [historyModal, setHistoryModal] = useState<StudentExamListItem | null>(null);

  const assignedQuizzes = useMemo(
    () => (lesson ? normalizeLessonAssignedQuizzes(lesson) : []),
    [lesson]
  );

  const assignedQuizCodes = useMemo(
    () => assignedQuizzes.map((q) => q.quizCode),
    [assignedQuizzes]
  );

  const videoLockQuizCodes = useMemo(
    () => (lesson ? getLessonVideoLockQuizCodes(lesson) : []),
    [lesson]
  );

  const refreshExamList = useCallback(async (opts?: { force?: boolean }) => {
    if (previewMode) {
      setExamList(previewExams ?? []);
      setExamsLoading(false);
      return;
    }
    if (!studentInfo?.id || assignedQuizCodes.length === 0) {
      setExamList([]);
      setExamsLoading(false);
      return;
    }
    setExamsLoading(true);
    try {
      if (opts?.force) {
        invalidateStudentExamList(studentInfo.id);
      }
      const exams = await fetchStudentExamList(studentInfo.id);
      setExamList(exams);
    } catch {
      setExamList([]);
    } finally {
      setExamsLoading(false);
    }
  }, [previewMode, previewExams, studentInfo?.id, assignedQuizCodes.length]);

  const resolveExamTitle = useCallback(
    (quizCode: string) => examList.find((e) => e.quizCode === quizCode)?.title,
    [examList]
  );

  const openStartModal = useCallback(
    async (exam: StudentExamListItem, mode: 'start' | 'retake') => {
      if (previewMode) {
        // 未開始／無法作答：開啟開始視窗顯示擋訊；已開放：走老師編輯預覽（模擬送出不記錄）
        if (!exam.accessible) {
          setStartModal({ exam, mode });
          return;
        }
        const blank = openBlankPreviewTab();
        try {
          const quiz = await fetchQuizByCode(exam.quizCode);
          openTeacherExamPreviewInNewTab(quiz, { targetWindow: blank });
        } catch (e) {
          try {
            blank?.close();
          } catch {
            /* ignore */
          }
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
    [previewMode, studentInfo?.id, resolveExamTitle]
  );

  const openHistory = useCallback((exam: StudentExamListItem) => {
    if (exam.attempts && exam.attempts.length > 0) {
      setHistoryModal(exam);
      return;
    }
    if (exam.latestSubmissionId) {
      openStudentExamReviewInNewTab(exam.quizCode, { submissionId: exam.latestSubmissionId });
      return;
    }
    openStudentExamReviewInNewTab(exam.quizCode, { review: true });
  }, []);

  // Initialize and fetch data
  useEffect(() => {
    // 為了防止 SSR/Hydration 問題，確保只在客戶端執行
    if (typeof window === 'undefined') return;

    try {
      const lessonData = localStorage.getItem('currentLesson');
      
      if (lessonData) {
        const parsedLesson = JSON.parse(lessonData);
        
        // 嘗試獲取額外資訊，但失敗也不影響顯示
        fetch(`/api/courses/classdata?courseId=${parsedLesson.courseCode}`)
          .then(res => res.json())
          .then(classData => {
            setLesson(prev => prev ? ({
              ...prev,
              location: classData.location || prev.location || '',
              description: classData.description || prev.description || ''
            }) : parsedLesson);
          })
          .catch(err => {
            console.warn("API request failed, using local data", err);
          });
          
        // 先設定既有的資料以加快顯示
        setLesson(parsedLesson);
      }
    } catch (error) {
      console.error('Error parsing lesson data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 課堂綁定測驗：進入頁面載入一次即可（沿用 client cache，不每次 invalidate／focus 重抓）
  useEffect(() => {
    void refreshExamList();
  }, [refreshExamList]);

  // Convert YouTube URL to Embed URL
  const getEmbedUrl = (url: string) => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return null;
    }
  
    let videoId = '';
    try {
      // 簡單的字串檢查，避免 URL 建構失敗導致錯誤
      if (!url.startsWith('http')) return null;

      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) {
        videoId = urlObj.searchParams.get('v')!;
      } else if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1);
      }
    } catch {
      console.error("Invalid URL:", url);
      return null;
    }
  
    if (videoId) {
      const params = new URLSearchParams({
        rel: '0',
        autoplay: '0',
      });
      return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
    }
  
    return null;
  };

  const handleVideoChange = (direction: 'prev' | 'next') => {
    if (!lesson?.videos || lesson.videos.length === 0) return;
    
    if (direction === 'prev') {
      setCurrentVideoIndex(prev => 
        prev === 0 ? lesson.videos.length - 1 : prev - 1
      );
    } else {
      setCurrentVideoIndex(prev => 
        prev === lesson.videos.length - 1 ? 0 : prev + 1
      );
    }
  };

  const handleBack = () => {
    const returnTo = searchParams.get('returnTo');
    if (returnTo) {
      router.push(returnTo);
      return;
    }

    if (lesson && lesson.courseCode) {
      router.push(`/student/courses/${encodeURIComponent(lesson.courseCode)}?tab=lessons`);
      return;
    }

    if (lesson?.courseId) {
      router.push(`/student/courses/${encodeURIComponent(lesson.courseId)}?tab=lessons`);
      return;
    }

    router.push('/student/courses');
  };

  const examsByCode = useMemo(() => {
    const map = new Map<string, StudentExamListItem>();
    examList.forEach((exam) => map.set(exam.quizCode, exam));
    return map;
  }, [examList]);

  const assignedQuizItems = useMemo(
    () =>
      assignedQuizzes.map(({ quizCode, requireBeforeVideo }) => ({
        quizCode,
        requireBeforeVideo,
        exam: examsByCode.get(quizCode) ?? null,
      })),
    [assignedQuizzes, examsByCode]
  );

  const videosLocked =
    videoLockQuizCodes.length > 0 &&
    hasPendingAccessibleLessonQuizzes(videoLockQuizCodes, examsByCode);

  const pendingQuizTitles = assignedQuizItems
    .filter(({ quizCode, requireBeforeVideo, exam }) => {
      if (!requireBeforeVideo) return false;
      if (!exam) return false;
      if (exam.submitted) return false;
      return exam.accessible !== false;
    })
    .map(({ exam }) => exam?.title || '線上測驗');

  if (loading) {
    return (
      <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10 flex flex-col h-full">
        <PageLoadingArea minHeight="min-h-[50vh]" />
      </div>
    );
  }

  // Error State (Fallback)
  if (!lesson) {
    return (
      <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10 flex flex-col h-full items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">找不到課程資訊</h2>
          <BackButton label="返回課程列表" onClick={handleBack} variant="primary" withSpacing={false} />
        </div>
      </div>
    );
  }

  // 準備影片 URL
  const currentEmbedUrl = (lesson.videos && lesson.videos.length > 0) 
    ? getEmbedUrl(lesson.videos[currentVideoIndex]) 
    : null;

  const showHomework = !lesson.noHomework && !!lesson.homework?.trim();
  const showOnlineExam = hasLessonOnlineExam(lesson);
  const showLegacyOnlineExam =
    !lesson.noOnlineExam && !!lesson.onlineExam?.trim() && assignedQuizCodes.length === 0;
  const showAssignedQuizzes = assignedQuizCodes.length > 0;
  const showExamScope = !lesson.noExamScope && !!lesson.examScope?.trim();
  const showNotes = !lesson.noNotes && !!lesson.notes?.trim();

  return (
    <div className="page-shell w-full min-w-0 pt-4 sm:pt-6 md:pt-8 pb-10 flex flex-col h-full animate-fade-in">
        
        {/* Header Section */}
        <div className="mb-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-800 tracking-tight leading-snug">
                {lesson.title}
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center mt-3 text-gray-500 gap-2.5 sm:gap-4">
                 <span className="w-fit bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase shadow-sm border border-indigo-200">
                    第 {lesson.lessonIndex} 堂
                 </span>
                 <span className="flex items-center text-sm font-medium">
                    <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    {lesson.courseName}
                 </span>
                 {lesson.date && (
                   <span className="flex items-center text-sm font-medium">
                      <svg className="w-4 h-4 mr-1.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {lesson.date}
                   </span>
                 )}
              </div>
            </div>
          </div>
          <BackButton label="返回課程清單" onClick={handleBack} withSpacing={false} className="mt-4" />
        </div>

        {/* Main Content Layout - 2 Columns on Large Screens */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Video Player (Takes up 2/3 space) */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              {lesson.videos && lesson.videos.length > 0 ? (
                <div className="flex flex-col">
                  {/* Video Container */}
                  <div className="relative w-full pt-[56.25%] bg-black">
                     {videosLocked ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white p-6">
                          <div className="text-center max-w-md">
                            <LockClosedIcon className="w-12 h-12 mx-auto mb-4 text-amber-400" />
                            <p className="text-lg font-semibold mb-2">請先完成測驗後再觀看影片</p>
                            <p className="text-sm text-gray-300">
                              {pendingQuizTitles.length > 0
                                ? `尚須完成：${pendingQuizTitles.join('、')}`
                                : '請至右側線上測驗區完成指定測驗。'}
                            </p>
                          </div>
                        </div>
                     ) : currentEmbedUrl ? (
                        <iframe
                          key={`${lesson.id}-${currentVideoIndex}`}
                          src={currentEmbedUrl}
                          title={`Video ${currentVideoIndex + 1}`}
                          className="absolute top-0 left-0 w-full h-full"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                          allowFullScreen
                        />
                     ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-white">
                          <div className="text-center">
                            <p className="text-lg">無法播放此影片</p>
                          </div>
                        </div>
                     )}
                  </div>

                  {/* Video Controls & Title */}
                  <div className="p-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-4 bg-gray-50/50">
                    <div className="flex items-center space-x-2 text-sm text-gray-500 font-mono">
                      <span className="bg-gray-200 px-2 py-1 rounded text-gray-700 font-bold">
                        {currentVideoIndex + 1} / {lesson.videos.length}
                      </span>
                      <span>影片片段</span>
                    </div>

                    {lesson.videos.length > 1 && !videosLocked && (
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => handleVideoChange('prev')}
                          className="flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:text-indigo-600 transition-colors shadow-sm text-sm font-medium"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                          上一部
                        </button>
                        <button
                          onClick={() => handleVideoChange('next')}
                          className="flex items-center px-4 py-2 bg-indigo-600 border border-transparent text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm text-sm font-medium"
                        >
                          下一部
                          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="aspect-video bg-gray-100 flex items-center justify-center flex-col text-gray-400">
                  <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  <p>本課程無影片內容</p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Info & Attachments */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Additional Info Cards (Moved to top) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full space-y-6">
               <h3 className="text-lg font-bold text-gray-800 mb-4 border-l-4 border-indigo-500 pl-3">課程資訊</h3>

               {/* Date */}
               {lesson.date && (
                 <div>
                    <h4 className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        課程日期
                    </h4>
                    <p className="text-gray-800 font-medium bg-gray-50 p-3 rounded-lg border border-gray-100">
                      {lesson.date}
                    </p>
                 </div>
               )}

               {/* Progress */}
               {lesson.progress && (
                 <div>
                    <h4 className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
                        課程進度
                    </h4>
                    <p className="text-gray-800 font-medium bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap">
                      {lesson.progress}
                    </p>
                 </div>
               )}

               {/* Exam Scope */}
               {showExamScope && (
                 <div>
                    <h4 className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        考試範圍
                    </h4>
                    <p className="text-gray-800 font-medium bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap">
                       {lesson.examScope}
                    </p>
                 </div>
               )}

               {/* Notes */}
               {showNotes && (
                 <div>
                    <h4 className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                        備註事項
                    </h4>
                    <p className="text-gray-800 font-medium bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap">
                       {lesson.notes}
                    </p>
                 </div>
               )}

               {/* Location */}
               {lesson.location && (
                  <div>
                    <h4 className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        上課地點
                    </h4>
                    <div className="flex items-center text-gray-700 bg-gray-50 p-3 rounded-lg border border-gray-100">
                       {lesson.location}
                    </div>
                  </div>
               )}
            </div>

            {/* Attachments Card (Moved Down) */}
            {Array.isArray(lesson.attachments) && (lesson.attachments as unknown[]).some(a => {
                if (typeof a === 'string') return a && a.trim() !== '';
                if (a && typeof a === 'object' && 'url' in a) {
                  const typed = a as { url: string; visibleToStudents?: boolean };
                  return typed.url && typed.visibleToStudents !== false;
                }
                return false;
            }) && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full">
                 <h3 className="text-lg font-bold text-gray-800 mb-4 border-l-4 border-indigo-500 pl-3">課程講義與附件</h3>
                 <div className="space-y-3">
                    {(lesson.attachments as unknown[])
                      .filter(a => {
                        if (typeof a === 'string') return a && a.trim() !== '';
                        if (a && typeof a === 'object' && 'url' in a) {
                          const typed = a as { url: string; visibleToStudents?: boolean };
                          return typed.url && typed.visibleToStudents !== false;
                        }
                        return false;
                      })
                      .map((attachment, idx) => {
                        let url = '';
                        let name = '';
                        if (typeof attachment === 'string') {
                          url = attachment;
                          name = `附件下載 ${idx + 1}`;
                        } else if (attachment && typeof attachment === 'object' && 'url' in attachment) {
                          url = (attachment as { url: string }).url;
                          const rawName = (attachment as { name?: string }).name;
                          name = rawName && rawName.trim() !== '' ? rawName : `附件下載 ${idx + 1}`;
                        }

                        return (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center p-3 rounded-xl bg-gray-50 border border-gray-200 hover:bg-indigo-50 hover:border-indigo-200 hover:shadow-sm transition-all group"
                          >
                             <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-red-500 shadow-sm mr-3 group-hover:scale-110 transition-transform">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                             </div>
                             <div className="flex-1 overflow-hidden">
                               <p className="text-sm font-bold text-gray-700 truncate group-hover:text-indigo-700">{name}</p>
                               <p className="text-xs text-gray-400">點擊下載</p>
                             </div>
                             <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          </a>
                        );
                      })}
                 </div>
              </div>
            )}

            {/* Homework Card */}
            {showHomework && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-l-4 border-orange-500 pl-3">回家作業</h3>
                <p className="text-gray-800 font-medium bg-gray-50 p-3 rounded-lg border border-gray-100 whitespace-pre-wrap">
                  {lesson.homework}
                </p>
              </div>
            )}

            {/* Online Exam Card */}
            {showOnlineExam && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full">
                <h3 className="text-lg font-bold text-gray-800 mb-4 border-l-4 border-green-500 pl-3">線上測驗</h3>
                {showAssignedQuizzes ? (
                  <div className="space-y-3">
                    {videoLockQuizCodes.length > 0 && (
                      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        完成標示為「須完成後觀課」的測驗後，即可觀看本堂課影片。
                      </p>
                    )}
                    {examsLoading ? (
                      <PageLoadingArea minHeight="min-h-[4rem]" />
                    ) : (
                      assignedQuizItems.map(({ quizCode, requireBeforeVideo, exam }) => {
                        const isRemoved = !exam && !examsLoading;
                        const title = exam?.title || (isRemoved ? '測驗已隱藏' : '線上測驗');
                        const submitted = !!exam?.submitted;
                        const accessible = !!exam?.accessible;
                        const windowUpcoming = exam?.windowPhase === 'upcoming';
                        const windowEnded = !!exam?.windowEnded || exam?.windowPhase === 'ended';
                        const canStart =
                          !!exam && accessible && (!submitted || exam.canRetake);
                        const isRetake = submitted && !!exam?.canRetake;
                        return (
                          <div
                            key={quizCode}
                            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border ${
                              isRemoved ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'
                            }`}
                          >
                            <div className="min-w-0">
                              <p className={`text-sm font-bold truncate ${isRemoved ? 'text-amber-900' : 'text-gray-800'}`}>
                                {title}
                              </p>
                              {requireBeforeVideo && !isRemoved && (
                                <p className="text-xs text-amber-700 mt-1 font-medium">須完成後觀課</p>
                              )}
                              <p className="text-xs mt-1">
                                {isRemoved ? (
                                  <span className="text-amber-700 font-medium">此測驗已隱藏，無需作答</span>
                                ) : submitted ? (
                                  <span className="text-emerald-600 font-medium">已完成</span>
                                ) : windowUpcoming ? (
                                  <span className="text-gray-500">作答期間尚未開始</span>
                                ) : windowEnded ? (
                                  <span className="text-gray-500">作答期間已截止</span>
                                ) : accessible ? (
                                  <span className="text-amber-600 font-medium">尚未完成</span>
                                ) : (
                                  <span className="text-gray-500">{exam?.inaccessibleReason || '測驗尚未開放'}</span>
                                )}
                              </p>
                            </div>
                            {!isRemoved && (
                            <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto sm:min-w-[10rem]">
                              {submitted && exam && (
                                <button
                                  type="button"
                                  onClick={() => openHistory(exam)}
                                  className="inline-flex items-center justify-center px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
                                >
                                  查看作答紀錄
                                </button>
                              )}
                              {canStart && exam ? (
                                <button
                                  type="button"
                                  onClick={() => void openStartModal(exam, isRetake ? 'retake' : 'start')}
                                  className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                  <ClipboardDocumentCheckIcon className="w-4 h-4 mr-1.5" />
                                  {previewMode
                                    ? '預覽作答'
                                    : isRetake
                                      ? '再次作答'
                                      : '開始作答'}
                                  <ArrowRightIcon className="w-4 h-4 ml-1.5" />
                                </button>
                              ) : windowUpcoming && exam && !submitted ? (
                                <button
                                  type="button"
                                  onClick={() => void openStartModal(exam, 'start')}
                                  className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                                >
                                  查看詳情
                                </button>
                              ) : !submitted ? (
                                <button
                                  type="button"
                                  disabled
                                  className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg opacity-50 cursor-not-allowed"
                                >
                                  {windowEnded ? '已截止' : '無法作答'}
                                </button>
                              ) : null}
                            </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : showLegacyOnlineExam ? (
                  <>
                    <p className="text-gray-500 text-sm mb-4">請點擊下方按鈕前往測驗平台進行考試。</p>
                    <a
                      href={lesson.onlineExam}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-full px-4 py-3 bg-green-50 text-green-700 font-semibold rounded-lg border border-green-100 hover:bg-green-100 transition-colors"
                    >
                      開始考試
                      <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </a>
                  </>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {startModal && (studentInfo?.id || previewMode) && (
          <StudentExamStartModal
            open
            onClose={() => setStartModal(null)}
            exam={startModal.exam}
            studentId={studentInfo?.id || 'preview'}
            mode={startModal.mode}
            resolveExamTitle={resolveExamTitle}
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