'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Swal from '@/utils/swalTheme';
import {
  DEFAULT_PERIODIC_ITEM_KEYS,
  defaultGradeSettings,
  mergePeriodicColumnDetails,
} from '@/services/gradeShape';
import { teacherCourseHubPath } from '@/utils/teacherCourseHub';

export interface GradeCourseInfo {
  id: string;
  name: string;
  code: string;
  gradeTags?: string[];
  subjectTag?: string;
  courseNature?: string;
  status?: string;
}

export type RegularType = '小考' | '作業' | '上課態度';

export interface StudentGradeRow {
  id: string;
  studentId: string;
  name: string;
  grade: string;
  regularScores: Record<string, number | undefined>;
  periodicScores: Record<string, number | undefined>;
  manualAdjust?: number;
}

export interface ComputedStudentGradeRow extends StudentGradeRow {
  qAvg: number;
  hAvg: number;
  aAvg: number;
  regWeighted: number;
  pAvg: number;
  originalTotal: number;
  finalTotal: number;
}

export interface ColumnDetail {
  type: RegularType;
  name: string;
  date: string;
  nature?: string;
  maxScore?: number;
}

export type PeriodicColumnMeta = { name: string; date: string; type: string; maxScore?: number };

export interface GradeSettings {
  percents: { quiz: number; hw: number; att: number; periodic: number };
  calcModes: Record<RegularType, { mode: 'all' | 'best'; n: number }>;
  periodicEnabled: Record<string, boolean>;
}

export const FIXED_PERIODIC_KEYS = [...DEFAULT_PERIODIC_ITEM_KEYS] as string[];

type GradePersistedState = {
  students: Array<{
    id: string;
    studentId: string;
    name: string;
    grade: string;
    regularScores: Record<string, number | undefined>;
    periodicScores: Record<string, number | undefined>;
    manualAdjust?: number;
  }>;
  columnDetails: Record<string, ColumnDetail>;
  regularColumns: number;
  settings: GradeSettings;
  periodicColumnDetails: Record<string, PeriodicColumnMeta>;
};

function serializeGradeState(state: GradePersistedState): string {
  return JSON.stringify(state);
}

export async function confirmDiscardGradeChanges(): Promise<boolean> {
  const result = await Swal.fire({
    icon: 'warning',
    title: '尚未儲存成績',
    text: '您有尚未儲存的修改，確定要離開嗎？離開後變更將會遺失。',
    showCancelButton: true,
    confirmButtonText: '離開',
    cancelButtonText: '繼續編輯',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    customClass: { popup: 'rounded-2xl' },
  });
  return result.isConfirmed;
}

/** Enter：同欄位往下一列學生；Shift+Enter：往上一列 */
export function focusAdjacentGradeInput(
  e: React.KeyboardEvent<HTMLInputElement>,
  colKey: string,
  rowIndex: number,
  direction: 1 | -1
) {
  e.preventDefault();
  const next = document.querySelector<HTMLInputElement>(
    `input[data-grade-col="${CSS.escape(colKey)}"][data-grade-row="${rowIndex + direction}"]`
  );
  if (!next || next.disabled || next.readOnly) return;
  next.focus();
  next.select();
}

export function handleGradeInputKeyDown(
  e: React.KeyboardEvent<HTMLInputElement>,
  colKey: string,
  rowIndex: number
) {
  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
  focusAdjacentGradeInput(e, colKey, rowIndex, e.shiftKey ? -1 : 1);
}

