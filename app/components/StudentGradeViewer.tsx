'use client';

import React, { useState, useEffect } from 'react';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged, User } from 'firebase/auth';
import { db } from '../../services/firebase';
import { Modal } from './ui';
import LoadingSpinner from './LoadingSpinner';



interface GradeData {
  columns: Record<string, { name: string; type: string; date: string; }>;
  students: { studentId: string; regularScores?: Record<string, number>; periodicScores?: Record<string, number>; }[];
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

// 修正：Props 中加入 studentId
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
  const [authUser, setAuthUser] = useState<User | null>(null);

  const [teacherNamesMap, setTeacherNamesMap] = useState<Record<string, string>>({});
  const [selectedGradeForChart, setSelectedGradeForChart] = useState<{ name: string; type: string; date: string; idx: string; score: number | undefined; } | null>(null);
  const [distributionData, setDistributionData] = useState<DistributionData | null>(null);

  const auth = typeof window !== 'undefined' ? getAuth() : null;

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (user) => setAuthUser(user));
  }, [auth]);

  

  const handleSelectGrade = async (gradeItem: { name: string; type: string; date: string; idx: string; score: number | undefined; }) => {
    if (selectedGradeForChart?.idx === gradeItem.idx) {
      setSelectedGradeForChart(null);
      setDistributionData(null);
      return;
    }

    if (!selectedCourse) return;
    setSelectedGradeForChart(gradeItem);
    setDistributionData(null); // Clear previous data
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

  // 依線上版本：student_data/{學號}/enrolledCourses 作為來源
  useEffect(() => {
    const loadStudentCourses = async () => {
      // 修正：使用 studentId (學號) 而非 user id
      const studentNumber = (studentInfo?.studentId || '').trim();
      if (!studentNumber) { setError('缺少學號，無法讀取選課'); setCourses([]); return; }
      try {
        setLoading(true); setError(null);

        // A) 比照「我的課程」：先走後端 API 聚合方式
        try {
          // 修正：使用 studentId (學號) 查詢
          const resProfile = await fetch('/api/student/profile', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: studentInfo.id })
          });
          if (resProfile.ok) {
            const profile = await resProfile.json();
            const enrolledIds: string[] = Array.isArray(profile?.enrolledCourses) ? profile.enrolledCourses : [];
            if (enrolledIds.length > 0) {
              const resCourses = await fetch('/api/courses/list');
              if (resCourses.ok) {
                const allCourses: CourseInfo[] = await resCourses.json();
                const filtered = allCourses
                  .filter((c) => enrolledIds.includes(String(c.id)));
                // 取所有教師 id 建立對照 (已移除未使用的變數)
                try {
                  const resTeachers = await fetch('/api/teacher/list');
                  if (resTeachers.ok) {
                    const teachers: { id: string; name: string }[] = await resTeachers.json();
                    const map: Record<string,string> = {};
                    teachers.forEach(t => { map[String(t.id)] = t.name; });
                    setTeacherNamesMap(map);
                  }
                } catch {}
                const normalized = filtered.map((c) => {
                  const courseData = c as unknown as Record<string, unknown>;
                  return {
                    id: String(c.id),
                    name: c.name || courseData.title as string || String(c.id),
                    code: c.code || String(c.id),
                    teacherName: (courseData.teachers && Array.isArray(courseData.teachers) && courseData.teachers.length > 0) ? (teacherNamesMap[String(courseData.teachers[0])] || String(courseData.teachers[0])) : undefined
                  } as CourseInfo;
                });
                if (normalized.length > 0) { setCourses(normalized); return; }
              }
            }
          }
        } catch {}

        // B) Firestore 方案（你的資料結構）
        const studentDocRef = doc(db, 'student_data', studentNumber);
        let enrolled: string[] = [];
        try {
          const studentDocSnap = await getDoc(studentDocRef);
          if (studentDocSnap.exists()) {
            const sd = studentDocSnap.data();
            if (Array.isArray(sd?.enrolledCourses)) enrolled = sd.enrolledCourses as string[];
          }
        } catch {}

        if (!enrolled.length) {
          try {
            const subRef = collection(db, 'student_data', studentNumber, 'enrolledCourses');
            const subSnap = await getDocs(subRef);
            enrolled = subSnap.docs.map(d => (d.id || (d.data() as Record<string, unknown>)?.courseId)).filter(Boolean) as string[];
          } catch {}
        }

        if (!enrolled.length) { setCourses([]); return; }

        const results = await Promise.all(enrolled.map(async (entry) => {
          // 先用文字顯示
          let base: CourseInfo = { id: entry, name: entry, code: entry };
          try {
            const cSnap = await getDoc(doc(db, 'courses', entry));
            if (cSnap.exists()) {
              const cd = cSnap.data() as Record<string, unknown>;
              let teacherName: string | undefined = cd.teacherName as string;
              const teacherId = cd.teacherId || (Array.isArray(cd.teachers) ? (cd.teachers as string[])[0] : undefined);
              if (!teacherName && teacherId) {
                try {
                  const uSnap = await getDoc(doc(db, 'users', String(teacherId)));
                  if (uSnap.exists()) {
                    const ud = uSnap.data() as Record<string, unknown>;
                    teacherName = (ud?.name as string) || String(teacherId);
                  } else {
                    teacherName = String(teacherId);
                  }
                } catch {
                  teacherName = String(teacherId);
                }
              }
              base = { id: entry, name: (cd.name || entry) as string, code: (cd.code || entry) as string, teacherName };
            }
          } catch {}
          return base;
        }));
        setCourses(results.filter(Boolean) as CourseInfo[]);
      } catch {
        setError('載入選課時發生錯誤');
      } finally { setLoading(false); }
    };
    loadStudentCourses();
  }, [studentInfo?.id, studentInfo?.studentId, teacherNamesMap]);

  // 讀取該課程中該學生的成績（改為呼叫後端 API）
  useEffect(() => {
    const loadGradeData = async () => {
      if (!selectedCourse || !studentInfo?.id) {
        setGradeData(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/student/grades', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseKey: selectedCourse }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.error || '無法載入成績資料');
        }

        const data = await res.json();
        
        if (data) {
          const newGradeData: GradeData = {
            columns: data.columns,
            totalSetting: data.totalSetting,
            periodicScores: data.periodicScores,
            students: data.student ? [data.student] : [],
          };
          setGradeData(newGradeData);
        } else {
          setGradeData(null);
        }

      } catch (e: unknown) {
        setError((e as Error).message || '載入成績時發生未知錯誤');
        setGradeData(null);
      } finally {
        setLoading(false);
      }
    };

    loadGradeData();
  }, [selectedCourse, studentInfo?.id]);

  // 修正：使用 studentId 查找學生，並簡化邏輯
  const studentGrade = gradeData?.students.find(s => {
    const studentIdToFind = studentInfo?.studentId;
    if (!studentIdToFind) return false;
    return String(s.studentId).trim() === String(studentIdToFind).trim();
  });

  // 調試信息
  useEffect(() => {
    if (gradeData && gradeData.students.length > 0) {
      console.log('=== 成績資料調試信息 ===');
      console.log('gradeData:', gradeData);
      console.log('studentInfo:', studentInfo);
      console.log('authUser:', authUser);
      console.log('所有學生ID:', gradeData.students.map(s => String(s.studentId).trim()));
      // 修正：顯示正確的查找ID
      console.log('尋找的學生ID:', studentInfo?.studentId ? String(studentInfo.studentId).trim() : 'N/A');
      console.log('找到的學生:', studentGrade);
      console.log('======================');
    }
  }, [gradeData, studentInfo, authUser, studentGrade]);


