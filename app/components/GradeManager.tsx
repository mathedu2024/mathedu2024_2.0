'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal, } from 'react-dom';
import LoadingSpinner from './LoadingSpinner';
import PageLoadingArea from './ui/PageLoadingArea';
import { 
  AdjustmentsHorizontalIcon, 
  CloudArrowUpIcon, ClipboardDocumentListIcon,
  XMarkIcon, TrashIcon,
  ChartBarIcon,
  PlusIcon,
  ArrowDownTrayIcon,
  ArrowLeftIcon,
} from '@heroicons/react/24/outline';
import CourseFilter from './CourseFilter';
import Dropdown from './ui/Dropdown';

const regularTypeOptions = [
  { value: '小考', label: '小考' },
  { value: '作業', label: '作業' },
  { value: '上課態度', label: '上課態度' },
];
import GradeRegistrationMobile from './GradeRegistrationMobile';
import Swal from 'sweetalert2';
import {
  DEFAULT_PERIODIC_ITEM_KEYS,
  defaultGradeSettings,
  mergePeriodicColumnDetails,
} from '@/services/gradeShape';

// --- 1. 型別定義 (TypeScript Interfaces) ---

interface UserInfo { id: string; name: string; role: string; }
interface CourseInfo { id: string; name: string; code: string; gradeTags?: string[]; subjectTag?: string; courseNature?: string; status?: string; }
type RegularType = '小考' | '作業' | '上課態度';

interface StudentGradeRow {
  id: string;
  studentId: string;
  name: string;
  grade: string;
  regularScores: Record<string, number | undefined>;
  periodicScores: Record<string, number | undefined>;
  manualAdjust?: number;
}

interface ComputedStudentGradeRow extends StudentGradeRow {
  qAvg: number;
  hAvg: number;
  aAvg: number;
  regWeighted: number;
  pAvg: number;
  originalTotal: number;
  finalTotal: number;
}


interface ColumnDetail { type: RegularType; name: string; date: string; nature?: string; maxScore?: number; }

type PeriodicColumnMeta = { name: string; date: string; type: string; maxScore?: number; };

/** 定期評量欄位固定三欄（與 Firestore / 採計鍵名一致） */
const FIXED_PERIODIC_KEYS = [...DEFAULT_PERIODIC_ITEM_KEYS] as string[];

interface GradeSettings {
  percents: { quiz: number; hw: number; att: number; periodic: number; };
  calcModes: Record<RegularType, { mode: 'all' | 'best'; n: number }>;
  periodicEnabled: Record<string, boolean>;
}


