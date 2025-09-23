'use client';

import React, { useState, useEffect, useRef } from 'react';
import * as ExcelJS from 'exceljs';
import CourseDetailModal from './CourseDetailModal';
import Swal from 'sweetalert2';
import { Modal } from './ui';
import Dropdown from './ui/Dropdown';
import LoadingSpinner from './LoadingSpinner';


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

interface PercentileStatistics {
  平均: number | null;
  頂標: number | null;
  前標: number | null;
  均標: number | null;
  後標: number | null;
  底標: number | null;
}

// 型別定義
type RegularType = '小考' | '作業' | '上課態度';

type RegularScoreSetting = {
  type: RegularType;
  percent: number;
  calcMethod: '平均' | '前N高' | '前N低';
  n?: number;
};

type PeriodicScoreName = '第一次定期評量' | '第二次定期評量' | '期末評量';

// 新增：ColumnDetail 類型定義
type ColumnDetail = {
  type: string;
  name: string;
  date: string;
};

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
function getTaiwanPercentileLevels(scores: number[]): PercentileStatistics {
  if (scores.length === 0) return { 頂標: null, 前標: null, 均標: null, 後標: null, 底標: null, 平均: null };
  const sorted = [...scores].sort((a, b) => b - a); // 由高到低
  const n = sorted.length;
  const levels: PercentileStatistics = { 頂標: null, 前標: null, 均標: null, 後標: null, 底標: null, 平均: null };
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
  const [selectedCourse, setSelectedCourse] = useState<string>('');
  const [selectedCourseName, setSelectedCourseName] = useState('');
  const [selectedCourseCode, setSelectedCourseCode] = useState('');
  const [students, setStudents] = useState<StudentGradeRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'regular' | 'periodic' | 'total'>('regular');
  const [regularColumns, setRegularColumns] = useState<number>(DEFAULT_REGULAR_COLUMNS);
  const [regularSettings, setRegularSettings] = useState<RegularScoreSetting[]>([
    { type: '小考', percent: 40, calcMethod: '平均', n: undefined },
    { type: '作業', percent: 40, calcMethod: '平均', n: undefined },
    { type: '上課態度', percent: 20, calcMethod: '平均', n: undefined },
  ]);
  const [periodicScores, setPeriodicScores] = useState<PeriodicScoreName[]>(['第一次定期評量', '第二次定期評量', '期末評量']);
  const [totalSetting, setTotalSetting] = useState<TotalScoreSetting>({
    regularPercent: 60,
    periodicPercent: 40,
    manualAdjust: 0,
    regularDetail: {
      '小考': { percent: 40, calcMethod: '平均' },
      '作業': { percent: 40, calcMethod: '平均' },
      '上課態度': { percent: 20, calcMethod: '平均' },
    },
  });
  const [columnDetails, setColumnDetails] = useState<{ [idx: number]: ColumnDetail }>({});
  const [editingColumn, setEditingColumn] = useState<number | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[][]>([]);
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [showPercentModal, setShowPercentModal] = useState(false);
  // 1. 新增 state：小考p%、作業q%、上課態度r%、特殊加分c、定期評量次數勾選、各項模式
  const [percentQuizRaw, setPercentQuizRaw] = useState<string>('40');
  const [percentHomeworkRaw, setPercentHomeworkRaw] = useState<string>('40');
  const [percentAttitudeRaw, setPercentAttitudeRaw] = useState<string>('20');
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
  const [showCourseDetail, setShowCourseDetail] = useState<{ id: string; name: string; code: string } | null>(null);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [isDistributionModalOpen, setIsDistributionModalOpen] = useState(false);
  const [distributionData, setDistributionData] = useState<DistributionData | null>(null);
  const [courseStats, setCourseStats] = useState<Record<string, { studentCount: number; examStatus: Record<PeriodicScoreName, boolean> }>>({});
  const [isCourseListLoading, setIsCourseListLoading] = useState(false);
  const [isGradeDataLoading, setIsGradeDataLoading] = useState(false);
  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null);


  const handleShowSettings = (colIdx: number) => {
    setEditingColumn(colIdx);
    const scores = students.map(s => s.regularScores?.[colIdx]).filter(score => typeof score === 'number' && !isNaN(score)) as number[];
    const stats = getTaiwanPercentileLevels(scores);
    const distribution = [
        { range: '90-100', count: 0 },
        { range: '80-89', count: 0 },
        { range: '70-79', count: 0 },
        { range: '60-69', count: 0 },
        { range: '50-59', count: 0 },
        { range: '<50', count: 0 },
    ];
    scores.forEach(score => {
        if (score >= 90) distribution[0].count++;
        else if (score >= 80) distribution[1].count++;
        else if (score >= 70) distribution[2].count++;
        else if (score >= 60) distribution[3].count++;
        else if (score >= 50) distribution[4].count++;
        else distribution[5].count++;
    });
    setDistributionData({ statistics: stats, distribution });
    
    setIsDistributionModalOpen(true);
  };

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
      }
    };

    const handlePopState = async () => {
      if (hasUnsavedChanges) {
        const result = await Swal.fire({
          title: '請確認',
          text: '您有未儲存的變更，確定要離開嗎？',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonText: '確定離開',
          cancelButtonText: '取消'
        });
        if (!result.isConfirmed) {
          window.history.pushState(null, '', window.location.href);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, [hasUnsavedChanges]);

  // 獲取老師資料
  const fetchTeachers = async () => {
    try {
      const res = await fetch('/api/teacher/list');
      if (res.ok) {
        const teachersData = await res.json();
        setTeachers(teachersData);
      }
    } catch (_error) {
      console.error('獲取老師資料時發生錯誤:', _error);
    }
  };

  useEffect(() => {
    if (!userInfo || !userInfo.id) {
      setCourses([]);
      return;
    }
    (async () => {
      setIsCourseListLoading(true);
      try {
        const resCourses = await fetch('/api/courses/list');
        const allCourses = await resCourses.json();
        if (!Array.isArray(allCourses)) {
          throw new Error('課程資料格式錯誤');
        }
        const teacherCourses = allCourses.filter((c: { teachers?: string[], name?: string, code?: string }) => Array.isArray(c.teachers) && c.teachers.includes(userInfo.id) && c.name && c.code);
        setCourses(teacherCourses);

        const courseStatsPromises = teacherCourses.map(async (course) => {
          const studentRes = await fetch(`/api/course-student-list/list`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseName: course.name, courseCode: course.code }),
          });
          const studentList = await studentRes.json();
          if (!Array.isArray(studentList)) {
            throw new Error('學生資料格式錯誤');
          }
          const studentCount = studentList.length;

          const gradeRes = await fetch('/api/grades/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseKeys: [`${course.name}(${course.code})`] }),
          });
          const gradeData = (await gradeRes.json())[`${course.name}(${course.code})`];
          const examStatus = {
            '第一次定期評量': false,
            '第二次定期評量': false,
            '期末評量': false,
          };
          if (gradeData && gradeData.students) {
            for (const student of gradeData.students) {
              if (student.periodicScores?.['第一次定期評量'] !== undefined) examStatus['第一次定期評量'] = true;
              if (student.periodicScores?.['第二次定期評量'] !== undefined) examStatus['第二次定期評量'] = true;
              if (student.periodicScores?.['期末評量'] !== undefined) examStatus['期末評量'] = true;
            }
          }
          return { courseId: course.id, studentCount, examStatus };
        });

        const courseStatsResults = await Promise.all(courseStatsPromises);
        const newCourseStats: Record<string, { studentCount: number; examStatus: Record<PeriodicScoreName, boolean> }> = {};
        courseStatsResults.forEach(stat => {
          newCourseStats[stat.courseId] = { studentCount: stat.studentCount, examStatus: stat.examStatus };
        });
        setCourseStats(newCourseStats);
      } catch (_error: unknown) {
        console.error('載入課程資料時發生錯誤:', _error);
        Swal.fire('錯誤', _error instanceof Error ? _error.message : String(_error), 'error');
      } finally {
        setIsCourseListLoading(false);
      }
    })()
  }, [userInfo]);

  // 獲取老師資料
  useEffect(() => {
    fetchTeachers();
  }, []);

  useEffect(() => {
    if (selectedCourseName && selectedCourseCode) {
      // 載入學生列表
      (async () => {
        setIsGradeDataLoading(true);
        try {
          const res = await fetch('/api/course-student-list/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseName: selectedCourseName, courseCode: selectedCourseCode }),
          });
          const studentList = await res.json();
          if (!Array.isArray(studentList)) {
            throw new Error('學生資料格式錯誤');
          }
          const initialStudents = studentList.map((stu: { studentId: string; name: string; grade: string }) => ({
            id: stu.studentId,
            studentId: stu.studentId,
            name: stu.name,
            grade: stu.grade,
            regularScores: {},
            periodicScores: {},
            totalScore: 0,
            manualAdjust: 0,
          }));

          // 載入現有成績資料
          const courseKey = `${selectedCourseName}(${selectedCourseCode})`;
          const resGrades = await fetch('/api/grades/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseKeys: [courseKey] }),
          });
          const gradesResult = await resGrades.json();
          const gradeData = gradesResult ? gradesResult[courseKey] : null;

          if (gradeData && Array.isArray(gradeData.students)) {
            const gradeDataStudentsMap = new Map(gradeData.students.map((s: StudentGradeRow) => [s.studentId, s]));
            const mergedStudents = initialStudents.map((s: StudentGradeRow) => {
              const savedStudentData = gradeDataStudentsMap.get(s.studentId);
              return savedStudentData ? { ...s, ...(savedStudentData as StudentGradeRow) } : s;
            });
            setStudents(mergedStudents);
          } else {
            setStudents(initialStudents);
          }
          
          if (gradeData) {
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
                regularPercent: gradeData.totalSetting.regularPercent ?? 60,
                periodicPercent: gradeData.totalSetting.periodicPercent ?? 40,
                manualAdjust: gradeData.totalSetting.manualAdjust ?? 0,
                regularDetail: gradeData.totalSetting.regularDetail ?? {
                  '小考': { percent: 40, calcMethod: '平均' },
              '作業': { percent: 40, calcMethod: '平均' },
              '上課態度': { percent: 20, calcMethod: '平均' },
                }
              });
              // 同步 percentQuiz/percentHomework/percentAttitude
              setPercentQuizRaw(String(gradeData.totalSetting.regularDetail?.['小考']?.percent ?? '40'));
              setPercentHomeworkRaw(String(gradeData.totalSetting.regularDetail?.['作業']?.percent ?? '40'));
              setPercentAttitudeRaw(String(gradeData.totalSetting.regularDetail?.['上課態度']?.percent ?? '20'));
            } else {
              setTotalSetting({
                regularPercent: 60,
                periodicPercent: 40,
                manualAdjust: 0,
                regularDetail: {
                  '小考': { percent: 40, calcMethod: '平均' },
                  '作業': { percent: 40, calcMethod: '平均' },
                  '上課態度': { percent: 20, calcMethod: '平均' },
                }
              });
              setPercentQuizRaw('40');
              setPercentHomeworkRaw('40');
              setPercentAttitudeRaw('20');
            }
          } else {
            setTotalSetting({
              regularPercent: 60,
              periodicPercent: 40,
              manualAdjust: 0,
              regularDetail: {
                '小考': { percent: 20, calcMethod: '平均' },
                '作業': { percent: 10, calcMethod: '平均' },
                '上課態度': { percent: 10, calcMethod: '平均' },
              }
            });
            setPercentQuizRaw('20');
            setPercentHomeworkRaw('10');
            setPercentAttitudeRaw('10');
          }
        } catch (error: unknown) {
          console.error('載入成績資料時發生錯誤:', error);
          Swal.fire('錯誤', error instanceof Error ? error.message : String(error), 'error');
        } finally {
          setIsGradeDataLoading(false);
          setLoadingCourseId(null);
        }
      })();
    } else {
      setStudents([]);
      setTotalSetting({
        regularPercent: 60,
        periodicPercent: 40,
        manualAdjust: 0,
        regularDetail: {
          '小考': { percent: 20, calcMethod: '平均' },
          '作業': { percent: 10, calcMethod: '平均' },
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
      Swal.fire('警告', '請先選擇課程', 'warning');
      return;
    }
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
        '小考': {
          ...(totalSetting.regularDetail['小考'] || {}),
          percent: percentQuiz
        },
        '作業': {
          ...(totalSetting.regularDetail['作業'] || {}),
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
      Swal.fire('成功', '成績已儲存！', 'success');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExport = () => {
    if (!selectedCourseName || !selectedCourseCode || students.length === 0) {
      Swal.fire('警告', '請先選擇課程且有學生資料', 'warning');
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${selectedCourseName} 成績`);

    // Define columns
    const columns: Partial<ExcelJS.Column>[] = [
      { header: '學號', key: 'studentId', width: 15 },
      { header: '姓名', key: 'name', width: 15 },
    ];

    // Add regular score columns
    const regularScoreColumns: Partial<ExcelJS.Column>[] = [];
    for (let i = 0; i < regularColumns; i++) {
      const detail = columnDetails[i];
      let displayName = `成績${i + 1}`;
      if (detail && detail.type) {
        const count = Array.from({ length: i + 1 }).filter((_, k) => (columnDetails[k]?.type) === detail.type).length;
        displayName = `${detail.type}${count}`;
      }
      if (detail.name && detail.name.trim() !== '') {
        displayName = detail.name;
      }
      regularScoreColumns.push({ header: displayName, key: `regular${i}`, width: 12 });
    }

    // Add periodic score columns
    const periodicScoreColumns: Partial<ExcelJS.Column>[] = periodicScores.map(scoreName => ({
        header: scoreName, key: scoreName, width: 15
    }));

    const totalScoreColumns: Partial<ExcelJS.Column>[] = [
        { header: '總成績', key: 'totalScore', width: 10 },
        { header: '備註', key: 'remark', width: 20 },
    ];

    worksheet.columns = [...columns, ...regularScoreColumns, ...periodicScoreColumns, ...totalScoreColumns];

    // Add rows
    students.forEach(student => {
        const row: { [key: string]: any } = {
          studentId: student.studentId,
          name: student.name,
          remark: student.remark || '',
        };
      for (let i = 0; i < regularColumns; i++) {
        row[`regular${i}`] = student.regularScores[i] ?? '';
      }
      
      // periodic scores
      periodicScores.forEach(scoreName => {
        row[scoreName] = student.periodicScores[scoreName] ?? '';
      });

      // total score
      const { weighted: regularScore } = calcRegularScore(student);
      const periodicEnabledObj = totalSetting.periodicEnabled || {};
      const enabledPeriodic = periodicScores.filter(name => periodicEnabledObj[name as PeriodicScoreName]);
      const periodicVals: number[] = enabledPeriodic.map(name => {
        const v = student.periodicScores?.[name as PeriodicScoreName];
        return typeof v === 'number' && !isNaN(v) ? v : 0;
      });
      const periodicAvgNum = enabledPeriodic.length > 0 ? periodicVals.reduce((a, b) => a + b, 0) / enabledPeriodic.length : 0;
      const manualAdjustNum = typeof student.manualAdjust === 'number' && !isNaN(student.manualAdjust) ? student.manualAdjust : 0;
      
      row.totalScore = Math.round(
        regularScore * (totalSetting.regularPercent / 100) +
        periodicAvgNum * (totalSetting.periodicPercent / 100) +
        manualAdjustNum
      );

      worksheet.addRow(row);
    });

    workbook.xlsx.writeBuffer().then((buffer: ArrayBuffer) => {
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedCourseName}_${selectedCourseCode}_成績.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      Swal.fire({
        title: '匯出完成',
        text: 'Excel 檔案已下載到您的電腦',
        icon: 'success',
        showConfirmButton: true,
        confirmButtonText: '確定',
        timer: 3000,
        timerProgressBar: true,
        allowOutsideClick: false,
        allowEscapeKey: true,
        customClass: {
          popup: 'animate-bounce-in',
          title: 'text-green-600'
        }
      });
    });
  };

  const handleImport = () => {
    // TODO: import from CSV/Excel
    Swal.fire('提示', '匯入功能尚未實作', 'info');
  };

  // 輔助函數：平時成績計算
  function calcRegularScore(stu: StudentGradeRow): { quizAvg: number; homeworkAvg: number; attitudeAvg: number; weighted: number } {
    // 小考
    const quizScores = Object.entries(stu.regularScores || {})
      .filter(([idx]) => {
        const detail: ColumnDetail | undefined = columnDetails[Number(idx)];
        return detail?.type === '小考';
      })
      .map(([, v]) => typeof v === 'number' ? v : undefined)
      .filter((v): v is number => typeof v === 'number');
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
      .filter(([idx]) => {
        const detail: ColumnDetail | undefined = columnDetails[Number(idx)];
        return detail?.type === '作業';
      })
      .map(([, v]) => typeof v === 'number' ? v : undefined)
      .filter((v): v is number => typeof v === 'number');
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
      .filter(([idx]) => {
        const detail: ColumnDetail | undefined = columnDetails[Number(idx)];
        return detail?.type === '上課態度';
      })
      .map(([, v]) => typeof v === 'number' ? v : undefined)
      .filter((v): v is number => typeof v === 'number');
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

  // 處理課程詳細資訊顯示
  const handleShowCourseDetail = (course: { id: string; name: string; code: string }) => {
    setShowCourseDetail(course);
  };

  const handleAddColumn = () => {
    setRegularColumns(prev => prev + 1);
  };

  // 處理刪除課程欄位
  const handleDeleteColumn = () => {
    if (editingColumn !== null) {
      // 移除該欄位的成績資料
      setStudents(prev => prev.map(stu => {
        const newRegularScores = { ...stu.regularScores };
        delete newRegularScores[editingColumn];
        // 重新整理 index 以確保欄位順序
        const reordered: { [key: string]: number | undefined } = {};
        let c = 0;
        for (let i = 0; i < regularColumns; i++) {
          if (i !== editingColumn) {
            reordered[c] = newRegularScores[i];
            c++;
          }
        }
        return { ...stu, regularScores: reordered };
      }));
      
      // 移除欄位詳細資訊
      setColumnDetails(prev => {
        const newDetails = { ...prev };
        delete newDetails[editingColumn];
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
      
      // 減少欄位數量
      setRegularColumns(prev => Math.max(1, prev - 1));
      
      // 關閉彈窗
      setEditingColumn(null);
      setShowCourseDetail(null);
    }
  };

  // 讀取時初始化 periodicEnabled 狀態
  useEffect(() => {
    if (totalSetting && totalSetting.periodicEnabled) {
      const PERIODIC_SCORE_NAMES: PeriodicScoreName[] = ['第一次定期評量', '第二次定期評量', '期末評量'];
      setPeriodicEnabled(PERIODIC_SCORE_NAMES.map(name => !!totalSetting.periodicEnabled?.[name]));
    }
  }, [totalSetting]);

  if (isCourseListLoading) {
    return (
      <div className="flex items-center justify-center p-4 md:p-8 h-full bg-gray-100">
        <div className="loading-spinner h-12 w-12"></div>
        <span className="ml-4 text-blue-600 text-lg md:text-xl font-semibold">成績資料載入中...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full p-4 h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-6 flex-shrink-0">成績資料管理</h2>
      {!selectedCourse ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">課程</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">學生人數</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">第一次段考</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">第二次段考</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">期末考</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {courses.map(course => (
                <tr key={course.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium">{course.name}</div>
                    <div className="text-sm text-gray-500">{course.code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">{courseStats[course.id]?.studentCount ?? '...'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {courseStats[course.id]?.examStatus['第一次定期評量'] ? '已上傳' : '未上傳'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {courseStats[course.id]?.examStatus['第二次定期評量'] ? '已上傳' : '未上傳'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    {courseStats[course.id]?.examStatus['期末評量'] ? '已上傳' : '未上傳'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      className="btn-primary"
                      disabled={isGradeDataLoading}
                      onClick={() => {
                        setIsGradeDataLoading(true);
                        setLoadingCourseId(course.id);
                        setSelectedCourse(course.id);
                        setSelectedCourseName(course.name);
                        setSelectedCourseCode(course.code);
                      }}
                    >
                      {isGradeDataLoading && loadingCourseId === course.id ? (
                        <LoadingSpinner size={20} color="white" />
                      ) : (
                        '管理成績'
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mb-4">
          <button
            className="btn-secondary"
            onClick={() => {
              setSelectedCourse('');
              setSelectedCourseName('');
              setSelectedCourseCode('');
            }}
          >
            返回課程列表
          </button>
        </div>
      )}
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
                <button type="button" className="btn-info min-w-[110px] flex-shrink-0" onClick={handleAddColumn}>增加欄位</button>
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
                        const detail = columnDetails[idx];
                        // 依 type 與同類型順序命名
                        let displayName = '';
                        if (detail?.type === '作業') {
                          const count = Array.from({ length: idx + 1 }).filter((_, i) => (columnDetails[i]?.type) === '作業').length;
                          displayName = `作業${count}`;
                        } else if (detail?.type === '上課態度') {
                          const count = Array.from({ length: idx + 1 }).filter((_, i) => (columnDetails[i]?.type) === '上課態度').length;
                          displayName = `上課態度${count}`;
                        } else if (detail?.type === '小考') {
                          const count = Array.from({ length: idx + 1 }).filter((_, i) => (columnDetails[i]?.type) === '小考').length;
                          displayName = `小考${count}`;
                        } else {
                          displayName = detail?.name?.trim() ? detail.name : `成績${idx + 1}`;
                        }
                        return (
                          <th key={idx} className="px-4 py-2 text-left text-sm font-semibold text-gray-700 whitespace-nowrap" style={{ width: '120px' }}>
                            <div className="flex flex-col items-start">
                              <span>{displayName}</span>
                              <button
                                className="mt-1 text-blue-500 hover:text-blue-700 text-xs border border-blue-400 rounded px-2 py-0.5"
                                type="button"
                                onClick={() => handleShowSettings(idx)}
                              >成績設定</button>
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
                      onBlur={e => {
                        const value = e.target.value;
                        if (value !== '') {
                          const numValue = parseInt(value, 10);
                          if (numValue < 0) {
                            setStudents(prev => prev.map(s =>
                              s.id === stu.id
                                ? { ...s, regularScores: { ...s.regularScores, [colIdx]: 0 } }
                                : s
                            ));
                          } else if (numValue > 100) {
                            setStudents(prev => prev.map(s =>
                              s.id === stu.id
                                ? { ...s, regularScores: { ...s.regularScores, [colIdx]: 100 } }
                                : s
                            ));
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
              {/* 平時成績課程詳細資訊模態框 */}
              <CourseDetailModal
                course={showCourseDetail}
                teachers={teachers}
                open={!!showCourseDetail && selectedTab === 'regular'}
                onClose={() => {
                  setShowCourseDetail(null);
                  setEditingColumn(null);
                }}
                showDescription={false}
                showStudents={false}
                showDeleteButton={true}
                onDelete={handleDeleteColumn}
                isGradeInfo={true}
                isPeriodic={false}
                editingColumn={editingColumn}
                columnDetails={columnDetails}
                onColumnDetailsChange={setColumnDetails}
                students={students}
                getTaiwanPercentileLevels={getTaiwanPercentileLevels}
                periodicScores={periodicScores}
              />

              {/* 平時成績分析卡片（已移除） */}
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
                              onClick={() => {
                                setEditingColumn(idx);
                                // 創建一個簡化的課程資訊物件
                                const tempCourse = {
                                  id: `periodic-${idx}`,
                                  name: `${periodicScores[idx]}成績`,
                                  code: `PERIODIC-${idx + 1}`
                                };
                                handleShowCourseDetail(tempCourse);
                              }}
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
              {/* 定期評量課程詳細資訊模態框 */}
              <CourseDetailModal
                course={showCourseDetail}
                teachers={teachers}
                open={!!showCourseDetail && selectedTab === 'periodic'}
                onClose={() => {
                  setShowCourseDetail(null);
                  setEditingColumn(null);
                }}
                showDescription={false}
                showStudents={false}
                showDeleteButton={false}
                isGradeInfo={true}
                isPeriodic={true}
                editingColumn={editingColumn}
                columnDetails={columnDetails}
                onColumnDetailsChange={setColumnDetails}
                students={students}
                getTaiwanPercentileLevels={getTaiwanPercentileLevels}
                periodicScores={periodicScores}
              />

              
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
                      const PERIODIC_SCORE_NAMES = ['第一次定期評量', '第二次定期評量', '期末評量'];
                      const enabledPeriodic = PERIODIC_SCORE_NAMES.filter(name => periodicEnabledObj[name as PeriodicScoreName]);
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
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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
                總成績 = 小考({totalSetting.regularDetail['小考']?.percent ?? 0}%)
                + 作業({totalSetting.regularDetail['作業']?.percent ?? 0}%)
                + 上課態度({totalSetting.regularDetail['上課態度']?.percent ?? 0}%)
                + 定期評量({totalSetting.periodicPercent ?? 0}%)
              </div>
            </div>
          )}
          {/* 2. 百分比調整 Modal 內容重構 */}
                    <Modal
  open={showPercentModal}
  onClose={() => setShowPercentModal(false)}
  title="百分比調整"
  size="lg"
>
  <div className="space-y-6">
    {/* 成績設定 */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">小考 (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          value={percentQuizRaw}
          onChange={e => setPercentQuizRaw(e.target.value)}
          className="w-full border border-gray-300 p-3 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">作業 (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          value={percentHomeworkRaw}
          onChange={e => setPercentHomeworkRaw(e.target.value)}
          className="w-full border border-gray-300 p-3 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">上課態度 (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          value={percentAttitudeRaw}
          onChange={e => setPercentAttitudeRaw(e.target.value)}
          className="w-full border border-gray-300 p-3 rounded-lg"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">平時成績 (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          value={percentRegular}
          readOnly
          className="w-full border border-gray-300 p-3 rounded-lg bg-gray-50"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">定期評量 (%)</label>
        <input
          type="number"
          min="0"
          max="100"
          value={percentPeriodic}
          readOnly
          className="w-full border border-gray-300 p-3 rounded-lg bg-gray-50"
        />
      </div>
    </div>

    {/* 百分比總和驗證 */}
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="text-sm text-gray-600 mb-2">平時成績總和：{percentRegular}%</div>
      <div className="text-sm text-gray-600 mb-2">總成績總和：{percentRegular + percentPeriodic}%</div>
      {(percentRegular > 100 || percentPeriodic < 0) && (
        <div className="text-red-600 text-sm">⚠️ p+q+r 不可超過 100</div>
      )}
    </div>

    {/* 採計模式設定 */}
    <div className="space-y-4">
      <h4 className="font-semibold text-gray-900">成績採計模式</h4>
      
      {/* 小考採計模式 */}
      <div className="border rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">小考成績採計（共{Object.values(columnDetails).filter((col: ColumnDetail)=>col.type==='小考').length}筆）</label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="quizMode"
              value="all"
              checked={quizMode === 'all'}
              onChange={e => setQuizMode(e.target.value as 'all' | 'best')}
              className="mr-2"
            />
            全部採計
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="quizMode"
              value="best"
              checked={quizMode === 'best'}
              onChange={e => setQuizMode(e.target.value as 'all' | 'best')}
              className="mr-2"
            />
            擇優採計
          </label>
          {quizMode === 'best' && (
            <div className="ml-6">
              <label className="block text-sm text-gray-600 mb-1">採計次數：</label>
              <input
                type="number"
                min="1"
                max={Object.values(columnDetails).filter((col: ColumnDetail)=>col.type==='小考').length}
                value={quizBestCount}
                onChange={e => setQuizBestCount(Math.min(Number(e.target.value), Object.values(columnDetails).filter((col: ColumnDetail)=>col.type==='小考').length))}
                className="w-20 border border-gray-300 p-1 rounded"
              />
              {quizBestCount > Object.values(columnDetails).filter((col: ColumnDetail)=>col.type==='小考').length && (
                <div className="text-red-500 text-sm mt-1">⚠️ 採計次數不可大於資料數</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 作業採計模式 */}
      <div className="border rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">作業成績採計（共{Object.values(columnDetails).filter((col: ColumnDetail)=>col.type==='作業').length}筆）</label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="homeworkMode"
              value="all"
              checked={homeworkMode === 'all'}
              onChange={e => setHomeworkMode(e.target.value as 'all' | 'best')}
              className="mr-2"
            />
            全部採計
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="homeworkMode"
              value="best"
              checked={homeworkMode === 'best'}
              onChange={e => setHomeworkMode(e.target.value as 'all' | 'best')}
              className="mr-2"
            />
            擇優採計
          </label>
          {homeworkMode === 'best' && (
            <div className="ml-6">
              <label className="block text-sm text-gray-600 mb-1">採計次數：</label>
              <input
                type="number"
                min="1"
                max={Object.values(columnDetails).filter((col: ColumnDetail)=>col.type==='作業').length}
                value={homeworkBestCount}
                onChange={e => setHomeworkBestCount(Math.min(Number(e.target.value), Object.values(columnDetails).filter((col: ColumnDetail)=>col.type==='作業').length))}
                className="w-20 border border-gray-300 p-1 rounded"
              />
              {homeworkBestCount > Object.values(columnDetails).filter((col: ColumnDetail)=>col.type==='作業').length && (
                <div className="text-red-500 text-sm mt-1">⚠️ 採計次數不可大於資料數</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 上課態度採計模式 */}
      <div className="border rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">上課態度採計（共{Object.values(columnDetails).filter((col: ColumnDetail)=>col.type==='上課態度').length}筆）</label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="attitudeMode"
              value="all"
              checked={attitudeMode === 'all'}
              onChange={e => setAttitudeMode(e.target.value as 'all' | 'best')}
              className="mr-2"
            />
            全部採計
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="attitudeMode"
              value="best"
              checked={attitudeMode === 'best'}
              onChange={e => setAttitudeMode(e.target.value as 'all' | 'best')}
              className="mr-2"
            />
            擇優採計
          </label>
          {attitudeMode === 'best' && (
            <div className="ml-6">
              <label className="block text-sm text-gray-600 mb-1">採計次數：</label>
              <input
                type="number"
                min="1"
                max={Object.values(columnDetails).filter((col: ColumnDetail)=>col.type==='上課態度').length}
                value={attitudeBestCount}
                onChange={e => setAttitudeBestCount(Math.min(Number(e.target.value), Object.values(columnDetails).filter((col: ColumnDetail)=>col.type==='上課態度').length))}
                className="w-20 border border-gray-300 p-1 rounded"
              />
              {attitudeBestCount > Object.values(columnDetails).filter((col: ColumnDetail)=>col.type==='上課態度').length && (
                <div className="text-red-500 text-sm mt-1">⚠️ 採計次數不可大於資料數</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 定期評量採計 */}
      <div className="border rounded-lg p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">定期評量採計</label>
        <div className="space-y-2">
          {[0,1,2].map(i=>(
            <label key={i} className="flex items-center">
              <input
                type="checkbox"
                checked={periodicEnabled[i] || false}
                onChange={()=>setPeriodicEnabled(arr=>arr.map((v,idx)=>idx===i?!v:v))}
                className="mr-2"
              />
              {['第一次定期評量','第二次定期評量','期末評量'][i]}
            </label>
          ))}
          <div className="text-sm text-blue-600 mt-2">
            目前採計：{
              periodicEnabled.map((v,i)=>v?['第一次定期評量','第二次定期評量','期末評量'][i]:null).filter(Boolean).join('、') || '（無）'
            }
          </div>
        </div>
      </div>
    </div>

    {/* 按鈕區域 */}
    <div className="flex justify-end space-x-3 pt-4 border-t">
      <button
        onClick={() => setShowPercentModal(false)}
        className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
      >
        取消
      </button>
      <button
        onClick={async () => {
          setShowPercentModal(false);
          await handleSave();
        }}
        disabled={percentRegular>100||percentPeriodic<0}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        儲存
      </button>
    </div>
  </div>
</Modal>          {/* 離開確認彈窗 */}
          

          {isDistributionModalOpen && distributionData && editingColumn !== null && (
            <Modal
              open={isDistributionModalOpen}
              onClose={() => {
                setIsDistributionModalOpen(false);
                setEditingColumn(null);
              }}
              title="成績設定"
              size="lg"
            >
              <div className="space-y-6">
                {/* Settings Form */}
                <div>
                  <h5 className="font-semibold mb-3">成績設定</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">成績名稱</label>
                      <input
                        type="text"
                        value={columnDetails[editingColumn]?.name || ''}
                        onChange={(e) => {
                          const newDetails = { ...columnDetails };
                          newDetails[editingColumn] = { ...(newDetails[editingColumn] || { type: '', name: '', date: '' }), name: e.target.value };
                          setColumnDetails(newDetails);
                        }}
                        className="w-full border border-gray-300 p-2 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">測驗日期</label>
                      <input
                        type="date"
                        value={columnDetails[editingColumn]?.date || ''}
                        onChange={(e) => {
                          const newDetails = { ...columnDetails };
                          newDetails[editingColumn] = { ...(newDetails[editingColumn] || { type: '', name: '', date: '' }), date: e.target.value };
                          setColumnDetails(newDetails);
                        }}
                        className="w-full border border-gray-300 p-2 rounded-lg"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">成績形式</label>
                      <Dropdown
                        value={columnDetails[editingColumn]?.type || ''}
                        onChange={(value) => {
                          const newDetails = { ...columnDetails };
                          newDetails[editingColumn] = { ...(newDetails[editingColumn] || { type: '', name: '', date: '' }), type: value };
                          setColumnDetails(newDetails);
                        }}
                        options={[{ value: '', label: '請選擇' }, { value: '小考', label: '小考' }, { value: '作業', label: '作業' }, { value: '上課態度', label: '上課態度' }]}
                        placeholder="請選擇"
                        className="w-full"
                      />
                    </div>
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
                          <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900 border-b">{distributionData.statistics.頂標 ?? '-'}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-900 border-b">前標</td>
                          <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900 border-b">{distributionData.statistics.前標 ?? '-'}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-900 border-b">均標</td>
                          <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900 border-b">{distributionData.statistics.均標 ?? '-'}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-900 border-b">後標</td>
                          <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900 border-b">{distributionData.statistics.後標 ?? '-'}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-900 border-b">底標</td>
                          <td className="px-4 py-2 text-center text-sm font-semibold text-gray-900 border-b">{distributionData.statistics.底標 ?? '-'}</td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2 text-sm font-medium text-gray-900">平均</td>
                          <td className="px-4 py-2 text-center text-sm font-bold text-gray-900">{distributionData.statistics.平均 ?? '-'}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>


                {/* 長條圖（改用表格呈現，已移除） */}
              </div>
            </Modal>
          )}
        </>
      )}
    </div>
  );
}