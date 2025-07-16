'use client';

import React, { useState, useEffect } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';

interface StudentGradeViewerProps {
  studentInfo: {
    id: string;
    name: string;
    studentId: string;
    enrolledCourses?: string[];
  };
}

interface CourseInfo {
  id: string;
  name: string;
  code: string;
  teachers?: string[];
}

interface StudentGradeRow {
  id: string;
  studentId: string;
  name: string;
  grade: string;
  regularScores: { [columnId: string]: number | undefined };
  periodicScores: { [name: string]: number | undefined };
  totalScore: number;
  manualAdjust: number;
  remark?: string;
}

interface GradeData {
  students: StudentGradeRow[];
  columns: Record<string, { type: string; name: string; date: string }>;
  regularSettings: unknown[];
  periodicScores: string[];
  totalSetting: {
    regularPercent: number;
    periodicPercent: number;
    manualAdjust: number;
    regularDetail: Record<string, { percent: number; calcMethod: string; n?: number }>;
    periodicEnabled?: Record<string, boolean>; // 新增：定期評量啟用設定
  };
  teacherId: string;
  teacherName: string;
  teacherIds?: string[];
  teacherNames?: string[];
}

// 五標計算
function getTaiwanPercentileLevels(scores: number[]) {
  if (scores.length === 0) return { 頂標: null, 前標: null, 均標: null, 後標: null, 底標: null, 平均: null };
  const sorted = [...scores].sort((a, b) => b - a); // 由高到低
  const n = sorted.length;
  const levels: { [k: string]: number | null } = { 頂標: null, 前標: null, 均標: null, 後標: null, 底標: null, 平均: null };
  
  // 平均
  levels['平均'] = parseFloat((scores.reduce((a, b) => a + b, 0) / n).toFixed(2));
  
  // 計算各標的分數
  for (let i = 0; i < n; i++) {
    const percentile = (n - i) / n;
    const score = sorted[i];
    
    // 頂標: 前12%（百分位 ≥ 0.88）
    if (percentile >= 0.88 && levels['頂標'] === null) {
      levels['頂標'] = score;
    }
    // 前標: 前25%（0.75 ≤ 百分位 < 0.88）
    else if (percentile >= 0.75 && percentile < 0.88 && levels['前標'] === null) {
      levels['前標'] = score;
    }
    // 均標: 前50%（0.50 ≤ 百分位 < 0.75）
    else if (percentile >= 0.50 && percentile < 0.75 && levels['均標'] === null) {
      levels['均標'] = score;
    }
    // 後標: 後段25%（0.25 ≤ 百分位 < 0.50）
    else if (percentile >= 0.25 && percentile < 0.50 && levels['後標'] === null) {
      levels['後標'] = score;
    }
    // 底標: 最後12%（百分位 < 0.25）
    else if (percentile < 0.25 && levels['底標'] === null) {
      levels['底標'] = score;
    }
  }
  
  // 處理相同分數的情況：取高標者
  const levelOrder = ['頂標', '前標', '均標', '後標', '底標'];
  for (let i = 0; i < levelOrder.length - 1; i++) {
    const currentLevel = levelOrder[i];
    const nextLevel = levelOrder[i + 1];
    
    // 如果當前標的分數與下一標的分數相同，且當前標的分數不為null
    if (levels[currentLevel] !== null && levels[nextLevel] !== null && 
        levels[currentLevel] === levels[nextLevel]) {
      // 將下一標的分數設為null，表示取高標者
      levels[nextLevel] = null;
    }
  }
  
  // 處理沒有數值的情況：自動填入較高標的數值
  for (let i = 1; i < levelOrder.length; i++) {
    const currentLevel = levelOrder[i];
    const prevLevel = levelOrder[i - 1];
    
    // 如果當前標沒有數值，且前一個標有數值
    if (levels[currentLevel] === null && levels[prevLevel] !== null) {
      levels[currentLevel] = levels[prevLevel];
    }
  }
  
  return levels;
}

