'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStudentInfo } from '../StudentInfoContext';
import LoadingSpinner from '../../components/LoadingSpinner';
import Dropdown from '../../components/ui/Dropdown';

// Interfaces remain the same
interface ClassTime { day: string; startTime: string; endTime: string; }
interface Course { id: string; name: string; code: string; status: string; gradeTags: string[]; subjectTag: string; startDate: string; endDate: string; teachers: string[]; teacherName?: string; description: string; teachingMethod: string; courseNature: string; location?: string; liveStreamURL?: string; coverImageURL?: string; classTimes?: ClassTime[]; }
interface Lesson { id: string; title: string; date: string; progress: string; attachments: string[]; videos: string[]; homework: string; onlineExam: string; examScope: string; notes: string; createdAt: string | number | { toDate: () => Date }; order?: number; }

export default function StudentCoursesPage() {
  const router = useRouter();
  const { studentInfo, loading: loadingStudentInfo } = useStudentInfo();

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
      const res = await fetch('/api/student/dashboard-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentInfo.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setCourses(data.courses);
      } else {
        setCourses([]);
      }
    } catch (error) {
      console.error('載入課程時發生錯誤:', error);
      setCourses([]);
    } finally {
      setLoadingCourses(false);
    }
  }, [studentInfo]);

  useEffect(() => {
    if (studentInfo) {
      fetchCourses();
    }
  }, [studentInfo, fetchCourses]);

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

  function LessonDetail({ lesson, index }: { lesson: Lesson; index: number }) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-900">
              第 {index + 1} 堂：{lesson.title}
            </h4>
          </div>
          <button
            onClick={() => {
              const lessonData = { ...lesson, courseName: selectedCourse?.name, courseCode: selectedCourse?.code, courseId: selectedCourse?.id, lessonIndex: index + 1 };
              localStorage.setItem('currentLesson', JSON.stringify(lessonData));
              const currentUrl = window.location.pathname + window.location.search;
              router.push(`/student/lesson-detail?returnTo=${encodeURIComponent(currentUrl)}`);
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            查看詳細
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
      <div className="flex items-center justify-center space-x-2 mt-6">
        <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className={`px-3 py-2 rounded-lg text-sm font-medium ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'}`}>上一頁</button>
        {startPage > 1 && (<><button onClick={() => setCurrentPage(1)} className="px-3 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border border-gray-300">1</button>{startPage > 2 && <span className="px-2 text-gray-500">...</span>}</>)}
        {pageNumbers.map(number => (<button key={number} onClick={() => setCurrentPage(number)} className={`px-3 py-2 rounded-lg text-sm font-medium ${currentPage === number ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'}`}>{number}</button>))}
        {endPage < totalPages && (<>{endPage < totalPages - 1 && <span className="px-2 text-gray-500">...</span>}<button onClick={() => setCurrentPage(totalPages)} className="px-3 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border border-gray-300">{totalPages}</button></>)}
        <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className={`px-3 py-2 rounded-lg text-sm font-medium ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'}`}>下一頁</button>
      </div>
    );
  };

  if (loadingStudentInfo) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <div className="max-w-6xl mx-auto w-full p-2 md:p-8 animate-fade-in">
      <h2 className="text-2xl font-bold mb-6">我的課程</h2>
      {loadingCourses ? (
        <div className="flex justify-center items-center h-64"><LoadingSpinner /><span className="ml-4 text-gray-600">載入中...</span></div>
      ) : courses.length === 0 ? (
        <div className="text-center py-12"><div className="text-gray-400 text-6xl mb-4">📚</div><h3 className="text-xl font-semibold text-gray-600 mb-2">尚無課程</h3><p className="text-gray-500">您目前還沒有選擇任何課程</p></div>
      ) : (
        <>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">選擇課程</label>
            <Dropdown
              value={selectedCourse ? selectedCourse.id : ''}
              onChange={(value) => {
                const course = courses.find(c => c.id === value);
                setSelectedCourse(course || null);
              }}
              options={[{ value: '', label: '請選擇課程' }, ...courses.map(course => ({ value: course.id, label: `${course.name}（${course.code}）` }))]} 
              placeholder="請選擇課程"
              className="w-1/3 min-w-[240px] pr-20"
            />
          </div>
          {selectedCourse && (
            <div className="animate-fade-in">
              <div className="bg-blue-600 rounded-lg shadow-md p-6 text-white mb-6">
                <div className="mb-6 flex items-center justify-between">
                  <div className="flex-grow">
                    <h3 className="text-xl font-bold mb-1">{selectedCourse.name}</h3>
                    <p className="text-blue-100">{selectedCourse.code}</p>
                  </div>
                  <div className="flex items-center">
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-white text-blue-600">{selectedCourse.status}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {selectedCourse.startDate && <div className="flex items-center justify-between p-3 bg-blue-700 rounded-lg"><span>課程期間</span><span>{selectedCourse.startDate} ~ {selectedCourse.endDate}</span></div>}
                  {selectedCourse.teachers?.length > 0 && <div className="flex items-center justify-between p-3 bg-blue-700 rounded-lg"><span>授課老師</span><span>{selectedCourse.teacherName || '未指定教師'}</span></div>}
                  {selectedCourse.classTimes?.length > 0 && <div className="flex items-center justify-between p-3 bg-blue-700 rounded-lg"><span>上課時間</span><span>{selectedCourse.classTimes.map(time => `${time.day} ${time.startTime}-${time.endTime}`).join(', ')}</span></div>}
                  {selectedCourse.teachingMethod && <div className="flex items-center justify-between p-3 bg-blue-700 rounded-lg"><span>上課方式</span><span>{selectedCourse.teachingMethod}</span></div>}
                  {selectedCourse.location && <div className="flex items-center justify-between p-3 bg-blue-700 rounded-lg"><span>上課地點</span><span>{selectedCourse.location}</span></div>}
                  {selectedCourse.liveStreamURL && <div className="flex items-center justify-between p-3 bg-blue-700 rounded-lg"><span>會議室連結</span><a href={selectedCourse.liveStreamURL} target="_blank" rel="noopener noreferrer" className="text-blue-200 hover:text-white underline">點擊進入</a></div>}
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-gray-900">課程清單</h3>
                  {lessons.length > 0 && <div className="text-sm text-gray-600">共 {lessons.length} 堂課{totalPages > 1 && <span className="ml-2">（第 {currentPage} 頁，共 {totalPages} 頁）</span>}</div>}
                </div>
                {loadingLessons ? (
                  <div className="flex justify-center items-center py-8"><LoadingSpinner /><span className="ml-3 text-gray-600">載入課程清單中...</span></div>
                ) : lessons.length === 0 ? (
                  <div className="text-center py-8"><div className="text-gray-400 text-4xl mb-2">📝</div><p className="text-gray-500">此課程尚未有課程清單</p></div>
                ) : (
                  <div className="space-y-3">
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
