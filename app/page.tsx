'use client';

import React from 'react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { getAnnouncements } from '../services/announcementService';
import { getExams, Exam } from '../services/examService';
import Dropdown from '@/components/ui/Dropdown';
import Footer from '@/components/Footer';
import LoadingSpinner from '@/components/LoadingSpinner';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
    },
  },
};

interface Link {
  name: string;
  url: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  contentType?: '公告事項' | '課程資訊';
  subject?: '數學' | '理化' | '物理' | '化學' | '生物';
  grade?: '國一' | '國二' | '國三' | '高一' | '高二' | '高三' | '職一' | '職二' | '職三' | '大一' | '進修';
  links?: Link[];
  createdAt: string; // Changed from 'any' to 'string'
  description: string;
}

const contentTypeOptions = [
  { value: '全部', label: '全部類型' },
  { value: '公告事項', label: '公告事項' },
  { value: '課程資訊', label: '課程資訊' },
];

const subjectOptions = [
  { value: '全部', label: '全部科目' },
  { value: '數學', label: '數學' },
  { value: '理化', label: '理化' },
  { value: '物理', label: '物理' },
  { value: '化學', label: '化學' },
  { value: '生物', label: '生物' },
];

const gradeOptions = [
  { value: '全部', label: '全部年級' },
  { value: '國一', label: '國一' },
  { value: '國二', label: '國二' },
  { value: '國三', label: '國三' },
  { value: '高一', label: '高一' },
  { value: '高二', label: '高二' },
  { value: '高三', label: '高三' },
  { value: '職一', label: '職一' },
  { value: '職二', label: '職二' },
  { value: '職三', label: '職三' },
  { value: '大一', label: '大一' },
  { value: '進修', label: '進修' },
];