export default function StudentGradeViewer({ studentInfo }: StudentGradeViewerProps) {
  const [selectedCourse, setSelectedCourse] = useState<string>(studentInfo.enrolledCourses?.[0] || '');
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [gradeData, setGradeData] = useState<GradeData | null>(null);
  const [studentGrade, setStudentGrade] = useState<StudentGradeRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'regular' | 'periodic' | 'total'>('total');
  const [popupDetail, setPopupDetail] = useState<{ type: 'regular' | 'periodic', idx: string | number } | null>(null);
  const [dateRange, setDateRange] = useState<{ from: string, to: string }>({ from: '', to: '' });

  // 獲取老師姓名函數
  const getTeacherNames = () => {
    // 1. Firestore 有 teacherName 欄位，直接顯示
    if (gradeData && gradeData.teacherName) {
      return gradeData.teacherName;
    }
    // 2. 有 teacherNames 陣列
    if (gradeData && Array.isArray(gradeData.teacherNames) && gradeData.teacherNames.length > 0) {
      return gradeData.teacherNames.join('、');
    }
    // 3. courses 有老師資訊
    if (selectedCourse && courses.length > 0) {
      const course = courses.find(c => c.id === selectedCourse);
      if (course && Array.isArray(course.teachers) && course.teachers.length > 0) {
        return course.teachers.join('、');
      }
    }
    return '未指定';
  };

  // 載入學生的選課資料
  useEffect(() => {
    const fetchGradesAndCourses = async () => {
      setLoading(true);
      try {
        // 取得學生課程列表
        const resCourses = await fetch('/api/courses/list');
        const allCourses = await resCourses.json();
        // 只取學生有修的課程
        const studentCourses = allCourses.filter((c: unknown) => typeof c === 'object' && c !== null && (c as { id?: string }).id && studentInfo.enrolledCourses?.includes((c as { id: string }).id));
        setCourses(studentCourses);
        // 查詢成績
        if (studentCourses.length > 0) {
          const courseKeys = studentCourses.map((c: { name: string; code: string }) => `${c.name}(${c.code})`);
          const resGrades = await fetch('/api/grades/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseKeys }),
          });
          const gradesResult = await resGrades.json();

          // 取得目前選擇的課程 key
          let selectedCourseKey = '';
          if (selectedCourse) {
            const selected = studentCourses.find((c: { id: string }) => c.id === selectedCourse);
            if (selected) {
              selectedCourseKey = `${(selected as { name: string; code: string }).name}(${(selected as { name: string; code: string }).code})`;
            }
          } else if (studentCourses.length > 0) {
            const first = studentCourses[0] as { name: string; code: string };
            selectedCourseKey = `${first.name}(${first.code})`;
          }

          // 取得該課程的 gradeData
          const courseGradeData = gradesResult[selectedCourseKey] || {};
          const columns = courseGradeData.columns || {};
          const students = courseGradeData.grades && courseGradeData.grades[studentInfo.studentId]
            ? [{ courseName: (studentCourses.find((c: { name: string; code: string }) => `${c.name}(${c.code})` === selectedCourseKey) as { name?: string })?.name, ...courseGradeData.grades[studentInfo.studentId] }]
            : [];

          setGradeData({
            students,
            columns,
            regularSettings: courseGradeData.regularSettings || [],
            periodicScores: courseGradeData.periodicScores || [],
            totalSetting: {
              ...(courseGradeData.totalSetting || {
                regularPercent: 50,
                periodicPercent: 50,
                manualAdjust: 0,
                regularDetail: {}
              }),
              periodicEnabled: courseGradeData.totalSetting?.periodicEnabled || {}
            },
            teacherId: courseGradeData.teacherId || '',
            teacherName: courseGradeData.teacherName || '',
            teacherIds: courseGradeData.teacherIds || [],
            teacherNames: courseGradeData.teacherNames || []
          } as GradeData);
          setStudentGrade(students[0] || null);
        }
      } catch (error) {
        console.error("Error fetching grades: ", error);
      }
      setLoading(false);
    };
    if (studentInfo.studentId) {
      fetchGradesAndCourses();
    }
  }, [studentInfo.studentId, selectedCourse, studentInfo.enrolledCourses]);

  // 新增：平時成績明細加權計算
  const calcRegularScore = (student: StudentGradeRow): number => {
    if (!gradeData || !student) return 0;
    const { regularDetail } = gradeData.totalSetting || {};
    // 小考
    const quizScores = Object.entries(student.regularScores || {})
      .filter(([key]) => (gradeData.columns?.[key]?.type === '小考成績'))
      .map(([, v]) => typeof v === 'number' ? v : Number(v))
      .filter(v => typeof v === 'number' && !isNaN(v)) as number[];
    let quizAvg = 0;
    if (quizScores.length > 0) {
      const method = regularDetail?.['平時測驗']?.calcMethod || '平均';
      if (method === 'all' || method === '平均') {
        quizAvg = quizScores.reduce((a, b) => a + b, 0) / quizScores.length;
      } else if (method === 'best' && typeof regularDetail?.['平時測驗']?.n === 'number') {
        const sorted = [...quizScores].sort((a, b) => b - a);
        const n = Math.min(regularDetail['平時測驗'].n!, sorted.length);
        quizAvg = sorted.slice(0, n).reduce((a, b) => a + b, 0) / n;
      }
    }
    // 作業
    const homeworkScores = Object.entries(student.regularScores || {})
      .filter(([key]) => (gradeData.columns?.[key]?.type === '作業成績'))
      .map(([, v]) => typeof v === 'number' ? v : Number(v))
      .filter(v => typeof v === 'number' && !isNaN(v)) as number[];
    let homeworkAvg = 0;
    if (homeworkScores.length > 0) {
      const method = regularDetail?.['回家作業']?.calcMethod || '平均';
      if (method === 'all' || method === '平均') {
        homeworkAvg = homeworkScores.reduce((a, b) => a + b, 0) / homeworkScores.length;
      } else if (method === 'best' && typeof regularDetail?.['回家作業']?.n === 'number') {
        const sorted = [...homeworkScores].sort((a, b) => b - a);
        const n = Math.min(regularDetail['回家作業'].n!, sorted.length);
        homeworkAvg = sorted.slice(0, n).reduce((a, b) => a + b, 0) / n;
      }
    }
    // 上課態度
    const attitudeScores = Object.entries(student.regularScores || {})
      .filter(([key]) => (gradeData.columns?.[key]?.type === '上課態度'))
      .map(([, v]) => typeof v === 'number' ? v : Number(v))
      .filter(v => typeof v === 'number' && !isNaN(v)) as number[];
    let attitudeAvg = 0;
    if (attitudeScores.length > 0) {
      const method = regularDetail?.['上課態度']?.calcMethod || '平均';
      if (method === 'all' || method === '平均') {
        attitudeAvg = attitudeScores.reduce((a, b) => a + b, 0) / attitudeScores.length;
      } else if (method === 'best' && typeof regularDetail?.['上課態度']?.n === 'number') {
        const sorted = [...attitudeScores].sort((a, b) => b - a);
        const n = Math.min(regularDetail['上課態度'].n!, sorted.length);
        attitudeAvg = sorted.slice(0, n).reduce((a, b) => a + b, 0) / n;
      }
    }
    // 加權
    const quizPercent = Number(regularDetail?.['平時測驗']?.percent) || 0;
    const homeworkPercent = Number(regularDetail?.['回家作業']?.percent) || 0;
    const attitudePercent = Number(regularDetail?.['上課態度']?.percent) || 0;
    return quizAvg * quizPercent / 100 + homeworkAvg * homeworkPercent / 100 + attitudeAvg * attitudePercent / 100;
  };
  // 顯示平時成績原始分數
  const calcRegularDisplay = (student: StudentGradeRow): string => {
    if (!gradeData || !student) return '0.0';
    const weighted = calcRegularScore(student);
    const totalPercent = (Number(gradeData.totalSetting.regularDetail?.['平時測驗']?.percent) || 0)
      + (Number(gradeData.totalSetting.regularDetail?.['回家作業']?.percent) || 0)
      + (Number(gradeData.totalSetting.regularDetail?.['上課態度']?.percent) || 0);
    if (!weighted || totalPercent === 0) return '0.0';
    return (weighted / (totalPercent / 100)).toFixed(1);
  };

  // 計算總成績
  const calcTotalScore = (student: StudentGradeRow): number => {
    if (!gradeData || !student) return 0;
    const regularScore = calcRegularScore(student); // 已經是加權分數
    const manualAdjust = typeof student.manualAdjust === 'number' && !isNaN(student.manualAdjust) ? student.manualAdjust : Number(student.manualAdjust) || 0;
    // 取得有啟用的定期評量名稱
    const periodicNames = ['第一次定期評量', '第二次定期評量', '期末評量'];
    const enabledPeriodic = periodicNames.filter(name => (gradeData.totalSetting.periodicEnabled?.[name] ?? true));
    const periodicVals = enabledPeriodic.map(name => {
      const v = student.periodicScores?.[name];
      if (typeof v === 'number' && !isNaN(v)) return v;
      if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return Number(v);
      return 0;
    });
    const periodicAvg = periodicVals.length > 0 ? periodicVals.reduce((a, b) => a + b, 0) / periodicVals.length : 0;
    if (regularScore === null || typeof regularScore !== 'number' || isNaN(regularScore)) return 0;
    // const regularPercent = Number(gradeData.totalSetting.regularPercent) || 0; // 不再乘
    const periodicPercent = Number(gradeData.totalSetting.periodicPercent) || 0;
    return Math.round(
      regularScore + // 不再乘 regularPercent
      periodicAvg * (periodicPercent / 100) +
      manualAdjust
    );
  };

  // 日期篩選後的平時成績
  const filteredRegularScores = () => {
    if (!gradeData || !studentGrade) return [];
    const { from, to } = dateRange;
    return Object.entries(gradeData.columns)
      .filter(([, col]) => {
        if (!from && !to) return true;
        if (from && col.date < from) return false;
        if (to && col.date > to) return false;
        return true;
      })
      .map(([key, col]) => ({
        ...col,
        idx: key,
        score: studentGrade.regularScores?.[key]
      }));
  };

  // 長條圖資料
  const barChartData = {
    labels: filteredRegularScores().map(col => col.name || col.type),
    datasets: [
      {
        label: '平時成績',
        data: filteredRegularScores().map(col => col.score ?? 0),
        backgroundColor: 'rgba(37, 99, 235, 0.7)'
      }
    ]
  };

  // 五標資料
  // Removed unused variable allRegularScores

  // 定期評量五標
  const periodicLevels: Record<string, ReturnType<typeof getTaiwanPercentileLevels>> = {};
  if (gradeData && gradeData.periodicScores) {
    gradeData.periodicScores.forEach(name => {
      const scores = gradeData.students.map(stu => stu.periodicScores?.[name] ?? 0).filter(s => typeof s === 'number');
      periodicLevels[name] = getTaiwanPercentileLevels(scores);
    });
  }

  if (courses.length === 0) {
    return (
      <div className="max-w-4xl mx-auto w-full p-4">
        <h2 className="text-2xl font-bold mb-6">成績查詢</h2>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <p className="text-yellow-800">您目前沒有選修任何課程，無法查詢成績。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full p-4">
      <h2 className="text-2xl font-bold mb-6">成績查詢</h2>
      {/* 課程選擇 */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          選擇課程
        </label>
        <select
          className="border border-gray-300 rounded-lg p-3 w-full md:w-80"
          value={selectedCourse}
          onChange={(e) => setSelectedCourse(e.target.value)}
        >
          <option value="">請選擇課程</option>
          {courses.map(course => (
            <option key={course.id} value={course.id}>
              {course.name}（{course.code}）
            </option>
          ))}
        </select>
      </div>
      {loading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-4 border-r-4 border-blue-600"></div>
        </div>
      )}
      {selectedCourse && !loading && (
        <div>
          {/* 課程資訊標題 */}
          <div className="text-blue-700 font-bold text-lg mb-2">
            {courses.find(c => c.id === selectedCourse)?.name}（{courses.find(c => c.id === selectedCourse)?.code}）
            <span className="ml-4 text-base font-normal text-blue-500">授課教師：{getTeacherNames()}</span>
          </div>
          {/* 標籤頁 */}
          <div className="border-b mb-4">
            <nav className="flex">
              <button
                onClick={() => setSelectedTab('total')}
                className={`px-6 py-3 text-sm font-medium ${
                  selectedTab === 'total'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                總成績
              </button>
              <button
                onClick={() => setSelectedTab('regular')}
                className={`px-6 py-3 text-sm font-medium ${
                  selectedTab === 'regular'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                平時成績
              </button>
              <button
                onClick={() => setSelectedTab('periodic')}
                className={`px-6 py-3 text-sm font-medium ${
                  selectedTab === 'periodic'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                定期評量
              </button>
            </nav>
          </div>
          {/* 內容區域 */}
          <div>
            {/* 總成績概況 */}
            {selectedTab === 'total' && (
              <div>
                <h4 className="text-lg font-semibold mb-4">總成績概況</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                  <div className="p-4 border rounded text-center">
                    <div className="text-sm text-blue-600 font-medium cursor-pointer" onClick={() => setSelectedTab('regular')}>平時成績</div>
                    <div className="text-2xl font-bold text-blue-800">
                      {studentGrade ? calcRegularDisplay(studentGrade) : '未評分'}
                    </div>
                  </div>
                  <div className="p-4 border rounded text-center">
                    <div className="text-sm text-blue-600 font-medium cursor-pointer" onClick={() => setPopupDetail({ type: 'periodic', idx: '第一次定期評量' })}>第一次定期評量</div>
                    <div className="text-2xl font-bold text-blue-800">
                      {studentGrade ? (studentGrade.periodicScores?.['第一次定期評量'] !== undefined ? studentGrade.periodicScores['第一次定期評量'] : '未評分') : '未評分'}
                    </div>
                  </div>
                  <div className="p-4 border rounded text-center">
                    <div className="text-sm text-blue-600 font-medium cursor-pointer" onClick={() => setPopupDetail({ type: 'periodic', idx: '第二次定期評量' })}>第二次定期評量</div>
                    <div className="text-2xl font-bold text-blue-800">
                      {studentGrade ? (studentGrade.periodicScores?.['第二次定期評量'] !== undefined ? studentGrade.periodicScores['第二次定期評量'] : '未評分') : '未評分'}
                    </div>
                  </div>
                  <div className="p-4 border rounded text-center">
                    <div className="text-sm text-blue-600 font-medium cursor-pointer" onClick={() => setPopupDetail({ type: 'periodic', idx: '期末評量' })}>期末評量</div>
                    <div className="text-2xl font-bold text-blue-800">
                      {studentGrade ? (studentGrade.periodicScores?.['期末評量'] !== undefined ? studentGrade.periodicScores['期末評量'] : '未評分') : '未評分'}
                    </div>
                  </div>
                  <div className="p-4 border rounded text-center">
                    <div className="text-sm text-blue-600 font-medium">總成績</div>
                    <div className="text-2xl font-bold text-orange-800">
                      {studentGrade ? (calcTotalScore(studentGrade) !== null ? calcTotalScore(studentGrade) : '未評分') : '未評分'}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {/* 平時成績 */}
            {selectedTab === 'regular' && (
              <div>
                <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                  <h4 className="text-lg font-semibold">平時成績明細</h4>
                  <div className="flex gap-2 items-center">
                    <label className="text-sm">日期篩選：</label>
                    <input type="date" value={dateRange.from} onChange={e => setDateRange(r => ({ ...r, from: e.target.value }))} className="border rounded px-2 py-1" />
                    <span>~</span>
                    <input type="date" value={dateRange.to} onChange={e => setDateRange(r => ({ ...r, to: e.target.value }))} className="border rounded px-2 py-1" />
                  </div>
                </div>
                {/* 明細表 */}
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-lg">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">項目</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">名稱</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">日期</th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">成績</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRegularScores().map(col => (
                        <tr key={col.idx} className="border-t border-gray-200">
                          <td className="px-4 py-3 text-sm text-blue-700 cursor-pointer underline" onClick={() => setPopupDetail({ type: 'regular', idx: col.idx })}>{col.type}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{col.name}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{col.date}</td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className={`font-semibold ${col.score !== undefined && col.score < 60 ? 'text-red-600' : 'text-gray-800'}`}>
                              {studentGrade ? (col.score ?? '未評分') : '未評分'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* 在平時成績明細表下方加上： */}
                <div className="mb-6 max-w-xl mx-auto">
                  <Bar data={barChartData} />
                </div>
              </div>
            )}
            {/* 定期評量 */}
            {selectedTab === 'periodic' && (
              <div>
                <h4 className="text-lg font-semibold mb-4">定期評量成績</h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-lg">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">評量項目</th>
                        <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700">成績</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gradeData?.periodicScores.map((scoreName) => (
                        <tr key={scoreName} className="border-t border-gray-200">
                          <td className="px-4 py-3 text-sm text-blue-700 cursor-pointer underline" onClick={() => setPopupDetail({ type: 'periodic', idx: scoreName })}>{scoreName}</td>
                          <td className="px-4 py-3 text-sm text-center">
                            <span className={`font-semibold ${(studentGrade && studentGrade.periodicScores?.[scoreName] !== undefined ? studentGrade.periodicScores[scoreName] : 0) < 60 ? 'text-red-600' : 'text-gray-800'}`}>
                              {studentGrade ? (studentGrade.periodicScores?.[scoreName] ?? '未評分') : '未評分'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {/* 詳細資料彈窗 */}
            {popupDetail && (
              <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-lg p-6 min-w-[400px] w-[400px]">
                  <div className="mb-4 font-bold text-lg text-center">
                    {popupDetail.type === 'regular'
                      ? `平時成績明細`
                      : `${popupDetail.idx} 詳細資料`}
                  </div>
                  {/* 五標與分布 */}
                  {(() => {
                    let scores: number[] = [];
                    if (popupDetail.type === 'regular' && gradeData) {
                      scores = gradeData.students.map(stu => stu.regularScores?.[popupDetail.idx as string]).filter(s => s !== undefined) as number[];
                    } else if (popupDetail.type === 'periodic' && gradeData) {
                      scores = gradeData.students.map(stu => stu.periodicScores?.[popupDetail.idx as string]).filter(s => s !== undefined) as number[];
                    }
                    if (scores.length === 0) {
                      return <div className="text-gray-500 text-center py-4">尚無成績分布資料</div>;
                    }
                    const levels = getTaiwanPercentileLevels(scores);
                    // 分布
                    const dist: { [k: string]: number } = {};
                    dist['100以上'] = 0;
                    for (let i = 90; i >= 0; i -= 10) dist[`${i}-${i + 9}`] = 0;
                    scores.forEach(s => {
                      if (s >= 100) {
                        dist['100以上']++;
                      } else {
                        const bucket = `${Math.floor(s / 10) * 10}-${Math.floor(s / 10) * 10 + 9}`;
                        dist[bucket]++;
                      }
                    });
                    return (
                      <>
                        <div className="mb-3 font-semibold">平均與五標：</div>
                        <table className="border text-base mb-2 w-full">
                          <thead>
                            <tr>
                              <th className="border px-2 py-1 font-bold text-center">平均</th>
                              <th className="border px-2 py-1 font-bold text-center">頂標</th>
                              <th className="border px-2 py-1 font-bold text-center">前標</th>
                              <th className="border px-2 py-1 font-bold text-center">均標</th>
                              <th className="border px-2 py-1 font-bold text-center">後標</th>
                              <th className="border px-2 py-1 font-bold text-center">底標</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="border px-2 py-1 text-center">{levels['平均'] ?? 0}</td>
                              <td className="border px-2 py-1 text-center">{levels['頂標'] ?? 0}</td>
                              <td className="border px-2 py-1 text-center">{levels['前標'] ?? 0}</td>
                              <td className="border px-2 py-1 text-center">{levels['均標'] ?? 0}</td>
                              <td className="border px-2 py-1 text-center">{levels['後標'] ?? 0}</td>
                              <td className="border px-2 py-1 text-center">{levels['底標'] ?? 0}</td>
                            </tr>
                          </tbody>
                        </table>
                        <div className="mb-1 font-semibold">成績分布：</div>
                        <table className="border text-base mt-2 w-full">
                          <tbody>
                            {Object.entries(dist).map(([range, count]) => (
                              <tr key={range}>
                                <td className="border px-2 py-1 font-bold text-center">{range}</td>
                                <td className="border px-2 py-1 text-center">{count}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </>
                    );
                  })()}
                  <div className="flex justify-end gap-2 mt-4">
                    <button
                      className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
                      onClick={() => setPopupDetail(null)}
                      type="button"
                    >關閉</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 