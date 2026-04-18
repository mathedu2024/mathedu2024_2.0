'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStudentInfo } from '../StudentInfoContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import StudentCourseSelector from '@/components/StudentCourseSelector';
import { BookOpenIcon, ClockIcon, MapPinIcon, UserIcon, VideoCameraIcon } from '@heroicons/react/24/outline';

// Interfaces
interface ClassTime { day: string; startTime: string; endTime: string; }
interface Course { id: string; name: string; code: string; status: string; archived?: boolean; gradeTags: string[]; subjectTag: string; startDate: string; endDate: string; teachers: string[]; teacherName?: string; description: string; teachingMethod: string; courseNature: string; location?: string; liveStreamURL?: string; coverImageURL?: string; classTimes?: ClassTime[]; }
interface Lesson { id: string; title: string; date: string; progress: string; attachments: Array<string | { url: string; name?: string; visibleToStudents?: boolean }>; videos: string[]; homework: string; onlineExam: string; examScope: string; notes: string; createdAt: string | number | { toDate: () => Date }; order?: number; }

const isCourseArchived = (course: Course): boolean => course.archived === true || String(course.archived) === 'true';

function LessonDetail({ lesson, index, selectedCourse, router }: { lesson: Lesson; index: number; selectedCourse: Course | null; router: ReturnType<typeof useRouter> }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 hover:shadow-md hover:border-indigo-200 transition-all duration-300 group">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
           <div className="flex-shrink-0 w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-bold">
              {index + 1}
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
            const lessonData = { ...lesson, courseName: selectedCourse?.name, courseCode: selectedCourse?.code, courseId: selectedCourse?.id, lessonIndex: index + 1 };
            localStorage.setItem('currentLesson', JSON.stringify(lessonData));
            const queryId = selectedCourse?.code || selectedCourse?.id;
            const currentUrl = `${window.location.pathname}?courseId=${queryId}`;
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
      <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${currentPage === 1 ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 hover:text-indigo-600'}`}>上一頁</button>
      {startPage > 1 && (<><button onClick={() => setCurrentPage(1)} className="w-10 h-10 rounded-xl text-sm font-medium bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 transition-all">1</button>{startPage > 2 && <span className="px-2 text-gray-400">...</span>}</>)}
      {pageNumbers.map(number => (<button key={number} onClick={() => setCurrentPage(number)} className={`w-10 h-10 rounded-xl text-sm font-bold transition-all shadow-sm ${currentPage === number ? 'bg-indigo-600 text-white shadow-indigo-200' : 'bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200'}`}>{number}</button>))}
      {endPage < totalPages && (<>{endPage < totalPages - 1 && <span className="px-2 text-gray-400">...</span>}<button onClick={() => setCurrentPage(totalPages)} className="w-10 h-10 rounded-xl text-sm font-medium bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 transition-all">{totalPages}</button></>)}
      <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${currentPage === totalPages ? 'bg-gray-50 text-gray-300 cursor-not-allowed' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200 hover:text-indigo-600'}`}>下一頁</button>
    </div>
  );
};

export default function StudentCoursesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { studentInfo, loading: loadingStudentInfo } = useStudentInfo();

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const lessonsPerPage = 5;

  const fetchCourses = useCallback(async () => {
    if (!studentInfo) return;
    setLoadingCourses(true);

    // 安全機制：設定 8 秒後強制停止 Loading，避免畫面卡死
    const safetyTimer = setTimeout(() => {
      console.warn("Course fetch timed out");
      setLoadingCourses(false);
    }, 8000);

    try {
      const res = await fetch('/api/student/dashboard-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentInfo.id }),
      });
      if (res.ok) {
        const data = await res.json();
        // 過濾已封存課程，確保後續 logic (如 URL 自動選課) 不會選到舊課
        const activeCourses = (data.courses || [])
          .filter((c: Course) => c && c.status !== '已封存' && !isCourseArchived(c));
        setCourses(activeCourses);
      } else {
        setCourses([]);
      }
      clearTimeout(safetyTimer);
    } catch (error) {
      console.error('載入課程時發生錯誤:', error);
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
    const courseIdFromQuery = searchParams.get('courseId');
    if (courseIdFromQuery && courses.length > 0) {
      // 支援透過 ID 或 Code (課程代碼) 尋找課程
      const courseToSelect = courses.find(c => c.id === courseIdFromQuery || c.code === courseIdFromQuery);
      if (courseToSelect) {
        setSelectedCourse(courseToSelect);
      }
    }
  }, [courses, searchParams]);

  useEffect(() => {
    const fetchLessons = async () => {
      if (!selectedCourse) {
        setLessons([]);
        return;
      }
      setLoadingLessons(true);
      try {
        const res = await fetch('/api/courses/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId: selectedCourse.id }),
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
        console.error('Error fetching lessons:', error);
        setLessons([]);
        setCurrentPage(1);
      } finally {
        setLoadingLessons(false);
      }
    };
    fetchLessons();
  }, [selectedCourse]);

  const indexOfLastLesson = currentPage * lessonsPerPage;
  const indexOfFirstLesson = indexOfLastLesson - lessonsPerPage;
  const currentLessons = lessons.slice(indexOfFirstLesson, indexOfLastLesson);
  const totalPages = Math.ceil(lessons.length / lessonsPerPage);

  // 修正: 避免因為背景更新資料而擋住頁面
  if (loadingStudentInfo && studentInfo === null) {
    return <LoadingSpinner fullScreen size={40} />;
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-6 md:pt-8 pb-10 flex flex-col h-full animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <BookOpenIcon className="h-8 w-8 text-indigo-600" />
            我的課程
          </h1>
          <p className="text-gray-500 text-sm mt-1">查看並進入您所選修的課程與教材內容。</p>
        </div>
        {courses.length > 0 && (
          <span className="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-full text-sm font-bold border border-indigo-100 shadow-sm self-start md:self-auto">
            目前選修 {courses.length} 門有效課程
          </span>
        )}
      </div>
      {loadingCourses ? (
        <div className="flex justify-center items-center h-64"><LoadingSpinner size={40} /></div>
      ) : courses.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-300">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-4xl text-gray-300">📚</div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">尚無課程</h3>
            <p className="text-gray-500">您目前還沒有選擇任何課程</p>
        </div>
      ) : (
        <>
          <StudentCourseSelector
            courses={courses}
            selectedCourse={selectedCourse ? `${selectedCourse.name}(${selectedCourse.code})` : ''}
            onChange={(value) => {
              // 從 name(code) 格式中解析並尋找課程物件
              const course = courses.find(c => `${c.name}(${c.code})` === value);
              setSelectedCourse(course || null);

              // 更新網址
              if (course) {
                const queryId = course.code || course.id;
                router.push(`/student/courses?courseId=${queryId}`);
              } else {
                router.push('/student/courses');
              }
            }}
          />
          {selectedCourse && (
            <div className="animate-fade-in space-y-8">
              {/* 課程資訊卡 */}
              <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -mt-20 -mr-20"></div>
                
                <div className="relative z-10">
                    <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-3xl font-bold mb-2 tracking-tight">{selectedCourse.name}</h3>
                        <p className="text-indigo-100 font-mono text-lg opacity-80">{selectedCourse.code}</p>
                    </div>
                    <div>
                        <span className="px-4 py-1.5 rounded-full text-sm font-bold bg-white/20 backdrop-blur-md text-white border border-white/30 shadow-sm">
                            {selectedCourse.status}
                        </span>
                    </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-indigo-50">
                    <div className="flex items-start">
                        <ClockIcon className="w-5 h-5 mr-3 mt-0.5 opacity-70" />
                        <div>
                            <p className="text-xs uppercase tracking-wider opacity-70 mb-1">課程期間</p>
                            <p className="font-medium">{selectedCourse.startDate || '未定'} ~ {selectedCourse.endDate || '未定'}</p>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <UserIcon className="w-5 h-5 mr-3 mt-0.5 opacity-70" />
                        <div>
                            <p className="text-xs uppercase tracking-wider opacity-70 mb-1">授課老師</p>
                            <p className="font-medium">{selectedCourse.teacherName || '未指定教師'}</p>
                        </div>
                    </div>
                    <div className="flex items-start">
                        <MapPinIcon className="w-5 h-5 mr-3 mt-0.5 opacity-70" />
                        <div>
                            <p className="text-xs uppercase tracking-wider opacity-70 mb-1">上課地點</p>
                            <p className="font-medium">{selectedCourse.location || '線上/未定'}</p>
                        </div>
                    </div>
                    {selectedCourse.classTimes?.length > 0 && (
                        <div className="flex items-start col-span-1 md:col-span-2 lg:col-span-3 bg-white/10 p-3 rounded-lg border border-white/10">
                            <ClockIcon className="w-5 h-5 mr-3 mt-0.5 opacity-70" />
                            <div>
                                <p className="text-xs uppercase tracking-wider opacity-70 mb-1">上課時間</p>
                                <p className="font-medium">{selectedCourse.classTimes.map(time => `${time.day} ${time.startTime}-${time.endTime}`).join('、')}</p>
                            </div>
                        </div>
                    )}
                    {selectedCourse.liveStreamURL && (
                         <div className="flex items-center col-span-1 md:col-span-2 lg:col-span-3 mt-2">
                             <a 
                                href={selectedCourse.liveStreamURL} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="inline-flex items-center px-5 py-2.5 bg-white text-indigo-600 rounded-xl font-bold hover:bg-indigo-50 transition-colors shadow-lg shadow-indigo-900/20"
                             >
                                <VideoCameraIcon className="w-5 h-5 mr-2" />
                                進入線上會議
                             </a>
                         </div>
                    )}
                    </div>
                </div>
              </div>

              {/* 課程列表區塊 */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                  <h3 className="text-xl font-bold text-gray-900 flex items-center">
                    <span className="w-1.5 h-6 bg-indigo-500 rounded-full mr-3"></span>
                    課程清單
                  </h3>
                  {lessons.length > 0 && <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium">共 {lessons.length} 堂</span>}
                </div>
                
                {loadingLessons ? (
                  <div className="flex justify-center items-center py-20"><LoadingSpinner size={40} /></div>
                ) : lessons.length === 0 ? (
                  <div className="text-center py-20 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                      <div className="text-gray-300 text-5xl mb-4">📝</div>
                      <p className="text-gray-500 font-medium">此課程尚未發布任何內容</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {currentLessons.map((lesson, index) => <LessonDetail key={lesson.id} lesson={lesson} index={indexOfFirstLesson + index} selectedCourse={selectedCourse} router={router} />)}
                  </div>
                )}
                <Pagination currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}