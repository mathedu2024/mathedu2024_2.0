'use client';

import React, { useState, useEffect, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, clearSession } from '../utils/session';
import StudentGradeViewer from '../components/StudentGradeViewer';
import PasswordManager from '../components/PasswordManager';
import SecureRoute from '../components/SecureRoute';
import TutoringRequest from '../components/TutoringRequest';
import StudentTutoringHistory from '../components/StudentTutoringHistory';
import { BookOpenIcon, ClipboardDocumentListIcon, CheckCircleIcon, PencilIcon, CalendarIcon, KeyIcon } from '@heroicons/react/24/outline';
import LoadingSpinner from '../components/LoadingSpinner';
import Sidebar from '../components/Sidebar';

interface StudentFeature {
  id: string;
  title: string;
  description: string;
  icon: React.ReactElement;
  link: string;
  disabled?: boolean;
  isAccount?: boolean; // 新增屬性，用於區分帳戶功能
}

const studentFeatures: StudentFeature[] = [
  {
    id: 'courses',
    title: '我的課程',
    description: '瀏覽與管理你已選的所有課程',
    icon: <BookOpenIcon />, // 移除 className
    link: '/student/courses',
  },
  {
    id: 'grades',
    title: '成績查詢',
    description: '查看各課程的成績與評量結果',
    icon: <ClipboardDocumentListIcon />, // 移除 className
    link: '/student/grades'
  },
  {
    id: 'attendance',
    title: '線上點名',
    description: '快速完成每日/每週課程點名',
    icon: <CheckCircleIcon />, // 移除 className
    link: '/student/attendance'
  },
  {
    id: 'exam',
    title: '線上測驗',
    description: '參加老師安排的線上測驗',
    icon: <PencilIcon />, // 移除 className
    link: '/student/exam'
  },
  {
    id: 'counseling',
    title: '輔導預約',
    description: '預約老師或助教的輔導時段',
    icon: <CalendarIcon />, // 移除 className
    link: '/student/counseling'
  },
  {
    id: 'change-password',
    title: '修改密碼',
    description: '修改您的登入密碼',
    icon: <KeyIcon />, // 移除 className
    link: '/student/change-password',
    isAccount: true,
  }
];

interface Course {
  id: string;
  name: string;
  code: string;
  status: '未開課' | '報名中' | '已額滿' | '已結束' | '已封存' | '資料建置中...';
  gradeTags: string[];
  subjectTag: string;
  startDate: string;
  endDate: string;
  teachers: string[];
  description: string;
  teachingMethod: string;
  courseNature: string;
  location?: string;
  liveStreamURL?: string;
  coverImageURL?: string;
}

interface Lesson {
  id: string;
  title: string;
  date: string;
  progress: string;
  attachments: string[];
  videos: string[];
  homework: string;
  onlineExam: string;
  examScope: string;
  notes: string;
  createdAt: {
    seconds: number;
    nanoseconds: number;
  } | null;
  order?: number;
}

