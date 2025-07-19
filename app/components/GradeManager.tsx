'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as ExcelJS from 'exceljs';

interface UserInfo {
  id: string;
  name: string;
  account: string;
  role: '管理員' | '老師' | '學生';
}

interface GradeManagerProps {
  userInfo?: UserInfo | null;
}

interface CourseInfo {
  id: string;
  name: string;
  code: string;
}

// 型別定義
type RegularType = '平時測驗' | '回家作業' | '上課態度';

type RegularScoreSetting = {
  type: RegularType;
  percent: number;
  calcMethod: '平均' | '前N高' | '前N低';
  n?: number;
};

type PeriodicScoreName = '第一次定期評量' | '第二次定期評量' | '期末評量';

type StudentGradeRow = {
  id: string;
  studentId: string;
  name: string;
  grade: string;
  regularScores: { [columnId: string]: number | undefined };
  periodicScores: { [name in PeriodicScoreName]?: number };
  totalScore: number;
  manualAdjust: number;
  remark?: string;
};

type TotalScoreSetting = {
  regularPercent: number;
  periodicPercent: number;
  manualAdjust: number; // -5~+5
  regularDetail: {
    [type in RegularType]: {
      percent: number;
      calcMethod: '平均' | '前N高' | '前N低';
      n?: number;
    }
  };
  periodicEnabled?: { [name in PeriodicScoreName]?: boolean };
};

async function saveGrades(courseName: string, courseCode: string, gradeData: unknown) {
  const res = await fetch('/api/grades/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseName, courseCode, gradeData }),
  });
  if (!res.ok) throw new Error('成績儲存失敗');
}

async function getGrades(courseName: string, courseCode: string) {
  const res = await fetch('/api/grades/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ courseKeys: [`${courseName}(${courseCode})`] }),
  });
  if (res.ok) {
    const data = await res.json();
    return data[`${courseName}(${courseCode})`];
  }
  return null;
}

// 恢復 DEFAULT_REGULAR_COLUMNS
const DEFAULT_REGULAR_COLUMNS = 10;
// sticky 樣式
const stickyCell = "bg-white sticky left-0 z-10";
const stickyCell2 = "bg-white sticky left-20 z-10";
// 統一三個頁面的學號/姓名欄位寬度與 sticky 樣式
const studentIdColStyle = { width: '120px', minWidth: '120px', maxWidth: '120px' };
const studentNameColStyle = { width: '100px', minWidth: '100px', maxWidth: '100px' };
const studentIdColClass = `px-4 py-2 text-left text-sm font-semibold text-gray-700 whitespace-nowrap ${stickyCell}`;
const studentNameColClass = `px-4 py-2 text-left text-sm font-semibold text-gray-700 whitespace-nowrap ${stickyCell2}`;
const studentIdTdClass = `px-4 py-2 text-sm text-gray-800 ${stickyCell}`;
const studentNameTdClass = `px-4 py-2 text-sm text-gray-800 whitespace-nowrap ${stickyCell2}`;
// 恢復 removeUndefinedDeep
function removeUndefinedDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefinedDeep);
  } else if (obj && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, v === undefined ? null : removeUndefinedDeep(v)])
    );
  }
  return obj === undefined ? null : obj;
}

// 恢復 getTaiwanPercentileLevels
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
    if (percentile >= 0.88 && levels['頂標'] === null) {
      levels['頂標'] = score;
    } else if (percentile >= 0.75 && percentile < 0.88 && levels['前標'] === null) {
      levels['前標'] = score;
    } else if (percentile >= 0.50 && percentile < 0.75 && levels['均標'] === null) {
      levels['均標'] = score;
    } else if (percentile >= 0.25 && percentile < 0.50 && levels['後標'] === null) {
      levels['後標'] = score;
    } else if (percentile < 0.25 && levels['底標'] === null) {
      levels['底標'] = score;
    }
  }
  // 處理相同分數的情況：取高標者
  const levelOrder = ['頂標', '前標', '均標', '後標', '底標'];
  for (let i = 0; i < levelOrder.length - 1; i++) {
    const currentLevel = levelOrder[i];
    const nextLevel = levelOrder[i + 1];
    if (levels[currentLevel] !== null && levels[nextLevel] !== null && levels[currentLevel] === levels[nextLevel]) {
      levels[nextLevel] = null;
    }
  }
  // 處理沒有數值的情況：自動填入較高標的數值
  for (let i = 1; i < levelOrder.length; i++) {
    const currentLevel = levelOrder[i];
    const prevLevel = levelOrder[i - 1];
    if (levels[currentLevel] === null && levels[prevLevel] !== null) {
      levels[currentLevel] = levels[prevLevel];
    }
  }
  return levels;
}

