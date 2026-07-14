'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import RichHtmlContent from '@/components/RichHtmlContent';
import { db } from '../firebase';
import Dropdown from '@/components/ui/Dropdown';
import 'react-quill-new/dist/quill.snow.css';

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

const quillDisplayStyles = `
  .ql-snow .ql-editor {
    padding: 0;
  }
  .ql-snow .ql-size-small {
    font-size: 0.85em;
  }
  .ql-snow .ql-size-large {
    font-size: 1.5em;
  }
  .ql-snow .ql-size-huge {
    font-size: 2.5em;
  }
  .ql-snow .ql-editor ol, .ql-snow .ql-editor ul {
    padding-left: 1.5em;
  }
  .ql-snow .ql-editor ol > li, .ql-snow .ql-editor ul > li {
    list-style-type: none;
  }
  .ql-snow .ql-editor ol {
    counter-reset: list-1;
  }
  .ql-snow .ql-editor ol > li::before {
    counter-increment: list-1;
    content: counter(list-1, decimal) ". ";
    margin-left: -1.5em;
    margin-right: 0.3em;
    text-align: right;
    white-space: nowrap;
    width: 1.2em;
    display: inline-block;
    line-height: inherit;
  }
  .ql-snow .ql-editor ul > li::before {
    content: '•';
    margin-left: -1.5em;
    margin-right: 0.3em;
    text-align: center;
    white-space: nowrap;
    width: 1.2em;
    display: inline-block;
    line-height: inherit;
  }
`;

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