export function computeStudentTotals(
  students: StudentGradeRow[],
  columnDetails: Record<string, ColumnDetail>,
  settings: GradeSettings | null
): ComputedStudentGradeRow[] {
  const s = (settings ?? defaultGradeSettings) as GradeSettings;
  return students.map((stu) => {
    const getAvg = (type: RegularType) => {
      const scores = Object.entries(stu.regularScores || {})
        .filter(
          ([idx]) =>
            columnDetails[idx]?.type === type && columnDetails[idx]?.name && columnDetails[idx]?.date
        )
        .map(([, v]) => v)
        .filter((v): v is number => typeof v === 'number' && !isNaN(v));

      if (scores.length === 0) return 0;
      const { mode, n } = s.calcModes[type] ?? { mode: 'all' as const, n: 3 };
      const takeN = Math.min(Math.max(1, n || 1), scores.length);
      const targetScores = mode === 'best' ? [...scores].sort((a, b) => b - a).slice(0, takeN) : scores;
      return targetScores.reduce((a, b) => a + b, 0) / targetScores.length;
    };

    const { percents } = s;
    const qAvg = getAvg('小考');
    const hAvg = getAvg('作業');
    const aAvg = getAvg('上課態度');
    const regTotalPercent = percents.quiz + percents.hw + percents.att;
    const regWeighted =
      regTotalPercent > 0
        ? (qAvg * percents.quiz + hAvg * percents.hw + aAvg * percents.att) / regTotalPercent
        : 0;

    const pEnabledNames = DEFAULT_PERIODIC_ITEM_KEYS.filter((k) => s.periodicEnabled[k] !== false);
    const pVals = pEnabledNames
      .map((n) => stu.periodicScores?.[n])
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));
    const pAvg = pVals.length > 0 ? pVals.reduce((a, b) => a + b, 0) / pVals.length : 0;

    const originalTotal = Math.round(
      regWeighted * (percents.periodic / 100) + pAvg * ((100 - percents.periodic) / 100)
    );
    const finalTotal = stu.manualAdjust ?? originalTotal;

    return { ...stu, qAvg, hAvg, aAvg, regWeighted, pAvg, originalTotal, finalTotal };
  });
}

