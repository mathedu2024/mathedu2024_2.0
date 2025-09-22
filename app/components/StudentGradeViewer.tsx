'use client';

import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

import { Modal } from './ui';
import Dropdown from './ui/Dropdown';
import LoadingSpinner from './LoadingSpinner';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface GradeData {
  columns: Record<string, { name: string; type: string; date: string; }>;
  student: StudentGradeRow | null;
  totalSetting?: { regularDetail?: Record<string, { calcMethod: string; n?: number; percent: number; }>; periodicEnabled?: Record<string, boolean>; periodicPercent: number; };
  periodicScores?: string[];
}

interface CourseInfo { id: string; name: string; code: string; teacherName?: string; }

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

  const handleSelectGrade = async (gradeItem: { name: string; type: string; date: string; idx: string; score: number | undefined; }) => {
    if (selectedGradeForChart?.idx === gradeItem.idx) {
      setSelectedGradeForChart(null);
      setDistributionData(null);
      return;
    }

    if (!selectedCourse) return;
    setSelectedGradeForChart(gradeItem);
    setDistributionData(null);
    try {
      const res = await fetch('/api/grades/distribution', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseKey: selectedCourse, columnId: gradeItem.idx }),
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

  const [allGrades, setAllGrades] = useState<Record<string, GradeData>>({});

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
        setCourses(data.courses);
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

    loadDashboardData();
  }, [studentInfo]);

  useEffect(() => {
    if (selectedCourse && allGrades[selectedCourse]) {
      setGradeData(allGrades[selectedCourse]);
    } else {
      setGradeData(null);
    }
  }, [selectedCourse, allGrades]);

  const studentGrade = gradeData?.student;

  const calcRegularScore = (student: StudentGradeRow): number => {
    if (!gradeData || !student) return 0;
    const { regularDetail } = gradeData.totalSetting || {};
    const avg = (v: number[]) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    const byType = (t: string) => Object.entries(student.regularScores || {}).filter(([k]) => gradeData.columns?.[k]?.type === t).map(([,v]) => Number(v)).filter(n => !isNaN(n));
    const bestN = (v: number[], n?: number) => (!n || n <= 0) ? avg(v) : avg([...v].sort((a,b)=>b-a).slice(0, Math.min(n, v.length)));
    const q = byType('小考'); const h = byType('作業'); const a = byType('上課態度');
    const qAvg = (regularDetail?.['小考']?.calcMethod === 'best') ? bestN(q, regularDetail?.['小考']?.n) : avg(q);
    const hAvg = (regularDetail?.['作業']?.calcMethod === 'best') ? bestN(h, regularDetail?.['作業']?.n) : avg(h);
    const aAvg = (regularDetail?.['上課態度']?.calcMethod === 'best') ? bestN(a, regularDetail?.['上課態度']?.n) : avg(a);
    const qPct = Number(regularDetail?.['小考']?.percent) || 0;
    const hPct = Number(regularDetail?.['作業']?.percent) || 0;
    const aPct = Number(regularDetail?.['上課態度']?.percent) || 0;
    return qAvg * qPct / 100 + hAvg * hPct / 100 + aAvg * aPct / 100;
  };

  const calcRegularDisplay = (student: StudentGradeRow): string => {
    if (!gradeData || !student) return '0.0';
    const weighted = calcRegularScore(student);
    const totalPercent = (Number(gradeData.totalSetting?.regularDetail?.['小考']?.percent) || 0) + (Number(gradeData.totalSetting?.regularDetail?.['作業']?.percent) || 0) + (Number(gradeData.totalSetting?.regularDetail?.['上課態度']?.percent) || 0);
    if (!weighted || totalPercent === 0) return '0.0';
    return (weighted / (totalPercent / 100)).toFixed(1);
  };

  const filteredRegularScores = () => {
    if (!gradeData || !gradeData.student) return [] as { name: string; type: string; date: string; idx: string; score: number | undefined; }[];
    
    const target = gradeData.student;
    
    const { from, to } = dateRange;
    return Object.entries(gradeData.columns)
        .filter(([, col]) => (!from && !to) || (!from || col.date >= from) && (!to || col.date <= to))
        .map(([key, col]) => ({ ...col, idx: key, score: target.regularScores?.[key] } as { name: string; type: string; date: string; idx: string; score: number | undefined; }));
  };

  const paginatedScores = filteredRegularScores().slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filteredRegularScores().length / itemsPerPage);

  const getTeacherNames = () => {
    if (selectedCourse.includes('(') && selectedCourse.includes(')')) {
      const courseName = selectedCourse.split('(')[0];
      const courseCode = selectedCourse.split('(')[1].replace(')', '');
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
    if (selectedCourse.includes('(') && selectedCourse.includes(')')) {
      const courseName = selectedCourse.split('(')[0];
      const courseCode = selectedCourse.split('(')[1].replace(')', '');
      return { name: courseName, code: courseCode };
    }
    return { name: selectedCourse, code: selectedCourse };
  };

  const chartData = {
    labels: filteredRegularScores().map(s => s.name),
    datasets: [
      {
        label: '成績',
        data: filteredRegularScores().map(s => s.score),
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: '個人成績趨勢',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
      },
    },
  };

  return (
      <div className="max-w-6xl mx-auto w-full p-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">成績查詢</h2>
        </div>

        <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">選擇課程</label>
        <Dropdown
          value={selectedCourse}
          onChange={value => {setSelectedCourse(value); setCurrentPage(1);}}
          options={[{ value: '', label: '請選擇課程' }, ...courses.map(course => ({ value: `${course.name}(${course.code})`, label: `${course.name}（${course.code}）` }))]}
          placeholder="請選擇課程"
          className="w-1/3 min-w-[240px]"
        />
        {error && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
            <button onClick={() => setError(null)} className="mt-2 text-red-600 hover:text-red-800 text-sm underline">關閉錯誤訊息</button>
          </div>
        )}
    </div>
    
    {loading && (
      <div className="flex justify-center py-8">
          <div className="text-center">
            <LoadingSpinner size={32} text="載入中..." />
          </div>
        </div>
    )}
    
      {!selectedCourse && !loading && courses.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">您目前沒有選修任何課程，無法查詢成績。</p>
        </div>
      )}

      {!selectedCourse && !loading && courses.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
          <p className="text-blue-800">請選擇一個課程來查看成績</p>
        </div>
      )}

      {selectedCourse && !loading && gradeData && (
      <div>
        <div className="text-blue-700 font-bold text-lg mb-2">
          {getSelectedCourseInfo().name}（{getSelectedCourseInfo().code}）
          <span className="ml-4 text-base font-normal text-blue-500">授課教師：{getTeacherNames()}</span>
        </div>
        
        <div className="border-b mb-4">
          <nav className="flex">
              <button onClick={() => setSelectedTab('total')} className={`px-6 py-3 text-sm font-medium ${selectedTab === 'total' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>總成績</button>
              <button onClick={() => setSelectedTab('regular')} className={`px-6 py-3 text-sm font-medium ${selectedTab === 'regular' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>平時成績</button>
              <button onClick={() => setSelectedTab('periodic')} className={`px-6 py-3 text-sm font-medium ${selectedTab === 'periodic' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>定期評量</button>
          </nav>
        </div>
        
        <div>
          {selectedTab === 'total' && (
            <div>
              <h4 className="text-lg font-semibold mb-4">總成績概況</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                <div className="p-4 border rounded text-center">
                  <div className="text-sm text-blue-600 font-medium cursor-pointer" onClick={() => setSelectedTab('regular')}>平時成績</div>
                    <div className="text-2xl font-bold text-blue-800">{studentGrade ? calcRegularDisplay(studentGrade) : '未評分'}</div>
                  </div>
                  {['第一次定期評量','第二次定期評量','期末評量'].map(name => (
                    <div key={name} className="p-4 border rounded text-center">
                      <div className="text-sm text-blue-600 font-medium cursor-pointer">{name}</div>
                      <div className="text-2xl font-bold text-blue-800">{studentGrade ? (studentGrade.periodicScores?.[name] ?? '未評分') : '未評分'}</div>
                </div>
                  ))}
              </div>
            </div>
          )}
          
          {selectedTab === 'regular' && (
            <div>
              <h4 className="text-lg font-semibold mb-4">平時成績</h4>
              <div className="mb-4 flex gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
                    <input type="date" value={dateRange.from} onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))} className="border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
                    <input type="date" value={dateRange.to} onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))} className="border rounded px-3 py-2" />
                </div>
                <div className="flex items-end">
                    <button onClick={() => setDateRange({ from: '', to: '' })} className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600">清除篩選</button>
                </div>
              </div>
              
              <div className="mb-6">
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-200 px-4 py-2">項目</th>
                        <th className="border border-gray-200 px-4 py-2">類型</th>
                        <th className="border border-gray-200 px-4 py-2">日期</th>
                        <th className="border border-gray-200 px-4 py-2">分數</th>
                      </tr>
                    </thead>
                    <tbody>
                        {paginatedScores.map((col, index: number) => (
                        <tr key={index} onClick={() => handleSelectGrade(col)} className="cursor-pointer hover:bg-gray-50">
                          <td className="border border-gray-200 px-4 py-2">{col.name}</td>
                            <td className="border border-gray-200 px-4 py-2">{col.type}</td>
                            <td className="border border-gray-200 px-4 py-2">{col.date}</td>
                            <td className="border border-gray-200 px-4 py-2 text-center">{col.score ?? '未評分'}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* 分頁按鈕 - 參考首頁公告的樣式 */}
              {totalPages > 1 && (
                <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mt-4 md:mt-8">
                  {Array.from({length: totalPages}).map((_, idx) => (
                    <button
                      key={idx}
                      className={`px-4 py-2 rounded transition-colors ${currentPage === idx+1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-blue-100'}`}
                      onClick={() => setCurrentPage(idx+1)}
                    >
                      {idx+1}
                    </button>
                  ))}
                </div>
              )}
              
              {/* 趨勢分析圖表 */}
              <div className="mb-6 mt-6">
                <h5 className="font-semibold mb-3">趨勢分析</h5>
                <div style={{ height: '300px' }}>
                  <Bar data={chartData} options={chartOptions} />
                </div>
              </div>
            </div>
          )}

          {selectedTab === 'periodic' && (
            <div>
              <h4 className="text-lg font-semibold mb-4">定期評量</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['第一次定期評量','第二次定期評量','期末評量'].map(name => (
                  <div key={name} className="p-4 border rounded text-center">
                    <div className="text-sm text-blue-600 font-medium">{name}</div>
                    <div className="text-2xl font-bold text-blue-800">{studentGrade ? (studentGrade.periodicScores?.[name] ?? '未評分') : '未評分'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      <Modal
        open={!!selectedGradeForChart && !!distributionData}
        onClose={() => {
          setSelectedGradeForChart(null);
          setDistributionData(null);
        }}
        title={`${selectedGradeForChart?.name} - 成績詳細資料`}
        size="lg"
      >
        {selectedGradeForChart && distributionData && (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h5 className="font-semibold text-blue-800 mb-2">您的分數</h5>
              <div className="text-3xl font-bold text-blue-600">
                {selectedGradeForChart.score ?? '未評分'}
              </div>
            </div>

            <div>
              <h5 className="font-semibold mb-3">五標統計</h5>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">項目</th>
                      <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 border-b">分數</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-4 py-2 text-sm text-gray-900 border-b">頂標</td>
                      <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900 border-b">
                        {distributionData.statistics.頂標 ?? '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-sm text-gray-900 border-b">前標</td>
                      <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900 border-b">
                        {distributionData.statistics.前標 ?? '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-sm text-gray-900 border-b">均標</td>
                      <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900 border-b">
                        {distributionData.statistics.均標 ?? '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-sm text-gray-900 border-b">後標</td>
                      <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900 border-b">
                        {distributionData.statistics.後標 ?? '-'}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 text-sm text-gray-900 border-b">底標</td>
                      <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900 border-b">
                        {distributionData.statistics.底標 ?? '-'}
                      </td>
                    </tr>
                    <tr className="bg-gray-50">
                      <td className="px-4 py-2 text-sm font-medium text-gray-900">平均</td>
                      <td className="px-4 py-2 text-center text-sm font-bold text-gray-900">
                        {distributionData.statistics.平均 ?? '-'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h5 className="font-semibold mb-3">成績分布</h5>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200 rounded-lg">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 border-b">分數區間</th>
                      <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 border-b">人數</th>
                      <th className="px-4 py-2 text-center text-sm font-medium text-gray-700 border-b">長條圖</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distributionData.distribution.map((d: { range: string; count: number }, index: number) => (
                      <tr key={index}>
                        <td className="px-4 py-2 text-sm text-gray-900 border-b">{d.range}</td>
                        <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900 border-b">
                          {d.count}
                        </td>
                        <td className="px-4 py-2 border-b">
                          <div className="flex items-center">
                            <div className="w-20 bg-gray-200 rounded-full h-2 mr-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full" 
                                style={{ 
                                  width: `${Math.max(5, (d.count / Math.max(...distributionData.distribution.map((item: { range: string; count: number }) => item.count))) * 100)}%` 
                                }}
                              ></div>
                            </div>
                            <span className="text-xs text-gray-500">
                              {Math.round((d.count / distributionData.distribution.reduce((sum: number, item: { range: string; count: number }) => sum + item.count, 0)) * 100)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="mt-6">
              <h5 className="font-semibold mb-3">成績分布圖</h5>
              <div style={{ height: '400px' }}>
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
