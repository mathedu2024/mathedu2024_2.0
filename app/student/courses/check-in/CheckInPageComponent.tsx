'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useStudentInfo } from '../../StudentInfoContext';
import LoadingSpinner from '@/components/LoadingSpinner';
import Dropdown from '@/components/ui/Dropdown';
import { BookOpenIcon, ClockIcon, MapPinIcon, UserIcon, VideoCameraIcon, ChevronRightIcon } from '@heroicons/react/24/outline';

// Interfaces
interface ClassTime { day: string; startTime: string; endTime: string; }
interface Course { id: string; name: string; code: string; status: string; gradeTags: string[]; subjectTag: string; startDate: string; endDate: string; teachers: string[]; teacherName?: string; description: string; teachingMethod: string; courseNature: string; location?: string; liveStreamURL?: string; coverImageURL?: string; classTimes?: ClassTime[]; }
interface Lesson { id: string; title: string; date: string; progress: string; attachments: string[]; videos: string[]; homework: string; onlineExam: string; examScope: string; notes: string; createdAt: string | number | { toDate: () => Date }; order?: number; }

export default function StudentCoursesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { studentInfo } = useStudentInfo();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [lessonsPerPage] = useState<number>(8);

  const fetchCourses = useCallback(async () => {
    if (!studentInfo) return;
    setLoadingCourses(true);
    try {
        const res = await fetch('/api/student/dashboard-data', { method: 'POST', body: JSON.stringify({ studentId: studentInfo.id }) });
        const data = await res.json();
        setCourses(data.courses || []);
    } catch { setCourses([]); }
    setLoadingCourses(false);
  }, [studentInfo]);

  useEffect(() => { if (studentInfo) fetchCourses(); }, [studentInfo, fetchCourses]);
  useEffect(() => {
      const cid = searchParams.get('courseId');
      if (cid && courses.length > 0) setSelectedCourse(courses.find(c => c.id === cid) || null);
  }, [courses, searchParams]);

  useEffect(() => {
    const fetchLessons = async () => {
        if (!selectedCourse) { setLessons([]); return; }
        setLoadingLessons(true);
        try {
            const res = await fetch('/api/courses/lessons', { method: 'POST', body: JSON.stringify({ courseId: selectedCourse.id }) });
            const data = await res.json();
            const sortedLessons = Array.isArray(data)
            ? [...data].sort((a, b) => {
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
        } catch { setLessons([]); }
        setLoadingLessons(false);
    };
    fetchLessons();
  }, [selectedCourse]);

  function LessonDetail({ lesson, index }: { lesson: Lesson; index: number }) {
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
              const currentUrl = window.location.pathname + window.location.search;
              router.push(`/student/lesson-detail?returnTo=${encodeURIComponent(currentUrl)}`);
            }}
            className="w-full sm:w-auto bg-white border-2 border-gray-100 text-gray-600 px-5 py-2 rounded-xl hover:bg-indigo-600 hover:text-white hover:border-indigo-600 text-sm font-bold transition-all shadow-sm active:scale-95 whitespace-nowrap flex items-center justify-center"
          >
            查看內容 <ChevronRightIcon className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    );
  }

  const indexOfLastLesson = currentPage * lessonsPerPage;
  const indexOfFirstLesson = indexOfLastLesson - lessonsPerPage;
  const currentLessons = lessons.slice(indexOfFirstLesson, indexOfLastLesson);
  const totalPages = Math.ceil(lessons.length / lessonsPerPage);
  
  const Pagination = () => {
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
        <div className="flex justify-center gap-2 mt-6">
            <button disabled={currentPage===1} onClick={()=>setCurrentPage(p=>p-1)} className="px-4 py-2 rounded-xl bg-gray-100 disabled:opacity-50 hover:bg-gray-200 transition-colors">上一頁</button>
            {startPage > 1 && (<><button onClick={() => setCurrentPage(1)} className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">1</button>{startPage > 2 && <span className="px-2 self-center text-gray-400">...</span>}</>)}
            {pageNumbers.map(number => (
                <button key={number} onClick={() => setCurrentPage(number)} className={`w-10 h-10 rounded-xl font-bold transition-all ${currentPage === number ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'}`}>{number}</button>
            ))}
            {endPage < totalPages && (<>{endPage < totalPages - 1 && <span className="px-2 self-center text-gray-400">...</span>}<button onClick={() => setCurrentPage(totalPages)} className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 transition-colors">{totalPages}</button></>)}
            <button disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>p+1)} className="px-4 py-2 rounded-xl bg-gray-100 disabled:opacity-50 hover:bg-gray-200 transition-colors">下一頁</button>
        </div>
    )
  };

  if (!studentInfo) return <LoadingSpinner fullScreen />;

  return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-8 animate-fade-in">
      <div className="flex items-center mb-8">
         <BookOpenIcon className="w-8 h-8 text-indigo-600 mr-3" />
         <h2 className="text-2xl font-bold text-gray-900">我的課程</h2>
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
          <div className="mb-8">
            <label className="block text-sm font-bold text-gray-700 mb-2 ml-1">選擇課程</label>
            <Dropdown
              value={selectedCourse ? selectedCourse.id : ''}
              onChange={(value) => {
                const course = courses.find(c => c.id === value);
                setSelectedCourse(course || null);
              }}
              options={[{ value: '', label: '請選擇課程' }, ...courses.map(course => ({ value: course.id, label: `${course.name}（${course.code}）` }))]} 
              placeholder="請選擇課程"
              className="w-full md:w-1/2 lg:w-1/3"
            />
          </div>
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
                    {/* Additional fields... */}
                    </div>
                    {selectedCourse.liveStreamURL && (
                         <div className="mt-6 pt-6 border-t border-white/10">
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
                    {currentLessons.map((lesson, index) => <LessonDetail key={lesson.id} lesson={lesson} index={indexOfFirstLesson + index} />)}
                  </div>
                )}
                <Pagination />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}