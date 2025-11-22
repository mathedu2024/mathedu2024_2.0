'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  BookOpenIcon,
  PencilSquareIcon,
  LinkIcon,
  InformationCircleIcon,
  ArrowDownTrayIcon,
  PencilIcon
} from '@heroicons/react/24/outline';


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
  order?: number;
}

const InfoCard = ({ icon, title, children }: { icon: React.ReactNode, title: string, children: React.ReactNode }) => (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-6">
            <div className="flex items-center mb-4">
        <div className="p-2 bg-blue-100 rounded-full mr-4">
          {React.isValidElement(icon) && typeof icon.type === 'function'
            ? React.cloneElement(icon as React.ReactElement<React.SVGProps<SVGSVGElement>>, { className: "h-6 w-6 text-blue-600" })
            : icon}
        </div>
                <h3 className="text-lg font-bold text-gray-900">{title}</h3>
            </div>
            <div className="text-gray-700 space-y-3 pl-2">
                {children}
            </div>
        </div>
    </div>
);


export default function LessonDetailPage() {
  const router = useRouter();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const lessonData = localStorage.getItem('currentLesson');
    if (lessonData) {
      try {
        const parsedLesson = JSON.parse(lessonData);
        fetch(`/api/courses/classdata?courseId=${parsedLesson.courseCode}`)
          .then(res => res.json())
          .then(classData => {
            parsedLesson.location = classData.location || '';
            parsedLesson.description = classData.description || '';
            setLesson(parsedLesson);
          })
          .catch(() => setLesson(parsedLesson))
          .finally(() => setLoading(false));
      } catch (error) {
        console.error('解析課程資料時發生錯誤:', error);
        router.push('/student');
        setLoading(false);
      }
    } else {
      router.push('/student');
      setLoading(false);
    }
  }, [router]);

  const getEmbedUrl = (url: string) => {
    if (!url || typeof url !== 'string' || url.trim() === '') return null;
    let videoId = '';
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('youtube.com') && urlObj.searchParams.has('v')) {
        videoId = urlObj.searchParams.get('v')!;
      } else if (urlObj.hostname.includes('youtu.be')) {
        videoId = urlObj.pathname.slice(1);
      }
    } catch { return url; }
    if (videoId) {
      const params = new URLSearchParams({ rel: '0', autoplay: '0' });
      return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
    }
    return url;
  };

  const handleVideoChange = (direction: 'prev' | 'next') => {
    if (!lesson?.videos || lesson.videos.length === 0) return;
    setCurrentVideoIndex(prev =>
      direction === 'prev'
        ? (prev === 0 ? lesson.videos.length - 1 : prev - 1)
        : (prev === lesson.videos.length - 1 ? 0 : prev + 1)
    );
  };

  const handleBack = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const returnTo = urlParams.get('returnTo');
    if (lesson?.courseId) {
      router.push(`/student/courses?courseId=${lesson.courseId}`);
    } else if (returnTo) {
      router.push(returnTo);
    } else {
      router.push('/student?tab=courses');
    }
  };

  if (loading) {
    return (
  <div className="h-full bg-white flex items-center justify-center">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8 animate-pulse">
          <div className="lg:col-span-2">
            <div className="aspect-video bg-gray-200 rounded-xl" />
            <div className="mt-4 h-12 bg-gray-200 rounded-lg" />
          </div>
          <div className="lg:col-span-1 space-y-6">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!lesson) {
    return (
  <div className="h-full bg-white flex items-center justify-center">
        <div className="text-center p-8">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">找不到課程資訊</h2>
          <button onClick={handleBack} className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">返回課程列表</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <div className="w-full max-w-7xl mx-auto p-6 animate-fade-in">
        <div className="mb-8">
          <button onClick={handleBack} className="flex items-center text-sm text-gray-500 hover:text-gray-800 mb-4 font-medium">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            返回課程列表
          </button>
          <h1 className="text-3xl font-bold text-gray-900">{lesson.courseName}</h1>
          <p className="text-xl text-gray-600 mt-1">第 {lesson.lessonIndex} 堂：{lesson.title}</p>
        </div>

        <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              {lesson.videos && lesson.videos.length > 0 ? (
                <div>
                  {(() => {
                    const embedUrl = getEmbedUrl(lesson.videos[currentVideoIndex]);
                    return embedUrl ? (
                      <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                        <iframe key={`${lesson.id}-${currentVideoIndex}`} src={embedUrl} title={`影片 ${currentVideoIndex + 1}`} className="absolute top-0 left-0 w-full h-full" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen" allowFullScreen loading="lazy" referrerPolicy="strict-origin-when-cross-origin" />
                      </div>
                    ) : (
                      <div className="aspect-video bg-gray-100 flex items-center justify-center text-gray-500"><div className="text-center"><div className="text-4xl mb-2">⚠️</div><p>無效的影片連結</p></div></div>
                    );
                  })()}
                  {lesson.videos.length > 1 && getEmbedUrl(lesson.videos[currentVideoIndex]) && (
                    <div className="p-4 bg-gray-50 border-t flex items-center justify-between">
                      <button onClick={() => handleVideoChange('prev')} className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"><svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>上一部</button>
                      <span className="text-sm font-medium text-gray-600">{currentVideoIndex + 1} / {lesson.videos.length}</span>
                      <button onClick={() => handleVideoChange('next')} className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium">下一部<svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-video bg-gray-100 flex items-center justify-center text-gray-500"><div className="text-center"><div className="text-4xl mb-2">🎥</div><p>此課程暫無影片</p></div></div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <InfoCard icon={<InformationCircleIcon />} title="課程資訊">
              <div className="flex items-center"><CalendarDaysIcon className="h-5 w-5 text-gray-500 mr-3" /><span className="font-medium text-gray-700">日期：</span><span className="text-gray-900">{lesson.date}</span></div>
              <div>
                <div className="flex items-center">
                  <ClipboardDocumentCheckIcon className="h-5 w-5 text-gray-500 mr-3" />
                  <span className="font-medium text-gray-700">進度：</span>
                </div>
                <p className="text-gray-800 mt-1 ml-8 whitespace-pre-wrap">{lesson.progress}</p>
              </div>
            </InfoCard>

            {Array.isArray(lesson.attachments) && (lesson.attachments as unknown[]).filter(a => {
                if (typeof a === 'string') return a && a.trim() !== '';
                if (a && typeof a === 'object' && 'url' in a) return (a as { url: string }).url && (a as { url: string }).url.trim() !== '';
                return false;
              }).length > 0 && (
              <InfoCard icon={<ArrowDownTrayIcon />} title="附件">
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
                    return <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center p-3 -m-2 rounded-lg hover:bg-gray-100 transition-colors"><LinkIcon className="h-5 w-5 text-gray-500 mr-3" /><span className="text-blue-600 hover:underline">{name}</span></a>;
                  })
                  .filter(Boolean)}
              </InfoCard>
            )}

            {lesson.homework && <InfoCard icon={<BookOpenIcon />} title="作業"><p className="whitespace-pre-wrap">{lesson.homework}</p></InfoCard>}
            {lesson.onlineExam && (
              <InfoCard icon={<PencilIcon />} title="線上考試">
                <a href={lesson.onlineExam} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"><PencilIcon className="h-5 w-5 mr-2" />點擊進入考試</a>
              </InfoCard>
            )}
            {lesson.examScope && <InfoCard icon={<PencilSquareIcon />} title="考試範圍"><p className="whitespace-pre-wrap">{lesson.examScope}</p></InfoCard>}
            {lesson.notes && <InfoCard icon={<InformationCircleIcon />} title="備註"><p className="whitespace-pre-wrap">{lesson.notes}</p></InfoCard>}
          </div>
        </div>
      </div>
    </div>
  );
}