export default function GradeManager({ userInfo }: GradeManagerProps) {
  console.log('GradeManager - Received userInfo:', userInfo);
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedCourseName, setSelectedCourseName] = useState('');
  const [selectedCourseCode, setSelectedCourseCode] = useState('');
  const [students, setStudents] = useState<StudentGradeRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'regular' | 'periodic' | 'total'>('regular');
  const [regularColumns, setRegularColumns] = useState<number>(DEFAULT_REGULAR_COLUMNS);
  const [regularSettings, setRegularSettings] = useState<RegularScoreSetting[]>([
    { type: '平時測驗', percent: 40, calcMethod: '平均', n: undefined },
    { type: '回家作業', percent: 40, calcMethod: '平均', n: undefined },
    { type: '上課態度', percent: 20, calcMethod: '平均', n: undefined },
  ]);
  const [periodicScores, setPeriodicScores] = useState<PeriodicScoreName[]>(['第一次定期評量', '第二次定期評量', '期末評量']);
  const [totalSetting, setTotalSetting] = useState<TotalScoreSetting>({
    regularPercent: 60,
    periodicPercent: 40,
    manualAdjust: 0,
    regularDetail: {
      '平時測驗': { percent: 40, calcMethod: '平均' },
      '回家作業': { percent: 40, calcMethod: '平均' },
      '上課態度': { percent: 20, calcMethod: '平均' },
    },
  });
  const [columnDetails, setColumnDetails] = useState<{ [idx: number]: { type: string; name: string; date: string } }>({});
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [showPercentModal, setShowPercentModal] = useState(false);
  // 1. 新增 state：小考p%、作業q%、上課態度r%、特殊加分c、定期評量次數勾選、各項模式
  const [percentQuizRaw, setPercentQuizRaw] = useState<string>('20');
  const [percentHomeworkRaw, setPercentHomeworkRaw] = useState<string>('10');
  const [percentAttitudeRaw, setPercentAttitudeRaw] = useState<string>('10');
  const percentQuiz = Number(percentQuizRaw);
  const percentHomework = Number(percentHomeworkRaw);
  const percentAttitude = Number(percentAttitudeRaw);
  const percentRegular = percentQuiz + percentHomework + percentAttitude;
  const percentPeriodic = 100 - percentRegular;
  const [quizMode, setQuizMode] = useState<'all'|'best'>('all');
  const [quizBestCount, setQuizBestCount] = useState<number>(3);
  const [homeworkMode, setHomeworkMode] = useState<'all'|'best'>('all');
  const [homeworkBestCount, setHomeworkBestCount] = useState<number>(3);
  const [attitudeMode, setAttitudeMode] = useState<'all'|'best'>('all');
  const [attitudeBestCount, setAttitudeBestCount] = useState<number>(3);
  const [periodicEnabled, setPeriodicEnabled] = useState<boolean[]>([true, true, true]); // [第一次, 第二次, 期末]
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState<boolean>(false);
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(null);

  // 檢查是否有未儲存的變更
  useEffect(() => {
    setHasUnsavedChanges(false);
  }, []);

  // 離開頁面檢查
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '您有未儲存的變更，確定要離開嗎？';
        return '您有未儲存的變更，確定要離開嗎？';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // 處理導航離開
  // const handleNavigation = (url: string) => {
  //   if (hasUnsavedChanges) {
  //     setShowLeaveConfirm(true);
  //     setPendingNavigation(url);
  //   } else {
  //     window.location.href = url;
  //   }
  // };

  // 確認離開
  const confirmLeave = () => {
    setShowLeaveConfirm(false);
    if (pendingNavigation) {
      window.location.href = pendingNavigation;
    }
  };

  // 取消離開
  const cancelLeave = () => {
    setShowLeaveConfirm(false);
    setPendingNavigation(null);
  };

  useEffect(() => {
    if (!userInfo || !userInfo.id) {
      setCourses([]);
      return;
    }
    (async () => {
      console.log('GradeManager - Fetching courses for teacher:', userInfo.id);
      // 改為呼叫 /api/courses/list 並過濾老師授課課程
      const resCourses = await fetch('/api/courses/list');
      const allCourses = await resCourses.json();
      console.log('GradeManager - All courses:', allCourses.length);
      // 假設老師授課課程 id 在 userInfo.courses 或 userInfo.id
      // 若有老師課程清單 API 可改用
      const teacherCourses = allCourses.filter((c: { teachers?: string[] }) => Array.isArray(c.teachers) && c.teachers.includes(userInfo.id));
      console.log('GradeManager - Teacher courses:', teacherCourses.length);
      setCourses(teacherCourses);
    })().catch((error: unknown) => {
      console.error('載入課程資料時發生錯誤:', error);
      alert('載入課程資料時發生錯誤: ' + (error instanceof Error ? error.message : String(error)));
    });
  }, [userInfo]);

  useEffect(() => {
    if (selectedCourseName && selectedCourseCode) {
      // 載入學生列表
      (async () => {
        const res = await fetch('/api/course-student-list/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseName: selectedCourseName, courseCode: selectedCourseCode }),
        });
        const list = await res.json();
        setStudents(list.map((stu: { studentId: string; name: string; grade: string }) => ({
          id: stu.studentId,
          studentId: stu.studentId,
          name: stu.name,
          grade: stu.grade,
          regularScores: {},
          periodicScores: {},
          totalScore: 0,
          manualAdjust: 0,
        })));
        // 載入現有成績資料
        const courseKey = `${selectedCourseName}(${selectedCourseCode})`;
        const resGrades = await fetch('/api/grades/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseKeys: [courseKey] }),
        });
        const gradesResult = await resGrades.json();
        const gradeData = gradesResult[courseKey];
        if (gradeData) {
          if (gradeData.students) {
            setStudents(gradeData.students);
          }
          if (gradeData.columns) {
            setColumnDetails(gradeData.columns);
          }
          if (gradeData.regularSettings) {
            setRegularSettings(gradeData.regularSettings);
          }
          if (gradeData.periodicScores) {
            setPeriodicScores(gradeData.periodicScores);
          }
          if (gradeData.totalSetting) {
            setTotalSetting({
              ...gradeData.totalSetting,
              regularPercent: gradeData.totalSetting.regularPercent ?? 40,
              periodicPercent: gradeData.totalSetting.periodicPercent ?? 60,
              manualAdjust: gradeData.totalSetting.manualAdjust ?? 0,
              regularDetail: gradeData.totalSetting.regularDetail ?? {
                '平時測驗': { percent: 20, calcMethod: '平均' },
                '回家作業': { percent: 10, calcMethod: '平均' },
                '上課態度': { percent: 10, calcMethod: '平均' },
              }
            });
            // 同步 percentQuiz/percentHomework/percentAttitude
            setPercentQuizRaw(String(gradeData.totalSetting.regularDetail?.['平時測驗']?.percent ?? '20'));
            setPercentHomeworkRaw(String(gradeData.totalSetting.regularDetail?.['回家作業']?.percent ?? '10'));
            setPercentAttitudeRaw(String(gradeData.totalSetting.regularDetail?.['上課態度']?.percent ?? '10'));
          } else {
            setTotalSetting({
              regularPercent: 40,
              periodicPercent: 60,
              manualAdjust: 0,
              regularDetail: {
                '平時測驗': { percent: 20, calcMethod: '平均' },
                '回家作業': { percent: 10, calcMethod: '平均' },
                '上課態度': { percent: 10, calcMethod: '平均' },
              }
            });
            setPercentQuizRaw('20');
            setPercentHomeworkRaw('10');
            setPercentAttitudeRaw('10');
          }
        } else {
          setTotalSetting({
            regularPercent: 40,
            periodicPercent: 60,
            manualAdjust: 0,
            regularDetail: {
              '平時測驗': { percent: 20, calcMethod: '平均' },
              '回家作業': { percent: 10, calcMethod: '平均' },
              '上課態度': { percent: 10, calcMethod: '平均' },
            }
          });
          setPercentQuizRaw('20');
          setPercentHomeworkRaw('10');
          setPercentAttitudeRaw('10');
        }
      })().catch((error: unknown) => {
        console.error('載入成績資料時發生錯誤:', error);
        alert('載入成績資料時發生錯誤: ' + (error instanceof Error ? error.message : String(error)));
      });
    } else {
      setStudents([]);
      setTotalSetting({
        regularPercent: 40,
        periodicPercent: 60,
        manualAdjust: 0,
        regularDetail: {
          '平時測驗': { percent: 20, calcMethod: '平均' },
          '回家作業': { percent: 10, calcMethod: '平均' },
          '上課態度': { percent: 10, calcMethod: '平均' },
        }
      });
      setPercentQuizRaw('20');
      setPercentHomeworkRaw('10');
      setPercentAttitudeRaw('10');
    }
  }, [selectedCourseName, selectedCourseCode]);

  // handleSave: 儲存時同步 periodicEnabled
  const handleSave = async () => {
    if (!selectedCourseName || !selectedCourseCode) {
      alert('請先選擇課程');
      return;
    }
    const periodicNames: PeriodicScoreName[] = ['第一次定期評量', '第二次定期評量', '期末評量'];
    const periodicEnabledObj: { [name in PeriodicScoreName]: boolean } = {
      '第一次定期評量': !!periodicEnabled[0],
      '第二次定期評量': !!periodicEnabled[1],
      '期末評量': !!periodicEnabled[2],
    };
    const newTotalSetting = {
      ...totalSetting,
      regularPercent: percentRegular,
      periodicPercent: percentPeriodic,
      regularDetail: {
        '平時測驗': {
          ...(totalSetting.regularDetail['平時測驗'] || {}),
          percent: percentQuiz
        },
        '回家作業': {
          ...(totalSetting.regularDetail['回家作業'] || {}),
          percent: percentHomework
        },
        '上課態度': {
          ...(totalSetting.regularDetail['上課態度'] || {}),
          percent: percentAttitude
        }
      },
      periodicEnabled: periodicEnabledObj
    };
    setIsSaving(true);
    try {
      const gradeData = {
        students,
        columns: columnDetails,
        regularSettings,
        periodicScores,
        totalSetting: newTotalSetting,
        teacherId: userInfo?.id,
        teacherName: userInfo?.name,
      };
      const cleanedGradeData = removeUndefinedDeep(gradeData);
      await saveGrades(selectedCourseName, selectedCourseCode, cleanedGradeData);
      // 儲存後自動重新讀取最新資料
      const latestGradeData = await getGrades(selectedCourseName, selectedCourseCode);
      if (latestGradeData && latestGradeData.totalSetting) {
        setTotalSetting({
          ...latestGradeData.totalSetting,
          regularPercent: latestGradeData.totalSetting.regularPercent ?? 60,
          periodicPercent: latestGradeData.totalSetting.periodicPercent ?? 40,
          manualAdjust: latestGradeData.totalSetting.manualAdjust ?? 0,
          regularDetail: latestGradeData.totalSetting.regularDetail ?? {
            '平時測驗': { percent: 40, calcMethod: '平均' },
            '回家作業': { percent: 40, calcMethod: '平均' },
            '上課態度': { percent: 20, calcMethod: '平均' },
          },
          periodicEnabled: latestGradeData.totalSetting.periodicEnabled || periodicEnabledObj
        });
        // 讀取時同步 periodicEnabled 狀態
        if (latestGradeData.totalSetting.periodicEnabled) {
          setPeriodicEnabled(periodicNames.map(name => !!latestGradeData.totalSetting.periodicEnabled?.[name]));
        }
      }
      alert('成績已儲存！');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    if (!selectedCourseName || !selectedCourseCode || students.length === 0) {
      alert('請先選擇課程且有學生資料');
      return;
    }

    // 創建Excel工作簿
    const workbook = new ExcelJS.Workbook();
    
    // 平時成績工作表
    const regularSheet = workbook.addWorksheet('平時成績');
    regularSheet.columns = [
      { header: '學號', key: 'studentId', width: 15 },
      { header: '姓名', key: 'name', width: 15 },
      ...Array.from({ length: regularColumns }).map((_, idx) => {
        const detail = columnDetails[idx] || {};
        let displayName = '';
        if (detail.type === '作業成績') {
          const count = Array.from({ length: idx + 1 }).filter((_, i) => (columnDetails[i]?.type) === '作業成績').length;
          displayName = `作業${count}`;
        } else if (detail.type === '上課態度') {
          const count = Array.from({ length: idx + 1 }).filter((_, i) => (columnDetails[i]?.type) === '上課態度').length;
          displayName = `上課${count}`;
        } else if (detail.type === '小考成績') {
          const count = Array.from({ length: idx + 1 }).filter((_, i) => (columnDetails[i]?.type) === '小考成績').length;
          displayName = `小考${count}`;
        } else {
          displayName = detail.name?.trim() ? detail.name : `成績${idx + 1}`;
        }
        return { header: displayName, key: `regular${idx}`, width: 12 };
      })
    ];
    
    students.forEach(student => {
      const row: Record<string, string | number> = {
        studentId: student.studentId,
        name: student.name
      };
      Array.from({ length: regularColumns }).forEach((_, idx) => {
        row[`regular${idx}`] = student.regularScores?.[idx] || '';
      });
      regularSheet.addRow(row);
    });

    // 定期評量工作表
    const periodicSheet = workbook.addWorksheet('定期評量');
    periodicSheet.columns = [
      { header: '學號', key: 'studentId', width: 15 },
      { header: '姓名', key: 'name', width: 15 },
      ...periodicScores.map(scoreName => ({
        header: scoreName,
        key: scoreName,
        width: 15
      }))
    ];
    
    students.forEach(student => {
      const row: Record<string, string | number> = {
        studentId: student.studentId,
        name: student.name
      };
      periodicScores.forEach(scoreName => {
        row[scoreName] = student.periodicScores?.[scoreName] || '';
      });
      periodicSheet.addRow(row);
    });

    // 總成績工作表
    const totalSheet = workbook.addWorksheet('總成績');
    totalSheet.columns = [
      { header: '學號', key: 'studentId', width: 15 },
      { header: '姓名', key: 'name', width: 15 },
      { header: '平時成績', key: 'regularScore', width: 15 },
      { header: '期中評量', key: 'midScore', width: 15 },
      { header: '期末評量', key: 'finalScore', width: 15 },
      { header: '特殊加分', key: 'manualAdjust', width: 15 },
      { header: '總成績', key: 'totalScore', width: 15 }
    ];
    
    students.forEach(student => {
      // 平時成績計算
      const { weighted: regularScore } = calcRegularScore(student);
      // 定期評量
      const first = student.periodicScores?.['第一次定期評量'] ?? 0;
      const second = student.periodicScores?.['第二次定期評量'] ?? 0;
      const final = student.periodicScores?.['期末評量'] ?? 0;
      const midAvg = (Number(first) + Number(second)) / 2;
      // 特殊加分
      const manualAdjust = typeof student.manualAdjust === 'number' ? student.manualAdjust : 0;
      // 平時成績顯示：現有平時成績數據 / (平時成績總%/100)
      const percentRegularNum = typeof totalSetting.regularPercent === 'number' && !isNaN(totalSetting.regularPercent) ? totalSetting.regularPercent : 0;
      const percentPeriodicNum = typeof totalSetting.periodicPercent === 'number' && !isNaN(totalSetting.periodicPercent) ? totalSetting.periodicPercent : 0;
      const manualAdjustNum = typeof manualAdjust === 'number' && !isNaN(manualAdjust) ? manualAdjust : 0;
      // 匯出時用 totalSetting.periodicEnabled
      const periodicEnabledObj = totalSetting.periodicEnabled || {
        '第一次定期評量': true,
        '第二次定期評量': true,
        '期末評量': true,
      };
      const periodicNames = ['第一次定期評量', '第二次定期評量', '期末評量'];
      const enabledPeriodic = periodicNames.filter(name => periodicEnabledObj[name as PeriodicScoreName]);
      const periodicVals: number[] = enabledPeriodic.map(name => {
        const v = student.periodicScores?.[name as PeriodicScoreName];
        return typeof v === 'number' && !isNaN(v) ? v : 0;
      });
      const periodicAvgNum = enabledPeriodic.length > 0 ? (periodicVals as number[]).reduce((a, b) => a + b, 0) / enabledPeriodic.length : 0;
      const total = Math.round(
        regularScore * percentRegularNum / 100 +
        periodicAvgNum * percentPeriodicNum / 100 +
        manualAdjustNum
      );
      totalSheet.addRow({
        studentId: student.studentId,
        name: student.name,
        regularScore,
        midScore: Math.round(midAvg),
        finalScore: final,
        manualAdjust,
        totalScore: total
      });
    });

    // 下載Excel檔案
    workbook.xlsx.writeBuffer().then((buffer: ArrayBuffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedCourseName}(${selectedCourseCode})_成績資料_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    });
  };

  const handleImport = () => {
    // TODO: import from CSV/Excel
    alert('匯入功能尚未實作');
  };

  // 輔助函數：平時成績計算
  function calcRegularScore(stu: StudentGradeRow): { quizAvg: number; homeworkAvg: number; attitudeAvg: number; weighted: number } {
    // 小考
    const quizScores = Object.entries(stu.regularScores || {})
      .filter(([idx]) => columnDetails[Number(idx)]?.type === '小考成績')
      .map(([, v]) => typeof v === 'number' ? v : undefined)
      .filter(v => typeof v === 'number') as number[];
    let quizAvg = 0;
    if (quizScores.length > 0) {
      if (quizMode === 'all') {
        quizAvg = quizScores.reduce((a, b) => a + b, 0) / quizScores.length;
      } else {
        const sorted = [...quizScores].sort((a, b) => b - a);
        const n = Math.min(quizBestCount, sorted.length);
        quizAvg = sorted.slice(0, n).reduce((a, b) => a + b, 0) / n;
      }
    }
    // 作業
    const homeworkScores = Object.entries(stu.regularScores || {})
      .filter(([idx]) => columnDetails[Number(idx)]?.type === '作業成績')
      .map(([, v]) => typeof v === 'number' ? v : undefined)
      .filter(v => typeof v === 'number') as number[];
    let homeworkAvg = 0;
    if (homeworkScores.length > 0) {
      if (homeworkMode === 'all') {
        homeworkAvg = homeworkScores.reduce((a, b) => a + b, 0) / homeworkScores.length;
      } else {
        const sorted = [...homeworkScores].sort((a, b) => b - a);
        const n = Math.min(homeworkBestCount, sorted.length);
        homeworkAvg = sorted.slice(0, n).reduce((a, b) => a + b, 0) / n;
      }
    }
    // 上課態度
    const attitudeScores = Object.entries(stu.regularScores || {})
      .filter(([idx]) => columnDetails[Number(idx)]?.type === '上課態度')
      .map(([, v]) => typeof v === 'number' ? v : undefined)
      .filter(v => typeof v === 'number') as number[];
    let attitudeAvg = 0;
    if (attitudeScores.length > 0) {
      if (attitudeMode === 'all') {
        attitudeAvg = attitudeScores.reduce((a, b) => a + b, 0) / attitudeScores.length;
      } else {
        const sorted = [...attitudeScores].sort((a, b) => b - a);
        const n = Math.min(attitudeBestCount, sorted.length);
        attitudeAvg = sorted.slice(0, n).reduce((a, b) => a + b, 0) / n;
      }
    }
    return {
      quizAvg,
      homeworkAvg,
      attitudeAvg,
      weighted: quizAvg * percentQuiz / 100 + homeworkAvg * percentHomework / 100 + attitudeAvg * percentAttitude / 100
    };
  }

  // 百分比調整彈窗開啟時同步最新值
  const openPercentModal = () => {
    setShowPercentModal(true);
  };

  // 讀取時初始化 periodicEnabled 狀態
  useEffect(() => {
    if (totalSetting && totalSetting.periodicEnabled) {
      const periodicNames: PeriodicScoreName[] = ['第一次定期評量', '第二次定期評量', '期末評量'];
      setPeriodicEnabled(periodicNames.map(name => !!totalSetting.periodicEnabled?.[name]));
    }
  }, [totalSetting]);

  return (
    <div className="max-w-6xl mx-auto w-full p-4">
      <h2 className="text-2xl font-bold mb-6">成績資料管理</h2>
      <div className="mb-4 flex flex-col md:flex-row md:items-center gap-4">
        <select
          className="select-unified w-full md:w-64"
          value={selectedCourse}
          onChange={e => {
            setSelectedCourse(e.target.value);
            const course = courses.find(c => c.id === e.target.value);
            setSelectedCourseName(course?.name || '');
            setSelectedCourseCode(course?.code || '');
          }}
        >
          <option value="">請選擇課程</option>
          {courses.map(course => (
            <option key={course.id} value={course.id}>{course.name}（{course.code}）</option>
          ))}
        </select>
      </div>
      {(userInfo && courses.length === 0) && (
        <div className="text-red-500 mb-4">尚未設定授課課程，請聯絡管理員。</div>
      )}
      {/* 已選課但無學生時顯示提示 */}
      {selectedCourse && students.length === 0 && (
        <div className="text-gray-500 mb-4">本課程暫無學生</div>
      )}
      {/* 已選課且有學生才顯示主功能區塊與匯入/出按鈕 */}
      {selectedCourse && students.length > 0 && (
        <>
          <div className="flex gap-4 mb-6 items-center flex-wrap">
            <button className={`px-4 py-2 rounded ${selectedTab === 'regular' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`} onClick={() => setSelectedTab('regular')}>平時成績</button>
            <button className={`px-4 py-2 rounded ${selectedTab === 'periodic' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`} onClick={() => setSelectedTab('periodic')}>定期評量</button>
            <button className={`px-4 py-2 rounded ${selectedTab === 'total' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`} onClick={() => setSelectedTab('total')}>總成績</button>
          </div>
          {/* 分頁內容 */}
          {selectedTab === 'regular' && (
            <div className="mb-8">
              {/* 按鈕區塊移到上方 */}
              <div className="grid grid-cols-2 gap-2 mb-4 md:flex md:gap-2 md:flex-nowrap md:overflow-x-auto">
                <button className="btn-primary min-w-[110px] flex-shrink-0" onClick={handleExport}>匯出成績</button>
                <button className="btn-success min-w-[110px] flex-shrink-0" onClick={handleImport}>匯入成績</button>
                <button className="btn-warning min-w-[110px] flex-shrink-0" onClick={openPercentModal}>百分比調整</button>
                <button
                  className="btn-danger min-w-[110px] flex-shrink-0"
                  onClick={handleSave}
                  disabled={isSaving}
                >{isSaving ? '儲存中...' : '儲存成績'}</button>
              </div>
              <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
                <table className="min-w-full border border-gray-200 rounded-lg" style={{ tableLayout: 'fixed', width: `${120 + 100 + (regularColumns * 120)}px` }}>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className={studentIdColClass} style={studentIdColStyle}>學號</th>
                      <th className={studentNameColClass} style={studentNameColStyle}>姓名</th>
                      {Array.from({ length: regularColumns }).map((_, idx) => {
                        const detail = columnDetails[idx] || {};
                        // 依 type 與同類型順序命名
                        let displayName = '';
                        if (detail.type === '作業成績') {
                          const count = Array.from({ length: idx + 1 }).filter((_, i) => (columnDetails[i]?.type) === '作業成績').length;
                          displayName = `作業${count}`;
                        } else if (detail.type === '上課態度') {
                          const count = Array.from({ length: idx + 1 }).filter((_, i) => (columnDetails[i]?.type) === '上課態度').length;
                          displayName = `上課${count}`;
                        } else if (detail.type === '小考成績') {
                          const count = Array.from({ length: idx + 1 }).filter((_, i) => (columnDetails[i]?.type) === '小考成績').length;
                          displayName = `小考${count}`;
                        } else {
                          displayName = detail.name?.trim() ? detail.name : `成績${idx + 1}`;
                        }
                        return (
                          <th key={idx} className="px-4 py-2 text-left text-sm font-semibold text-gray-700 whitespace-nowrap" style={{ width: '120px' }}>
                            <div className="flex flex-col items-start">
                              <span>{displayName}</span>
                              <button
                                className="mt-1 text-blue-500 hover:text-blue-700 text-xs border border-blue-400 rounded px-2 py-0.5"
                                type="button"
                                onClick={() => setEditingColumn(idx)}
                              >成績資訊</button>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((stu, rowIdx) => (
                      <tr key={stu.id} className="border-t">
                        <td className={studentIdTdClass} style={studentIdColStyle}>{stu.studentId}</td>
                        <td className={studentNameTdClass} style={studentNameColStyle}>{stu.name}</td>
                        {Array.from({ length: regularColumns }).map((_, colIdx) => {
                          const score = stu.regularScores?.[colIdx];
                          const isLow = typeof score === 'number' && score < 60;
                          return (
                            <td key={colIdx} className="px-2 py-2" style={{ width: '120px' }}>
                              <input
                                inputMode="numeric"
                                className="w-16 border rounded p-1"
                                value={score ?? ''}
                                ref={el => {
                                  if (!inputRefs.current[rowIdx]) inputRefs.current[rowIdx] = [];
                                  inputRefs.current[rowIdx][colIdx] = el;
                                }}
                                onChange={e => {
                                  const value = e.target.value;
                                  setStudents(prev => prev.map(s =>
                                    s.id === stu.id
                                      ? { ...s, regularScores: { ...s.regularScores, [colIdx]: value === '' ? undefined : parseInt(value, 10) } }
                                      : s
                                  ));
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (rowIdx < students.length - 1) {
                                      inputRefs.current[rowIdx + 1]?.[colIdx]?.focus();
                                    }
                                  }
                                }}
                              />
                              {/* 4. 小於60分標記* */}
                              {isLow && (
                                <span className="text-red-500 ml-1 font-bold">*</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* 成績資訊彈窗 */}
              {editingColumn !== null && selectedTab === 'regular' && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg shadow-lg p-6 min-w-[300px] w-full max-w-md max-h-[70vh] overflow-auto">
                    {/* 大標題最上方 */}
                    <div className="mb-4 font-bold text-lg">
                      {`第${editingColumn + 1}次成績資訊`}
                    </div>
                    {(() => {
                      const scores = students.map(stu => stu.regularScores?.[editingColumn]).filter(s => typeof s === 'number') as number[];
                      const levels = getTaiwanPercentileLevels(scores);
                      // 分布（10分一段，最後一格為100以上，且100以上在最前面）
                      const dist: {[k: string]: number} = {};
                      dist['100以上'] = 0;
                      for (let i = 90; i >= 0; i -= 10) dist[`${i}-${i+9}`] = 0;
                      scores.forEach(s => {
                        if (s >= 100) {
                          dist['100以上']++;
                        } else {
                          const bucket = `${Math.floor(s/10)*10}-${Math.floor(s/10)*10+9}`;
                          dist[bucket]++;
                        }
                      });
                      // 分布表每行兩格，100以上在最前面
                      const distEntries = Object.entries(dist) as [string, number][];
                      const distRows: [string, number][][] = [];
                      for (let i = 0; i < distEntries.length; i += 2) {
                        distRows.push(distEntries.slice(i, i+2));
                      }
                      const detail = columnDetails[editingColumn] || {};
                      return (
                        <>
                          {/* 平時成績：成績性質下方補上名稱和考試日期 */}
                          <div className="mb-3">
                            <label className="block mb-1">成績性質：</label>
                            <select
                              className="select-unified w-full"
                              value={detail.type || ''}
                              onChange={e => setColumnDetails(details => ({
                                ...details,
                                [editingColumn]: {
                                  ...details[editingColumn],
                                  type: e.target.value
                                }
                              }))}
                            >
                              <option value="">請選擇</option>
                              <option value="小考成績">小考成績</option>
                              <option value="作業成績">作業成績</option>
                              <option value="上課態度">上課態度</option>
                            </select>
                          </div>
                          <div className="mb-3">
                            <label className="block mb-1">名稱：</label>
                            <input
                              className="border rounded px-2 py-1 w-full"
                              value={detail.name || ''}
                              onChange={e => setColumnDetails(details => ({
                                ...details,
                                [editingColumn]: {
                                  ...details[editingColumn],
                                  name: e.target.value
                                }
                              }))}
                            />
                          </div>
                          <div className="mb-3">
                            <label className="block mb-1">考試日期：</label>
                            <input
                              type="date"
                              className="border rounded px-2 py-1 w-full"
                              value={detail.date || ''}
                              onChange={e => setColumnDetails(details => ({
                                ...details,
                                [editingColumn]: {
                                  ...details[editingColumn],
                                  date: e.target.value
                                }
                              }))}
                            />
                          </div>
                          {/* 五標與分布下移到這裡 */}
                          <div className="mb-3 mt-4">
                            <div className="mb-1 font-semibold">平均與五標：</div>
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
                            {/* 分布表格恢復，每行兩格，最高區間為100以上 */}
                            <div className="mb-1 font-semibold">成績分布：</div>
                            <table className="border text-base mt-2 w-full">
                              <tbody>
                                {distRows.map((row: [string, number][], idx: number) => (
                                  <tr key={idx}>
                                    {row.map(([range, count]: [string, number]) => (
                                      <React.Fragment key={range}>
                                        <td className="border px-2 py-1 font-bold text-center">{range}</td>
                                        <td className="border px-2 py-1 text-center">{count}</td>
                                      </React.Fragment>
                                    ))}
                                    {/* 若最後一行只有一格，補空格 */}
                                    {row.length === 1 && <><td className="border px-2 py-1"></td><td className="border px-2 py-1"></td></>}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      );
                    })()}
                    <div className="flex justify-between gap-2 mt-4">
                      <button
                        className="px-4 py-2 rounded bg-red-100 text-red-700 hover:bg-red-200"
                        onClick={() => {
                          // 刪除此欄
                          setRegularColumns(prev => prev > 1 ? prev - 1 : 1);
                          setStudents(prev => prev.map(stu => {
                            const newScores = { ...stu.regularScores };
                            delete newScores[editingColumn];
                            // 重新整理 index 以確保欄位順序
                            const reordered: { [key: string]: number | undefined } = {};
                            let c = 0;
                            for (let i = 0; i < prev.length; i++) {
                              if (i !== editingColumn) {
                                reordered[c] = newScores[i];
                                c++;
                              }
                            }
                            return { ...stu, regularScores: reordered };
                          }));
                          setColumnDetails(details => {
                            const newDetails = { ...details };
                            delete newDetails[editingColumn!];
                            // 重新整理 index
                            const reordered: { [key: string]: { type: string; name: string; date: string } } = {};
                            let c = 0;
                            for (let i = 0; i < regularColumns; i++) {
                              if (i !== editingColumn) {
                                reordered[c] = newDetails[i];
                                c++;
                              }
                            }
                            return reordered;
                          });
                          setEditingColumn(null);
                        }}
                        type="button"
                      >刪除此欄</button>
                      <button
                        className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
                        onClick={() => setEditingColumn(null)}
                        type="button"
                      >關閉</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {selectedTab === 'periodic' && (
            <div className="mb-8">
              {/* 按鈕區塊移到上方 */}
              <div className="grid grid-cols-2 gap-2 mb-4 md:flex md:gap-2 md:flex-nowrap md:overflow-x-auto">
                <button className="btn-primary min-w-[110px] flex-shrink-0" onClick={handleExport}>匯出成績</button>
                <button className="btn-success min-w-[110px] flex-shrink-0" onClick={handleImport}>匯入成績</button>
                <button className="btn-warning min-w-[110px] flex-shrink-0" onClick={openPercentModal}>百分比調整</button>
                <button
                  className="btn-danger min-w-[110px] flex-shrink-0"
                  onClick={handleSave}
                  disabled={isSaving}
                >{isSaving ? '儲存中...' : '儲存成績'}</button>
              </div>
              <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
                <table className="min-w-full border border-gray-200 rounded-lg" style={{ tableLayout: 'fixed', width: `${120 + 100 + (periodicScores.length * 120)}px` }}>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className={studentIdColClass} style={studentIdColStyle}>學號</th>
                      <th className={studentNameColClass} style={studentNameColStyle}>姓名</th>
                      {periodicScores.map((scoreName, idx) => (
                        <th key={idx} className="px-4 py-2 text-left text-sm font-semibold text-gray-700 whitespace-nowrap" style={{ width: '120px' }}>
                          <div className="flex flex-col items-start">
                            <span>{scoreName}</span>
                            <button
                              className="mt-1 text-blue-500 hover:text-blue-700 text-xs border border-blue-400 rounded px-2 py-0.5"
                              type="button"
                              onClick={() => setEditingColumn(idx)}
                            >成績資訊</button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((stu, rowIdx) => (
                      <tr key={stu.id} className="border-t">
                        <td className={studentIdTdClass} style={studentIdColStyle}>{stu.studentId}</td>
                        <td className={studentNameTdClass} style={studentNameColStyle}>{stu.name}</td>
                        {periodicScores.map((scoreName, colIdx) => {
                          const score = stu.periodicScores?.[scoreName];
                          const isLow = typeof score === 'number' && score < 60;
                          return (
                            <td key={colIdx} className="px-2 py-2" style={{ width: '120px' }}>
                              <input
                                inputMode="numeric"
                                className="w-16 border rounded p-1"
                                value={score ?? ''}
                                ref={el => {
                                  if (!inputRefs.current[rowIdx]) inputRefs.current[rowIdx] = [];
                                  inputRefs.current[rowIdx][colIdx] = el;
                                }}
                                onChange={e => {
                                  const value = e.target.value;
                                  setStudents(prev => prev.map(s =>
                                    s.id === stu.id
                                      ? { 
                                          ...s, 
                                          periodicScores: { 
                                            ...s.periodicScores, 
                                            [scoreName]: value === '' ? undefined : parseInt(value, 10) 
                                          } 
                                        }
                                      : s
                                  ));
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    if (rowIdx < students.length - 1) {
                                      inputRefs.current[rowIdx + 1]?.[colIdx]?.focus();
                                    }
                                  }
                                }}
                              />
                              {/* 小於60分標記* */}
                              {isLow && (
                                <span className="text-red-500 ml-1 font-bold">*</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* 定期評量成績資訊彈窗 */}
              {editingColumn !== null && selectedTab === 'periodic' && (
                <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg shadow-lg p-6 min-w-[300px] w-full max-w-md max-h-[70vh] overflow-auto">
                    <div className="mb-4 font-bold text-lg">
                      {`${periodicScores[editingColumn]}成績資訊`}
                    </div>
                    <div className="mb-3">
                      <label className="block mb-1">日期：</label>
                      <input
                        type="date"
                        className="border rounded px-2 py-1 w-full"
                        value={columnDetails[editingColumn]?.date || ''}
                        onChange={e => setColumnDetails(details => ({
                          ...details,
                          [editingColumn]: {
                            ...details[editingColumn],
                            date: e.target.value
                          }
                        }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="block mb-1">名稱：</label>
                      <input
                        className="border rounded px-2 py-1 w-full"
                        value={periodicScores[editingColumn]}
                        disabled
                      />
                    </div>
                    {/* 統計資訊 */}
                    {(() => {
                      const scores = students.map(stu => stu.periodicScores?.[periodicScores[editingColumn]]).filter(s => typeof s === 'number') as number[];
                      if (scores.length === 0) return <div className="mb-2 text-gray-500">尚無成績資料</div>;
                      const levels = getTaiwanPercentileLevels(scores);
                      // 分布（10分一段，最後一格為100以上）
                      const dist: {[k: string]: number} = {};
                      dist['100以上'] = 0;
                      for (let i = 90; i >= 0; i -= 10) dist[`${i}-${i+9}`] = 0;
                      scores.forEach(s => {
                        if (s >= 100) {
                          dist['100以上']++;
                        } else {
                          const bucket = `${Math.floor(s/10)*10}-${Math.floor(s/10)*10+9}`;
                          dist[bucket]++;
                        }
                      });
                      // 分布表每行兩格
                      const distEntries = Object.entries(dist) as [string, number][];
                      const distRows: [string, number][][] = [];
                      for (let i = 0; i < distEntries.length; i += 2) {
                        distRows.push(distEntries.slice(i, i+2));
                      }
                      return (
                        <>
                          <div className="mb-3 mt-4">
                            <div className="mb-1 font-semibold">平均與五標：</div>
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
                            {/* 分布表格恢復，每行兩格，最高區間為100以上 */}
                            <div className="mb-1 font-semibold">成績分布：</div>
                            <table className="border text-base mt-2 w-full">
                              <tbody>
                                {distRows.map((row: [string, number][], idx: number) => (
                                  <tr key={idx}>
                                    {row.map(([range, count]: [string, number]) => (
                                      <React.Fragment key={range}>
                                        <td className="border px-2 py-1 font-bold text-center">{range}</td>
                                        <td className="border px-2 py-1 text-center">{count}</td>
                                      </React.Fragment>
                                    ))}
                                    {/* 若最後一行只有一格，補空格 */}
                                    {row.length === 1 && <><td className="border px-2 py-1"></td><td className="border px-2 py-1"></td></>}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      );
                    })()}
                    <div className="flex justify-end gap-2 mt-4">
                      <button
                        className="px-4 py-2 rounded bg-gray-200 text-gray-800 hover:bg-gray-300"
                        onClick={() => setEditingColumn(null)}
                        type="button"
                      >關閉</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {selectedTab === 'total' && (
            <div className="mb-8">
              {/* 按鈕區塊移到上方 */}
              <div className="flex gap-2 mb-4 flex-nowrap overflow-x-auto">
                <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 min-w-[110px] flex-shrink-0" onClick={handleExport}>匯出成績</button>
                <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 min-w-[110px] flex-shrink-0" onClick={handleImport}>匯入成績</button>
                <button className="bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600 min-w-[110px] flex-shrink-0" onClick={openPercentModal}>百分比調整</button>
                <button
                  className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 min-w-[110px] flex-shrink-0"
                  onClick={handleSave}
                  disabled={isSaving}
                >{isSaving ? '儲存中...' : '儲存成績'}</button>
              </div>
              <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
                <table className="min-w-full border border-gray-200 rounded-lg" style={{ tableLayout: 'fixed', width: `${120 + 100 + 120*4}px` }}>
                  <thead>
                    <tr className="bg-gray-100">
                      <th className={studentIdColClass} style={studentIdColStyle}>學號</th>
                      <th className={studentNameColClass} style={studentNameColStyle}>姓名</th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700 whitespace-nowrap" style={{ width: '120px' }}>平時成績</th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700 whitespace-nowrap" style={{ width: '120px' }}>期中評量</th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700 whitespace-nowrap" style={{ width: '120px' }}>期末評量</th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700 whitespace-nowrap" style={{ width: '120px' }}>特殊加分</th>
                      <th className="px-4 py-2 text-center text-sm font-semibold text-gray-700 whitespace-nowrap" style={{ width: '120px' }}>總成績</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((stu) => {
                      // 平時成績計算
                      const { weighted: regularScore } = calcRegularScore(stu);
                      // 定期評量
                      const first = stu.periodicScores?.['第一次定期評量'] ?? 0;
                      const second = stu.periodicScores?.['第二次定期評量'] ?? 0;
                      const final = stu.periodicScores?.['期末評量'] ?? 0;
                      const midAvg = (Number(first) + Number(second)) / 2;
                      // 特殊加分
                      const manualAdjust = typeof stu.manualAdjust === 'number' ? stu.manualAdjust : 0;
                      // 平時成績顯示：現有平時成績數據 / (平時成績總%/100)
                      const percentRegularNum = typeof totalSetting.regularPercent === 'number' && !isNaN(totalSetting.regularPercent) ? totalSetting.regularPercent : 0;
                      const percentPeriodicNum = typeof totalSetting.periodicPercent === 'number' && !isNaN(totalSetting.periodicPercent) ? totalSetting.periodicPercent : 0;
                      const manualAdjustNum = typeof manualAdjust === 'number' && !isNaN(manualAdjust) ? manualAdjust : 0;
                      // 匯出時用 totalSetting.periodicEnabled
                      const periodicEnabledObj = totalSetting.periodicEnabled || {
                        '第一次定期評量': true,
                        '第二次定期評量': true,
                        '期末評量': true,
                      };
                      const periodicNames = ['第一次定期評量', '第二次定期評量', '期末評量'];
                      const enabledPeriodic = periodicNames.filter(name => periodicEnabledObj[name as PeriodicScoreName]);
                      const periodicVals: number[] = enabledPeriodic.map(name => {
                        const v = stu.periodicScores?.[name as PeriodicScoreName];
                        return typeof v === 'number' && !isNaN(v) ? v : 0;
                      });
                      const periodicAvgNum = enabledPeriodic.length > 0 ? (periodicVals as number[]).reduce((a, b) => a + b, 0) / enabledPeriodic.length : 0;
                      // 修正：正確計算總成績
                      const total = Math.round(
                        regularScore * percentRegularNum / 100 +
                        periodicAvgNum * percentPeriodicNum / 100 +
                        manualAdjustNum
                      );
                      return (
                        <tr key={stu.id} className="border-t">
                          <td className={studentIdTdClass} style={studentIdColStyle}>{stu.studentId}</td>
                          <td className={studentNameTdClass} style={studentNameColStyle}>{stu.name}</td>
                          <td className="px-4 py-2 text-center text-base">{regularScore.toFixed(1)}</td>
                          <td className="px-4 py-2 text-center text-base">{midAvg.toFixed(1)}</td>
                          <td className="px-4 py-2 text-center text-base">{final}</td>
                          <td className="px-4 py-2 text-center text-base">
                            <input
                              type="number"
                              inputMode="numeric"
                              className="border rounded px-2 py-1 w-20 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              min={-5}
                              max={5}
                              step={1}
                              value={manualAdjust}
                              onChange={e => {
                                let v = Number(e.target.value);
                                if (isNaN(v)) v = 0;
                                if (v > 5) v = 5;
                                if (v < -5) v = -5;
                                setStudents(prev => prev.map(s =>
                                  s.id === stu.id ? { ...s, manualAdjust: v } : s
                                ));
                              }}
                              onBlur={e => {
                                let v = Number(e.target.value);
                                if (isNaN(v)) v = 0;
                                if (v > 5) v = 5;
                                if (v < -5) v = -5;
                                setStudents(prev => prev.map(s =>
                                  s.id === stu.id ? { ...s, manualAdjust: v } : s
                                ));
                              }}
                            />
                          </td>
                          <td className="px-4 py-2 text-center text-base font-bold">{total}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* 在總成績表格上方顯示公式 */}
              <div className="mb-2 text-sm text-gray-600 font-mono">
                總成績 = 小考({totalSetting.regularDetail['平時測驗']?.percent ?? 0}%)
                + 作業({totalSetting.regularDetail['回家作業']?.percent ?? 0}%)
                + 上課態度({totalSetting.regularDetail['上課態度']?.percent ?? 0}%)
                + 定期評量({totalSetting.periodicPercent ?? 0}%)
              </div>
            </div>
          )}
          {/* 2. 百分比調整 Modal 內容重構 */}
          {showPercentModal && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-lg p-6 min-w-[400px] w-[480px]">
                <div className="mb-4 font-bold text-lg text-center">成績設定</div>
                <div className="mb-4 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block mb-1">小考成績 p%</label>
                      <input type="number" min={0} max={100} className="border rounded px-2 py-1 w-full text-center" value={percentQuizRaw} onChange={e=>setPercentQuizRaw(e.target.value)} />
                    </div>
                    <div>
                      <label className="block mb-1">作業成績 q%</label>
                      <input type="number" min={0} max={100} className="border rounded px-2 py-1 w-full text-center" value={percentHomeworkRaw} onChange={e=>setPercentHomeworkRaw(e.target.value)} />
                    </div>
                    <div>
                      <label className="block mb-1">上課態度 r%</label>
                      <input type="number" min={0} max={100} className="border rounded px-2 py-1 w-full text-center" value={percentAttitudeRaw} onChange={e=>setPercentAttitudeRaw(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block mb-1">平時成績 a%</label>
                      <input type="number" className="border rounded px-2 py-1 w-full text-center bg-gray-100" value={percentRegular} readOnly />
                    </div>
                    <div>
                      <label className="block mb-1">定期評量 b%</label>
                      <input type="number" className="border rounded px-2 py-1 w-full text-center bg-gray-100" value={percentPeriodic} readOnly />
                    </div>
                  </div>
                  <div className="text-center text-red-500 text-sm" style={{ minHeight: '1.5em' }}>
                    {(percentRegular > 100 || percentPeriodic < 0) && 'p+q+r 不可超過 100'}
                  </div>
                  {/* 各項模式與筆數顯示 */}
                  <div className="mt-2">
                    {quizMode==='best' && quizBestCount > Object.values(columnDetails).filter(col=>col.type==='小考成績').length && (
                      <div className="text-red-500 text-sm mb-1">擇優採計次數不可大於資料數，已自動調整</div>
                    )}
                    <div className="font-bold mb-1">小考成績模式（共{Object.values(columnDetails).filter(col=>col.type==='小考成績').length}筆）</div>
                    <select className="select-unified w-32 mr-2" value={quizMode} onChange={e=>setQuizMode(e.target.value as 'all' | 'best')}>
                      <option value="all">全部採計</option>
                      <option value="best">擇優採計</option>
                    </select>
                    {quizMode==='best' && <input type="number" min={1} max={Object.values(columnDetails).filter(col=>col.type==='小考成績').length} className="border rounded px-2 py-1 w-16" value={quizBestCount > Object.values(columnDetails).filter(col=>col.type==='小考成績').length ? Object.values(columnDetails).filter(col=>col.type==='小考成績').length : quizBestCount} onChange={e=>setQuizBestCount(Math.min(Number(e.target.value),Object.values(columnDetails).filter(col=>col.type==='小考成績').length))} />}<span className="ml-2 text-gray-500">前x筆高分平均</span>
                  </div>
                  <div className="mt-2">
                    {homeworkMode==='best' && homeworkBestCount > Object.values(columnDetails).filter(col=>col.type==='作業成績').length && (
                      <div className="text-red-500 text-sm mb-1">擇優採計次數不可大於資料數，已自動調整</div>
                    )}
                    <div className="font-bold mb-1">作業成績模式（共{Object.values(columnDetails).filter(col=>col.type==='作業成績').length}筆）</div>
                    <select className="select-unified w-32 mr-2" value={homeworkMode} onChange={e=>setHomeworkMode(e.target.value as 'all' | 'best')}>
                      <option value="all">全部採計</option>
                      <option value="best">擇優採計</option>
                    </select>
                    {homeworkMode==='best' && <input type="number" min={1} max={Object.values(columnDetails).filter(col=>col.type==='作業成績').length} className="border rounded px-2 py-1 w-16" value={homeworkBestCount > Object.values(columnDetails).filter(col=>col.type==='作業成績').length ? Object.values(columnDetails).filter(col=>col.type==='作業成績').length : homeworkBestCount} onChange={e=>setHomeworkBestCount(Math.min(Number(e.target.value),Object.values(columnDetails).filter(col=>col.type==='作業成績').length))} />}<span className="ml-2 text-gray-500">前x筆高分平均</span>
                  </div>
                  <div className="mt-2">
                    {attitudeMode==='best' && attitudeBestCount > Object.values(columnDetails).filter(col=>col.type==='上課態度').length && (
                      <div className="text-red-500 text-sm mb-1">擇優採計次數不可大於資料數，已自動調整</div>
                    )}
                    <div className="font-bold mb-1">上課態度模式（共{Object.values(columnDetails).filter(col=>col.type==='上課態度').length}筆）</div>
                    <select className="select-unified w-32 mr-2" value={attitudeMode} onChange={e=>setAttitudeMode(e.target.value as 'all' | 'best')}>
                      <option value="all">全部採計</option>
                      <option value="best">擇優採計</option>
                    </select>
                    {attitudeMode==='best' && <input type="number" min={1} max={Object.values(columnDetails).filter(col=>col.type==='上課態度').length} className="border rounded px-2 py-1 w-16" value={attitudeBestCount > Object.values(columnDetails).filter(col=>col.type==='上課態度').length ? Object.values(columnDetails).filter(col=>col.type==='上課態度').length : attitudeBestCount} onChange={e=>setAttitudeBestCount(Math.min(Number(e.target.value),Object.values(columnDetails).filter(col=>col.type==='上課態度').length))} />}<span className="ml-2 text-gray-500">前x筆高分平均</span>
                  </div>
                  <div className="mt-2">
                    <div className="font-bold mb-1">定期評量次數</div>
                    {[0,1,2].map(i=>(
                      <label key={i} className="mr-4">
                        <input type="checkbox" checked={periodicEnabled[i] || false} onChange={()=>setPeriodicEnabled(arr=>arr.map((v,idx)=>idx===i?!v:v))} />
                        {['第一次定期評量','第二次定期評量','期末評量'][i]}
                      </label>
                    ))}
                    {/* 新增：目前採計提示 */}
                    <div className="mt-2 text-sm text-blue-700">
                      目前採計：{
                        periodicEnabled.map((v,i)=>v?['第一次定期評量','第二次定期評量','期末評量'][i]:null).filter(Boolean).join('、') || '（無）'
                      }
                    </div>
                  </div>
                </div>
                <div className="flex justify-center gap-4 mt-4">
                  <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 min-w-[110px]" disabled={percentRegular>100||percentPeriodic<0} onClick={async ()=>{
                    setShowPercentModal(false);
                    await handleSave();
                  }}>儲存</button>
                  <button className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 min-w-[110px]" onClick={()=>setShowPercentModal(false)}>取消</button>
                </div>
              </div>
            </div>
          )}
          {/* 離開確認彈窗 */}
          {showLeaveConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-lg p-6 min-w-[400px] w-[400px]">
                <div className="mb-4 font-bold text-lg text-center">確認離開</div>
                <div className="mb-4 text-center">
                  您有未儲存的變更，確定要離開嗎？
                </div>
                <div className="flex justify-center gap-4 mt-4">
                  <button
                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 min-w-[110px]"
                    onClick={confirmLeave}
                  >確定離開</button>
                  <button
                    className="bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500 min-w-[110px]"
                    onClick={cancelLeave}
                  >取消</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 