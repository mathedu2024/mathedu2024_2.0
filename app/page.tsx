'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, getDocs, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import Dropdown from '@/components/ui/Dropdown';

// ==========================================
// 介面定義
// ==========================================

export interface Exam {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  contentType?: '公告事項' | '課程資訊';
  subject?: '數學' | '理化' | '物理' | '化學' | '生物';
  grade?: '國一' | '國二' | '國三' | '高一' | '高二' | '高三' | '職一' | '職二' | '職三' | '大一' | '進修';
  createdAt: unknown;
}

// ==========================================
// 預設/模擬資料 (確保 UI 不會消失)
// ==========================================

const mockExams: Exam[] = [
  { id: 'gsat', name: '學科能力測驗 (學測)', startDate: '2025-01-18', endDate: '2025-01-20' },
  { id: 'tcat', name: '四技二專統一入學測驗 (統測)', startDate: '2025-04-26', endDate: '2025-04-27' },
  { id: 'bcat', name: '國中教育會考 (會考)', startDate: '2025-05-17', endDate: '2025-05-18' },
  { id: 'ast', name: '分科測驗', startDate: '2025-07-11', endDate: '2025-07-12' }
];

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
  { value: '國一', label: '國一' }, { value: '國二', label: '國二' }, { value: '國三', label: '國三' },
  { value: '高一', label: '高一' }, { value: '高二', label: '高二' }, { value: '高三', label: '高三' },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.5 } },
};

// Utility Functions moved outside component to be stable references

const formatDate = (dateInput: unknown) => {
  if (!dateInput) return '無日期';
  try {
    if (typeof dateInput === 'object' && dateInput !== null && 'toDate' in dateInput && typeof (dateInput as { toDate: () => Date }).toDate === 'function') {
      return (dateInput as { toDate: () => Date }).toDate().toLocaleDateString();
    }
    const date = new Date(dateInput as string | number | Date);
    return isNaN(date.getTime()) ? '日期格式錯誤' : date.toLocaleDateString('zh-TW');
  } catch {
    return '日期錯誤';
  }
};

const calculateDaysLeft = (startDate: string) => {
  if (!startDate) return -999;
  const now = new Date();
  const taiwanNow = new Date(now.getTime() + (now.getTimezoneOffset() + 480) * 60000);
  const today = new Date(taiwanNow.getFullYear(), taiwanNow.getMonth(), taiwanNow.getDate());
  
  const targetDate = new Date(startDate);
  const examDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
  
  const timeDiff = examDay.getTime() - today.getTime();
  return Math.floor(timeDiff / (1000 * 3600 * 24));
};

const sortExams = (list: Exam[]) => {
  const orderMap: Record<string, number> = {
    'gsat': 1,
    'tcat': 2,
    'bcat': 3,
    'ast': 4
  };

  return [...list].sort((a, b) => {
    const orderA = orderMap[a.id] || 999;
    const orderB = orderMap[b.id] || 999;
    return orderA - orderB;
  });
};

// ==========================================
// 主程式
// ==========================================

