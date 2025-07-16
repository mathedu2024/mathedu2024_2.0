'use client';

import React from 'react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { getAnnouncements } from '../services/announcementService';
import { getExams, Exam } from '../services/examService';
import { Listbox } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';

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
  department?: '高中部' | '國中部';
  links?: Link[];
  createdAt: string; // Changed from 'any' to 'string'
  description: string;
}

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
  const [selectedDepartment, setSelectedDepartment] = useState<string>('全部');

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
      const departmentMatch = selectedDepartment === '全部' || announcement.department === selectedDepartment;
      return contentTypeMatch && subjectMatch && departmentMatch;
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

  // 取得公告、課程與考試資訊
  useEffect(() => {
    setLoading(true);
    setError(null);
    
    Promise.all([
      getAnnouncements().catch(err => {
        console.error('Error fetching announcements:', err);
        return [];
      }),
      getExams().catch(err => {
        console.error('Error fetching exams:', err);
        return [];
      })
    ]).then(([ann, exm]) => {
      setAnnouncements(
        Array.isArray(ann)
          ? ann.map(a => ({
              id: a.id,
              title: typeof a === 'object' && 'title' in a && typeof a.title === 'string' ? a.title : '',
              content: typeof a === 'object' && 'content' in a && typeof a.content === 'string' ? a.content : '',
              contentType: typeof a === 'object' && 'contentType' in a ? a.contentType : undefined,
              subject: typeof a === 'object' && 'subject' in a ? a.subject : undefined,
              department: typeof a === 'object' && 'department' in a ? a.department : undefined,
              links: typeof a === 'object' && 'links' in a && Array.isArray(a.links) ? a.links : undefined,
              createdAt: typeof a === 'object' && 'createdAt' in a ? a.createdAt : '', // Changed from 'any' to 'string'
              description: typeof a === 'object' && 'description' in a && typeof a.description === 'string' ? a.description : '',
            }))
          : []
      );
      setExams(Array.isArray(exm) ? exm : []);
      setLoading(false);
    }).catch(err => {
      console.error('Error in data fetching:', err);
      setError('載入資料時發生錯誤');
      setLoading(false);
    });
  }, []);

  // 重置分頁當篩選器改變時
  useEffect(() => {
    setAnnouncementPage(1);
  }, [selectedContentType, selectedSubject, selectedDepartment]);

  // 如果發生錯誤，顯示錯誤訊息
  if (error) {
    return (
      <main className="min-h-screen p-8 bg-gray-50">
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
    <main className="min-h-screen p-2 sm:p-4 md:p-6 lg:p-8 bg-gray-50">
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
            <div className="loading-spinner h-10 w-10"></div>
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
                  <Listbox value={selectedContentType} onChange={setSelectedContentType}>
                    <div className="relative">
                      <Listbox.Button className="select-unified min-w-[240px] md:min-w-[300px] max-w-full pr-12 flex items-center justify-between">
                        <span className="truncate">{selectedContentType || '全部類型'}</span>
                        <ChevronUpDownIcon className="w-5 h-5 text-gray-400 absolute right-3 pointer-events-none" />
                      </Listbox.Button>
                      <Listbox.Options className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                        <Listbox.Option value="全部" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>全部類型</Listbox.Option>
                        <Listbox.Option value="公告事項" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>公告事項</Listbox.Option>
                        <Listbox.Option value="課程資訊" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>課程資訊</Listbox.Option>
                      </Listbox.Options>
                    </div>
                  </Listbox>
                </div>
                {/* 篩選器2 */}
                <div className="w-full md:w-auto">
                  <Listbox value={selectedSubject} onChange={setSelectedSubject}>
                    <div className="relative">
                      <Listbox.Button className="select-unified min-w-[240px] md:min-w-[300px] max-w-full pr-12 flex items-center justify-between">
                        <span className="truncate">{selectedSubject || '全部科目'}</span>
                        <ChevronUpDownIcon className="w-5 h-5 text-gray-400 absolute right-3 pointer-events-none" />
                      </Listbox.Button>
                      <Listbox.Options className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                        <Listbox.Option value="全部" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>全部科目</Listbox.Option>
                        <Listbox.Option value="數學" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>數學</Listbox.Option>
                        <Listbox.Option value="理化" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>理化</Listbox.Option>
                        <Listbox.Option value="物理" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>物理</Listbox.Option>
                        <Listbox.Option value="化學" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>化學</Listbox.Option>
                        <Listbox.Option value="生物" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>生物</Listbox.Option>
                      </Listbox.Options>
                    </div>
                  </Listbox>
                </div>
                {/* 篩選器3 */}
                <div className="w-full md:w-auto">
                  <Listbox value={selectedDepartment} onChange={setSelectedDepartment}>
                    <div className="relative">
                      <Listbox.Button className="select-unified min-w-[240px] md:min-w-[300px] max-w-full pr-12 flex items-center justify-between">
                        <span className="truncate">{selectedDepartment || '全部部門'}</span>
                        <ChevronUpDownIcon className="w-5 h-5 text-gray-400 absolute right-3 pointer-events-none" />
                      </Listbox.Button>
                      <Listbox.Options className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                        <Listbox.Option value="全部" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>全部部門</Listbox.Option>
                        <Listbox.Option value="高中部" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>高中部</Listbox.Option>
                        <Listbox.Option value="國中部" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>國中部</Listbox.Option>
                      </Listbox.Options>
                    </div>
                  </Listbox>
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
                        {announcement.department && (
                          <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs sm:text-sm rounded-full">
                            {announcement.department}
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

      {/* 在網站公告區塊之後插入聯絡資訊區塊，字體加大 */}
      <div className="mt-4 md:mt-8 pt-4 md:pt-8 border-t border-gray-200">
        <div className="flex flex-col md:flex-row md:justify-center md:space-x-8 gap-2 text-gray-600 text-base md:text-lg font-semibold items-center">
          <div className="text-center md:text-left break-all flex-shrink-0">E-mail：mathedu2024.class@gmail.com</div>
          <div className="text-center md:text-left break-all flex-shrink-0">LINE@：@674ofxrd</div>
        </div>
      </div>

      {/* 課程資訊區塊 */}
      {/* 課程資訊區塊已移除課程列表 */}

    </main>
  );
}