export default function StudentPanel() {
  return (
    <SecureRoute requiredRole="student">
      <Suspense fallback={<div className="flex h-screen bg-gray-100 items-center justify-center">
        <LoadingSpinner size={8} />
      </div>}>
        <StudentPanelContent />
      </Suspense>
    </SecureRoute>
  );
}
function StudentPanelContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // 明確型別
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [counselingSubTab, setCounselingSubTab] = useState<'request' | 'history' | null>(null);
  const [studentInfo, setStudentInfo] = useState<{
    id: string;
    name: string;
    account: string;
    role: string;
    studentId: string;
    enrolledCourses?: string[];
  } | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  
  // 我的課程 hooks（移到最外層）
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [loadingCourses, setLoadingCourses] = useState<boolean>(false);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState<boolean>(false);
  // 新增：老師帳號對應名稱
  const [teacherNamesMap, setTeacherNamesMap] = useState<{ [id: string]: string }>({});
  // 新增：分頁相關狀態
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [lessonsPerPage] = useState<number>(8);

  // 1. 新增 isMobile 狀態與漢堡選單控制
  // const isMobile = typeof window !== 'undefined' && window.innerWidth < 768; // 已移除未使用變數
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  // 課程詳細資訊組件
  function LessonDetail({ lesson, index }: { lesson: Lesson; index: number }) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-900">
              第 {index + 1} 堂：{lesson.title}
            </h4>
          </div>
          <button
            onClick={() => {
              // 將課程資訊存儲到 localStorage，然後跳轉到課堂詳細頁面
              const lessonData = {
                ...lesson,
                courseName: selectedCourse?.name,
                courseCode: selectedCourse?.code,
                courseId: selectedCourse?.id,
                lessonIndex: index + 1
              };
              localStorage.setItem('currentLesson', JSON.stringify(lessonData));
              window.location.href = '/student/lesson-detail';
            }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            查看詳細
          </button>
        </div>
      </div>
    );
  }

  // studentQuickActions 陣列
  const studentQuickActions = [
    {
      id: 'courses',
      title: '我的課程',
      description: '查看課程內容與進度',
      icon: <BookOpenIcon className="h-8 w-8" />, // 修正 icon 大小
      onClick: () => setActiveTab('courses'),
      disabled: false,
    },
    {
      id: 'grades',
      title: '成績查詢',
      description: '查看各科成績與評量',
      icon: <ClipboardDocumentListIcon className="h-8 w-8" />, // 修正 icon 大小
      onClick: () => setActiveTab('grades'),
      disabled: false,
    },
    {
      id: 'counseling',
      title: '輔導預約',
      description: '功能暫時關閉',
      icon: <CalendarIcon className="h-8 w-8" />, // 修正 icon 大小
      onClick: () => setActiveTab('counseling'),
      disabled: true,
    },
    {
      id: 'change-password',
      title: '修改密碼',
      description: '更新您的登入密碼',
      icon: <KeyIcon className="h-8 w-8" />, // 修正 icon 大小
      onClick: () => setActiveTab('change-password'),
      disabled: false,
    },
    {
      id: 'attendance',
      title: '線上點名',
      description: '功能暫時關閉',
      icon: <CheckCircleIcon className="h-8 w-8" />, // 修正 icon 大小
      onClick: () => setActiveTab('attendance'),
      disabled: true,
    },
    {
      id: 'exam',
      title: '線上測驗',
      description: '功能暫時關閉',
      icon: <PencilIcon className="h-8 w-8" />, // 修正 icon 大小
      onClick: () => setActiveTab('exam'),
      disabled: true,
    },
  ];

  useEffect(() => {
    const session = getSession();
    if (session) {
      const fetchStudentInfo = async () => {
        try {
          const res = await fetch('/api/student/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: session.id }),
          });
          if (res.ok) {
            const studentInfo = await res.json();
            setStudentInfo(studentInfo);
            if (studentInfo.enrolledCourses && studentInfo.enrolledCourses.length > 0) {
              setLoadingCourses(true);
              try {
                // 改為呼叫 /api/courses/list 並過濾
                const resCourses = await fetch('/api/courses/list');
                const allCourses = await resCourses.json();
                // 依照老師端 Firestore 查詢順序
                const filteredCourses = allCourses.filter((c: unknown) => (studentInfo.enrolledCourses ?? []).includes((c as Course).id));
                setCourses(filteredCourses);
              } catch (error) {
                console.error('Error fetching courses:', error);
                // setError('讀取課程清單失敗'); // 移除未使用的 error 變數
              } finally {
                setLoadingCourses(false);
              }
            }
          } else {
            // setError('找不到您的學生資料，請聯絡管理員。'); // 移除未使用的 error 變數
            clearSession();
            router.push('/login');
          }
        } catch (error) {
          console.error("Error fetching student info:", error);
          // setError('讀取學生資料時發生錯誤'); // 移除未使用的 error 變數
        } finally {
          setLoading(false);
        }
      };
      fetchStudentInfo();
    } else {
      router.push('/login');
    }
  }, [router]);

  // 初始化 activeTab 根據網址 query
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  // 切換分頁時，更新網址 query
  const handleTabChange = (tab: string | null) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab) {
      url.searchParams.set('tab', tab);
    } else {
      url.searchParams.delete('tab');
    }
    window.history.replaceState({}, '', url.toString());
  };

  // 重置 counselingSubTab 當切換到其他頁面時
  useEffect(() => {
    if (activeTab !== 'counseling') {
      setCounselingSubTab(null);
    }
  }, [activeTab]);

  // Wrap fetchCourses in useCallback
  const fetchCourses = useCallback(async () => {
    if (!studentInfo?.enrolledCourses || studentInfo.enrolledCourses.length === 0) {
      setCourses([]);
      setTeacherNamesMap({});
      return;
    }
    setLoadingCourses(true);
    try {
      const resCourses = await fetch('/api/courses/list');
      if (resCourses.ok) {
        const allCourses = await resCourses.json();
        const filteredCourses = allCourses.filter((c: unknown) => (studentInfo.enrolledCourses ?? []).includes((c as Course).id));
        const allTeacherIds = Array.from(new Set(filteredCourses.flatMap((c: unknown) => (c as Course).teachers || [])));
        let teacherNames: { [id: string]: string } = {};
        if (allTeacherIds.length > 0) {
          const resTeachers = await fetch('/api/teacher/list');
          if (resTeachers.ok) {
            const teachers: { id: string; name: string }[] = await resTeachers.json();
            teacherNames = allTeacherIds.reduce<{ [id: string]: string }>((acc, id) => {
              const t = teachers.find((t: { id: string }) => t.id === id);
              acc[String(id)] = t ? t.name : String(id);
              return acc;
            }, {});
          }
        }
        setCourses(filteredCourses);
        setTeacherNamesMap(teacherNames);
      } else {
        setCourses([]);
        setTeacherNamesMap({});
      }
    } catch (error) {
      console.error('載入課程時發生錯誤:', error);
      setCourses([]);
      setTeacherNamesMap({});
    } finally {
      setLoadingCourses(false);
    }
  }, [studentInfo]);

  useEffect(() => {
    if (activeTab === 'courses' && studentInfo) {
      fetchCourses();
    }
  }, [activeTab, studentInfo, fetchCourses]);

  // 當選擇課程時，載入該課程的課程清單（優化：添加快取）
  useEffect(() => {
    const fetchLessons = async () => {
      if (!selectedCourse) {
        setLessons([]);
        return;
      }
      setLoadingLessons(true);
      try {
        // 改為呼叫 /api/courses/lessons
        const res = await fetch('/api/courses/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId: selectedCourse.id }),
        });
        const lessons = await res.json();
        // 加入排序，與詳情頁一致
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

  // 分頁計算
  const indexOfLastLesson = currentPage * lessonsPerPage;
  const indexOfFirstLesson = indexOfLastLesson - lessonsPerPage;
  const currentLessons = lessons.slice(indexOfFirstLesson, indexOfLastLesson);
  const totalPages = Math.ceil(lessons.length / lessonsPerPage);

  // 分頁控制組件
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
        {/* 上一頁 */}
        <button
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentPage === 1
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
        >
          上一頁
        </button>

        {/* 頁碼 */}
        {startPage > 1 && (
          <>
            <button
              onClick={() => setCurrentPage(1)}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
            >
              1
            </button>
            {startPage > 2 && (
              <span className="px-2 text-gray-500">...</span>
            )}
          </>
        )}

        {pageNumbers.map(number => (
          <button
            key={number}
            onClick={() => setCurrentPage(number)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentPage === number
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
            }`}
          >
            {number}
          </button>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && (
              <span className="px-2 text-gray-500">...</span>
            )}
            <button
              onClick={() => setCurrentPage(totalPages)}
              className="px-3 py-2 rounded-lg text-sm font-medium bg-white text-gray-700 hover:bg-gray-50 border border-gray-300"
            >
              {totalPages}
            </button>
          </>
        )}

        {/* 下一頁 */}
        <button
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
            currentPage === totalPages
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'
          }`}
        >
          下一頁
        </button>
      </div>
    );
  };

  const handleLogout = () => {
    // 清除所有快取資料
    if (studentInfo) {
      localStorage.removeItem(`student_info_${studentInfo.id}`);
      localStorage.removeItem(`courses_${studentInfo.id}`);
      if (selectedCourse) {
        localStorage.removeItem(`lessons_${selectedCourse.id}`);
      }
    }
    
    // 清除所有課程快取
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('lessons_') || key.startsWith('courses_') || key.startsWith('student_info_')) {
        localStorage.removeItem(key);
      }
    });
    
    clearSession();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <LoadingSpinner size={8} />
      </div>
    );
  }

  if (!studentInfo) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="text-gray-500">找不到學生資料，請重新登入。</div>
      </div>
    );
  }

  // 決定哪些功能要 disabled
  const allSidebarFeatures = studentFeatures.map(f => {
    let disabled = f.disabled || false;
    // 強制鎖定三個功能
    if (['attendance', 'exam', 'counseling'].includes(f.id)) {
      disabled = true;
    }
    return { ...f, disabled };
  });

  // 在 StudentPanelContent 內，定義 Accordion 群組
  // 1. 移除 sidebarAccordionGroups 與 <Accordion />
  // 2. 手機與桌面都用同一套單層功能選單

  // 渲染功能內容
  const renderContent = () => {
    switch (activeTab) {
      case 'grades':
        return <StudentGradeViewer studentInfo={studentInfo} />;
      case 'change-password':
        return (
          <div className="max-w-2xl mx-auto w-full">
            <PasswordManager />
          </div>
        );
      case 'courses': {
        // 下拉選單選課 + 詳細資料
        return (
          <div className="max-w-6xl mx-auto w-full p-4">
            <h2 className="text-2xl font-bold mb-6">我的課程</h2>
            {loadingCourses ? (
              <div className="flex justify-center items-center h-64">
                <LoadingSpinner size={8} />
                <span className="ml-4 text-gray-600">載入中...</span>
              </div>
            ) : courses.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">📚</div>
                <h3 className="text-xl font-semibold text-gray-600 mb-2">尚無課程</h3>
                <p className="text-gray-500">您目前還沒有選擇任何課程</p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">選擇課程</label>
                  <select
                    className="select-unified w-full md:w-80"
                    value={selectedCourse ? selectedCourse.id : ''}
                    onChange={e => {
                      const course = courses.find(c => c.id === e.target.value);
                      setSelectedCourse(course || null);
                    }}
                  >
                    <option value="">請選擇課程</option>
                    {courses.map(course => (
                      <option key={course.id} value={course.id}>
                        {course.name}（{course.code}）
                      </option>
                    ))}
                  </select>
                </div>
                {selectedCourse && (
                  <>
                    <div className="bg-blue-600 rounded-lg shadow-md p-6 text-white mb-6">
                      <div className="mb-6 flex items-center justify-between">
                        <div>
                          <h3 className="text-xl font-bold mb-1">{selectedCourse.name}</h3>
                          <p className="text-blue-100">{selectedCourse.code}</p>
                        </div>
                        <span className="px-3 py-1 rounded-full text-sm font-medium bg-white text-blue-600">
                          {selectedCourse.status}
                        </span>
                      </div>
                      
                      <div className="space-y-3">
                        {(selectedCourse.startDate || selectedCourse.endDate) && (
                          <div className="flex items-center justify-between p-3 bg-blue-700 rounded-lg">
                            <span className="font-medium">課程期間</span>
                            <span>{selectedCourse.startDate || ''} ~ {selectedCourse.endDate || ''}</span>
                          </div>
                        )}
                        
                        {selectedCourse.teachers && selectedCourse.teachers.length > 0 && (
                          <div className="flex items-center justify-between p-3 bg-blue-700 rounded-lg">
                            <span className="font-medium">授課老師</span>
                            <span>{selectedCourse.teachers.map(id => teacherNamesMap[id] || id).join('、')}</span>
                          </div>
                        )}
                        
                        {selectedCourse.teachingMethod && (
                          <div className="flex items-center justify-between p-3 bg-blue-700 rounded-lg">
                            <span className="font-medium">上課時間</span>
                            <span>{selectedCourse.teachingMethod}</span>
                          </div>
                        )}
                        
                        {selectedCourse.location && (
                          <div className="flex items-center justify-between p-3 bg-blue-700 rounded-lg">
                            <span className="font-medium">上課地點</span>
                            <span>{selectedCourse.location}</span>
                          </div>
                        )}
                        
                        {selectedCourse.liveStreamURL && (
                          <div className="flex items-center justify-between p-3 bg-blue-700 rounded-lg">
                            <span className="font-medium">會議室連結</span>
                            <a 
                              href={selectedCourse.liveStreamURL} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-blue-200 hover:text-white underline"
                            >
                              點擊進入
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 課程清單 */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-gray-900">課程清單</h3>
                        {lessons.length > 0 && (
                          <div className="text-sm text-gray-600">
                            共 {lessons.length} 堂課
                            {totalPages > 1 && (
                              <span className="ml-2">
                                （第 {currentPage} 頁，共 {totalPages} 頁）
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {loadingLessons ? (
                        <div className="flex justify-center items-center py-8">
                          <LoadingSpinner size={8} />
                          <span className="ml-3 text-gray-600">載入課程清單中...</span>
                        </div>
                      ) : lessons.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="text-gray-400 text-4xl mb-2">📝</div>
                          <p className="text-gray-500">此課程尚未有課程清單</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {currentLessons.map((lesson, index) => (
                            <LessonDetail 
                              key={lesson.id} 
                              lesson={lesson} 
                              index={indexOfFirstLesson + index} 
                            />
                          ))}
                        </div>
                      )}
                      
                      {/* 分頁控制 */}
                      <Pagination />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        );
      }
      case 'attendance':
        return (
          <div className="p-8">
            <div className="bg-white rounded-lg p-8 shadow text-center">
              <h2 className="text-2xl font-bold mb-4">線上點名</h2>
              <p className="text-gray-600">此功能尚未開發完成</p>
            </div>
          </div>
        );
      case 'exam':
        return (
          <div className="p-8">
            <div className="bg-white rounded-lg p-8 shadow text-center">
              <h2 className="text-2xl font-bold mb-4">線上測驗</h2>
              <p className="text-gray-600">此功能尚未開發完成</p>
            </div>
          </div>
        );
      case 'counseling':
        return (
          <div className="p-8">
            <div className="max-w-6xl mx-auto">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">輔導預約</h2>
                <div className="flex space-x-4">
                  <button
                    onClick={() => setCounselingSubTab('request')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      counselingSubTab === 'request' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    申請預約
                  </button>
                  <button
                    onClick={() => setCounselingSubTab('history')}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      counselingSubTab === 'history' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    預約記錄
                  </button>
                </div>
              </div>
              
              {counselingSubTab === 'request' && (
                <TutoringRequest userInfo={studentInfo} />
              )}
              
              {counselingSubTab === 'history' && (
                <StudentTutoringHistory userInfo={studentInfo} />
              )}
              
              {!counselingSubTab && (
                <div className="bg-white rounded-lg p-8 shadow text-center">
                  <h3 className="text-xl font-bold mb-4">輔導預約服務</h3>
                  <p className="text-gray-600 mb-6">您可以預約與老師的一對一輔導，或查看您的預約記錄</p>
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={() => setCounselingSubTab('request')}
                      disabled={true}
                      className="bg-gray-600 text-white px-6 py-3 rounded-lg cursor-not-allowed opacity-50"
                    >
                      申請預約
                    </button>
                    <button
                      onClick={() => setCounselingSubTab('history')}
                      className="bg-gray-600 text-white px-6 py-3 rounded-lg cursor-not-allowed opacity-50"
                    >
                      查看記錄
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // 2. 側邊欄響應式與漢堡選單
  return (
    <div className="flex flex-col h-screen bg-gray-100 font-sans">
      <div className="flex flex-1 min-h-0">
        {/* 手機漢堡按鈕 */}
        <button
          className={`fixed top-20 left-4 z-50 bg-white p-2 rounded-full shadow-lg hover:bg-gray-50 transition-colors md:hidden ${sidebarOpen ? 'hidden' : 'block'}`}
          onClick={() => setSidebarOpen(true)}
        >
          <svg className="w-6 h-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        {/* 手機遮罩 */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-40 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* 使用統一的 Sidebar 組件 */}
        <Sidebar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          userInfo={studentInfo}
          menuItems={allSidebarFeatures}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          onLogout={handleLogout}
          isMobile={typeof window !== 'undefined' && window.innerWidth < 768}
        />
        {/* Main Content */}
        <main
          className="flex-1 min-w-0 p-2 md:p-8 transition-all duration-300 flex justify-center"
          style={{
            height: '100vh',
            overflowY: 'auto',
            paddingLeft: sidebarOpen ? 64 : 256,
            transition: 'padding-left 0.3s'
          }}
        >
          {/* 儀表板或功能頁 */}
          {!activeTab ? (
            // 儀表板內容
            <div className="max-w-7xl mx-auto w-full px-2 sm:px-4 md:px-6 lg:px-8">
              {/* 歡迎區塊 */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-4 md:p-6 text-white mb-4 md:mb-8">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <h1 className="text-2xl md:text-4xl font-bold mb-2">歡迎回來，{studentInfo?.name}！</h1>
                    <p className="text-blue-100 text-base md:text-lg">學號：{studentInfo?.studentId}</p>
                    <p className="text-blue-100 mt-2 text-sm md:text-base">今天是 {new Date().toLocaleDateString('zh-TW', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      weekday: 'long'
                    })}</p>
                  </div>
                  <div className="text-center lg:text-right">
                    <div className="text-4xl mb-2">📚</div>
                    <p className="text-blue-100 text-sm md:text-base">學習愉快！</p>
                  </div>
                </div>
              </div>

              {/* 統計卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-blue-500">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12V6a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">已選課程</p>
                      <p className="text-2xl font-bold text-gray-900">{studentInfo?.enrolledCourses?.length || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-500">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-green-100 text-green-600">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">成績查詢</p>
                      <p className="text-2xl font-bold text-gray-900">可查看</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-yellow-500">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">輔導預約</p>
                      <p className="text-2xl font-bold text-gray-900">未開放</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-purple-500">
                  <div className="flex items-center">
                    <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <div className="ml-4">
                      <p className="text-sm font-medium text-gray-600">帳戶設定</p>
                      <p className="text-2xl font-bold text-gray-900">可修改</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 快速操作 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">快速操作</h2>
                <div className="card-list">
                  {studentQuickActions.map((action) => (
                    <button
                      key={action.id}
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className={`min-w-[260px] sm:min-w-0 text-left p-6 rounded-2xl transition-all sm:duration-200 md:duration-300 flex items-center border ${
                        action.disabled
                          ? 'bg-gray-100 cursor-not-allowed opacity-60 border-gray-200'
                          : 'bg-white hover:bg-gray-50 border-gray-200 hover:shadow-xl md:hover:-translate-y-1'
                      }`}
                    >
                      <div className={`p-4 rounded-xl mr-4 ${action.disabled ? 'bg-gray-200' : 'bg-blue-100'}`}>
                        {action.icon}
                      </div>
                      <div>
                        <h3 className={`text-xl font-bold ${action.disabled ? 'text-gray-500' : 'text-gray-800'}`}>{action.title}</h3>
                        <p className={`text-base mt-1 ${action.disabled ? 'text-gray-400' : 'text-gray-600'}`}>{action.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            renderContent()
          )}
        </main>
        {/* FooterInfo 已移除 */}
      </div>
    </div>
  );
} 