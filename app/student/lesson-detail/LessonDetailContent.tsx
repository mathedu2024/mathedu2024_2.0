'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

// 定義範例資料，確保在沒有 localStorage 的預覽環境也能顯示 UI
const MOCK_LESSON: LessonDetail = {
  id: 'mock-1',
  title: '範例課程：微積分基礎 (預覽模式)',
  date: '2023-10-27',
  progress: '第一章：極限與連續',
  attachments: [
    { url: '#', name: '第一章講義.pdf' } as unknown as string,
    { url: '#', name: '習題解答.pdf' } as unknown as string
  ],
  videos: ['https://www.youtube.com/watch?v=5qap5aO4i9A'], // Lofi girl for safe demo
  homework: '請完成課本 p.10-12 的習題。',
  onlineExam: 'https://example.com/exam',
  examScope: '第一章全',
  notes: '下週停課一次，請同學利用時間複習。',
  courseName: '微積分 (一)',
  courseCode: 'MATH101',
  lessonIndex: 1,
  location: '綜合大樓 301',
  description: '這是微積分的基礎課程。'
};

interface LessonDetail {
  id: string;
  title: string;
  date: string;
  progress: string;
  attachments: Array<string | { url: string; name?: string; visibleToStudents?: boolean }>;
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
  order?: number;
}

export default function LessonDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);

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
      } else {
        // 如果沒有資料（預覽環境），使用 Mock Data
        console.log("No local data found, using mock data for preview.");
        setLesson(MOCK_LESSON);
      }
    } catch (error) {
      console.error('Error parsing lesson data:', error);
      // 發生錯誤時也使用 Mock Data 避免畫面空白
      setLesson(MOCK_LESSON);
    } finally {
      setLoading(false);
    }
  }, []);

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

    if (lesson && (lesson.courseCode || lesson.courseId)) {
      const queryId = lesson.courseCode || lesson.courseId;
      router.push(`/student/courses?courseId=${queryId}`);
      return;
    }

    router.push('/student/courses');
  };

  // Loading Skeleton
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-6 md:pt-8 pb-10 flex flex-col h-full">
        <div className="w-full animate-pulse grid grid-cols-1 lg:grid-cols-3 gap-8">
           {/* Header Skeleton */}
          <div className="lg:col-span-3 h-20 bg-gray-200 rounded-2xl mb-4"></div>
           {/* Video Skeleton */}
          <div className="lg:col-span-2">
            <div className="aspect-video bg-gray-200 rounded-2xl mb-4"></div>
          </div>
           {/* Info Skeleton */}
          <div className="lg:col-span-1 space-y-4">
            <div className="h-40 bg-gray-200 rounded-2xl"></div>
            <div className="h-40 bg-gray-200 rounded-2xl"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error State (Fallback)
  if (!lesson) {
    return (
      <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-6 md:pt-8 pb-10 flex flex-col h-full items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-md w-full">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">找不到課程資訊</h2>
          <button
            onClick={handleBack}
            className="w-full bg-indigo-600 text-white px-6 py-3 rounded-xl hover:bg-indigo-700 transition-colors font-medium"
          >
            返回課程列表
          </button>
        </div>
      </div>
    );
  }

  // 準備影片 URL
  const currentEmbedUrl = (lesson.videos && lesson.videos.length > 0) 
    ? getEmbedUrl(lesson.videos[currentVideoIndex]) 
    : null;

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pt-6 md:pt-8 pb-10 flex flex-col h-full animate-fade-in">
        
        {/* Header Section */}
        <div className="mb-8">
          <button
            onClick={handleBack}
            className="group flex items-center text-gray-500 hover:text-indigo-600 mb-4 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center mr-2 group-hover:border-indigo-200 group-hover:bg-indigo-50 shadow-sm">
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </div>
            <span className="font-medium">返回列表</span>
          </button>
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 tracking-tight">
                {lesson.title}
              </h1>
              <div className="flex items-center mt-2 text-gray-500 space-x-4">
                 <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase">
                    第 {lesson.lessonIndex} 堂
                 </span>
                 <span className="flex items-center text-sm">
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                    {lesson.courseName}
                 </span>
                 {lesson.date && (
                   <span className="flex items-center text-sm">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {lesson.date}
                   </span>
                 )}
              </div>
            </div>
          </div>
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
                     {currentEmbedUrl ? (
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

                    {lesson.videos.length > 1 && (
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

            {/* Exam & Homework Section (Placed below video on large screens) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Online Exam Card */}
                {lesson.onlineExam && (
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-24 h-24 bg-green-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
                     <div className="relative z-10">
                        <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center">
                          <span className="w-8 h-8 rounded-lg bg-green-100 text-green-600 flex items-center justify-center mr-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </span>
                          線上測驗
                        </h3>
                        <p className="text-gray-500 text-sm mb-4">請點擊下方按鈕前往測驗平台進行考試。</p>
                        <a 
                          href={lesson.onlineExam} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center text-green-600 font-semibold hover:text-green-700"
                        >
                          開始考試 <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                        </a>
                     </div>
                  </div>
                )}

                {/* Homework Card */}
                {lesson.homework && (
                   <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-4 -mt-4 z-0"></div>
                      <div className="relative z-10">
                         <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center">
                           <span className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center mr-2">
                             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                           </span>
                           回家作業
                         </h3>
                         <div className="text-gray-600 text-sm whitespace-pre-wrap bg-orange-50/50 p-3 rounded-lg border border-orange-100">
                           {lesson.homework}
                         </div>
                      </div>
                   </div>
                )}
            </div>
          </div>

          {/* Right Column: Info & Attachments */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Additional Info Cards (Moved to top) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
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
               {lesson.examScope && (
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
               {lesson.notes && (
                 <div>
                    <h4 className="flex items-center text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                        備註事項
                    </h4>
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-yellow-800 text-sm whitespace-pre-wrap">
                       {lesson.notes}
                    </div>
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
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
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
          </div>
        </div>
    </div>
  );
}