export default function Home() {

  const [exams, setExams] = useState<Exam[]>(sortExams(mockExams));
  const [countdowns, setCountdowns] = useState<number[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<string | null>(null);
  const [announcementPage] = useState<number>(1);
  const ANNOUNCEMENTS_PER_PAGE = 5; 

  const [selectedContentType, setSelectedContentType] = useState<string>('全部');
  const [selectedSubject, setSelectedSubject] = useState<string>('全部');
  const [selectedGrade, setSelectedGrade] = useState<string>('全部');

  // 更新倒數數值
  useEffect(() => {
    if (exams.length > 0) {
      setCountdowns(exams.map(exam => calculateDaysLeft(exam.startDate)));
    }
  }, [exams]);

  // 抓取公告資料 (使用 getDocs，元件掛載時執行一次)
  useEffect(() => {
    const fetchAnnouncements = async () => {
      try {
        const annQ = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
        const annSnap = await getDocs(annQ);

        const annList = annSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          contentType: doc.data().contentType || doc.data().category || '公告事項',
          createdAt: doc.data().createdAt || doc.data().date
        })) as Announcement[];
        setAnnouncements(annList);
      } catch (err) {
        console.error('Fetch announcements error:', err);
      }
    };
    fetchAnnouncements();
  }, []); // 空依賴陣列，表示只在元件掛載時執行一次

  // 監聽考試日期 (使用 onSnapshot 實現即時更新)
  useEffect(() => {
    const exmQ = query(collection(db, 'exam_dates'), orderBy('startDate', 'asc'));

    // 設定 Firestore 即時監聽器
    const unsubscribe = onSnapshot(exmQ, (snapshot) => {
      const exmList = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        startDate: doc.data().startDate || '',
        endDate: doc.data().endDate || ''
      })) as Exam[];
      setExams(sortExams(exmList)); // 更新 exams 狀態，這會觸發 countdowns 的 useEffect
    }, (error) => {
      // 處理監聽錯誤
      console.error('Listen exam dates error:', error);
    });

    // 返回清理函數，在元件卸載時取消訂閱監聽器
    return () => unsubscribe();
  }, []);

  const filteredAnnouncements = announcements.filter(ann => {
    const ctMatch = selectedContentType === '全部' || ann.contentType === selectedContentType;
    const subMatch = selectedSubject === '全部' || ann.subject === selectedSubject;
    const gradeMatch = selectedGrade === '全部' || ann.grade === selectedGrade;
    return ctMatch && subMatch && gradeMatch;
  });

  return (
    <main className="min-h-screen bg-gray-50 pb-20">
      
      <div className="pt-8 pb-6 md:pt-16 md:pb-12 text-center px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-5xl font-bold text-gray-800 mb-4">
            歡迎來到 <span className="text-indigo-600">高中學習資源教育網 2.0</span>
          </h1>
          <p className="text-gray-500 text-lg md:text-xl">在家也能學好數學，掌握學習新趨勢</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* 重要考試時程 - 已修正 UI 顯示邏輯 */}
        <div className="bg-indigo-600 rounded-2xl p-6 md:p-10 shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 flex items-center justify-center">
            <i className="fas fa-calendar-alt mr-3 text-indigo-200"></i> 重要考試時程
          </h2>
          
          <motion.div 
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {exams.map((exam, index) => {
              // 確保倒數數值已計算完成，否則顯示計算中或預設值
              const daysLeft = countdowns[index] !== undefined ? countdowns[index] : calculateDaysLeft(exam.startDate);
              let statusColor = "text-emerald-300";
              if (daysLeft < 0) statusColor = "text-gray-400";
              else if (daysLeft <= 7) statusColor = "text-red-300";

              return (
                <motion.div 
                  key={exam.id} 
                  className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-6 text-center hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-1"
                  variants={itemVariants}
                >
                  <h3 className="text-xl font-bold mb-2 tracking-wide">{exam.name}</h3>
                  <div className="text-indigo-100 text-sm mb-4 font-mono">
                    {exam.startDate} {exam.startDate !== exam.endDate && ` ~ ${exam.endDate}`}
                  </div>
                  <div className={`text-2xl md:text-3xl font-bold ${statusColor}`}>
                    {daysLeft > 0 ? (
                      <>倒數 <span className="text-4xl">{daysLeft}</span> 天</>
                    ) : daysLeft === 0 ? '考試開始' : '已結束'}
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>

        {/* 網站公告 */}
        <section id="announcements">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 border-l-4 border-indigo-500 pl-4">網站公告</h2>
            <div className="flex flex-wrap gap-4 w-full md:w-auto">
              <div className="min-w-[150px] flex-1 md:flex-none">
                <Dropdown value={selectedContentType} onChange={setSelectedContentType} options={contentTypeOptions} placeholder="全部類型" className="w-full" />
              </div>
              <div className="min-w-[150px] flex-1 md:flex-none">
                <Dropdown value={selectedSubject} onChange={setSelectedSubject} options={subjectOptions} placeholder="全部科目" className="w-full" />
              </div>
              <div className="min-w-[150px] flex-1 md:flex-none">
                <Dropdown value={selectedGrade} onChange={setSelectedGrade} options={gradeOptions} placeholder="全部年級" className="w-full" />
              </div>
            </div>
          </div>
          
          <div className="space-y-4">
            {filteredAnnouncements.length > 0 ? (
              filteredAnnouncements.slice((announcementPage-1)*ANNOUNCEMENTS_PER_PAGE, announcementPage*ANNOUNCEMENTS_PER_PAGE).map((ann) => {
                const isExpanded = expandedAnnouncement === ann.id;
                return (
                  <motion.div key={ann.id} className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden transition-all ${isExpanded ? 'ring-2 ring-indigo-500 shadow-md' : 'hover:shadow-md'}`}>
                    <button className="w-full text-left p-5 flex items-center justify-between group" onClick={() => setExpandedAnnouncement(isExpanded ? null : ann.id)}>
                      <div className="flex-1 pr-4">
                        <div className="flex flex-wrap gap-2 mb-2 items-center">
                          <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${ann.contentType === '公告事項' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>{ann.contentType}</span>
                          <span className="text-xs text-gray-400 font-mono"><i className="far fa-clock mr-1"></i>{formatDate(ann.createdAt)}</span>
                        </div>
                        <h3 className={`text-lg font-bold text-gray-800 group-hover:text-indigo-600 transition-colors ${isExpanded ? 'text-indigo-700' : ''}`}>{ann.title}</h3>
                      </div>
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isExpanded ? 'bg-indigo-100 text-indigo-600 rotate-180' : 'bg-gray-100'}`}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </div>
                    </button>
                    {isExpanded && (
                      <div className="p-5 border-t border-gray-100 bg-gray-50/50">
                        <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-line leading-relaxed mb-6">{ann.content}</div>
                      </div>
                    )}
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">目前沒有符合篩選條件的公告</div>
            )}
          </div>
        </section>
      </div>
      
      <footer className="bg-gray-50 border-t border-gray-200 py-8 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">© 2024 高中學習資源教育網. All rights reserved.</div>
      </footer>
    </main>
  );
}