export function useCourseGrades({
  userInfoId,
  courseCodeFromUrl = '',
  onDirtyChange,
  leaveConfirmRef,
}: {
  userInfoId?: string;
  courseCodeFromUrl?: string;
  onDirtyChange?: (dirty: boolean) => void;
  leaveConfirmRef?: React.MutableRefObject<(() => Promise<boolean>) | null>;
}) {
  const router = useRouter();
  const [courses, setCourses] = useState<GradeCourseInfo[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<GradeCourseInfo | null>(null);
  const [students, setStudents] = useState<StudentGradeRow[]>([]);
  const [columnDetails, setColumnDetails] = useState<Record<string, ColumnDetail>>({});
  const [regularColumns, setRegularColumns] = useState(0);
  const [periodicColumnDetails, setPeriodicColumnDetails] = useState<Record<string, PeriodicColumnMeta>>(
    () => mergePeriodicColumnDetails(undefined)
  );
  const [settings, setSettings] = useState<GradeSettings | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isCourseLoading, setIsCourseLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSnapshot, setSavedSnapshot] = useState('');
  const baselineReadyRef = useRef(false);
  const allowLeaveRef = useRef(false);

  const isArchived = selectedCourse?.status === '已封存';

  const currentSnapshot = useMemo(
    () =>
      serializeGradeState({
        students: students.map((s) => {
          const { id, studentId, name, grade, regularScores, periodicScores, manualAdjust } = s;
          return {
            id,
            studentId,
            name,
            grade,
            regularScores: regularScores || {},
            periodicScores: periodicScores || {},
            manualAdjust,
          };
        }),
        columnDetails,
        regularColumns,
        settings: (settings ?? defaultGradeSettings) as GradeSettings,
        periodicColumnDetails,
      }),
    [students, columnDetails, regularColumns, settings, periodicColumnDetails]
  );

  const isDirty = useMemo(() => {
    if (isCourseLoading || isArchived || !selectedCourse || !savedSnapshot) return false;
    return currentSnapshot !== savedSnapshot;
  }, [isCourseLoading, isArchived, selectedCourse, savedSnapshot, currentSnapshot]);

  const confirmLeaveIfDirty = useCallback(async () => {
    if (isArchived || !isDirty) return true;
    return confirmDiscardGradeChanges();
  }, [isArchived, isDirty]);

  const discardChanges = useCallback(() => {
    if (!savedSnapshot) return;
    try {
      const parsed = JSON.parse(savedSnapshot) as GradePersistedState;
      setStudents(parsed.students || []);
      setColumnDetails(parsed.columnDetails || {});
      setRegularColumns(parsed.regularColumns || 0);
      setSettings((parsed.settings ?? defaultGradeSettings) as GradeSettings);
      setPeriodicColumnDetails(mergePeriodicColumnDetails(parsed.periodicColumnDetails));
    } catch {
      /* ignore */
    }
  }, [savedSnapshot]);

  const computedData = useMemo(
    () => computeStudentTotals(students, columnDetails, settings),
    [students, columnDetails, settings]
  );

  const handleScoreChange = useCallback(
    (id: string, type: 'reg' | 'peri', key: string | number, val: string | number | undefined) => {
      const raw = val === undefined || val === null ? '' : String(val);
      const num = raw === '' || raw === 'undefined' ? undefined : parseInt(raw, 10);
      const safe = num !== undefined && !Number.isNaN(num) ? num : undefined;
      const scoreKey = String(key);
      setStudents((prev) =>
        prev.map((s) => {
          if (s.id !== id) return s;
          return type === 'reg'
            ? { ...s, regularScores: { ...s.regularScores, [scoreKey]: safe } }
            : { ...s, periodicScores: { ...s.periodicScores, [scoreKey]: safe } };
        })
      );
    },
    []
  );

  const handleFinalScoreChange = useCallback((id: string, val: string | number | undefined) => {
    const raw = val === undefined || val === null ? '' : String(val);
    const num = raw === '' ? undefined : parseInt(raw, 10);
    const safe = num !== undefined && !Number.isNaN(num) ? num : undefined;
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        return { ...s, manualAdjust: safe };
      })
    );
  }, []);

  const addRegularColumn = useCallback(() => {
    setRegularColumns((c) => {
      const nextIdx = c;
      setColumnDetails((prev) => ({
        ...prev,
        [String(nextIdx)]: {
          type: '小考',
          name: `平時項目${nextIdx + 1}`,
          date: '',
          maxScore: 100,
        },
      }));
      return c + 1;
    });
  }, []);

  const deleteRegularColumn = useCallback((removeIdx: number) => {
    setColumnDetails((prev) => {
      const next: Record<string, ColumnDetail> = {};
      Object.keys(prev).forEach((k) => {
        const i = Number(k);
        if (Number.isNaN(i)) return;
        if (i < removeIdx) next[k] = prev[k];
        else if (i > removeIdx) next[String(i - 1)] = prev[k];
      });
      const currentCount = Object.keys(prev).length;
      let newCount = currentCount - 1;
      while (newCount < 10) {
        next[String(newCount)] = { type: '小考', name: '', date: '' };
        newCount++;
      }
      return next;
    });
    setStudents((prev) =>
      prev.map((s) => {
        const rs = { ...s.regularScores };
        const newRs: Record<string, number | undefined> = {};
        Object.keys(rs).forEach((k) => {
          const i = Number(k);
          if (Number.isNaN(i)) return;
          if (i < removeIdx) newRs[k] = rs[k];
          else if (i > removeIdx) newRs[String(i - 1)] = rs[k];
        });
        return { ...s, regularScores: newRs };
      })
    );
    setRegularColumns((c) => Math.max(10, c - 1));
  }, []);

  const selectCourse = useCallback(
    async (course: GradeCourseInfo | null) => {
      if (!(await confirmLeaveIfDirty())) return;
      allowLeaveRef.current = true;
      setSelectedCourse(course);
      if (course) {
        router.push(teacherCourseHubPath(course.code, 'grades'));
      } else {
        router.push('/back-panel/teacher-courses');
      }
    },
    [router, confirmLeaveIfDirty]
  );

  useEffect(() => {
    baselineReadyRef.current = false;
    allowLeaveRef.current = false;
    setSavedSnapshot('');
  }, [selectedCourse?.id]);

  useEffect(() => {
    if (isCourseLoading || !selectedCourse) return;
    if (!baselineReadyRef.current) {
      setSavedSnapshot(currentSnapshot);
      baselineReadyRef.current = true;
    }
  }, [isCourseLoading, selectedCourse, currentSnapshot]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    if (!leaveConfirmRef) return;
    leaveConfirmRef.current = confirmLeaveIfDirty;
    return () => {
      leaveConfirmRef.current = null;
    };
  }, [leaveConfirmRef, confirmLeaveIfDirty]);

  useEffect(() => {
    if (!isDirty || isArchived || isCourseLoading || !selectedCourse) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isArchived, isCourseLoading, selectedCourse]);

  useEffect(() => {
    if (userInfoId) {
      setIsLoading(true);
      fetch('/api/courses/list', { method: 'POST' })
        .then((res) => res.json())
        .then((data) =>
          setCourses(data.filter((c: { teachers?: string[] }) => c.teachers?.includes(userInfoId)))
        )
        .finally(() => setIsLoading(false));
    }
  }, [userInfoId]);

  useEffect(() => {
    if (!courseCodeFromUrl) {
      setSelectedCourse(null);
      return;
    }
    if (courses.length === 0) return;
    const decodedCode = decodeURIComponent(courseCodeFromUrl);
    const course = courses.find((c) => c.code === decodedCode);
    if (course) {
      setSelectedCourse((prev) => (prev?.id === course.id ? prev : course));
    }
  }, [courseCodeFromUrl, courses]);

  useEffect(() => {
    if (!selectedCourse || !userInfoId) return;
    let cancelled = false;
    const course = selectedCourse;
    const fetchGradeData = async () => {
      setIsCourseLoading(true);
      try {
        const res = await fetch('/api/grades/get', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            courseId: course.id,
            courseName: course.name,
            courseCode: course.code,
          }),
        });
        if (cancelled) return;
        if (res.status === 401) throw new Error('登入已過期，請重新登入後再試');
        if (!res.ok) throw new Error('讀取成績資料失敗');
        const data = await res.json();
        if (cancelled) return;

        let fetchedRegularColumns = data.regularColumns || 0;
        const fetchedColumnDetails = data.columnDetails || {};
        if (fetchedRegularColumns < 10) {
          for (let i = fetchedRegularColumns; i < 10; i++) {
            fetchedColumnDetails[String(i)] = {
              type: '小考',
              name: '',
              date: '',
              maxScore: 100,
            };
          }
          fetchedRegularColumns = 10;
        }

        setStudents(data.students || []);
        setColumnDetails(fetchedColumnDetails);
        setRegularColumns(fetchedRegularColumns);
        setSettings((data.settings ?? defaultGradeSettings) as GradeSettings);
        setPeriodicColumnDetails(mergePeriodicColumnDetails(data.periodicColumnDetails));
      } catch (error) {
        if (cancelled) return;
        void Swal.fire({
          icon: 'error',
          title: '讀取失敗',
          text: error instanceof Error ? error.message : '發生未知錯誤',
          confirmButtonColor: '#ef4444',
          customClass: { popup: 'rounded-2xl' },
        });
      } finally {
        if (!cancelled) setIsCourseLoading(false);
      }
    };
    void fetchGradeData();
    return () => {
      cancelled = true;
    };
  }, [selectedCourse, userInfoId]);

  const handleSaveChanges = useCallback(async () => {
    if (!selectedCourse) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/grades/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          students: students.map((s) => {
            const { id, studentId, name, grade, regularScores, periodicScores, manualAdjust } = s;
            return {
              id,
              studentId,
              name,
              grade,
              regularScores: regularScores || {},
              periodicScores: periodicScores || {},
              manualAdjust,
            };
          }),
          columnDetails,
          regularColumns,
          settings,
          periodicColumnDetails,
        }),
      });
      if (!res.ok) throw new Error('儲存成績失敗');
      setSavedSnapshot(currentSnapshot);
      baselineReadyRef.current = true;
      allowLeaveRef.current = false;
      void Swal.fire({
        icon: 'success',
        title: '成績已儲存',
        confirmButtonColor: '#2D6DF6',
        customClass: { popup: 'rounded-2xl' },
      });
    } catch (error) {
      void Swal.fire({
        icon: 'error',
        title: '儲存失敗',
        text: error instanceof Error ? error.message : '發生未知錯誤',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' },
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedCourse,
    students,
    columnDetails,
    regularColumns,
    settings,
    periodicColumnDetails,
    currentSnapshot,
  ]);

  const handleImportRegular = useCallback(
    (params: {
      columnIndex: number;
      columnDetail: ColumnDetail;
      scoresByStudentId: Record<string, number>;
    }) => {
      const { columnIndex, columnDetail, scoresByStudentId } = params;
      const colKey = String(columnIndex);
      setColumnDetails((prev) => ({ ...prev, [colKey]: columnDetail }));
      if (columnIndex >= regularColumns) setRegularColumns(columnIndex + 1);
      setStudents((prev) =>
        prev.map((s) => {
          const score = scoresByStudentId[s.studentId];
          if (score === undefined) return s;
          return { ...s, regularScores: { ...s.regularScores, [colKey]: score } };
        })
      );
    },
    [regularColumns]
  );

  const handleImportPeriodic = useCallback(
    (params: {
      periodicKey: string;
      columnMeta: PeriodicColumnMeta;
      scoresByStudentId: Record<string, number>;
    }) => {
      const { periodicKey, columnMeta, scoresByStudentId } = params;
      setPeriodicColumnDetails((prev) => ({ ...prev, [periodicKey]: columnMeta }));
      setStudents((prev) =>
        prev.map((s) => {
          const score = scoresByStudentId[s.studentId];
          if (score === undefined) return s;
          return {
            ...s,
            periodicScores: { ...s.periodicScores, [periodicKey]: score },
          };
        })
      );
    },
    []
  );

  const handleExportGrades = useCallback(async () => {
    if (!selectedCourse || computedData.length === 0) {
      void Swal.fire({
        icon: 'info',
        title: '沒有可匯出資料',
        text: '請先選擇課程並確認已有成績資料。',
        confirmButtonColor: '#2D6DF6',
        customClass: { popup: 'rounded-2xl' },
      });
      return;
    }
    void Swal.fire({
      title: '正在產生 Excel 檔案...',
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });
    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const sanitizedSheetName = `${selectedCourse.name} 成績`
        .replace(/[*?:\\/\[\]]/g, '')
        .substring(0, 31);
      const worksheet = workbook.addWorksheet(sanitizedSheetName);
      const regularHeaders = Array.from({ length: regularColumns }).map((_, i) => {
        const detail = columnDetails[i];
        return detail?.name || `平時${i + 1}`;
      });
      worksheet.columns = [
        { header: '學號', key: 'studentId', width: 15 },
        { header: '姓名', key: 'name', width: 12 },
        ...regularHeaders.map((h) => ({ header: h, key: h, width: 12 })),
        ...FIXED_PERIODIC_KEYS.map((h) => ({ header: h, key: h, width: 15 })),
        { header: '平時加權', key: 'regWeighted', width: 12 },
        { header: '定期平均', key: 'pAvg', width: 12 },
        { header: '原始成績', key: 'originalTotal', width: 12 },
        { header: '最終成績', key: 'finalTotal', width: 12 },
      ];
      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2D6DF6' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });
      computedData.forEach((stu) => {
        const rowData: Record<string, string | number> = {
          studentId: stu.studentId,
          name: stu.name,
        };
        regularHeaders.forEach((h, i) => {
          rowData[h] = stu.regularScores[i] ?? '';
        });
        FIXED_PERIODIC_KEYS.forEach((key) => {
          rowData[key] = stu.periodicScores?.[key] ?? '';
        });
        rowData.regWeighted = parseFloat(stu.regWeighted.toFixed(1));
        rowData.pAvg = parseFloat(stu.pAvg.toFixed(1));
        rowData.originalTotal = stu.originalTotal;
        rowData.finalTotal = stu.finalTotal;
        const row = worksheet.addRow(rowData);
        if (stu.finalTotal < 60) {
          row.getCell('finalTotal').font = { bold: true, color: { argb: 'FFDC2626' } };
        }
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedCourse.name}_完整成績匯出.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      void Swal.fire({
        icon: 'success',
        title: '匯出成功',
        text: '成績 Excel 檔案已下載。',
        confirmButtonColor: '#2D6DF6',
        customClass: { popup: 'rounded-2xl' },
      });
    } catch (error) {
      console.error('匯出 Excel 失敗:', error);
      void Swal.fire({
        icon: 'error',
        title: '匯出失敗',
        text: '產生 Excel 檔案時發生錯誤，請稍後再試。',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' },
      });
    }
  }, [selectedCourse, computedData, regularColumns, columnDetails]);

  /** 已設定名稱與日期的平時欄索引 */
  const activeRegularIndices = useMemo(() => {
    const idxs: number[] = [];
    for (let i = 0; i < regularColumns; i++) {
      const detail = columnDetails[String(i)] ?? columnDetails[i as unknown as string];
      if (detail?.name?.trim() && detail?.date) idxs.push(i);
    }
    return idxs;
  }, [regularColumns, columnDetails]);

  return {
    courses,
    selectedCourse,
    selectCourse,
    students,
    setStudents,
    columnDetails,
    setColumnDetails,
    regularColumns,
    setRegularColumns,
    periodicColumnDetails,
    setPeriodicColumnDetails,
    settings,
    setSettings,
    computedData,
    isLoading,
    isCourseLoading,
    isSaving,
    isDirty,
    isArchived,
    handleScoreChange,
    handleFinalScoreChange,
    handleSaveChanges,
    discardChanges,
    confirmLeaveIfDirty,
    addRegularColumn,
    deleteRegularColumn,
    handleImportRegular,
    handleImportPeriodic,
    handleExportGrades,
    activeRegularIndices,
  };
}
