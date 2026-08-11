'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import RichHtmlContent from '@/components/RichHtmlContent';
import { contentDb as db } from '@/lib/firebase-content-client';
import Dropdown from '@/components/ui/Dropdown';
import SiteFooter from '@/components/site/SiteFooter';
import ExamCountdownCarousel, { type ExamCountdownItem } from '@/components/site/ExamCountdownCarousel';
import HotCourseCards from '@/components/site/HotCourseCards';
import HotArticleCards from '@/components/site/HotArticleCards';
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

const sortExams = (list: Exam[]) => {
  const orderMap: Record<string, number> = {
    gsat: 1,
    tcat: 2,
    bcat: 3,
    ast: 4,
  };

  return [...list].sort((a, b) => {
    const orderA = orderMap[a.id] || 999;
    const orderB = orderMap[b.id] || 999;
    return orderA - orderB;
  });
};

export default function Home() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [expandedAnnouncement, setExpandedAnnouncement] = useState<string | null>(null);
  const [announcementPage, setAnnouncementPage] = useState<number>(1);
  const ANNOUNCEMENTS_PER_PAGE = 5;

  const [selectedContentType, setSelectedContentType] = useState<string>('全部');
  const [selectedSubject, setSelectedSubject] = useState<string>('全部');
  const [selectedGrade, setSelectedGrade] = useState<string>('全部');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    const annQ = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(annQ, (snapshot) => {
      const annList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        contentType: doc.data().contentType || doc.data().category || '公告事項',
        createdAt: doc.data().createdAt || doc.data().date,
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
        endDate: doc.data().endDate || '',
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
  const countdownExams: ExamCountdownItem[] = exams;

  return (
    <div className="min-h-full flex flex-col bg-surface text-on-surface">
      <style>{quillDisplayStyles}</style>

      <main className="flex-grow">
        {/* Hero */}
        <section className="relative bg-surface-containerLow overflow-hidden">
          <div className="page-shell py-16 md:py-24 flex flex-col md:flex-row items-center gap-10 md:gap-12">
            <div className="w-full md:w-1/2 z-10">
              <p className="font-mono text-xs font-semibold tracking-widest text-primary mb-3 uppercase">
                Academic Precision
              </p>
              <h1 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-on-surface mb-5 leading-tight">
                精準掌握數學，
                <br />
                <span className="text-primary">在家也能學好</span>
              </h1>
              <p className="text-base sm:text-lg text-on-surfaceVariant mb-8 leading-relaxed max-w-xl">
                透過系統化課程與專業指導，掌握學習新趨勢。加入高中學習資源教育網 2.0，為下一次重要考試做好準備。
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/courses"
                  className="inline-flex items-center justify-center bg-primary text-on-primary px-7 py-3 rounded-lg font-medium hover:bg-primary-container shadow-md transition-colors"
                >
                  立即探索課程
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center border border-primary text-primary px-7 py-3 rounded-lg font-medium hover:bg-primary/5 transition-colors"
                >
                  登入
                </Link>
              </div>
            </div>

            <div className="w-full md:w-1/2 z-10">
              <ExamCountdownCarousel exams={countdownExams} />
            </div>
          </div>
          <div className="absolute top-0 right-0 w-1/2 h-full bg-surface-containerHighest rounded-bl-[200px] -z-0 opacity-50 translate-x-16 pointer-events-none hidden md:block" />
        </section>

        {/* Hot courses */}
        <section className="py-16 md:py-20 bg-surface">
          <div className="page-shell">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-10">
              <div>
                <h2 className="font-display text-2xl md:text-3xl font-extrabold text-on-surface mb-2">熱門課程</h2>
                <p className="text-on-surfaceVariant text-sm sm:text-base">針對不同程度與目標，打造專屬學習進階之路。</p>
              </div>
              <Link href="/courses" className="text-primary font-medium hover:underline inline-flex items-center gap-1 shrink-0">
                查看全部 <i className="fas fa-arrow-right text-xs" aria-hidden />
              </Link>
            </div>
            <HotCourseCards limit={3} />
          </div>
        </section>

        {/* Hot articles */}
        <section className="py-16 md:py-20 bg-surface-containerLow">
          <div className="page-shell">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-10">
              <div>
                <h2 className="font-display text-2xl md:text-3xl font-extrabold text-on-surface mb-2">熱門文章</h2>
                <p className="text-on-surfaceVariant text-sm sm:text-base">精選高閱讀量文章，快速掌握考試攻略與學習觀念。</p>
              </div>
              <Link href="/blog" className="text-primary font-medium hover:underline inline-flex items-center gap-1 shrink-0">
                查看全部 <i className="fas fa-arrow-right text-xs" aria-hidden />
              </Link>
            </div>
            <HotArticleCards limit={3} />
          </div>
        </section>

        {/* Announcements */}
        <section id="announcements" className="py-16 md:py-20 bg-surface">
          <div className="page-shell">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6">
              <h2 className="font-display text-2xl md:text-3xl font-extrabold text-on-surface border-l-4 border-primary pl-4">
                網站公告
              </h2>

              <div className="md:hidden">
                <button
                  onClick={() => setIsFilterOpen(!isFilterOpen)}
                  className="w-full flex items-center justify-between bg-surface-containerLowest px-5 py-4 rounded-xl shadow-sm border border-outline-variant/40 transition-all active:scale-[0.99]"
                >
                  <span className="font-bold text-on-surface flex items-center text-sm">
                    <i className="fas fa-filter mr-2 text-primary"></i>
                    條件篩選與搜尋
                  </span>
                  <i className={`fas fa-chevron-down text-outline transform transition-transform duration-300 ${isFilterOpen ? 'rotate-180' : ''}`}></i>
                </button>
              </div>

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
                filteredAnnouncements.slice((announcementPage - 1) * ANNOUNCEMENTS_PER_PAGE, announcementPage * ANNOUNCEMENTS_PER_PAGE).map((ann) => {
                  const isExpanded = expandedAnnouncement === ann.id;
                  return (
                    <motion.div
                      key={ann.id}
                      className={`bg-surface-containerLowest rounded-xl border border-outline-variant/30 shadow-sm overflow-hidden transition-all ${
                        isExpanded ? 'ring-2 ring-primary shadow-md' : 'hover:shadow-md'
                      }`}
                    >
                      <button className="w-full text-left p-5 flex items-center justify-between group" onClick={() => setExpandedAnnouncement(isExpanded ? null : ann.id)}>
                        <div className="flex-1 pr-4">
                          <div className="flex flex-wrap gap-2 mb-2 items-center">
                            <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${ann.contentType === '公告事項' ? 'bg-orange-100 text-orange-700' : 'bg-primary/10 text-primary'}`}>
                              {ann.contentType}
                            </span>
                            <span className="text-xs text-outline font-mono">
                              <i className="far fa-clock mr-1"></i>{formatDate(ann.createdAt)}
                            </span>
                          </div>
                          <h3 className={`text-lg font-bold text-on-surface group-hover:text-primary transition-colors ${isExpanded ? 'text-primary' : ''}`}>
                            {ann.title}
                          </h3>
                        </div>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all shrink-0 ${isExpanded ? 'bg-primary/10 text-primary rotate-180' : 'bg-surface-container'}`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                        </div>
                      </button>
                      {isExpanded && (
                        <div className="p-5 border-t border-outline-variant/30 bg-surface-containerLow/50">
                          {/<[a-z][\s\S]*>/i.test(ann.content) ? (
                            <div className="ql-snow">
                              <RichHtmlContent
                                html={ann.content}
                                className="ql-editor text-on-surfaceVariant mb-2"
                              />
                            </div>
                          ) : (
                            <div className="prose prose-sm max-w-none text-on-surfaceVariant whitespace-pre-line leading-relaxed">
                              {ann.content}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })
              ) : (
                <div className="text-center py-20 bg-surface-containerLowest rounded-xl border border-dashed border-outline-variant text-on-surfaceVariant">
                  目前沒有符合篩選條件的公告
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 pt-6 flex-wrap">
                  <button
                    onClick={() => setAnnouncementPage(p => Math.max(1, p - 1))}
                    disabled={announcementPage === 1}
                    className="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant/50 bg-surface-containerLowest text-on-surfaceVariant disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-container transition-colors shadow-sm"
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
                          isCurrentPage
                            ? 'bg-primary text-white border-primary'
                            : 'bg-surface-containerLowest border border-outline-variant/50 text-on-surfaceVariant hover:bg-surface-container hover:text-primary'
                        }`}
                      >
                        {pageNumber}
                      </button>
                    );
                  })}

                  <button
                    onClick={() => setAnnouncementPage(p => Math.min(totalPages, p + 1))}
                    disabled={announcementPage === totalPages}
                    className="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant/50 bg-surface-containerLowest text-on-surfaceVariant disabled:opacity-30 disabled:cursor-not-allowed hover:bg-surface-container transition-colors shadow-sm"
                  >
                    <i className="fas fa-chevron-right text-xs"></i>
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
