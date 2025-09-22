'use client';

import React from 'react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getAnnouncements } from '../services/announcementService';
import { getExams, Exam } from '../services/examService';
import Dropdown from './components/ui/Dropdown';
import Footer from './components/Footer';
import LoadingSpinner from './components/LoadingSpinner';

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

// Removed unused getHomePageData function

export default function Home() {
  // 計算倒數天數 (考試前一天為第1天)
  const calculateDaysLeft = (startDate: string) => {
    const now = new Date();
    const target = new Date(startDate);
    
    // 設定為台灣時區
    const taiwanOffset = 8 * 60; // 台灣是 UTC+8
    const userOffset = now.getTimezoneOffset(); // 獲取用戶時區偏移（分鐘）
    const totalOffset = taiwanOffset + userOffset; // 計算總偏移
    
    // 調整時間到台灣時區
    const taiwanTime = new Date(now.getTime() + totalOffset * 60 * 1000);
    taiwanTime.setHours(0, 0, 0, 0); // 設定為當天凌晨
    
    const targetDay = new Date(target);
    targetDay.setHours(0, 0, 0, 0); // 設定目標日期為凌晨
    
    const timeDiff = targetDay.getTime() - taiwanTime.getTime();
    const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return daysLeft - 1; // 考試前一天為第1天，考試當天為第0天
  };

  // 考試資料狀態
  const [exams, setExams] = useState<Exam[]>([]);
  const [countdowns, setCountdowns] = useState<number[]>([]);

  // 公告與課程資料
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<string | null>(null);
  const [announcementPage, setAnnouncementPage] = useState<number>(1);
  const ANNOUNCEMENTS_PER_PAGE = 3;

  // 篩選器狀態
  const [selectedContentType, setSelectedContentType] = useState<string>('全部');
  const [selectedSubject, setSelectedSubject] = useState<string>('全部');
  const [selectedGrade, setSelectedGrade] = useState<string>('全部');

  // 篩選後的公告
  const filteredAnnouncements = announcements
    .slice()
    .sort((a, b) => {
      // createdAt 可能是字串或 Timestamp，統一轉成數字比較
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime; // 新到舊
    })
    .filter(announcement => {
      const contentTypeMatch = selectedContentType === '全部' || announcement.contentType === selectedContentType;
      const subjectMatch = selectedSubject === '全部' || announcement.subject === selectedSubject;
      const gradeMatch = selectedGrade === '全部' || announcement.grade === selectedGrade;
      return contentTypeMatch && subjectMatch && gradeMatch;
    });

  // 更新倒數天數
  useEffect(() => {
    const updateCountdowns = () => {
      const newCountdowns = exams.map(exam => calculateDaysLeft(exam.startDate));
      setCountdowns(newCountdowns);
    };
    updateCountdowns();
    // 暫停自動更新功能
    // const timer = setInterval(updateCountdowns, 1000 * 60 * 60); // 每小時更新一次
    // return () => clearInterval(timer);
  }, [exams]);

  // 檢查本地緩存
  useEffect(() => {
    // 檢查是否有緩存數據可用
    const checkCache = () => {
      // 確保只在客戶端執行
      if (typeof window === 'undefined') return false;
      
      try {
        const cachedAnn = localStorage.getItem('cached_announcements');
        const cachedExm = localStorage.getItem('cached_exams');
        const annCacheTime = localStorage.getItem('announcements_cache_time');
        const exmCacheTime = localStorage.getItem('exams_cache_time');
        
        // 檢查緩存是否過期（24小時）
        const now = Date.now();
        const cacheExpiry = 24 * 60 * 60 * 1000; // 24小時
        
        let hasValidCache = false;
        
        if (cachedAnn && annCacheTime && (now - parseInt(annCacheTime)) < cacheExpiry) {
          try {
            const parsedAnn = JSON.parse(cachedAnn);
            if (Array.isArray(parsedAnn) && parsedAnn.length > 0) {
              console.log('使用緩存的公告數據進行初始渲染');
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
              console.log('使用緩存的考試數據進行初始渲染');
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
    
    // 如果有有效緩存，先顯示緩存數據，然後在後台刷新
    const hasCache = checkCache();
    
    // 無論是否有緩存，都嘗試獲取最新數據
    setLoading(!hasCache); // 如果沒有緩存，顯示加載狀態
    setError(null);
  }, []);
  
  // 檢查是否需要顯示加載狀態
  useEffect(() => {
    // 如果沒有任何數據，顯示加載狀態
    if (announcements.length === 0 && exams.length === 0) {
      setLoading(true);
    } else {
      setLoading(false);
    }
  }, [announcements.length, exams.length]);

  // 取得公告、課程與考試資訊（只在組件掛載時執行一次）
  useEffect(() => {
    // 使用 ref 來追蹤是否已經獲取過數據，避免重複請求
    let isMounted = true;
    
    setError(null);
    
    // 添加增強的重試機制
    const fetchData = async (retryCount = 0, maxRetries = 3) => {
      if (!isMounted) return; // 如果組件已卸載，停止執行
      
      try {
        console.log(`嘗試獲取首頁資料 (嘗試 ${retryCount + 1}/${maxRetries + 1})`);
        
        // 使用單獨的 try-catch 塊分別獲取數據，這樣一個失敗不會影響另一個
        let ann = [];
        let exm = [];
        
        try {
          ann = await getAnnouncements();
          console.log(`成功獲取公告數據: ${Array.isArray(ann) ? ann.length : 0} 條記錄`);
        } catch (annErr) {
          console.error('獲取公告數據失敗:', annErr);
          // 不拋出錯誤，而是使用空數組繼續
        }
        
        try {
          exm = await getExams();
          console.log(`成功獲取考試數據: ${Array.isArray(exm) ? exm.length : 0} 條記錄`);
        } catch (exmErr) {
          console.error('獲取考試數據失敗:', exmErr);
          // 不拋出錯誤，而是使用空數組繼續
        }
        
        // 如果兩個數據源都失敗且還有重試機會，則拋出錯誤以觸發重試
        if ((!ann || ann.length === 0) && (!exm || exm.length === 0) && retryCount < maxRetries) {
          throw new Error('兩個數據源都獲取失敗，將進行重試');
        }
        
        console.log('首頁資料獲取成功');
        
        // 處理公告資料
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
                createdAt: a.createdAt ? a.createdAt.toString() : new Date().toISOString(), // 確保 createdAt 是字符串
                description: typeof a.description === 'string' ? a.description : '',
              };
            }).filter(Boolean) // 過濾掉無效的數據
          : [];
        
        setAnnouncements(processedAnnouncements);
        
        // 處理考試資料
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
            }).filter(Boolean) // 過濾掉無效的數據
          : [];
        
        setExams(processedExams);
        
        // 將處理後的數據保存到本地緩存
        try {
          // 確保只在客戶端執行
          if (typeof window !== 'undefined') {
            if (processedAnnouncements.length > 0) {
              localStorage.setItem('cached_announcements', JSON.stringify(processedAnnouncements));
              localStorage.setItem('announcements_cache_time', Date.now().toString());
              console.log('公告數據已緩存到本地存儲');
            }
            
            if (processedExams.length > 0) {
              localStorage.setItem('cached_exams', JSON.stringify(processedExams));
              localStorage.setItem('exams_cache_time', Date.now().toString());
              console.log('考試數據已緩存到本地存儲');
            }
          }
        } catch (cacheErr) {
          console.error('無法緩存數據到本地存儲:', cacheErr);
        }
        setLoading(false);
      } catch (err) {
        console.error(`首頁資料獲取錯誤 (嘗試 ${retryCount + 1}/${maxRetries + 1}):`, err);
        
        // 如果還有重試次數，則重試
        if (retryCount < maxRetries) {
          // 使用指數退避策略，每次重試延遲時間增加
          const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 10000); // 最大延遲10秒
          console.log(`將在 ${retryDelay}ms 後重試...`);
          
          setTimeout(() => {
            fetchData(retryCount + 1, maxRetries);
          }, retryDelay);
        } else {
          console.error('已達最大重試次數，無法獲取資料');
          // 提供更詳細的錯誤信息
          const errorMessage = err instanceof Error ? err.message : '未知錯誤';
          setLoading(false);
          
          // 嘗試使用本地緩存數據（如果有）
          try {
            // 確保只在客戶端執行
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
                    console.log(`使用本地緩存的公告數據（緩存時間：${annCacheTime ? new Date(parseInt(annCacheTime)).toLocaleString() : '未知'}）`);
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
                    console.log(`使用本地緩存的考試數據（緩存時間：${exmCacheTime ? new Date(parseInt(exmCacheTime)).toLocaleString() : '未知'}）`);
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
          } catch (cacheErr) {
            console.error('無法使用本地緩存:', cacheErr);
            setError(`載入資料時發生錯誤: ${errorMessage}。無法讀取緩存數據。請檢查網絡連接後重新整理頁面。`);
          }
        }
      }
    };
    
    // 開始獲取資料
    fetchData();
    
    // 清理函數
    return () => {
      isMounted = false;
      console.log('首頁資料獲取組件卸載');
    };
  }, []); // 空依賴數組是正確的，因為我們只想在組件掛載時執行一次

  // 重置分頁當篩選器改變時
  useEffect(() => {
    setAnnouncementPage(1);
  }, [selectedContentType, selectedSubject, selectedGrade]);

  // 如果發生錯誤，顯示錯誤訊息
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
      {/* 頁首區塊 */}
      <div className="mb-4 md:mb-8 text-center">
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

      {/* 重要考試時程區塊 */}
      <div className="mb-4 md:mb-8 rounded-xl p-4 md:p-6 bg-blue-600">
        <h2 className="text-2xl md:text-4xl font-bold text-center text-white mb-4 md:mb-8">重要考試時程</h2>
        {loading ? (
          <div className="flex items-center justify-center p-4 md:p-8 py-4 md:py-8">
            <LoadingSpinner size={40} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {exams.sort((a, b) => {
              const order = {
                'gsat': 1, // 學測
                'tcat': 2, // 統測
                'bcat': 3, // 會考
                'ast': 4   // 分科測驗
              };
              return (order[a.id as keyof typeof order] || 999) - (order[b.id as keyof typeof order] || 999);
            }).map((exam, index) => (
              <div key={exam.id} className="bg-white/20 backdrop-blur-sm rounded-lg p-4 md:p-6 text-center">
                <h3 className="text-xl md:text-3xl font-bold text-white mb-4 md:mb-6">{exam.name}</h3>
                <div className="text-base md:text-lg text-white">
                  {exam.startDate}
                  {exam.startDate !== exam.endDate && ` ~ ${exam.endDate}`}
                </div>
                <div className="text-xl md:text-3xl font-bold text-white mt-4 md:mt-6">
                  {countdowns[index] > 0 ? `倒數 ${countdowns[index]} 天` : countdowns[index] === 0 ? '考試開始' : countdowns[index] < 0 ? '已結束' : '考試開始'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 網站公告區塊 */}
      <section id="announcements" className="py-4 md:py-8 bg-white">
        <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8">
          <div className="text-center mb-4 md:mb-8">
            <h2 className="text-2xl md:text-4xl font-bold text-center mb-4 md:mb-8 text-blue-600">網站公告</h2>
            
            {/* 公告篩選器 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 md:mb-8">
              <div className="flex flex-col gap-2 w-full md:flex-row md:gap-4 md:w-auto md:items-center">
                {/* 篩選器1 */}
                <div className="w-full md:w-auto">
                  <Dropdown
                    value={selectedContentType}
                    onChange={setSelectedContentType}
                    options={contentTypeOptions}
                    placeholder="全部類型"
                    className="min-w-[240px] md:min-w-[300px] max-w-full"
                  />
                </div>
                {/* 篩選器2 */}
                <div className="w-full md:w-auto">
                  <Dropdown
                    value={selectedSubject}
                    onChange={setSelectedSubject}
                    options={subjectOptions}
                    placeholder="全部科目"
                    className="min-w-[240px] md:min-w-[300px] max-w-full"
                  />
                </div>
                {/* 篩選器3 */}
                <div className="w-full md:w-auto">
                  <Dropdown
                    value={selectedGrade}
                    onChange={setSelectedGrade}
                    options={gradeOptions}
                    placeholder="全部年級"
                    className="min-w-[240px] md:min-w-[300px] max-w-full"
                  />
                </div>
              </div>
            </div>
          </div>
          
          {filteredAnnouncements.length > 0 ? (
            <div className="space-y-4 w-full">
              {filteredAnnouncements.slice((announcementPage-1)*ANNOUNCEMENTS_PER_PAGE, announcementPage*ANNOUNCEMENTS_PER_PAGE).map((announcement) => (
                <div key={announcement.id} className="border rounded-lg overflow-hidden">
                  <button
                    className="w-full text-left p-4 md:p-6 hover:bg-gray-50 transition-colors flex items-center"
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
                  {expandedAnnouncement === announcement.id && (
                    <div className="p-4 md:p-6 border-t">
                      {/* 標籤顯示 */}
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
                      {/* 連結顯示 */}
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
                                className="inline-block bg-blue-600 text-white px-3 py-1 rounded text-xs sm:text-sm hover:bg-blue-700 transition-colors"
                              >
                                {link.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {/* 分頁按鈕 */}
              {filteredAnnouncements.length > ANNOUNCEMENTS_PER_PAGE && (
                <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-4 md:mt-8">
                  {Array.from({length: Math.ceil(filteredAnnouncements.length/ANNOUNCEMENTS_PER_PAGE)}).map((_, idx) => (
                    <button
                      key={idx}
                      className={`px-4 py-2 rounded transition-colors ${announcementPage === idx+1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-blue-100'}`}
                      onClick={() => setAnnouncementPage(idx+1)}
                    >
                      {idx+1}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-center text-gray-500 text-base md:text-lg">目前沒有符合篩選條件的公告</p>
          )}
        </div>
      </section>
      
      {/* 添加 Footer 组件 */}
      <Footer />
    </main>
  );
}