const calcRegularScore = (student: StudentGradeRow): number => {
  if (!gradeData || !student) return 0;
  const { regularDetail } = gradeData.totalSetting || {};
    const avg = (v: number[]) => v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    const byType = (t: string) => Object.entries(student.regularScores || {}).filter(([k]) => gradeData.columns?.[k]?.type === t).map(([,v]) => Number(v)).filter(n => !isNaN(n));
    const bestN = (v: number[], n?: number) => (!n || n <= 0) ? avg(v) : avg([...v].sort((a,b)=>b-a).slice(0, Math.min(n, v.length)));
    const q = byType('小考成績'); const h = byType('作業成績'); const a = byType('上課態度');
    const qAvg = (regularDetail?.['平時測驗']?.calcMethod === 'best') ? bestN(q, regularDetail?.['平時測驗']?.n) : avg(q);
    const hAvg = (regularDetail?.['回家作業']?.calcMethod === 'best') ? bestN(h, regularDetail?.['回家作業']?.n) : avg(h);
    const aAvg = (regularDetail?.['上課態度']?.calcMethod === 'best') ? bestN(a, regularDetail?.['上課態度']?.n) : avg(a);
    const qPct = Number(regularDetail?.['平時測驗']?.percent) || 0;
    const hPct = Number(regularDetail?.['回家作業']?.percent) || 0;
    const aPct = Number(regularDetail?.['上課態度']?.percent) || 0;
    return qAvg * qPct / 100 + hAvg * hPct / 100 + aAvg * aPct / 100;
  };