const Modal = ({ open, onClose, title, size = 'md', children }: { open?: boolean; onClose?: () => void; title?: string; size?: string; children?: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !open) return null;
  const maxWidth = { md: 'max-w-lg', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size as 'md'|'lg'|'xl'];
  
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex justify-center items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-full sm:max-h-[90vh] flex flex-col overflow-hidden`}>
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 flex justify-between items-center text-white">
          <h3 className="font-bold flex items-center">{title}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default function GradeManager({
  userInfo,
  courseCodeFromUrl = '',
}: {
  userInfo?: UserInfo | null;
  courseCodeFromUrl?: string;
}) {
  const router = useRouter();
  const [courses, setCourses] = useState<CourseInfo[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseInfo | null>(null);
  const [students, setStudents] = useState<StudentGradeRow[]>([]);
  const [columnDetails, setColumnDetails] = useState<Record<string, ColumnDetail>>({});
  const [regularColumns, setRegularColumns] = useState(0);
  const [periodicColumnDetails, setPeriodicColumnDetails] = useState<Record<string, PeriodicColumnMeta>>(() =>
    mergePeriodicColumnDetails(undefined)
  );
  const [settings, setSettings] = useState<GradeSettings | null>(null);

  const [selectedTab, setSelectedTab] = useState<'regular' | 'periodic' | 'total'>('regular');
  const [isLoading, setIsLoading] = useState(true);
  const [isCourseLoading, setIsCourseLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // UI 輔助狀態
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [columnEditor, setColumnEditor] = useState<
    { kind: 'regular'; index: number } | { kind: 'periodic'; key: string } | null
  >(null);
  const [editorDistribution, setEditorDistribution] = useState<{
    statistics: Record<string, number | null>;
    distribution: { range: string; count: number }[];
  } | null>(null);
  const [editorDistLoading, setEditorDistLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedNature, setSelectedNature] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  const computedData: ComputedStudentGradeRow[] = useMemo(() => {
    const s = (settings ?? defaultGradeSettings) as GradeSettings;
    return students.map(stu => {
      const getAvg = (type: RegularType) => {
        const scores = Object.entries(stu.regularScores || {})
          .filter(([idx]) => columnDetails[idx]?.type === type && columnDetails[idx]?.name && columnDetails[idx]?.date)
          .map(([, v]) => v).filter((v): v is number => typeof v === 'number' && !isNaN(v));
        
        if (scores.length === 0) return 0;
        const { mode, n } = s.calcModes[type];
        const targetScores = mode === 'all' ? scores : [...scores].sort((a,b)=>b-a).slice(0, n);
        return targetScores.reduce((a,b)=>a+b, 0) / targetScores.length;
      };

      const { percents } = s;
      const qAvg = getAvg('小考'), hAvg = getAvg('作業'), aAvg = getAvg('上課態度');
      const regTotalPercent = percents.quiz + percents.hw + percents.att;
      const regWeighted = regTotalPercent > 0 ? (qAvg * percents.quiz + hAvg * percents.hw + aAvg * percents.att) / regTotalPercent : 0;
      
      const pEnabledNames = DEFAULT_PERIODIC_ITEM_KEYS.filter((k) => s.periodicEnabled[k] !== false);
      const pVals = pEnabledNames.map((n) => stu.periodicScores?.[n]).filter((v): v is number => typeof v === 'number' && !isNaN(v));
      const pAvg = pVals.length > 0 ? pVals.reduce((a,b)=>a+b,0)/pVals.length : 0;

      const originalTotal = Math.round(regWeighted * (percents.periodic / 100) + pAvg * ((100 - percents.periodic) / 100));
      const finalTotal = stu.manualAdjust ?? originalTotal;
      
      return { ...stu, qAvg, hAvg, aAvg, regWeighted, pAvg, originalTotal, finalTotal };
    });
  }, [students, columnDetails, settings]);

  // --- 資料處理 Functions ---
  const handleScoreChange = useCallback((id: string, type: 'reg'|'peri', key: string|number, val: string) => {
    const num = val === '' ? undefined : parseInt(val, 10);
    setStudents(prev => prev.map(s => {
      if (s.id !== id) return s;
      return type === 'reg' 
        ? { ...s, regularScores: { ...s.regularScores, [key]: num } }
        : { ...s, periodicScores: { ...s.periodicScores, [key]: num } };
    }));
  }, []);

  const handleFinalScoreChange = useCallback((id: string, val: string) => {
    const num = val === '' ? undefined : parseInt(val, 10);
    setStudents(prev => prev.map(s => {
      if (s.id !== id) return s;
      return { ...s, manualAdjust: num };
    }));
  }, []);

  useEffect(() => {
    if (!columnEditor || !selectedCourse) {
      setEditorDistribution(null);
      return;
    }
    const columnId = columnEditor.kind === 'regular' ? columnEditor.index : columnEditor.key;
    const scoreKind = columnEditor.kind === 'periodic' ? 'periodic' : 'regular';
    let cancelled = false;
    setEditorDistLoading(true);
    setEditorDistribution(null);
    fetch('/api/grades/distribution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        courseId: selectedCourse.id,
        courseKey: `${selectedCourse.name}(${selectedCourse.code})`,
        columnId,
        scoreKind,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.statistics && data.distribution) {
          setEditorDistribution({
            statistics: data.statistics,
            distribution: data.distribution,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setEditorDistribution(null);
      })
      .finally(() => {
        if (!cancelled) setEditorDistLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [columnEditor, selectedCourse]);

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

  const deleteRegularColumn = useCallback(
    (removeIdx: number) => {
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
            while (newCount < 10) { // 確保至少有 10 欄
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
      setColumnEditor(null);
    },
    []
  );

  const selectCourse = useCallback(
    (course: CourseInfo | null) => {
      setSelectedCourse(course);
      if (course) {
        router.push(`/back-panel/teacher-grades/${encodeURIComponent(course.code)}`);
      } else {
        router.push('/back-panel/teacher-grades');
      }
    },
    [router]
  );

  // --- 副作用 (Fetch Data) ---
  useEffect(() => {
    if (userInfo) {
      setIsLoading(true);
      fetch('/api/courses/list', { method: 'POST' })
        .then(res => res.json())
        .then(data => setCourses(data.filter((c: { teachers?: string[] }) => c.teachers?.includes(userInfo.id))))
        .finally(() => setIsLoading(false));
    }
  }, [userInfo]);

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
    if (selectedCourse) {
      const fetchGradeData = async () => {
        setIsCourseLoading(true);
        try {
          const res = await fetch('/api/grades/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId: selectedCourse.id, courseName: selectedCourse.name, courseCode: selectedCourse.code })
          });
          if (!res.ok) throw new Error('讀取成績資料失敗');
          const data = await res.json();
          
          let fetchedRegularColumns = data.regularColumns || 0;
          let fetchedColumnDetails = data.columnDetails || {};

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
          Swal.fire({
            icon: 'error',
            title: '讀取失敗',
            text: error instanceof Error ? error.message : '發生未知錯誤',
            confirmButtonColor: '#ef4444',
            customClass: { popup: 'rounded-2xl' }
          });
        } finally {
          setIsCourseLoading(false);
        }
      };
      fetchGradeData();
    }
  }, [selectedCourse]);

  const handleSaveChanges = async () => {
    if (!selectedCourse) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/grades/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: selectedCourse.id,
          // 移除客戶端計算的欄位，只傳送純粹的學生資料
          students: students.map(s => {
            const { id, studentId, name, grade, regularScores, periodicScores, manualAdjust } = s;
            return {
              id, studentId, name, grade,
              regularScores: regularScores || {},
              periodicScores: periodicScores || {},
              manualAdjust: manualAdjust,
            };
          }),
          columnDetails,
          regularColumns,
          settings,
          periodicColumnDetails,
        })
      });
      if (!res.ok) throw new Error('儲存成績失敗');
      Swal.fire({
        icon: 'success',
        title: '成績已儲存',
        confirmButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-2xl' }
      });
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '儲存失敗',
        text: error instanceof Error ? error.message : '發生未知錯誤',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' }
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportGrades = useCallback(async () => {
    if (!selectedCourse || computedData.length === 0) {
      Swal.fire({
        icon: 'info',
        title: '沒有可匯出資料',
        text: '請先選擇課程並確認已有成績資料。',
        confirmButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-2xl' },
      });
      return;
    }

    Swal.fire({
      title: '正在產生 Excel 檔案...',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); },
    });

    try {
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      // 移除 Excel 工作表名稱中不允許的字元，並將長度限制在 31 字元內
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
        ...regularHeaders.map(h => ({ header: h, key: h, width: 12 })),
        ...FIXED_PERIODIC_KEYS.map(h => ({ header: h, key: h, width: 15 })),
        { header: '平時加權', key: 'regWeighted', width: 12 },
        { header: '定期平均', key: 'pAvg', width: 12 },
        { header: '原始成績', key: 'originalTotal', width: 12 },
        { header: '最終成績', key: 'finalTotal', width: 12 },
      ];

      // 標題列樣式
      worksheet.getRow(1).eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6366F1' } }; // indigo-500
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      // 填入資料
      computedData.forEach((stu) => {
        const rowData: Record<string, any> = {
          studentId: stu.studentId,
          name: stu.name,
        };
        regularHeaders.forEach((h, i) => {
          rowData[h] = stu.regularScores[i] ?? '';
        });
        FIXED_PERIODIC_KEYS.forEach(key => {
          rowData[key] = stu.periodicScores?.[key] ?? '';
        });
        rowData.regWeighted = parseFloat(stu.regWeighted.toFixed(1));
        rowData.pAvg = parseFloat(stu.pAvg.toFixed(1));
        rowData.originalTotal = stu.originalTotal;
        rowData.finalTotal = stu.finalTotal;
        
        const row = worksheet.addRow(rowData);

        // 設定不及格紅字
        const finalTotalCell = row.getCell('finalTotal');
        if (stu.finalTotal < 60) {
          finalTotalCell.font = { bold: true, color: { argb: 'FFDC2626' } }; // red-600
        }
      });

      // 生成檔案並下載
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

      Swal.fire({
        icon: 'success',
        title: '匯出成功',
        text: '成績 Excel 檔案已下載。',
        confirmButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-2xl' },
      });
    } catch (error) {
      console.error('匯出 Excel 失敗:', error);
      Swal.fire({
        icon: 'error',
        title: '匯出失敗',
        text: '產生 Excel 檔案時發生錯誤，請稍後再試。',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' },
      });
    }
  }, [selectedCourse, computedData, regularColumns, columnDetails]);

  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      const statusMatch = selectedStatus === 'all' ? course.status !== '已封存' : course.status === selectedStatus;
      const natureMatch = selectedNature === 'all' || course.courseNature === selectedNature;

      return (course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             course.code.toLowerCase().includes(searchTerm.toLowerCase())) && 
             (selectedGrade === 'all' || (course.gradeTags && course.gradeTags.includes(selectedGrade))) && 
             (selectedSubject === 'all' || course.subjectTag === selectedSubject) &&
             natureMatch &&
             statusMatch;
    }).sort((a, b) => {
        const statuses = ['報名中', '開課中', '未開課', '已額滿', '已結束', '已封存', '資料建置中...'];
        const statusA = statuses.indexOf(a.status || '');
        const statusB = statuses.indexOf(b.status || '');
        const priorityA = statusA !== -1 ? statusA : 999;
        const priorityB = statusB !== -1 ? statusB : 999;

        if (priorityA !== priorityB) {
            return priorityA - priorityB;
        }

        const codeA = a.code || '';
        const codeB = b.code || '';

        const codeCompare = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
        
        if (codeCompare !== 0) return codeCompare;
        
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [courses, searchTerm, selectedGrade, selectedSubject, selectedNature, selectedStatus]);

  const isArchived = selectedCourse?.status === '已封存';

  // --- 渲染部分 ---
  return (
    <div className="page-shell w-full min-w-0 flex flex-col h-full animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <ClipboardDocumentListIcon className="h-8 w-8 text-indigo-600" />
            成績管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">設定評量比例並登記學生的平時與定期成績。</p>
        </div>
        {selectedCourse && (
          <button onClick={() => selectCourse(null)} className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm font-medium flex items-center text-sm">
            <ArrowLeftIcon className="w-4 h-4 mr-2" /> 返回列表
          </button>
        )}
      </div>

      {isLoading ? (
        <PageLoadingArea />
      ) : !selectedCourse ? (
        <>
          {/* 篩選器 */}
          {!isLoading && courses.length > 0 && (
            <CourseFilter
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
              selectedGrade={selectedGrade}
              onGradeChange={setSelectedGrade}
              selectedSubject={selectedSubject}
              onSubjectChange={setSelectedSubject}
              selectedNature={selectedNature}
              onNatureChange={setSelectedNature}
              selectedStatus={selectedStatus}
              onStatusChange={setSelectedStatus}
              onReset={() => {
                setSearchTerm('');
                setSelectedGrade('all');
                setSelectedSubject('all');
                setSelectedNature('all');
                setSelectedStatus('all');
              }}
            />
          )}

          {filteredCourses.length === 0 ? (
              <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
                  <h3 className="mt-2 text-xl font-bold text-gray-900">尚無符合的課程</h3>
              </div>
          ) : (
            <>
          {/* 桌面版表格視圖 */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hidden md:block">
              <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                      <tr>
                          <th className="px-6 py-4 font-bold min-w-[200px]">課程名稱</th>
                          <th className="px-6 py-4 font-bold text-right w-[150px]">操作</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {filteredCourses.map(course => (
                          <tr key={course.id} className="hover:bg-indigo-50/30 transition-colors group">
                              <td className="px-6 py-4">
                                  <div className="font-bold text-gray-900 text-base whitespace-nowrap overflow-hidden text-ellipsis">{course.name}</div>
                                  <div className="text-xs font-mono text-gray-500 mt-1">{course.code}</div>
                              </td>
                              <td className="px-6 py-4 text-right whitespace-nowrap">
                                  <button onClick={() => selectCourse(course)} className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                                      管理成績
                                  </button>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
          </div>

          {/* 手機版卡片視圖 */}
          <div className="md:hidden space-y-4">
              {filteredCourses.map(course => (
                  <div key={course.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 flex flex-col gap-3 active:scale-[0.99] transition-transform" onClick={() => selectCourse(course)}>
                      <div className="flex justify-between items-start">
                           <div>
                               <h3 className="font-bold text-gray-900 text-lg">{course.name}</h3>
                               <p className="text-xs font-mono text-gray-500 mt-1">{course.code}</p>
                           </div>
                      </div>
                      <div className="border-t border-gray-100 pt-3 flex justify-end">
                           <button onClick={(e) => { e.stopPropagation(); selectCourse(course); }} className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
                               管理成績
                           </button>
                      </div>
                  </div>
              ))}
          </div>
            </>
          )}
        </>
      ) : (
        /* 管理主畫面 */
        <div className="space-y-4">
          {isArchived && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm">
              <span className="font-bold mr-2">提示：</span>
              此課程已封存，您只能查看成績紀錄與下載 Excel，無法修改成績。
            </div>
          )}
          {/* 工具列 */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex bg-gray-100 p-1 rounded-xl w-full lg:w-auto">
              {(['regular', 'periodic', 'total'] as const).map(t => (
                <button key={t} onClick={() => setSelectedTab(t)} className={`flex-1 lg:flex-none px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
                  {t === 'regular' ? '平時' : t === 'periodic' ? '定期' : '總成績'}
                </button>
              ))}
            </div>
            
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap sm:items-center gap-3 w-full lg:w-auto lg:ml-auto">
              <button className="px-3 sm:px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap" onClick={() => setShowSettingsModal(true)} disabled={isArchived}><AdjustmentsHorizontalIcon className="w-5 h-5 mr-1.5 shrink-0" />課程成績設定</button>
              {selectedTab === 'regular' && !isArchived && (
                <button
                  type="button"
                  className="px-3 sm:px-5 py-2.5 bg-white text-indigo-600 border border-indigo-200 border-dashed rounded-xl hover:bg-indigo-50 font-medium transition-colors shadow-sm flex items-center justify-center text-sm whitespace-nowrap"
                  onClick={addRegularColumn}
                >
                  <PlusIcon className="w-5 h-5 mr-1.5 shrink-0" />
                  新增平時
                </button>
              )}
              <button className="px-3 sm:px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center text-sm whitespace-nowrap" onClick={handleExportGrades}>
                <ArrowDownTrayIcon className="w-5 h-5 mr-1.5 shrink-0" />
                匯出成績
              </button>
              {!isArchived && (
                <button className="px-3 sm:px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center text-sm whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed" onClick={handleSaveChanges} disabled={isSaving}>
                  {isSaving ? <LoadingSpinner size={16} color="white" className="mr-1.5 shrink-0" /> : <CloudArrowUpIcon className="w-5 h-5 mr-1.5 shrink-0" />}
                  {isSaving ? '儲存中' : '儲存變更'}
                </button>
              )}
            </div>
          </div>

          

          {/* 表格主體 (簡化邏輯呈現) */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            {isCourseLoading ? (
              <PageLoadingArea minHeight="min-h-[200px]" />
            ) : (
            <>
            {/* Mobile View */}
            <GradeRegistrationMobile 
              tab={selectedTab} 
              students={computedData} 
              regularColumns={regularColumns}
              columnDetails={columnDetails}
              onUpdateFinalScore={handleFinalScoreChange}
              _periodicScores={FIXED_PERIODIC_KEYS}
              periodicColumnDetails={periodicColumnDetails}
              onUpdateRegularScore={(studentId, colIdx, value) => handleScoreChange(studentId, 'reg', colIdx, String(value ?? ''))}
              _onUpdatePeriodicScore={(studentId, scoreName, value) => handleScoreChange(studentId, 'peri', scoreName, String(value ?? ''))}
              isArchived={isArchived}
              onEditColumn={(kind, id) => setColumnEditor(kind === 'regular' ? { kind, index: id as number } : { kind, key: id as string })}
            />
            <div className="hidden md:flex relative items-start bg-white border-t border-gray-200">
              {/* 左側固定區塊 (學號、姓名) */}
              <div className="flex-shrink-0 z-20 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.05)] border-r border-gray-200 bg-white">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-700 uppercase text-sm font-bold">
                    <tr className="h-[72px]">
                      <th className="px-4 py-4 w-[120px] min-w-[120px] max-w-[120px] border-b border-gray-200">學號</th>
                      <th className="px-4 py-4 w-[100px] min-w-[100px] max-w-[100px] border-b border-gray-200">姓名</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {computedData.map((stu) => (
                      <tr key={stu.id} className={`h-[65px] transition-colors ${hoveredRowId === stu.id ? 'bg-indigo-50' : 'bg-white'}`} onMouseEnter={() => setHoveredRowId(stu.id)} onMouseLeave={() => setHoveredRowId(null)}>
                        <td className="px-4 py-4 font-mono text-base w-[120px] min-w-[120px] max-w-[120px] truncate">{stu.studentId}</td>
                        <td className="px-4 py-4 font-medium text-base w-[100px] min-w-[100px] max-w-[100px] truncate">{stu.name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* 右側滾動區塊 (成績登記) */}
              <div className="overflow-x-auto custom-scrollbar flex-1 bg-white">
                <table className="w-full text-sm text-left min-w-max">
                  <thead className="bg-gray-50 text-gray-700 uppercase text-sm font-bold">
                    <tr className="h-[72px]">
                    {selectedTab === 'regular' && Array.from({ length: regularColumns }).map((_, i) => (
                      <th key={i} className="px-4 py-4 min-w-[120px] text-center border-b border-gray-200">
                        <div className={`cursor-pointer text-base hover:text-indigo-600 ${isArchived ? 'text-gray-600' : ''}`} onClick={() => setColumnEditor({ kind: 'regular', index: i })}>
                          {columnDetails[i]?.name || `成績${i + 1}`}
                        </div>
                        {columnDetails[i]?.date ? (
                          <div className="text-xs text-gray-400 font-mono mt-0.5">{columnDetails[i].date}</div>
                        ) : (
                          <div className="text-xs text-red-400 mt-0.5">(尚未設定)</div>
                        )}
                      </th>
                    ))}
                    {selectedTab === 'periodic' &&
                      FIXED_PERIODIC_KEYS.map((pk) => {
                        const meta = periodicColumnDetails[pk];
                        return (
                          <th key={pk} className="px-4 py-4 min-w-[140px] text-center border-b border-gray-200">
                            <div className="cursor-pointer text-base font-bold hover:text-indigo-600 text-gray-800" onClick={() => setColumnEditor({ kind: 'periodic', key: pk })}>
                              {pk}
                            </div>
                            {meta?.date ? (
                              <div className="text-xs text-gray-400 font-mono mt-0.5">{meta.date}</div>
                            ) : (
                              <div className="text-xs text-red-400 mt-0.5">(尚未設定)</div>
                            )}
                          </th>
                        );
                      })}
                    {selectedTab === 'total' && (
                      <>
                          <th className="px-4 py-4 text-center border-b border-gray-200 text-base">平時加權</th>
                          <th className="px-4 py-4 text-center border-b border-gray-200 text-base">定期平均</th>
                          <th className="px-4 py-4 text-center border-b border-gray-200 text-base">原始成績</th>
                          <th className="px-4 py-4 text-center text-indigo-600 border-b border-gray-200 text-base">最終成績</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {computedData.map((stu) => (
                    <tr key={stu.id} className={`h-[65px] transition-colors ${hoveredRowId === stu.id ? 'bg-indigo-50' : 'bg-white'}`} onMouseEnter={() => setHoveredRowId(stu.id)} onMouseLeave={() => setHoveredRowId(null)}>
                      {selectedTab === 'regular' && Array.from({ length: regularColumns }).map((_, colIdx) => {
                        const isSetup = !!(columnDetails[colIdx]?.name && columnDetails[colIdx]?.date);
                        return (
                          <td key={colIdx} className="px-4 py-2 text-center align-middle">
                            <input 
                              type="text"
                              inputMode="numeric"
                              title={!isSetup ? "請先設定項目名稱與日期" : ""}
                              placeholder="-"
                              className={`w-20 border rounded-lg px-2 py-1.5 text-center text-base font-semibold focus:ring-2 focus:ring-indigo-500 outline-none ${ (stu.regularScores[colIdx] ?? 0) < 60 ? 'text-red-500 font-bold' : ''} ${isArchived || !isSetup ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''} appearance-none`}
                              value={stu.regularScores[colIdx] ?? ''}
                              onChange={(e) => handleScoreChange(stu.id, 'reg', colIdx, e.target.value)}
                              disabled={isArchived || !isSetup}
                            />
                          </td>
                        );
                      })}
                      {selectedTab === 'periodic' && FIXED_PERIODIC_KEYS.map((pk) => {
                          const isSetup = !!periodicColumnDetails[pk]?.date;
                          return (
                          <td key={pk} className="px-4 py-2 text-center align-middle">
                            <input
                              type="text"
                              inputMode="numeric"
                                title={!isSetup ? "請先設定日期" : ""}
                                placeholder="-"
                                className={`w-20 border rounded-lg px-2 py-1.5 text-center text-base font-semibold focus:ring-2 focus:ring-indigo-500 outline-none ${(stu.periodicScores?.[pk] ?? 0) < 60 ? 'text-red-500 font-bold' : ''} ${isArchived || !isSetup ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''} appearance-none`}
                              value={stu.periodicScores?.[pk] ?? ''}
                              onChange={(e) => handleScoreChange(stu.id, 'peri', pk, e.target.value)}
                                disabled={isArchived || !isSetup}
                            />
                          </td>
                          );
                        })}
                      {selectedTab === 'total' && (
                        <>
                          <td className="px-4 py-4 text-center font-mono text-base font-semibold align-middle">{stu.regWeighted.toFixed(1)}</td>
                          <td className="px-4 py-4 text-center font-mono text-base font-semibold align-middle">{stu.pAvg.toFixed(1)}</td>
                          <td className="px-4 py-4 text-center font-mono text-base font-semibold align-middle">{stu.originalTotal}</td>
                          <td className="px-4 py-2 text-center align-middle">
                            <input
                              type="text"
                              inputMode="numeric"
                              placeholder="-"
                              className={`w-24 border rounded-lg px-2 py-1.5 text-center text-base font-semibold focus:ring-2 focus:ring-indigo-500 outline-none ${stu.finalTotal < 60 ? 'text-red-600 font-bold' : 'text-indigo-600'} ${isArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''} appearance-none`}
                              value={stu.finalTotal ?? ''}
                              onChange={(e) => handleFinalScoreChange(stu.id, e.target.value)}
                              disabled={isArchived}
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* 權重設定 Modal */}
      <Modal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="課程成績設定" size="lg">
        {(() => {
          const s = (settings ?? defaultGradeSettings) as GradeSettings;
          const regSum = s.percents.quiz + s.percents.hw + s.percents.att;
          const finalPeriodicPct = 100 - s.percents.periodic;
          return (
            <div className="space-y-8">
              {/* 平時成績權重設定 */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                  <span className="w-1 h-5 bg-indigo-500 rounded-full mr-2"></span>
                  平時成績各項目佔比 (建議加總為 100%)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                  {([['quiz', '小考'], ['hw', '作業'], ['att', '上課態度']] as const).map(([key, label]) => (
                    <div key={key}>
                      <label className="block text-base font-medium text-gray-900 mb-2">{label} (%)</label>
                      <input
                        type="number"
                        className="w-full border border-gray-300 rounded-lg p-2.5 text-base focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        value={s.percents[key]}
                        onChange={(e) =>
                          setSettings((prev) => {
                            const base = (prev ?? defaultGradeSettings) as GradeSettings;
                            return {
                              ...base,
                              percents: { ...base.percents, [key]: Number(e.target.value) || 0 },
                            };
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <div className={`mt-5 text-base font-bold flex items-center ${regSum === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                  目前平時權重加總：{regSum}% {regSum !== 100 && <span className="text-sm ml-2 font-medium">(建議調整至 100%)</span>}
                </div>
              </div>

              {/* 學期總成績權重設定 */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <h4 className="text-base font-bold text-gray-900 mb-4 flex items-center">
                  <span className="w-1 h-5 bg-purple-500 rounded-full mr-2"></span>
                  學期總成績佔比
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
                  <div>
                    <label className="block text-base font-medium text-gray-900 mb-2">平時加權 佔總成績 (%)</label>
                    <input
                      type="number"
                      className="w-full border border-gray-300 rounded-lg p-2.5 text-base focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={s.percents.periodic}
                      onChange={(e) =>
                        setSettings((prev) => {
                          const base = (prev ?? defaultGradeSettings) as GradeSettings;
                          return {
                            ...base,
                            percents: { ...base.percents, periodic: Number(e.target.value) || 0 },
                          };
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-base font-medium text-gray-900 mb-2">定期平均 佔總成績 (%)</label>
                    <input
                      type="number"
                      disabled
                      className="w-full border border-gray-200 rounded-lg p-2.5 text-base bg-gray-200 text-gray-600 cursor-not-allowed font-bold"
                      value={finalPeriodicPct}
                    />
                    <p className="text-sm text-gray-600 mt-2 font-medium">
                      (由 100% 扣除平時加權自動計算)
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6 space-y-4">
                <div className="text-base font-bold text-gray-900">採計「定期平均」時納入的項目</div>
                <div className="flex flex-col gap-3">
                  {DEFAULT_PERIODIC_ITEM_KEYS.map((k) => (
                    <label key={k} className="flex items-center gap-3 text-base font-medium text-gray-900 cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                        checked={s.periodicEnabled[k] !== false}
                        onChange={(e) =>
                          setSettings((prev) => {
                            const base = (prev ?? defaultGradeSettings) as GradeSettings;
                            return {
                              ...base,
                              periodicEnabled: { ...base.periodicEnabled, [k]: e.target.checked },
                            };
                          })
                        }
                      />
                      {k}
                    </label>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-200 pt-6 space-y-4">
                <div className="text-base font-bold text-gray-900">學生端顯示設定</div>
                <div className="flex flex-col gap-3">
                  <label className="flex items-center gap-3 text-base font-medium text-gray-900 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                      checked={s.periodicEnabled?.['showOriginalTotalToStudents'] !== false}
                      onChange={(e) =>
                        setSettings((prev) => {
                          const base = (prev ?? defaultGradeSettings) as GradeSettings;
                          return {
                            ...base,
                            periodicEnabled: {
                              ...base.periodicEnabled,
                              showOriginalTotalToStudents: e.target.checked,
                            },
                          };
                        })
                      }
                    />
                    允許學生查看「原始成績」
                  </label>
                  <label className="flex items-center gap-3 text-base font-medium text-gray-900 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-5 h-5 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 accent-indigo-600 cursor-pointer"
                      checked={s.periodicEnabled?.['showFinalTotalToStudents'] !== false}
                      onChange={(e) =>
                        setSettings((prev) => {
                          const base = (prev ?? defaultGradeSettings) as GradeSettings;
                          return {
                            ...base,
                            periodicEnabled: {
                              ...base.periodicEnabled,
                              showFinalTotalToStudents: e.target.checked,
                            },
                          };
                        })
                      }
                    />
                    允許學生查看「最終成績」
                  </label>
                </div>
              </div>
              <div className="pt-2">
                <button
                  className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-base hover:bg-indigo-700 shadow-md transition-colors"
                  onClick={() => {
                    setShowSettingsModal(false);
                    handleSaveChanges();
                  }}
                >
                  確認設定
                </button>
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* 成績細項：名稱／日期／類別 + 五標 + 分布 */}
      <Modal
        open={columnEditor !== null}
        onClose={() => setColumnEditor(null)}
        title={columnEditor?.kind === 'regular' ? '平時成績項目設定' : '定期評量項目設定'}
        size="xl"
      >
        {columnEditor && (
          <div className="space-y-6">
            {columnEditor.kind === 'regular' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <div className="sm:col-span-1">
                  <label className="text-xs text-gray-500">項目名稱</label>
                  <input
                    type="text"
                    className={`w-full border rounded-lg p-2 mt-1 ${isArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                    value={columnDetails[columnEditor.index]?.name ?? ''}
                    disabled={isArchived}
                    onChange={(e) =>
                      setColumnDetails((prev) => ({
                        ...prev,
                        [String(columnEditor.index)]: {
                          type: prev[String(columnEditor.index)]?.type ?? '小考',
                          name: e.target.value,
                          date: prev[String(columnEditor.index)]?.date ?? '',
                          maxScore: prev[String(columnEditor.index)]?.maxScore ?? 100,
                        },
                      }))
                    }
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="text-xs text-gray-500">滿分</label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg p-2 mt-1 ${isArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                    value={columnDetails[columnEditor.index]?.maxScore ?? 100}
                    disabled={isArchived}
                    onChange={(e) =>
                      setColumnDetails((prev) => ({
                        ...prev,
                        [String(columnEditor.index)]: {
                          ...(prev[String(columnEditor.index)] as ColumnDetail),
                          maxScore: Number(e.target.value) || 100,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">日期</label>
                  <input
                    type="date"
                    className={`w-full border rounded-lg p-2 mt-1 ${isArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                    value={columnDetails[columnEditor.index]?.date ?? ''}
                    disabled={isArchived}
                    onChange={(e) =>
                      setColumnDetails((prev) => ({
                        ...prev,
                        [String(columnEditor.index)]: {
                          type: prev[String(columnEditor.index)]?.type ?? '小考',
                          name: prev[String(columnEditor.index)]?.name ?? '',
                          date: e.target.value,
                          maxScore: prev[String(columnEditor.index)]?.maxScore ?? 100,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">成績類別</label>
                  <div className={`mt-1 ${isArchived ? 'pointer-events-none opacity-60' : ''}`}>
                    <Dropdown
                      value={columnDetails[columnEditor.index]?.type ?? '小考'}
                      onChange={(type) =>
                        setColumnDetails((prev) => ({
                          ...prev,
                          [String(columnEditor.index)]: {
                            type: type as RegularType,
                            name: prev[String(columnEditor.index)]?.name ?? '',
                            date: prev[String(columnEditor.index)]?.date ?? '',
                            maxScore: prev[String(columnEditor.index)]?.maxScore ?? 100,
                          },
                        }))
                      }
                      options={regularTypeOptions}
                      placeholder="選擇成績類別"
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            ) : ( // 定期評量項目設定
              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 border border-gray-100 px-4 py-3 w-full">
                  <div className="text-xs text-gray-500">評量名稱（固定）</div>
                  <div className="text-base font-bold text-gray-900 mt-1">{columnEditor.key}</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-500">日期</label>
                    <input
                      type="date"
                      className={`w-full border rounded-lg p-2 mt-1 ${isArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                      value={periodicColumnDetails[columnEditor.key]?.date ?? ''}
                      disabled={isArchived}
                      onChange={(e) =>
                        setPeriodicColumnDetails((prev) => ({
                          ...prev,
                          [columnEditor.key]: {
                            name: columnEditor.key,
                            date: e.target.value,
                            type: prev[columnEditor.key]?.type ?? '定期評量',
                            maxScore: prev[columnEditor.key]?.maxScore ?? 100,
                          },
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">成績類別</label>
                    <input
                      type="text"
                      className="w-full border rounded-lg p-2 mt-1 bg-gray-100 text-gray-500 cursor-not-allowed"
                      value={periodicColumnDetails[columnEditor.key]?.type ?? '定期評量'}
                      disabled
                      readOnly
                    />
                  </div>
                  <div>
                  <label className="text-xs text-gray-500">滿分</label>
                  <input
                    type="number"
                    className={`w-full border rounded-lg p-2 mt-1 ${isArchived ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                    value={periodicColumnDetails[columnEditor.key]?.maxScore ?? 100}
                    disabled={isArchived}
                    onChange={(e) =>
                      setPeriodicColumnDetails((prev) => ({
                        ...prev,
                        [columnEditor.key]: {
                          ...(prev[columnEditor.key] as PeriodicColumnMeta),
                          maxScore: Number(e.target.value) || 100,
                        },
                      }))
                    }
                  />
                  </div>
                </div>
              </div>
            )}

            {editorDistLoading ? (
              <PageLoadingArea minHeight="min-h-[8rem]" />
            ) : editorDistribution ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div>
                  <h5 className="font-bold text-gray-800 mb-3 flex items-center">
                    <ChartBarIcon className="w-5 h-5 mr-2 text-indigo-500" /> 五標與平均
                  </h5>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                      <tbody className="divide-y divide-gray-50">
                        {[
                          ['頂標', editorDistribution.statistics.頂標],
                          ['前標', editorDistribution.statistics.前標],
                          ['均標', editorDistribution.statistics.均標],
                          ['後標', editorDistribution.statistics.後標],
                          ['底標', editorDistribution.statistics.底標],
                          ['平均', editorDistribution.statistics.平均],
                        ].map(([label, val]) => (
                          <tr key={String(label)}>
                            <td className="px-4 py-2 text-gray-700">{label}</td>
                            <td className="px-4 py-2 text-right font-mono">{val ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h5 className="font-bold text-gray-800 mb-3 flex items-center">
                    <ChartBarIcon className="w-5 h-5 mr-2 text-indigo-500" /> 分數分布
                  </h5>
                  <div className="space-y-2">
                    {(() => {
                      const total = editorDistribution.distribution.reduce((sum, d) => sum + d.count, 0);
                      return editorDistribution.distribution.map((d) => {
                        const pct = total > 0 ? Math.round((d.count / total) * 100) : 0;
                        return (
                          <div key={d.range} className="flex items-center gap-2 text-sm">
                            <span className="w-16 text-gray-600">{d.range}</span>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="w-20 text-right text-gray-500">
                              {d.count} 人 ({pct}%)
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">尚無分數資料或無法載入統計（儲存後全班有分數時會顯示）</p>
            )}

            {columnEditor.kind === 'regular' && !isArchived && (
              <div className="border-t pt-4">
                <button
                  type="button"
                  className="w-full py-2 text-red-600 font-medium hover:bg-red-50 rounded-lg transition-colors flex items-center justify-center"
                  onClick={() => {
                    Swal.fire({
                      icon: 'warning',
                      title: '確定刪除此欄？',
                      text: '將一併移除所有學生此欄成績，且欄位會重新編號。',
                      showCancelButton: true,
                      confirmButtonText: '確定刪除',
                      cancelButtonText: '取消',
                      confirmButtonColor: '#dc2626',
                      cancelButtonColor: '#6b7280',
                    }).then((r) => {
                      if (r.isConfirmed) deleteRegularColumn(columnEditor.index);
                    });
                  }}
                >
                  <TrashIcon className="w-4 h-4 mr-2" /> 刪除此平時欄位
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}