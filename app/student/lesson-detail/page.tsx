'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface LessonDetail {
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
  courseName?: string;
  courseCode?: string;
  courseId?: string;
  lessonIndex?: number;
  location?: string;
  description?: string;
  order?: number; // 新增 order 欄位
}

export default function LessonDetailPage() {
  const router = useRouter();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lessonList, setLessonList] = useState<LessonDetail[]>([]);
  const [lessonListLoading, setLessonListLoading] = useState(true);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  useEffect(() => {
    

    // 從 localStorage 獲取課程資訊
    const lessonData = localStorage.getItem('currentLesson');
    if (lessonData) {
      try {
        const parsedLesson = JSON.parse(lessonData);
        // 並行請求 classdata 和 lessons
        const classdataPromise = fetch(`/api/courses/classdata?courseId=${parsedLesson.courseCode}`)
          .then(res => res.json())
          .catch(() => ({}));
        const lessonsPromise = fetch('/api/courses/lessons', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId: parsedLesson.courseId || parsedLesson.id || parsedLesson.courseCode })
        })
          .then(res => res.json())
          .catch(() => []);
        Promise.all([classdataPromise, lessonsPromise])
          .then(([classData, lessonListData]) => {
            parsedLesson.location = classData.location || '';
            parsedLesson.description = classData.description || '';
            // 依 order 欄位排序課堂清單，若無 order 則用 date
            const sortedLessons = Array.isArray(lessonListData)
              ? [...lessonListData].sort((a, b) => {
                  if ((a.order == null || b.order == null)) {
                    // 若 order 皆無，或有一方無，則用 date 排序
                    const aDate = a.date ? new Date(a.date).getTime() : 0;
                    const bDate = b.date ? new Date(b.date).getTime() : 0;
                    return aDate - bDate;
                  }
                  return (a.order ?? 9999) - (b.order ?? 9999);
                })
              : [];
            setLesson(parsedLesson);
            setLessonList(sortedLessons);
          })
          .finally(() => {
            setLoading(false);
            setLessonListLoading(false);
          });
      } catch (error) {
        console.error('解析課程資料時發生錯誤:', error);
        router.push('/student');
        setLoading(false);
        setLessonListLoading(false);
      }
    } else {
      router.push('/student');
      setLoading(false);
      setLessonListLoading(false);
    }
    
  }, [router]);

  // 將 YouTube URL 轉換為嵌入 URL
  const getEmbedUrl = (url: string) => {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      return null;
    }
  
    let videoId = '';
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) {
        videoId = urlObj.searchParams.get('v')!;
      } else if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1);
      }
    } catch {
      // 如果 URL 無效，則直接返回
      return url;
    }
  
    if (videoId) {
      // Use a simpler set of parameters to avoid playback issues.
      const params = new URLSearchParams({
        rel: '0',
        autoplay: '0',
      });
      return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
    }
  
    return url;
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
    const urlParams = new URLSearchParams(window.location.search);
    const returnTo = urlParams.get('returnTo');
    if (returnTo) {
      router.push(returnTo);
    } else {
      router.push('/student?tab=courses');
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-gray-100 flex items-center justify-center">
        {/* Skeleton UI: 三區塊骨架 */}
        <div className="w-full max-w-6xl px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 animate-pulse">
          {/* C區：課堂清單骨架 */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-md p-4 mb-6 h-[calc(100vh-180px)] flex flex-col">
              <div className="h-6 w-24 bg-gray-200 rounded mb-4" />
              <div className="flex-1 flex flex-col gap-2">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-8 bg-gray-200 rounded mb-1" />
                ))}
              </div>
            </div>
          </div>
          {/* A區：影片骨架 */}
          <div className="lg:col-span-6">
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="aspect-video bg-gray-200 flex items-center justify-center" />
              <div className="p-4 bg-gray-50 border-t flex items-center justify-between">
                <div className="h-8 w-24 bg-gray-200 rounded" />
                <div className="h-6 w-12 bg-gray-200 rounded" />
                <div className="h-8 w-24 bg-gray-200 rounded" />
              </div>
            </div>
          </div>
          {/* B區：課程資訊骨架 */}
          <div className="lg:col-span-3 space-y-6 text-base">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-md p-6">
                <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
                <div className="h-4 w-full bg-gray-200 rounded mb-2" />
                <div className="h-4 w-2/3 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    // 只有在 loading=false 且 lesson=null 時才顯示
    return (
      <div className="h-full bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">找不到課程資訊</h2>
          <button
            onClick={handleBack}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回課程列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      {/* 頂部導航 */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={handleBack}
              className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              返回課程列表
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {lesson.courseName} ({lesson.courseCode})
              </h1>
              <p className="text-sm text-gray-600">
                第 {lesson.lessonIndex} 堂：{lesson.title}
              </p>
            </div>
          </div>
          {/* 漢堡按鈕（手機顯示） */}
          <button className="md:hidden p-2" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        </div>
      </div>
      {/* 主要內容 */}
      <div className="w-full max-w-full px-2 md:px-8 py-4 md:py-8 flex flex-col md:grid md:grid-cols-10 gap-4 md:gap-8">
        {/* C區：課堂清單 */}
        {sidebarOpen && (
          <div className="md:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-2 md:p-4 mb-4 md:mb-6 h-auto md:h-[calc(100vh-180px)] flex flex-col relative">
              <button
                className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded-full shadow hover:bg-gray-100 focus:outline-none absolute top-12 right-2 z-40 md:hidden"
                onClick={() => setSidebarOpen(false)}
                aria-label="收合課堂清單"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="flex items-center mb-4">
                <h3 className="text-base font-bold text-gray-900">課堂清單</h3>
              </div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 text-base">
                {lessonListLoading ? (
                  <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                    <svg className="animate-spin h-6 w-6 mr-2 text-blue-400" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    載入中...
                  </div>
                ) : lessonList.length === 0 ? (
                  <div className="text-gray-400 text-sm">無課堂</div>
                ) : lessonList.map((item, idx) => {
                  let domain = '';
                  let url = '';
                  if (item.videos && item.videos.length > 0) {
                    url = item.videos[0];
                  } else if (item.attachments && item.attachments.length > 0) {
                    const att = item.attachments[0];
                    if (typeof att === 'string') url = att;
                    else if (att && typeof att === 'object' && 'url' in att) url = (att as unknown as { url: string }).url;
                  }
                  if (url) {
                    try {
                      domain = new URL(url).hostname.replace(/^www\./, '');
                    } catch {}
                  }
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        const lessonData = {
                          ...item,
                          courseName: lesson?.courseName,
                          courseCode: lesson?.courseCode,
                          courseId: lesson?.courseId,
                          lessonIndex: idx + 1
                        };
                        setLesson(lessonData);
                        setCurrentVideoIndex(0);
                        localStorage.setItem('currentLesson', JSON.stringify(lessonData));
                      }}
                      className={`text-left px-3 py-2 rounded-lg border transition-colors text-sm mb-1 ${lesson && item.id === lesson.id ? 'bg-blue-100 border-blue-400 font-bold text-blue-700' : 'bg-gray-50 border-gray-200 hover:bg-blue-50'}`}
                    >
                      <div>第 {idx + 1} 堂：{item.title}</div>
                      {domain && <div className="text-xs text-gray-400 mt-1">{domain}</div>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {/* A區：影片播放區域 */}
        <div className="md:col-span-5 flex flex-col">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {lesson.videos && lesson.videos.length > 0 ? (
              <div>
                {/* 影片播放器（強制 16:9） */}
                {(() => {
                  const embedUrl = getEmbedUrl(lesson.videos[currentVideoIndex]);
                  if (!embedUrl) {
                    return (
                      <div className="aspect-video bg-gray-100 flex items-center justify-center">
                        <div className="text-center text-gray-500">
                          <div className="text-4xl mb-2">⚠️</div>
                          <p>無效的影片連結</p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
                      <iframe
                        key={`${lesson.id}-${currentVideoIndex}`}
                        src={embedUrl}
                        title={`影片 ${currentVideoIndex + 1}`}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          border: 0,
                          userSelect: 'none',
                          WebkitUserSelect: 'none',
                          MozUserSelect: 'none',
                          msUserSelect: 'none',
                          pointerEvents: 'auto'
                        }}
                        frameBorder="0"
                         allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
                         allowFullScreen
                        loading="lazy"
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    </div>
                  );
                })()}
                
                {/* 影片控制按鈕 */}
                {lesson.videos.length > 1 && getEmbedUrl(lesson.videos[currentVideoIndex]) && (
                  <div className="p-4 bg-gray-50 border-t">
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => handleVideoChange('prev')}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                        上一部
                      </button>
                      
                      <span className="text-sm text-gray-600">
                        {currentVideoIndex + 1} / {lesson.videos.length}
                      </span>
                      
                      <button
                        onClick={() => handleVideoChange('next')}
                        className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        下一部
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-video bg-gray-100 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <div className="text-4xl mb-2">🎥</div>
                  <p>此課程暫無影片</p>
                </div>
              </div>
            )}
          </div>
        </div>
        {/* B區：課程資訊 */}
        <div className="md:col-span-3 space-y-6 text-base">
          {/* 基本資訊 */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">課程資訊</h3>
            <div className="space-y-3 text-sm">
              {lesson.date && (
                <div>
                  <span className="font-medium text-gray-700">日期：</span>
                  <span className="text-gray-900">{lesson.date}</span>
                </div>
              )}
              
              {lesson.progress && (
                <div>
                  <span className="font-medium text-gray-700">進度：</span>
                  <span className="text-gray-900">{lesson.progress}</span>
                </div>
              )}
            </div>
          </div>

          {/* 附件 */}
          {Array.isArray(lesson.attachments) && (lesson.attachments as unknown[]).filter(a => {
            if (typeof a === 'string') return a && a.trim() !== '';
            if (a && typeof a === 'object' && 'url' in a) return (a as { url: string }).url && (a as { url: string }).url.trim() !== '';
            return false;
          }).length > 0 && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">附件</h3>
              <div className="space-y-2">
                {(lesson.attachments as unknown[])
                  .filter(a => {
                    if (typeof a === 'string') return a && a.trim() !== '';
                    if (a && typeof a === 'object' && 'url' in a) return (a as { url: string }).url && (a as { url: string }).url.trim() !== '';
                    return false;
                  })
                  .map((attachment, idx) => {
                    let url = '';
                    let name = '';
                    if (typeof attachment === 'string') {
                      url = attachment;
                      name = `附件${idx + 1}`;
                    } else if (attachment && typeof attachment === 'object' && 'url' in attachment) {
                      url = (attachment as { url: string }).url;
                      const rawName = (attachment as { name?: string }).name;
                      name = rawName && rawName.trim() !== '' ? rawName : `附件${idx + 1}`;
                    } else {
                      return null;
                    }
                    return (
                      <a
                        key={idx}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center p-3 border border-gray-200 rounded-lg bg-gray-50 hover:bg-blue-50 transition-colors cursor-pointer"
                      >
                        <span className="text-blue-600 mr-2">📎</span>
                        <span className="text-gray-900">{name}</span>
                      </a>
                    );
                  })
                  .filter(Boolean)}
                </div>
              </div>
            )}

          {/* 作業 */}
          {lesson.homework && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">作業</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{lesson.homework}</p>
            </div>
          )}

          {/* 線上考試 */}
          {lesson.onlineExam && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">線上考試</h3>
              <a 
                href={lesson.onlineExam} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <span className="mr-2">📝</span>
                點擊進入考試
              </a>
            </div>
          )}

          {/* 考試範圍 */}
          {lesson.examScope && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">考試範圍</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{lesson.examScope}</p>
            </div>
          )}

          {/* 備註 */}
          {lesson.notes && (
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">備註</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{lesson.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 