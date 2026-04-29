'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { 
  ChartBarIcon,
  FunnelIcon, 
  ExclamationCircleIcon 
} from '@heroicons/react/24/outline';

import StudentCourseSelector, { isCourseArchived } from './StudentCourseSelector';
import LoadingSpinner from './LoadingSpinner';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Simple Modal Component (Local definition to ensure compatibility if ui/Modal is not available or differs)
const Modal = ({ open, onClose, title, size = 'md', children }: { open: boolean; onClose: () => void; title: string; size?: 'md' | 'lg'; children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 animate-fade-in">
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${size === 'lg' ? 'max-w-4xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto animate-bounce-in border border-gray-100`}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};

interface GradeData {
  courseId?: string;
  columns: Record<string, { name: string; type: string; date: string; }>;
  student: StudentGradeRow | null;
  totalSetting?: { regularDetail?: Record<string, { calcMethod: string; n?: number; percent: number; }>; periodicEnabled?: Record<string, boolean>; periodicPercent: number; showTotalGradeToStudents?: boolean; };
  periodicScores?: string[];
}

interface CourseInfo { id: string; name: string; code: string; teacherName?: string; status?: string; archived?: boolean; }

interface DistributionData {
  statistics: {
    平均: number | null;
    頂標: number | null;
    前標: number | null;
    均標: number | null;
    後標: number | null;
    底標: number | null;
  };
  distribution: { range: string; count: number }[];
}

interface StudentGradeViewerProps {
  studentInfo: {
    id: string;
    name: string;
    studentId: string;
  };
}

type StudentGradeRow = { studentId: string; regularScores?: Record<string, number>; periodicScores?: Record<string, number>; manualAdjust?: number; };

export default function StudentGradeViewer({ studentInfo }: StudentGradeViewerProps) {
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [gradeData, setGradeData] = useState<GradeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedTab, setSelectedTab] = useState<'total' | 'regular' | 'periodic'>('total');
  const [dateRange, setDateRange] = useState({ from: '', to: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [selectedGradeForChart, setSelectedGradeForChart] = useState<{ name: string; type: string; date: string; idx: string; score: number | undefined; } | null>(null);
  const [distributionData, setDistributionData] = useState<DistributionData | null>(null);
  const [teacherNamesMap, setTeacherNamesMap] = useState<Record<string, string>>({});

  const [allGrades, setAllGrades] = useState<Record<string, GradeData>>({});

  const fetchDistributionForChart = async (gradeItem: { name: string; type: string; date: string; idx: string; score: number | undefined; }) => {
    if (selectedGradeForChart?.idx === gradeItem.idx) {
      setSelectedGradeForChart(null);
      setDistributionData(null);
      return;
    }

    if (!selectedCourse || gradeItem.score === undefined) return;
    setSelectedGradeForChart(gradeItem);
    setDistributionData(null); // Show loading state in modal
    try {
      const gd = allGrades[selectedCourse];
      const res = await fetch('/api/grades/distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: gd?.courseId,
          courseKey: selectedCourse,
          columnId: gradeItem.idx,
          scoreKind: gradeItem.type === '定期評量' ? 'periodic' : 'regular',
        }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || '無法載入成績分布資料');
      }
      const data = await res.json();
      setDistributionData(data as DistributionData);
    } catch (e: unknown) {
      setError((e as Error).message || '載入成績分布時發生未知錯誤');
    }
  };

  const handleSelectGrade = (gradeItem: { name: string; type: string; date: string; idx: string; score: number | undefined; }) => {
    // Only open modal if there is a score
    if (gradeItem.score !== undefined) {
      fetchDistributionForChart(gradeItem);
    }
  };

  const handleSelectPeriodicGrade = (name: string, score: number | undefined) => {
    if (score === undefined) return;

    const gradeItem = {
      name: name, type: '定期評量', date: '', // Date is not available for periodic scores here
      idx: name, // Use the name as the identifier for the API call
      score: score,
    };
    fetchDistributionForChart(gradeItem);
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!studentInfo || !studentInfo.id) return;

      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/student/dashboard-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: studentInfo.id }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || '無法載入資料');
        }

        const data = await res.json();
        // 過濾掉已封存的課程資料
        const activeCourses = (data.courses || [])
          .filter((c: CourseInfo) => c && !isCourseArchived(c));
        setCourses(activeCourses);
        setAllGrades(data.grades);

        // Fetch teacher names
        const teachersRes = await fetch('/api/teacher/list');
        if (!teachersRes.ok) {
          throw new Error('無法載入教師列表');
        }
        const teachersData = await teachersRes.json();
        const namesMap: Record<string, string> = {};
        teachersData.forEach((teacher: { id: string; name: string }) => {
          namesMap[teacher.id] = teacher.name;
        });
        setTeacherNamesMap(namesMap);
      } catch (e: unknown) {
        setError((e as Error).message || '載入資料時發生未知錯誤');
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData().catch(error => {
      console.error('Unhandled error in loadDashboardData:', error);
    });
  }, [studentInfo]);

  useEffect(() => {
    if (selectedCourse && allGrades[selectedCourse]) {
      setGradeData(allGrades[selectedCourse]);
    } else {
      setGradeData(null);
    }
  }, [selectedCourse, allGrades]);

  const studentGrade = gradeData?.student;

  // 計算各項加權平均與最終總成績
  const gradeSummaries = useMemo(() => {
    if (!gradeData || !studentGrade) return { total: '0', regWeighted: '0.0', pAvg: '0.0' };
    
    const { regularDetail, periodicEnabled, periodicPercent = 50 } = gradeData.totalSetting || {};
    
    // 1. 平時加權成績計算
    const avg = (v: number[]) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    const byType = (t: string) => Object.entries(studentGrade.regularScores || {})
      .filter(([k]) => gradeData.columns?.[k]?.type === t)
      .map(([,v]) => Number(v))
      .filter(n => !isNaN(n));
    const bestN = (v: number[], n?: number) => (!n || n <= 0) ? avg(v) : avg([...v].sort((a,b)=>b-a).slice(0, Math.min(n, v.length)));
    
    const q = byType('小考'); 
    const h = byType('作業'); 
    const a = byType('上課態度');
    
    const qAvg = (regularDetail?.['小考']?.calcMethod === 'best') ? bestN(q, regularDetail?.['小考']?.n) : avg(q);
    const hAvg = (regularDetail?.['作業']?.calcMethod === 'best') ? bestN(h, regularDetail?.['作業']?.n) : avg(h);
    const aAvg = (regularDetail?.['上課態度']?.calcMethod === 'best') ? bestN(a, regularDetail?.['上課態度']?.n) : avg(a);
    
    const qPct = Number(regularDetail?.['小考']?.percent) || 0;
    const hPct = Number(regularDetail?.['作業']?.percent) || 0;
    const aPct = Number(regularDetail?.['上課態度']?.percent) || 0;
    
    const regTotalWeight = qPct + hPct + aPct;
    const regWeightedNumeric = regTotalWeight > 0 ? (qAvg * qPct + hAvg * hPct + aAvg * aPct) / regTotalWeight : 0;

    // 2. 定期評量平均計算 (僅計算有勾選採計的項目)
    const pEnabledNames = ['第一次定期評量', '第二次定期評量', '期末評量'].filter(name => periodicEnabled?.[name] !== false);
    const pScores = pEnabledNames.map(name => studentGrade.periodicScores?.[name]).filter((v): v is number => v !== undefined && v !== null);
    const pAvgNumeric = pScores.length > 0 ? pScores.reduce((a, b) => a + b, 0) / pScores.length : 0;

    // 3. 最終學期總成績計算
    const regWeightPct = Number(periodicPercent); // 平時佔比
    const totalNumeric = Math.round(regWeightedNumeric * (regWeightPct / 100) + pAvgNumeric * ((100 - regWeightPct) / 100));

    return {
      total: totalNumeric.toString(),
      regWeighted: regWeightedNumeric.toFixed(1),
      pAvg: pAvgNumeric.toFixed(1)
    };
  }, [gradeData, studentGrade]);

  const filteredRegularScores = useMemo(() => {
    if (!gradeData || !gradeData.student) return [] as { name: string; type: string; date: string; idx: string; score: number | undefined; }[];
    
    const target = gradeData.student;
    
    const { from, to } = dateRange;
    return Object.entries(gradeData.columns)
        .filter(([, col]) => (!from && !to) || (!from || col.date >= from) && (!to || col.date <= to))
        .map(([key, col]) => ({ ...col, idx: key, score: target.regularScores?.[key] } as { name: string; type: string; date: string; idx: string; score: number | undefined; }));
  }, [gradeData, dateRange]);

  const paginatedScores = filteredRegularScores.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredRegularScores.length / itemsPerPage);
  
  const showTotalGrade = gradeData?.totalSetting?.periodicEnabled?.['showTotalGradeToStudents'] !== false;

  const getTeacherNames = () => {
    const lastOpenIdx = selectedCourse.lastIndexOf('(');
    const lastCloseIdx = selectedCourse.lastIndexOf(')');
    if (lastOpenIdx !== -1 && lastCloseIdx > lastOpenIdx) {
      const courseName = selectedCourse.substring(0, lastOpenIdx);
      const courseCode = selectedCourse.substring(lastOpenIdx + 1, lastCloseIdx);
      const matchingCourse = courses.find(c => c.name === courseName && c.code === courseCode);
      if (matchingCourse) {
        if (matchingCourse.teacherName && teacherNamesMap[matchingCourse.teacherName]) {
          return teacherNamesMap[matchingCourse.teacherName];
        }
        return matchingCourse.teacherName || '未指定教師';
      }
    }
    return '未指定教師';
  };

  const getSelectedCourseInfo = () => {
    const lastOpenIdx = selectedCourse.lastIndexOf('(');
    const lastCloseIdx = selectedCourse.lastIndexOf(')');
    if (lastOpenIdx !== -1 && lastCloseIdx > lastOpenIdx) {
      const courseName = selectedCourse.substring(0, lastOpenIdx);
      const courseCode = selectedCourse.substring(lastOpenIdx + 1, lastCloseIdx);
      return { name: courseName, code: courseCode };
    }
    return { name: selectedCourse, code: selectedCourse };
  };

  const chartData = useMemo(() => ({
    labels: filteredRegularScores.map(s => s.name),
    datasets: [
      {
        label: '成績',
        data: filteredRegularScores.map(s => s.score),
        backgroundColor: 'rgba(79, 70, 229, 0.6)', // Indigo-600 with opacity
        borderRadius: 4,
      },
    ],
  }), [filteredRegularScores]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '個人成績趨勢',
        color: '#4b5563', // gray-600
        font: {
            size: 16,
            weight: 'bold' as const
        }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        grid: {
            color: '#e5e7eb' // gray-200
        }
      },
      x: {
        grid: {
            display: false
        }
      }
    },
  }), []);

  return (
      <div className="w-full">
        {/* The title has been moved to the parent page (app/student/grades/page.tsx) for consistency. */}
        
        <StudentCourseSelector
            courses={courses}
            selectedCourse={selectedCourse}
            onChange={value => {setSelectedCourse(value); setCurrentPage(1);}}
            error={error}
            onErrorClear={() => setError(null)}
        />
    
        {loading && (
            <div className="flex flex-col justify-center items-center py-20">
                <LoadingSpinner size={40} />
                <p className="text-gray-500 mt-4 font-medium">資料讀取中...</p>
            </div>
        )}
    
        {!selectedCourse && !loading && courses.length === 0 && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-8 text-center shadow-sm">
                <ExclamationCircleIcon className="w-12 h-12 text-amber-300 mx-auto mb-3" />
                <p className="text-amber-800 font-medium">您目前沒有選修任何課程，無法查詢成績。</p>
            </div>
        )}

        {!selectedCourse && !loading && courses.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-8 text-center shadow-sm">
                <div className="w-16 h-16 bg-indigo-100 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ChartBarIcon className="w-8 h-8" />
                </div>
                <p className="text-indigo-800 font-medium text-lg">請選擇一個課程來查看成績詳情</p>
            </div>
        )}

        {selectedCourse && !loading && (
        <div className="space-y-6 animate-fade-in">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                            {getSelectedCourseInfo().name} <span className="font-normal text-gray-500 text-base ml-1">({getSelectedCourseInfo().code})</span>
                        </h3>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                            <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium mr-2">授課教師</span>
                            {getTeacherNames()}
                        </div>
                    </div>
                </div>
                
                <div className="border-b border-gray-100 mb-6">
                    <nav className="flex space-x-1">
                        <button onClick={() => setSelectedTab('total')} className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${selectedTab === 'total' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'}`}>總成績</button>
                        <button onClick={() => setSelectedTab('regular')} className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${selectedTab === 'regular' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'}`}>平時成績</button>
                        <button onClick={() => setSelectedTab('periodic')} className={`px-4 py-3 text-sm font-bold transition-all border-b-2 ${selectedTab === 'periodic' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-200'}`}>定期評量</button>
                    </nav>
                </div>
        
                <div className="animate-fade-in">
                    {selectedTab === 'total' && (
                        <div>
                            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <span className="w-1 h-6 bg-indigo-500 rounded-full mr-2"></span>
                                總成績概況
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                {/* 總成績卡片 - 醒目顯示 */}
                                <div className="p-5 bg-gradient-to-br from-indigo-600 to-indigo-800 border border-indigo-700 rounded-xl shadow-md text-white">
                                    <div className="text-xs font-bold text-indigo-100 uppercase tracking-wider mb-1">學期總成績</div>
                                    <div className="text-4xl font-black">
                                        {!showTotalGrade ? '未公布' : studentGrade ? gradeSummaries.total : '未評分'}
                                    </div>
                                    <div className="text-[10px] text-indigo-200 mt-2 flex justify-between">
                                        <span>{showTotalGrade ? '依權重比例計算' : '老師尚未公布總成績'}</span>
                                        {showTotalGrade && studentGrade && <span className={Number(gradeSummaries.total) < 60 ? 'text-red-300 font-bold' : ''}>{Number(gradeSummaries.total) < 60 ? '不及格' : '及格'}</span>}
                                    </div>
                                </div>
                                
                                <div className="p-5 bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => setSelectedTab('regular')}>
                                    <div className="text-xs font-bold text-indigo-500 uppercase tracking-wider mb-1">平時加權成績</div>
                                    <div className="text-3xl font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                        {studentGrade ? gradeSummaries.regWeighted : '未評分'}
                                    </div>
                                    <div className="text-xs text-gray-400 mt-2 flex items-center">
                                        點擊查看詳情 <svg className="w-3 h-3 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                    </div>
                                </div>
                                {['第一次定期評量', '第二次定期評量', '期末評量'].map(name => {
                                    const score = studentGrade?.periodicScores?.[name];
                                    const hasScore = score !== undefined && score !== null;
                                    return (
                                        <div 
                                            key={name} 
                                            className={`p-5 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md transition-shadow ${hasScore ? 'cursor-pointer' : ''}`}
                                            onClick={() => hasScore && handleSelectPeriodicGrade(name, score)}
                                        >
                                            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{name}</div>
                                            <div className="text-3xl font-bold text-gray-900">
                                                {hasScore ? score : <span className="text-gray-300 text-xl font-normal">未評分</span>}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}          
                    {selectedTab === 'regular' && (
                        <div>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                <h4 className="text-lg font-bold text-gray-800 flex items-center">
                                    <span className="w-1 h-6 bg-indigo-500 rounded-full mr-2"></span>
                                    平時成績列表
                                </h4>
                                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto bg-gray-50 p-2 rounded-xl border border-gray-100">
                                    <div className="flex items-center gap-2">
                                        <FunnelIcon className="w-4 h-4 text-gray-400 ml-2" />
                                        <input type="date" value={dateRange.from} onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                                        <span className="text-gray-400">-</span>
                                        <input type="date" value={dateRange.to} onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
                                    </div>
                                    <button onClick={() => setDateRange({ from: '', to: '' })} className="text-xs font-medium text-gray-500 hover:text-indigo-600 px-3 py-1.5 hover:bg-white rounded-lg transition-colors">清除篩選</button>
                                </div>
                            </div>
                            
                            <div className="overflow-hidden rounded-xl border border-gray-200 mb-6">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">項目名稱</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">類型</th>
                                            <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">日期</th>
                                            <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">分數</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {paginatedScores.length > 0 ? (
                                            paginatedScores.map((col, index) => (
                                                <tr key={index} onClick={() => handleSelectGrade(col)} className="cursor-pointer hover:bg-indigo-50/50 transition-colors group">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 group-hover:text-indigo-700">{col.name}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        <span className={`px-2 py-1 rounded text-xs font-medium ${col.type === '小考' ? 'bg-blue-50 text-blue-700' : col.type === '作業' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                                            {col.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{col.date}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-center">
                                                        {col.score !== undefined ? (
                                                            <span className={`text-sm font-bold ${col.score < 60 ? 'text-red-500' : 'text-gray-900'}`}>{col.score}</span>
                                                        ) : (
                                                            <span className="text-xs text-gray-400">未評分</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">此區間無成績資料</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            
                            {totalPages > 1 && (
                                <div className="flex justify-center gap-2 mt-6">
                                    {Array.from({length: totalPages}).map((_, idx) => (
                                        <button
                                            key={idx}
                                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${currentPage === idx+1 ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                            onClick={() => setCurrentPage(idx+1)}
                                        >
                                            {idx+1}
                                        </button>
                                    ))}
                                </div>
                            )}
                            
                            <div className="mt-8 pt-8 border-t border-gray-100">
                                <h5 className="font-bold text-gray-800 mb-4 flex items-center">
                                    <ChartBarIcon className="w-5 h-5 mr-2 text-indigo-500" />
                                    成績趨勢分析
                                </h5>
                                <div className="bg-white p-4 rounded-xl border border-gray-100 h-[300px]">
                                    <Bar data={chartData} options={chartOptions} />
                                </div>
                            </div>
                        </div>
                    )}

                    {selectedTab === 'periodic' && (
                        <div>
                            <h4 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <span className="w-1 h-6 bg-indigo-500 rounded-full mr-2"></span>
                                定期評量詳細
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                {['第一次定期評量','第二次定期評量','期末評量'].map(name => {
                                    const score = studentGrade?.periodicScores?.[name];
                                    return (
                                        <div 
                                            key={name} 
                                            className={`bg-white border border-gray-200 rounded-xl p-6 text-center hover:border-indigo-300 hover:shadow-md transition-all ${score !== undefined ? 'cursor-pointer' : ''}`}
                                            onClick={() => score !== undefined && handleSelectPeriodicGrade(name, score)}
                                        >
                                            <div className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{name}</div>
                                            <div className={`text-4xl font-bold ${score !== undefined && score < 60 ? 'text-red-500' : 'text-indigo-600'}`}>
                                                {score ?? <span className="text-gray-300 text-2xl">--</span>}
                                            </div>
                                            <div className="mt-2 h-1 w-12 mx-auto bg-gray-100 rounded-full overflow-hidden">
                                                {score !== undefined && (
                                                    <div className="h-full bg-indigo-500" style={{ width: `${Math.min(score, 100)}%` }}></div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
        )}

        <Modal
            open={!!selectedGradeForChart && !!distributionData}
            onClose={() => {
                setSelectedGradeForChart(null);
                setDistributionData(null);
            }}
            title={`${selectedGradeForChart?.name} - 成績分布`}
            size="lg"
        >
            {selectedGradeForChart && distributionData && (() => {
                const studentScore = selectedGradeForChart.score;

                const getFivePointInterval = (score: number, stats: DistributionData['statistics']): string => {
                    if (score === undefined || score === null) return '';
                    if (score >= (stats.頂標 ?? Infinity)) return '頂標';
                    if (score >= (stats.前標 ?? Infinity)) return '前標';
                    if (score >= (stats.均標 ?? Infinity)) return '均標';
                    if (score >= (stats.後標 ?? Infinity)) return '後標';
                    if (score >= (stats.底標 ?? -Infinity)) return '底標';
                    return '未達底標';
                };

                const isScoreInDistributionRange = (score: number | undefined, range: string): boolean => {
                    if (score === undefined || score === null) return false;
                    switch (range) {
                        case '90-100': return score >= 90 && score <= 100;
                        case '80-89': return score >= 80 && score < 90;
                        case '70-79': return score >= 70 && score < 80;
                        case '60-69': return score >= 60 && score < 70;
                        case '50-59': return score >= 50 && score < 60;
                        case '<50': return score < 50;
                        default: return false;
                    }
                };

                const fivePointInterval = studentScore !== undefined ? getFivePointInterval(studentScore, distributionData.statistics) : '';

                return (
                    <div className="space-y-8">
                        <div className="bg-indigo-50 p-6 rounded-xl border border-indigo-100 text-center">
                            <h5 className="font-bold text-indigo-900 mb-2 uppercase tracking-wide text-xs">您的分數</h5>
                            <div className="text-5xl font-extrabold text-indigo-600">
                                {selectedGradeForChart.score ?? '未評分'}
                            </div>
                            {fivePointInterval && (
                                <span className="inline-block mt-2 px-3 py-1 bg-white text-indigo-600 rounded-full text-xs font-bold border border-indigo-100 shadow-sm">
                                    {fivePointInterval}
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div>
                                <h5 className="font-bold text-gray-800 mb-4 flex items-center">
                                    <ChartBarIcon className="w-5 h-5 mr-2 text-indigo-500" /> 五標統計
                                </h5>
                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-100">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">項目</th>
                                                <th className="px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">分數</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {[
                                                { label: '頂標', value: distributionData.statistics.頂標 },
                                                { label: '前標', value: distributionData.statistics.前標 },
                                                { label: '均標', value: distributionData.statistics.均標 },
                                                { label: '後標', value: distributionData.statistics.後標 },
                                                { label: '底標', value: distributionData.statistics.底標 },
                                                { label: '平均', value: distributionData.statistics.平均, isAvg: true },
                                            ].map((stat, idx) => (
                                                <tr key={idx} className={`${fivePointInterval === stat.label ? 'bg-indigo-50' : ''} ${stat.isAvg ? 'bg-gray-50 font-bold' : ''}`}>
                                                    <td className={`px-4 py-3 text-sm ${fivePointInterval === stat.label ? 'text-indigo-700 font-bold' : 'text-gray-700'}`}>{stat.label}</td>
                                                    <td className={`px-4 py-3 text-sm text-right ${fivePointInterval === stat.label ? 'text-indigo-700 font-bold' : 'text-gray-900'}`}>{stat.value ?? '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div>
                                <h5 className="font-bold text-gray-800 mb-4 flex items-center">
                                    <ChartBarIcon className="w-5 h-5 mr-2 text-indigo-500" /> 成績分布
                                </h5>
                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-100">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider w-20">區間</th>
                                                <th className="px-4 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider w-16">人數</th>
                                                <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">比例</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {distributionData.distribution.map((d: { range: string; count: number }, index: number) => {
                                                const totalCount = distributionData.distribution.reduce((sum, item) => sum + item.count, 0);
                                                const percentage = totalCount > 0 ? Math.round((d.count / totalCount) * 100) : 0;
                                                const isMyRange = isScoreInDistributionRange(studentScore, d.range);
                                                
                                                return (
                                                    <tr key={index} className={isMyRange ? 'bg-indigo-50' : ''}>
                                                        <td className={`px-4 py-2 text-sm ${isMyRange ? 'font-bold text-indigo-700' : 'text-gray-600'}`}>{d.range}</td>
                                                        <td className={`px-4 py-2 text-sm text-center ${isMyRange ? 'font-bold text-indigo-700' : 'text-gray-900'}`}>{d.count}</td>
                                                        <td className="px-4 py-2 align-middle">
                                                            <div className="flex items-center">
                                                                <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden mr-2">
                                                                    <div 
                                                                        className={`h-full rounded-full ${isMyRange ? 'bg-indigo-500' : 'bg-gray-400'}`} 
                                                                        style={{ width: `${percentage}%` }}
                                                                    ></div>
                                                                </div>
                                                                <span className="text-xs text-gray-400 w-8 text-right">{percentage}%</span>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </Modal>
    </div>
  );
}