const calcRegularDisplay = (student: StudentGradeRow): string => {
  if (!gradeData || !student) return '0.0';
  const weighted = calcRegularScore(student);
    const totalPercent = (Number(gradeData.totalSetting?.regularDetail?.['平時測驗']?.percent) || 0) + (Number(gradeData.totalSetting?.regularDetail?.['回家作業']?.percent) || 0) + (Number(gradeData.totalSetting?.regularDetail?.['上課態度']?.percent) || 0);
  if (!weighted || totalPercent === 0) return '0.0';
  return (weighted / (totalPercent / 100)).toFixed(1);
};


const filteredRegularScores = () => {
    if (!gradeData) return [] as { name: string; type: string; date: string; idx: string; score: number | undefined; }[];
    
    // 修正：使用 studentId 查找學生，並簡化邏輯
    const target = gradeData.students.find(s => {
      const studentIdToFind = studentInfo?.studentId;
      if (!studentIdToFind) return false;
      return String(s.studentId).trim() === String(studentIdToFind).trim();
    });
    
    if (!target) return [];
    
    const { from, to } = dateRange;
    return Object.entries(gradeData.columns)
        .filter(([, col]) => (!from && !to) || (!from || col.date >= from) && (!to || col.date <= to))
        .map(([key, col]) => ({ ...col, idx: key, score: target.regularScores?.[key] } as { name: string; type: string; date: string; idx: string; score: number | undefined; }));
  };

  const getTeacherNames = () => {
    // 從 selectedCourse 中提取課程資訊
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

  return (
  <div className="max-w-6xl mx-auto w-full p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">成績查詢</h2>
      </div>

    <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">選擇課程</label>
        <select className="select-unified w-full md:w-80" value={selectedCourse} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCourse(e.target.value)}>
        <option value="">請選擇課程</option>
          {courses.map(course => {
            // 建立 grades 集合的文件 ID 格式：課程名稱(課程代碼)
            const gradeDocId = `${course.name}(${course.code})`;
            return (
              <option key={course.id} value={gradeDocId}>
                {course.name}（{course.code}）
              </option>
            );
          })}
      </select>
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
              <div className="overflow-x-auto mb-6">
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
                      {filteredRegularScores().map((col, index: number) => (
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
              
              {/* 個人成績長條圖 */}
              {studentGrade && (
                <div className="mt-8">
                  <h4 className="text-lg font-semibold mb-4">個人成績趨勢圖</h4>
                  <div className="bg-white p-4 border rounded-lg">
                    <div className="h-80">
                      {/* Bar chart removed - using table presentation only */}
                    </div>
                  </div>
                  
                  {/* 底部留白空間 */}
                  <div className="mt-8 mb-12">
                    <div className="h-16"></div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {selectedTab === 'periodic' && (
            <div>
              <h4 className="text-lg font-semibold mb-4">定期評量</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full border border-gray-200">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-200 px-4 py-2">評量名稱</th>
                      <th className="border border-gray-200 px-4 py-2">分數</th>
                      <th className="border border-gray-200 px-4 py-2">班級排名</th>
                    </tr>
                  </thead>
                  <tbody>
                      {gradeData?.periodicScores?.map((scoreName: string, index: number) => {
                      const myScore = studentGrade?.periodicScores?.[scoreName];
                        const allScores = gradeData.students.map(s => s.periodicScores?.[scoreName]).filter(s => typeof s === 'number') as number[];
                        const rank = myScore !== undefined && typeof myScore === 'number' ? allScores.filter(s => s > myScore).length + 1 : null;
                      return (
                        <tr key={index}>
                            <td className="border border-gray-200 px-4 py-2">{scoreName}</td>
                            <td className="border border-gray-200 px-4 py-2 text-center">{myScore ?? '未評分'}</td>
                            <td className="border border-gray-200 px-4 py-2 text-center">{rank ? `${rank}/${allScores.length}` : '未排名'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              
              {/* 底部留白空間 */}
              <div className="mt-8 mb-12">
                <div className="h-16"></div>
              </div>
            </div>
          )}
        </div>
      </div>
    )}

    {/* 成績詳細資料Modal */}
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
          {/* 個人分數 */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h5 className="font-semibold text-blue-800 mb-2">您的分數</h5>
            <div className="text-3xl font-bold text-blue-600">
              {selectedGradeForChart.score ?? '未評分'}
            </div>
          </div>

          {/* 五標表格 */}
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

          {/* 成績分布表格 */}
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

          {/* 長條圖（改用表格呈現，已移除） */}
        </div>
      )}
    </Modal>
  </div>
);
}