export default function Home() {

  const [exams, setExams] = useState<Exam[]>([]);
  const [countdowns, setCountdowns] = useState<number[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<string | null>(null);
  const [announcementPage, setAnnouncementPage] = useState<number>(1);
  const ANNOUNCEMENTS_PER_PAGE = 5; 

  const [selectedContentType, setSelectedContentType] = useState<string>('全部');
  const [selectedSubject, setSelectedSubject] = useState<string>('全部');
  const [selectedGrade, setSelectedGrade] = useState<string>('全部');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    if (exams.length > 0) {
      setCountdowns(exams.map(exam => calculateDaysLeft(exam.startDate)));
    }
  }, [exams]);

  useEffect(() => {
    const annQ = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(annQ, (snapshot) => {
      const annList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        contentType: doc.data().contentType || doc.data().category || '公告事項',
        createdAt: doc.data().createdAt || doc.data().date
      })) as Announcement[];
      setAnnouncements(annList);
    }, (err) => {
      console.error('Listen announcements error:', err);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const exmQ = query(collection(db, 'exam_dates'), orderBy('startDate', 'asc'));

    const unsubscribe = onSnapshot(exmQ, (snapshot) => {
      const exmList = snapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().name || '',
        startDate: doc.data().startDate || '',
        endDate: doc.data().endDate || ''
      })) as Exam[];
      setExams(sortExams(exmList));
    }, (error) => {
      console.error('Listen exam dates error:', error);
    });

    return () => unsubscribe();
  }, []);

  const filteredAnnouncements = React.useMemo(() => {
    return announcements.filter(ann => {
    const ctMatch = selectedContentType === '全部' || ann.contentType === selectedContentType;
    const subMatch = selectedSubject === '全部' || ann.subject === selectedSubject;
    const gradeMatch = selectedGrade === '全部' || ann.grade === selectedGrade;
    return ctMatch && subMatch && gradeMatch;
    });
  }, [announcements, selectedContentType, selectedSubject, selectedGrade]);

  useEffect(() => {
    setAnnouncementPage(1);
  }, [selectedContentType, selectedSubject, selectedGrade]);

  const totalPages = Math.ceil(filteredAnnouncements.length / ANNOUNCEMENTS_PER_PAGE);

  return (
    <main className="min-h-screen bg-gray-50">
      <style>{quillDisplayStyles}</style>
      
      <div className="pt-4 pb-4 sm:pt-8 sm:pb-6 md:pt-16 md:pb-12 text-center px-3 sm:px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold text-gray-800 mb-4">
            歡迎來到 <span className="text-indigo-600">高中學習資源教育網 2.0</span>
          </h1>
          <p className="text-gray-500 text-lg md:text-xl">在家也能學好數學，掌握學習新趨勢</p>
        </div>
      </div>

      <div className="page-shell space-y-12">
        
      
        <div className="bg-indigo-600 rounded-2xl p-4 sm:p-6 md:p-10 shadow-xl text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl"></div>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-4 sm:mb-6 md:mb-8 flex items-center justify-center gap-2">
            <i className="fas fa-calendar-alt text-indigo-200"></i>
            <span>重要考試時程</span>
          </h2>
          
          <motion.div 
            className="grid grid-cols-4 gap-1.5 sm:gap-3 md:gap-6"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
          >
            {exams.length > 0 ? exams.map((exam, index) => {
              const daysLeft = countdowns[index] !== undefined ? countdowns[index] : calculateDaysLeft(exam.startDate);
              let statusColor = "text-emerald-300";
              if (daysLeft < 0) statusColor = "text-gray-400";
              else if (daysLeft <= 7) statusColor = "text-red-300";

              return (
                <motion.div 
                  key={exam.id} 
                  className="bg-white/10 backdrop-blur-md border border-white/20 rounded-lg sm:rounded-xl p-2 sm:p-4 md:p-6 text-center hover:bg-white/20 transition-all duration-300 transform hover:-translate-y-1 min-w-0"
                  variants={itemVariants}
                >
                  <h3 className="text-[11px] sm:text-base md:text-xl font-bold mb-1 sm:mb-2 tracking-wide leading-tight line-clamp-2">{exam.name}</h3>
                  <div className="text-indigo-100 text-[9px] sm:text-xs md:text-sm mb-2 sm:mb-4 font-mono leading-snug break-words">
                    {exam.startDate}{exam.startDate !== exam.endDate ? ` ~ ${exam.endDate}` : ''}
                  </div>
                  <div className={`text-sm sm:text-2xl md:text-3xl font-bold ${statusColor}`}>
                    {daysLeft > 0 ? (
                      <>倒數 <span className="text-lg sm:text-3xl md:text-4xl tabular-nums">{daysLeft}</span> 天</>
                    ) : daysLeft === 0 ? '考試開始' : '已結束'}
                  </div>
                </motion.div>
              );
            }) : (
              <div className="col-span-4 text-center py-8 text-indigo-100/80 text-sm">
                尚無考試時程資料
              </div>
            )}
          </motion.div>
        </div>

        {/* 網站公告 */}
        <section id="announcements">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 border-l-4 border-indigo-500 pl-4">網站公告</h2>

            {/* 手機版：展開/收合觸發按鈕 */}
            <div className="md:hidden">
              <button
                onClick={() => setIsFilterOpen(!isFilterOpen)}
                className="w-full flex items-center justify-between bg-white px-5 py-4 rounded-xl shadow-sm border border-gray-100 transition-all active:scale-[0.99]"
              >
                <span className="font-bold text-gray-700 flex items-center text-sm">
                  <i className="fas fa-filter mr-2 text-indigo-500"></i>
                  條件篩選與搜尋
                </span>
                <i className={`fas fa-chevron-down text-gray-400 transform transition-transform duration-300 ${isFilterOpen ? 'rotate-180' : ''}`}></i>
              </button>
            </div>

            {/* 篩選器內容：手機版具備收合動畫，電腦版保持顯示 */}
            <div className={`
              md:block transition-all duration-300 ease-in-out w-full md:w-auto
              ${isFilterOpen ? 'max-h-[1000px] opacity-100 overflow-visible mt-2' : 'max-h-0 md:max-h-none opacity-0 md:opacity-100 overflow-hidden md:overflow-visible'}
            `}>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <Dropdown value={selectedContentType} onChange={setSelectedContentType} options={contentTypeOptions} placeholder="類型" className="w-full sm:w-36" />
                <Dropdown value={selectedSubject} onChange={setSelectedSubject} options={subjectOptions} placeholder="科目" className="w-full sm:w-36" />
                <Dropdown value={selectedGrade} onChange={setSelectedGrade} options={gradeOptions} placeholder="年級" className="w-full sm:w-36" />
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
                        {/<[a-z][\s\S]*>/i.test(ann.content) ? (
                          <div className="ql-snow">
                            <RichHtmlContent
                              html={ann.content}
                              className="ql-editor text-gray-600 mb-6"
                            />
                          </div>
                        ) : (
                          <div className="prose prose-sm max-w-none text-gray-600 whitespace-pre-line leading-relaxed mb-6">{ann.content}</div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })
            ) : (
              <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300 text-gray-500">目前沒有符合篩選條件的公告</div>
            )}

            {/* 分頁控制 UI */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 pt-6 flex-wrap">
                <button 
                  onClick={() => setAnnouncementPage(p => Math.max(1, p - 1))}
                  disabled={announcementPage === 1}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <i className="fas fa-chevron-left text-xs"></i>
                </button>
                
                {Array.from({ length: totalPages }).map((_, idx) => {
                  const pageNumber = idx + 1;
                  const isCurrentPage = announcementPage === pageNumber;
                  return (
                    <button
                      key={pageNumber}
                      onClick={() => setAnnouncementPage(pageNumber)}
                      className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm ${
                        isCurrentPage ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-200'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                <button 
                  onClick={() => setAnnouncementPage(p => Math.min(totalPages, p + 1))}
                  disabled={announcementPage === totalPages}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <i className="fas fa-chevron-right text-xs"></i>
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
      
      <footer className="bg-gray-50 border-t border-gray-200 pt-8 pb-6 mt-20">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500 text-sm">© 2024 高中學習資源教育網. All rights reserved.</div>
      </footer>
    </main>
  );
}