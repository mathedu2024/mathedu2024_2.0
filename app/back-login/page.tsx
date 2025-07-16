'use client';

import React, { useState, useEffect, useRef, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getSession, clearSession } from '../utils/session';
import { db } from '../../services/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import SecureRoute from '../components/SecureRoute';
import StudentGradeViewer from '../components/StudentGradeViewer';
import PasswordManager from '../components/PasswordManager';

// 閒置時間設定（3分鐘 = 180000毫秒）
const IDLE_TIMEOUT = 3 * 60 * 1000;

interface StudentInfo {
  id: string;
  name: string;
  studentId: string;
  enrolledCourses: string[];
  grade: string;
  class: string;
  email?: string;
  phone?: string;
}

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
    <Suspense fallback={<div className="flex h-screen bg-gray-100 items-center justify-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-r-4 border-blue-600"></div>
    </div>}>
      <StudentPanelContent />
    </Suspense>
  );
}

function StudentPanelContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [teacherNamesMap, setTeacherNamesMap] = useState<Record<string, string>>({});

  // 閒置檢測相關
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef<number>(Date.now());

  // 先宣告 handleLogout，讓 resetIdleTimer 可以安全依賴
  const handleLogout = useCallback(() => {
    // 清除閒置計時器
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    // 清除暫存資料
    clearSession();
    // 清除 localStorage 中的課程資料
    if (typeof window !== 'undefined') {
      localStorage.removeItem('currentLesson');
    }
    console.log('用戶登出，已清除所有暫存資料');
    router.push('/login');
  }, [router]);

  // 閒置檢測函數
  const resetIdleTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      console.log('用戶閒置3分鐘，自動登出');
      handleLogout();
    }, IDLE_TIMEOUT);
  }, [handleLogout]);

  // 用戶活動檢測
  const handleUserActivity = useCallback(() => {
    resetIdleTimer();
  }, [resetIdleTimer]);

  // 初始化閒置檢測
  useEffect(() => {
    resetIdleTimer();

    // 監聽用戶活動
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      document.addEventListener(event, handleUserActivity, true);
    });

    // 清理函數
    return () => {
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      events.forEach(event => {
        document.removeEventListener(event, handleUserActivity, true);
      });
    };
  }, [resetIdleTimer, handleUserActivity]);

  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        const session = getSession();
        if (!session || session.role !== 'student') {
          router.push('/login');
          return;
        }

        const userDocRef = doc(db, 'student_data', session.id);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();
          setStudentInfo({
            id: userDocSnap.id,
            name: userData.name || '',
            studentId: userData.studentId || userDocSnap.id,
            enrolledCourses: userData.enrolledCourses || [],
            grade: userData.grade || '',
            class: userData.class || '',
            email: userData.email,
            phone: userData.phone
          });
          
          // 檢查 URL 參數，如果有 tab=courses 則自動切換到課程列表
          const tabParam = searchParams.get('tab');
          if (tabParam === 'courses') {
            setActiveTab('courses');
          }
          // 移除自動跳轉到課程列表的邏輯，讓學生登入後直接顯示儀表板
        } else {
          console.error('找不到學生資料');
          router.push('/login');
        }
      } catch (error) {
        console.error('獲取學生資料時發生錯誤:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchStudentData();
  }, [router, searchParams]);

  const fetchCourses = useCallback(async () => {
    if (!studentInfo?.enrolledCourses || studentInfo.enrolledCourses.length === 0) {
      setCourses([]);
      setTeacherNamesMap({});
      return;
    }
    
    setLoadingCourses(true);
    try {
      console.log('Fetching courses for student:', studentInfo.enrolledCourses);
      const coursePromises = studentInfo.enrolledCourses.map(async (courseId: string) => {
        const courseDocRef = doc(db, 'courses', courseId);
        const courseDocSnap = await getDoc(courseDocRef);
        if (courseDocSnap.exists()) {
          return { id: courseDocSnap.id, ...courseDocSnap.data() } as Course;
        }
        return null;
      });
      
      const courseResults = await Promise.all(coursePromises);
      const filteredCourses = courseResults.filter(Boolean) as Course[];
      
      console.log('Fetched courses:', filteredCourses);
      setCourses(filteredCourses);
      
      // 查詢所有老師名稱
      const allTeacherIds = Array.from(new Set(filteredCourses.flatMap(c => c.teachers || [])));
      if (allTeacherIds.length > 0) {
        const teacherNames: Record<string, string> = {};
        // Firestore 'in' 限制 10 or 30 筆，分批查詢
        const batchSize = 30;
        for (let i = 0; i < allTeacherIds.length; i += batchSize) {
          const batchIds = allTeacherIds.slice(i, i + batchSize);
          const q = collection(db, 'admin-teachers');
          const snapshot = await getDocs(q);
          snapshot.docs.forEach(docSnap => {
            if (batchIds.includes(docSnap.id)) {
              teacherNames[docSnap.id] = docSnap.data().name || docSnap.id;
            }
          });
        }
        setTeacherNamesMap(teacherNames);
      } else {
        setTeacherNamesMap({});
      }
      
      // 如果有課程，預設選擇第一個
      if (filteredCourses.length > 0 && !selectedCourse) {
        setSelectedCourse(filteredCourses[0]);
      }
      
    } catch (error) {
      console.error('Error fetching courses:', error);
      setCourses([]);
      setTeacherNamesMap({});
    } finally {
      setLoadingCourses(false);
    }
  }, [studentInfo, selectedCourse]);

  useEffect(() => {
    if (!selectedCourse) {
      setLessons([]);
      return;
    }
    
    const fetchLessons = async () => {
      if (!selectedCourse) {
        return;
      }
      
      setLoadingLessons(true);
      try {
        console.log('Fetching lessons for course:', selectedCourse.id);
        const lessonsCollection = collection(db, 'courses', selectedCourse.id, 'lessons');
        const lessonsSnapshot = await getDocs(lessonsCollection);
        
        const lessonsData = lessonsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Lesson));
        
        // 按順序排序
        const sortedLessons = lessonsData.sort((a, b) => 
          (a.order ?? a.createdAt?.seconds ?? 0) - (b.order ?? b.createdAt?.seconds ?? 0)
        );
        
        console.log('Fetched lessons:', sortedLessons);
        setLessons(sortedLessons);
      } catch (error) {
        console.error('Error fetching lessons:', error);
        setLessons([]);
      } finally {
        setLoadingLessons(false);
      }
    };

    fetchLessons();
  }, [selectedCourse]);

  // 當切換到課程頁面時，確保課程資料已載入
  useEffect(() => {
    if (activeTab === 'courses' && studentInfo) {
      fetchCourses();
    }
  }, [activeTab, studentInfo, fetchCourses]);

  // 功能卡片定義
  const studentFeatures = [
    {
      id: 'courses',
      title: '我的課程',
      description: '查看已選課程和課程清單',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
    },
    {
      id: 'grades',
      title: '成績查詢',
      description: '查看各科成績和學習進度',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
    },
    {
      id: 'attendance',
      title: '點名記錄',
      description: '查看上課出席狀況',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    {
      id: 'exam',
      title: '線上測驗',
      description: '參加老師安排的線上測驗',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h2" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h.01" /></svg>
    },
    {
      id: 'counseling',
      title: '輔導預約',
      description: '預約老師輔導時間',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
    },
    {
      id: 'change-password',
      title: '修改密碼',
      description: '更改登入密碼',
      icon: <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
    }
  ];

  function LessonDetail({ lesson, index }: { lesson: Lesson; index: number }) {
    return (
      <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-gray-900">第 {index + 1} 堂：{lesson.title}</h4>
          <span className="text-sm text-gray-500">{lesson.date}</span>
        </div>
        <div className="space-y-2 text-sm text-gray-600">
          {lesson.progress && <p><strong>進度：</strong>{lesson.progress}</p>}
          {lesson.notes && <p><strong>備註：</strong>{lesson.notes}</p>}
          {lesson.homework && <p><strong>作業：</strong>{lesson.homework}</p>}
          {lesson.examScope && <p><strong>考試範圍：</strong>{lesson.examScope}</p>}
          {lesson.onlineExam && <p><strong>線上測驗：</strong>{lesson.onlineExam}</p>}
          {(lesson.attachments && lesson.attachments.length > 0) && (
            <p><strong>附件：</strong>{lesson.attachments.join(', ')}</p>
          )}
          {(lesson.videos && lesson.videos.length > 0) && (
            <p><strong>影片：</strong>{lesson.videos.join(', ')}</p>
          )}
        </div>
      </div>
    );
  }

  // 根據學生選課顯示功能卡片
  const enrolledSet = new Set(studentInfo?.enrolledCourses || []);
  const filteredFeatures = studentFeatures.filter(f => {
    // "我的課程"、"修改密碼"、"輔導預約"、"成績查詢"永遠顯示，其餘依選課顯示
    if (f.id === 'courses' || f.id === 'change-password' || f.id === 'counseling' || f.id === 'grades') return true;
    // 例如: 若有選課才顯示點名/測驗
    if (f.id === 'attendance' || f.id === 'exam') return enrolledSet.size > 0;
    return true;
  });

  // 修正 studentInfo 型別檢查
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-100">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-r-4 border-blue-600"></div>
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
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
                    className="border border-gray-300 rounded-lg p-3 w-full md:w-80"
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
                      <h3 className="text-lg font-bold text-gray-900 mb-4">課程清單</h3>
                      
                      {loadingLessons ? (
                        <div className="flex justify-center items-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          <span className="ml-3 text-gray-600">載入課程清單中...</span>
                        </div>
                      ) : lessons.length === 0 ? (
                        <div className="text-center py-8">
                          <div className="text-gray-400 text-4xl mb-2">📝</div>
                          <p className="text-gray-500">此課程尚未有課程清單</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {lessons.map((lesson, index) => (
                            <LessonDetail key={lesson.id} lesson={lesson} index={index} />
                          ))}
                        </div>
                      )}
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
            <div className="bg-white rounded-lg p-8 shadow text-center">
              <h2 className="text-2xl font-bold mb-4">輔導預約</h2>
              <p className="text-gray-600">此功能尚未開發完成</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <SecureRoute requiredRole="student">
      <div className="flex bg-gray-100 font-sans" style={{ height: 'calc(100vh - 64px)' }}>
        {/* Sidebar */}
        <div className={`bg-white flex flex-col ${isSidebarCollapsed ? 'w-20' : 'w-64'} transition-all duration-200`} style={{ height: 'calc(100vh - 64px)', minHeight: 0, position: 'fixed', left: 0, top: '64px', bottom: 0, zIndex: 40 }}>
          {/* 頂部學生資訊 */}
          <div className={`p-4 flex items-center border-b ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            <div className="flex flex-col items-center w-full text-center">
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-xl font-bold mb-2 flex-shrink-0">
                {studentInfo.name?.[0] || '?'}
              </div>
              {!isSidebarCollapsed && (
                <>
                  <div className="font-semibold truncate w-full">{studentInfo.name} (學生)</div>
                  <div className="text-sm text-gray-500">學號：{studentInfo.studentId}</div>
                </>
              )}
            </div>
          </div>
          {/* 側邊欄選單 */}
          <nav className="mt-2 flex-1 overflow-y-auto">
            <div className="px-4 py-2">
              <button
                onClick={() => setActiveTab(null)}
                className={`w-full flex items-center p-2 rounded-lg transition-colors ${!activeTab ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM4 12a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2z" /></svg>
                {!isSidebarCollapsed && <span className="ml-3">儀表板</span>}
              </button>
            </div>
            {filteredFeatures.map(item => (
              <div className="px-4 py-2" key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center p-2 rounded-lg transition-colors ${activeTab === item.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}`}
                >
                  <span className="flex-shrink-0">{React.cloneElement(item.icon, { className: 'h-6 w-6 text-blue-600' })}</span>
                  {!isSidebarCollapsed && <span className="ml-3">{item.title}</span>}
                </button>
              </div>
            ))}
          </nav>
          {/* 底部收合與登出 */}
          <div className="px-4 py-2 mt-auto border-t flex flex-col gap-2">
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="w-full flex items-center p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {isSidebarCollapsed ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              )}
              {!isSidebarCollapsed && <span className="ml-3">{isSidebarCollapsed ? '展開選單' : '收合選單'}</span>}
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center p-2 rounded-lg text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
              {!isSidebarCollapsed && <span className="ml-3">登出</span>}
            </button>
          </div>
        </div>
        {/* Main Content */}
        <main className="flex-1 p-4 md:p-8" style={{ minHeight: 0, height: 'calc(100vh - 64px)' }}>
          {/* 儀表板或功能頁 */}
          {!activeTab ? (
            // 儀表板內容
            <div className="p-6 max-w-7xl mx-auto">
              {/* 歡迎區塊 */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-8 text-white mb-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-3xl font-bold mb-2">歡迎回來，{studentInfo?.name}！</h1>
                    <p className="text-blue-100 text-lg">學號：{studentInfo?.studentId}</p>
                    <p className="text-blue-100 mt-2">今天是 {new Date().toLocaleDateString('zh-TW', { 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric',
                      weekday: 'long'
                    })}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-4xl mb-2">📚</div>
                    <p className="text-blue-100">學習愉快！</p>
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
                      <p className="text-2xl font-bold text-gray-900">可預約</p>
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
                <h2 className="text-xl font-bold text-gray-900 mb-6">快速操作</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <button
                    onClick={() => setActiveTab('courses')}
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                  >
                    <div className="p-2 rounded-full bg-blue-100 text-blue-600 mr-4">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12V6a2 2 0 00-2-2H6a2 2 0 00-2 2v6" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">我的課程</h3>
                      <p className="text-sm text-gray-600">查看課程內容與進度</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('grades')}
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-colors"
                  >
                    <div className="p-2 rounded-full bg-green-100 text-green-600 mr-4">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">成績查詢</h3>
                      <p className="text-sm text-gray-600">查看各科成績與評量</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('counseling')}
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-yellow-50 hover:border-yellow-300 transition-colors"
                  >
                    <div className="p-2 rounded-full bg-yellow-100 text-yellow-600 mr-4">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">輔導預約</h3>
                      <p className="text-sm text-gray-600">預約老師輔導時段</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('change-password')}
                    className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-purple-50 hover:border-purple-300 transition-colors"
                  >
                    <div className="p-2 rounded-full bg-purple-100 text-purple-600 mr-4">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-gray-900">修改密碼</h3>
                      <p className="text-sm text-gray-600">更新您的登入密碼</p>
                    </div>
                  </button>

                  {studentInfo?.enrolledCourses && studentInfo.enrolledCourses.length > 0 && (
                    <>
                      <button
                        onClick={() => setActiveTab('attendance')}
                        className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-indigo-50 hover:border-indigo-300 transition-colors"
                      >
                        <div className="p-2 rounded-full bg-indigo-100 text-indigo-600 mr-4">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-gray-900">線上點名</h3>
                          <p className="text-sm text-gray-600">完成課程點名</p>
                        </div>
                      </button>

                      <button
                        onClick={() => setActiveTab('exam')}
                        className="flex items-center p-4 border border-gray-200 rounded-lg hover:bg-red-50 hover:border-red-300 transition-colors"
                      >
                        <div className="p-2 rounded-full bg-red-100 text-red-600 mr-4">
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2a4 4 0 014-4h2" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h.01" />
                          </svg>
                        </div>
                        <div className="text-left">
                          <h3 className="font-semibold text-gray-900">線上測驗</h3>
                          <p className="text-sm text-gray-600">參加線上測驗</p>
                        </div>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            renderContent()
          )}
        </main>
      </div>
    </SecureRoute>
  );
} 