export default function Home() {
  const calculateDaysLeft = (startDate: string) => {
    const now = new Date();
    const target = new Date(startDate);
    const taiwanOffset = 8 * 60;
    const userOffset = now.getTimezoneOffset();
    const totalOffset = taiwanOffset + userOffset;
    const taiwanTime = new Date(now.getTime() + totalOffset * 60 * 1000);
    taiwanTime.setHours(0, 0, 0, 0);
    const targetDay = new Date(target);
    targetDay.setHours(0, 0, 0, 0);
    const timeDiff = targetDay.getTime() - taiwanTime.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysLeft - 1;
  };

  const [exams, setExams] = useState<Exam[]>([]);
  const [countdowns, setCountdowns] = useState<number[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<string | null>(null);
  const [announcementPage, setAnnouncementPage] = useState<number>(1);
  const ANNOUNCEMENTS_PER_PAGE = 3;
  const [selectedContentType, setSelectedContentType] = useState<string>('全部');
  const [selectedSubject, setSelectedSubject] = useState<string>('全部');
  const [selectedGrade, setSelectedGrade] = useState<string>('全部');

  const filteredAnnouncements = announcements
    .slice()
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    })
    .filter(announcement => {
      const contentTypeMatch = selectedContentType === '全部' || announcement.contentType === selectedContentType;
      const subjectMatch = selectedSubject === '全部' || announcement.subject === selectedSubject;
      const gradeMatch = selectedGrade === '全部' || announcement.grade === selectedGrade;
      return contentTypeMatch && subjectMatch && gradeMatch;
    });

  useEffect(() => {
    const updateCountdowns = () => {
      const newCountdowns = exams.map(exam => calculateDaysLeft(exam.startDate));
      setCountdowns(newCountdowns);
    };
    updateCountdowns();
  }, [exams]);

  useEffect(() => {
    const checkCache = () => {
      if (typeof window === 'undefined') return false;
      try {
        const cachedAnn = localStorage.getItem('cached_announcements');
        const cachedExm = localStorage.getItem('cached_exams');
        const annCacheTime = localStorage.getItem('announcements_cache_time');
        const exmCacheTime = localStorage.getItem('exams_cache_time');
        const now = Date.now();
        const cacheExpiry = 24 * 60 * 60 * 1000;
        let hasValidCache = false;
        if (cachedAnn && annCacheTime && (now - parseInt(annCacheTime)) < cacheExpiry) {
          try {
            const parsedAnn = JSON.parse(cachedAnn);
            if (Array.isArray(parsedAnn) && parsedAnn.length > 0) {
              setAnnouncements(parsedAnn);
              hasValidCache = true;
            }
          } catch (parseErr) {
            console.error('解析緩存公告數據時出錯:', parseErr);
          }
        }
        if (cachedExm && exmCacheTime && (now - parseInt(exmCacheTime)) < cacheExpiry) {
          try {
            const parsedExm = JSON.parse(cachedExm);
            if (Array.isArray(parsedExm) && parsedExm.length > 0) {
              setExams(parsedExm);
              hasValidCache = true;
            }
          } catch (parseErr) {
            console.error('解析緩存考試數據時出錯:', parseErr);
          }
        }
        if (hasValidCache) {
          setLoading(false);
        }
        return hasValidCache;
      } catch (err) {
        console.error('檢查緩存時出錯:', err);
        return false;
      }
    };
    const hasCache = checkCache();
    setLoading(!hasCache);
    setError(null);
  }, []);

  useEffect(() => {
    if (announcements.length === 0 && exams.length === 0) {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [announcements.length, exams.length]);

  useEffect(() => {
    let isMounted = true;
    setError(null);
    const fetchData = async (retryCount = 0, maxRetries = 3) => {
      if (!isMounted) return;
      try {
        let ann = [];
        let exm = [];
        try {
          ann = await getAnnouncements();
        } catch (annErr) {
          console.error('獲取公告數據失敗:', annErr);
        }
        try {
          exm = await getExams();
        } catch (exmErr) {
          console.error('獲取考試數據失敗:', exmErr);
        }
        if ((!ann || ann.length === 0) && (!exm || exm.length === 0) && retryCount < maxRetries) {
          throw new Error('兩個數據源都獲取失敗，將進行重試');
        }
        const processedAnnouncements = Array.isArray(ann) && ann.length > 0
          ? ann.map(a => {
              if (!a || typeof a !== 'object') {
                console.warn('Invalid announcement data:', a);
                return null;
              }
              return {
                id: a.id || `temp-${Math.random().toString(36).substring(2, 9)}`,
                title: typeof a.title === 'string' ? a.title : '',
                content: typeof a.content === 'string' ? a.content : '',
                contentType: a.contentType || undefined,
                subject: a.subject || undefined,
                grade: a.grade || undefined,
                links: Array.isArray(a.links) ? a.links : [],
                createdAt: a.createdAt ? a.createdAt.toString() : new Date().toISOString(),
                description: typeof a.description === 'string' ? a.description : '',
              };
            }).filter(Boolean)
          : [];
        setAnnouncements(processedAnnouncements);
        const processedExams = Array.isArray(exm) && exm.length > 0
          ? exm.map(e => {
              if (!e || typeof e !== 'object') {
                console.warn('Invalid exam data:', e);
                return null;
              }
              return {
                id: e.id || `temp-${Math.random().toString(36).substring(2, 9)}`,
                name: typeof e.name === 'string' ? e.name : '',
                startDate: typeof e.startDate === 'string' ? e.startDate : new Date().toISOString().split('T')[0],
                endDate: typeof e.endDate === 'string' ? e.endDate : new Date().toISOString().split('T')[0],
                createdAt: e.createdAt ? e.createdAt.toString() : new Date().toISOString(),
              };
            }).filter(Boolean)
          : [];
        setExams(processedExams);
        if (typeof window !== 'undefined') {
          if (processedAnnouncements.length > 0) {
            localStorage.setItem('cached_announcements', JSON.stringify(processedAnnouncements));
            localStorage.setItem('announcements_cache_time', Date.now().toString());
          }
          if (processedExams.length > 0) {
            localStorage.setItem('cached_exams', JSON.stringify(processedExams));
            localStorage.setItem('exams_cache_time', Date.now().toString());
          }
        }
        setLoading(false);
      } catch (err) {
        if (retryCount < maxRetries) {
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000);
          setTimeout(() => {
            fetchData(retryCount + 1, maxRetries);
          }, retryDelay);
        } else {
          const errorMessage = err instanceof Error ? err.message : '未知錯誤';
          setLoading(false);
          try {
            if (typeof window !== 'undefined') {
              const cachedAnn = localStorage.getItem('cached_announcements');
              const cachedExm = localStorage.getItem('cached_exams');
              const annCacheTime = localStorage.getItem('announcements_cache_time');
              const exmCacheTime = localStorage.getItem('exams_cache_time');
              let hasCache = false;
              if (cachedAnn) {
                try {
                  const parsedAnn = JSON.parse(cachedAnn);
                  if (Array.isArray(parsedAnn) && parsedAnn.length > 0) {
                    setAnnouncements(parsedAnn);
                    hasCache = true;
                  }
                } catch (parseErr) {
                  console.error('解析緩存公告數據時出錯:', parseErr);
                }
              }
              if (cachedExm) {
                try {
                  const parsedExm = JSON.parse(cachedExm);
                  if (Array.isArray(parsedExm) && parsedExm.length > 0) {
                    setExams(parsedExm);
                    hasCache = true;
                  }
                } catch (parseErr) {
                  console.error('解析緩存考試數據時出錯:', parseErr);
                }
              }
              if (hasCache) {
                setError(`使用緩存數據顯示，部分內容可能不是最新。上次更新時間：${new Date(Math.max(
                  annCacheTime ? parseInt(annCacheTime) : 0,
                  exmCacheTime ? parseInt(exmCacheTime) : 0
                )).toLocaleString()}。請檢查網絡連接後重新整理頁面。`);
              } else {
                setError(`載入資料時發生錯誤: ${errorMessage}。請檢查網絡連接後重新整理頁面。`);
              }
            }
          } catch {
            setError(`載入資料時發生錯誤: ${errorMessage}。無法讀取緩存數據。請檢查網絡連接後重新整理頁面。`);
          }
        }
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setAnnouncementPage(1);
  }, [selectedContentType, selectedSubject, selectedGrade]);

  if (error) {
    return (
      <main className="h-full p-8 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">載入錯誤</h1>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            重新載入
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="h-full p-2 sm:p-4 md:p-6 lg:p-8 bg-gray-50">
      <div className="mb-4 md:mb-8 text-center animate-fade-in">
        <div className="bg-white rounded-xl p-4 md:p-6 mb-4 md:mb-8">
          <h1 className="text-2xl md:text-4xl font-bold text-blue-700 mb-4 md:mb-8 text-center">
            <span className="block md:inline">歡迎來到</span>
            <span className="block md:inline">高中學習資源教育網2.0</span>
          </h1>
          <p className="text-gray-600 text-base md:text-lg mb-4 md:mb-8">
            在家也能學好數學
          </p>
        </div>
      </div>

      <div className="mb-4 md:mb-8 rounded-xl p-4 md:p-6 bg-blue-600 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <h2 className="text-2xl md:text-4xl font-bold text-center text-white mb-4 md:mb-8">重要考試時程</h2>
        {loading ? (
          <div className="flex items-center justify-center p-4 md:p-8 py-4 md:py-8">
            <LoadingSpinner size={40} />
          </div>
        ) : (
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {exams.sort((a, b) => {
              const order = {
                'gsat': 1,
                'tcat': 2,
                'bcat': 3,
                'ast': 4
              };
              return (order[a.id as keyof typeof order] || 999) - (order[b.id as keyof typeof order] || 999);
            }).map((exam, index) => (
              <motion.div 
                key={exam.id} 
                className="bg-white/20 backdrop-blur-sm rounded-lg p-4 md:p-6 text-center"
                variants={itemVariants}
              >
                <h3 className="text-xl md:text-3xl font-bold text-white mb-4 md:mb-6">{exam.name}</h3>
                <div className="text-base md:text-lg text-white">
                  {exam.startDate}
                  {exam.startDate !== exam.endDate && ` ~ ${exam.endDate}`}
                </div>
                <div className="text-xl md:text-3xl font-bold text-white mt-4 md:mt-6">
                  {countdowns[index] > 0 ? `倒數 ${countdowns[index]} 天` : countdowns[index] === 0 ? '考試開始' : countdowns[index] < 0 ? '已結束' : '考試開始'}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <section id="announcements" className="py-4 md:py-8 bg-white animate-fade-in" style={{ animationDelay: '0.2s' }}>
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="text-center mb-4 md:mb-8">
            <h2 className="text-2xl md:text-4xl font-bold text-center mb-4 md:mb-8 text-blue-600">網站公告</h2>
            
            <div className="flex flex-col sm:flex-row flex-wrap justify-center items-center gap-4 mb-4 md:mb-8">
              <Dropdown
                value={selectedContentType}
                onChange={setSelectedContentType}
                options={contentTypeOptions}
                placeholder="全部類型"
                className="w-full sm:w-auto sm:min-w-[200px]"
              />
              <Dropdown
                value={selectedSubject}
                onChange={setSelectedSubject}
                options={subjectOptions}
                placeholder="全部科目"
                className="w-full sm:w-auto sm:min-w-[200px]"
              />
              <Dropdown
                value={selectedGrade}
                onChange={setSelectedGrade}
                options={gradeOptions}
                placeholder="全部年級"
                className="w-full sm:w-auto sm:min-w-[200px]"
              />
            </div>
          </div>
          
          {filteredAnnouncements.length > 0 ? (
            <motion.div 
              className="space-y-4 w-full"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              {filteredAnnouncements.slice((announcementPage-1)*ANNOUNCEMENTS_PER_PAGE, announcementPage*ANNOUNCEMENTS_PER_PAGE).map((announcement) => (
                <motion.div 
                  key={announcement.id} 
                  className="border rounded-lg overflow-hidden"
                  variants={itemVariants}
                >
                  <button
                    className="w-full text-left p-4 md:p-6 hover:bg-gray-50 flex items-center"
                    onClick={() => setExpandedAnnouncement(expandedAnnouncement === announcement.id ? null : announcement.id)}
                    style={{ color: 'rgb(70, 131, 229)' }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex-1">
                        <div className="text-lg md:text-2xl font-normal">{announcement.title}</div>
                      </div>
                      <svg
                        className={`w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 transform transition-transform ${expandedAnnouncement === announcement.id ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  <div
                    className={`transition-[max-height,opacity] duration-300 ease-in-out overflow-hidden ${expandedAnnouncement === announcement.id ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-4 md:p-6 border-t">
                      <div className="flex flex-wrap gap-2 mb-4 md:mb-6">
                        {announcement.contentType && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs sm:text-sm rounded-full">
                            {announcement.contentType}
                          </span>
                        )}
                        {announcement.subject && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs sm:text-sm rounded-full">
                            {announcement.subject}
                          </span>
                        )}
                        {announcement.grade && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs sm:text-sm rounded-full">
                            {announcement.grade}
                          </span>
                        )}
                      </div>
                      <p className="text-sm md:text-base text-black whitespace-pre-line mb-4 md:mb-6">{announcement.content}</p>
                      {announcement.links && announcement.links.length > 0 && (
                        <div className="mt-4 md:mt-6">
                          <div className="text-sm md:text-base font-medium text-gray-700 mb-2">相關連結：</div>
                          <div className="flex flex-wrap gap-2">
                            {announcement.links.map((link, index) => (
                              <a
                                key={index}
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block bg-blue-600 text-white px-3 py-1 rounded text-xs sm:text-sm hover:bg-blue-700"
                              >
                                {link.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
              {filteredAnnouncements.length > ANNOUNCEMENTS_PER_PAGE && (
                <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-4 md:mt-8">
                  {Array.from({length: Math.ceil(filteredAnnouncements.length/ANNOUNCEMENTS_PER_PAGE)}).map((_, idx) => (
                    <button
                      key={idx}
                      className={`px-3 py-1 sm:px-4 sm:py-2 rounded ${announcementPage === idx+1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-blue-100'}`}
                      onClick={() => setAnnouncementPage(idx+1)}
                    >
                      {idx+1}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <p className="text-center text-gray-500 text-base md:text-lg">目前沒有符合篩選條件的公告</p>
          )}
        </div>
      </section>
      
      <Footer />
    </main>
  );
}
