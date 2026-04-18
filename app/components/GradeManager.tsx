'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal, } from 'react-dom';
import LoadingSpinner from './LoadingSpinner';
import { 
  AdjustmentsHorizontalIcon, 
  CloudArrowUpIcon, ClipboardDocumentListIcon,
  XMarkIcon, TrashIcon,
  ChartBarIcon,
  PlusIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';
import CourseFilter from './CourseFilter';
import GradeRegistrationMobile from './GradeRegistrationMobile';
import Swal from 'sweetalert2';
import {
  DEFAULT_PERIODIC_ITEM_KEYS,
  defaultGradeSettings,
  mergePeriodicColumnDetails,
} from '@/services/gradeShape';

// --- 型別定義 ---
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
  total: number;
}


interface ColumnDetail { type: RegularType; name: string; date: string; nature?: string; }

type PeriodicColumnMeta = { name: string; date: string; type: string };

/** 定期評量欄位固定三欄（與 Firestore / 採計鍵名一致） */
const FIXED_PERIODIC_KEYS = [...DEFAULT_PERIODIC_ITEM_KEYS] as string[];

interface GradeSettings {
  percents: { quiz: number; hw: number; att: number; periodic: number; };
  calcModes: Record<RegularType, { mode: 'all' | 'best'; n: number }>;
  periodicEnabled: Record<string, boolean>;
}


// --- 核心組件 ---
const Modal = ({ open, onClose, title, size = 'md', children }: { open?: boolean; onClose?: () => void; title?: string; size?: string; children?: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !open) return null;
  const maxWidth = { md: 'max-w-lg', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size as 'md'|'lg'|'xl'];
  
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex justify-center items-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] flex flex-col border border-gray-100`}>
        <div className="flex justify-between items-center px-6 py-4 border-b bg-gray-50/50 rounded-t-2xl">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>,
    document.body
  );
};

export default function GradeManager({ userInfo }: { userInfo?: UserInfo | null }) {
  // --- 狀態管理 ---
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

  // --- 核心計算邏輯 (useMemo 優化) ---
  const computedData: ComputedStudentGradeRow[] = useMemo(() => {
    const s = settings ?? defaultGradeSettings;
    return students.map(stu => {
      const getAvg = (type: RegularType) => {
        const scores = Object.entries(stu.regularScores || {})
          .filter(([idx]) => columnDetails[idx]?.type === type)
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

      const total = Math.round(regWeighted * (percents.periodic / 100) + pAvg * ((100 - percents.periodic) / 100));
      
      return { ...stu, qAvg, hAvg, aAvg, regWeighted, pAvg, total };
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
      setRegularColumns((c) => Math.max(0, c - 1));
      setColumnEditor(null);
    },
    []
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
          
          setStudents(data.students || []);
          setColumnDetails(data.columnDetails || {});
          setRegularColumns(data.regularColumns || 0);
          setSettings(data.settings ?? defaultGradeSettings);
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
          students,
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

  const handleExportGrades = useCallback(() => {
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

    const escapeCsv = (value: string | number | undefined | null) => {
      const raw = value === undefined || value === null ? '' : String(value);
      if (raw.includes('"') || raw.includes(',') || raw.includes('\n')) {
        return `"${raw.replace(/"/g, '""')}"`;
      }
      return raw;
    };

    const regularHeaders = Array.from({ length: regularColumns }).map((_, i) => {
      const detail = columnDetails[i];
      return detail?.name || `平時${i + 1}`;
    });
    const periodicHeaders = [...FIXED_PERIODIC_KEYS];

    const headers: string[] = [
      '學號',
      '姓名',
      ...regularHeaders,
      ...periodicHeaders,
      '平時加權',
      '定期平均',
      '總成績',
    ];

    const rows: (string | number)[][] = computedData.map((stu) => [
      stu.studentId,
      stu.name,
      ...Array.from({ length: regularColumns }).map((_, i) => stu.regularScores[i] ?? ''),
      ...FIXED_PERIODIC_KEYS.map((key) => stu.periodicScores?.[key] ?? ''),
      stu.regWeighted.toFixed(1),
      stu.pAvg.toFixed(1),
      stu.total,
    ]);

    const csv = [headers, ...rows]
      .map((line) => line.map((cell) => escapeCsv(cell)).join(','))
      .join('\n');

    const bom = '\uFEFF';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedCourse.name}_完整成績匯出.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    });
  }, [courses, searchTerm, selectedGrade, selectedSubject, selectedNature, selectedStatus]);

  // --- 渲染部分 ---
  if (isLoading) return <div className="flex justify-center p-20"><LoadingSpinner size={50} text="載入課程中..." /></div>;

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 flex flex-col h-full animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <ClipboardDocumentListIcon className="h-8 w-8 text-indigo-600" />
            成績管理系統
          </h1>
          <p className="text-gray-500 text-sm mt-1">設定評量比例並登記學生的平時與定期成績。</p>
        </div>
        {selectedCourse && (
          <button onClick={() => setSelectedCourse(null)} className="text-sm text-indigo-600 hover:underline">返回列表</button>
        )}
      </div>

      {!selectedCourse ? (
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
                                  <button onClick={() => setSelectedCourse(course)} className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
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
                  <div key={course.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 flex flex-col gap-3 active:scale-[0.99] transition-transform" onClick={() => setSelectedCourse(course)}>
                      <div className="flex justify-between items-start">
                           <div>
                               <h3 className="font-bold text-gray-900 text-lg">{course.name}</h3>
                               <p className="text-xs font-mono text-gray-500 mt-1">{course.code}</p>
                           </div>
                      </div>
                      <div className="border-t border-gray-100 pt-3 flex justify-end">
                           <button onClick={(e) => { e.stopPropagation(); setSelectedCourse(course); }} className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">
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
          {/* 工具列 */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex bg-gray-100 p-1 rounded-xl">
              {(['regular', 'periodic', 'total'] as const).map(t => (
                <button key={t} onClick={() => setSelectedTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${selectedTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
                  {t === 'regular' ? '平時' : t === 'periodic' ? '定期' : '總成績'}
                </button>
              ))}
            </div>
            <button className="btn-secondary flex items-center" onClick={() => setShowSettingsModal(true)}><AdjustmentsHorizontalIcon className="w-4 h-4 mr-2" />權重設定</button>
            {selectedTab === 'regular' && (
              <button
                type="button"
                className="btn-secondary flex items-center border-dashed border-2 border-indigo-200 text-indigo-700"
                onClick={addRegularColumn}
              >
                <PlusIcon className="w-4 h-4 mr-2" />
                新增平時欄位
              </button>
            )}
            <button className="btn-secondary flex items-center" onClick={handleExportGrades}>
              <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
              匯出成績
            </button>
            <button className="btn-primary ml-auto flex items-center" onClick={handleSaveChanges} disabled={isSaving}>
              {isSaving ? <LoadingSpinner size={16} color="white" className="mr-2" /> : <CloudArrowUpIcon className="w-5 h-5 mr-2" />}
              {isSaving ? '儲存中...' : '儲存變更'}
            </button>
          </div>

          

          {/* 表格主體 (簡化邏輯呈現) */}
          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            {isCourseLoading ? (
              <div className="p-20 flex justify-center items-center">
                <LoadingSpinner text="載入成績資料..." />
              </div>
            ) : (
            <>
            {/* Mobile View */}
            <GradeRegistrationMobile 
              tab={selectedTab} // The 'tab' prop is already typed as 'regular' | 'periodic' | 'total'
              students={computedData} // 'computedData' is now correctly typed as 'ComputedStudentGradeRow[]'
              regularColumns={regularColumns}
              columnDetails={columnDetails}
              _periodicScores={FIXED_PERIODIC_KEYS}
              periodicColumnDetails={periodicColumnDetails}
              onUpdateRegularScore={(studentId, colIdx, value) => handleScoreChange(studentId, 'reg', colIdx, String(value ?? ''))}
              _onUpdatePeriodicScore={(studentId, scoreName, value) => handleScoreChange(studentId, 'peri', scoreName, String(value ?? ''))}
            />
            <div className="hidden md:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-700 uppercase text-xs font-bold">
                  <tr>
                    <th className="px-6 py-4 sticky left-0 bg-gray-50 z-10 w-32 border-r">學號</th>
                    <th className="px-6 py-4 sticky left-32 bg-gray-50 z-10 w-24 border-r shadow-sm">姓名</th>
                    {selectedTab === 'regular' && Array.from({ length: regularColumns }).map((_, i) => (
                      <th key={i} className="px-4 py-4 min-w-[120px] text-center border-b">
                        <div className="text-[10px] text-gray-400 mb-1">{columnDetails[i]?.type || '未設定'}</div>
                        <div className="cursor-pointer hover:text-indigo-600" onClick={() => setColumnEditor({ kind: 'regular', index: i })}>
                          {columnDetails[i]?.name || `成績${i + 1}`}
                        </div>
                        {columnDetails[i]?.date ? (
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">{columnDetails[i].date}</div>
                        ) : null}
                      </th>
                    ))}
                    {selectedTab === 'periodic' &&
                      FIXED_PERIODIC_KEYS.map((pk) => {
                        const meta = periodicColumnDetails[pk];
                        return (
                          <th key={pk} className="px-4 py-4 min-w-[140px] text-center border-b">
                            <div className="text-[10px] text-gray-400 mb-1">{meta?.type || '定期評量'}</div>
                            <div className="cursor-pointer hover:text-indigo-600 text-sm font-bold text-gray-800" onClick={() => setColumnEditor({ kind: 'periodic', key: pk })}>
                              {pk}
                            </div>
                            {meta?.date ? (
                              <div className="text-[10px] text-gray-400 font-mono mt-0.5">{meta.date}</div>
                            ) : null}
                          </th>
                        );
                      })}
                    {selectedTab === 'total' && (
                      <>
                        <th className="px-4 py-4 text-center">平時加權</th>
                        <th className="px-4 py-4 text-center">定期平均</th>
                        <th className="px-4 py-4 text-center text-indigo-600">總成績</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {computedData.map((stu) => (
                    <tr key={stu.id} className="group">
                      <td className="px-6 py-4 font-mono sticky left-0 bg-white group-hover:bg-indigo-50/30 z-20 border-r">{stu.studentId}</td>
                      <td className="px-6 py-4 font-medium sticky left-32 bg-white group-hover:bg-indigo-50/30 z-20 border-r shadow-sm">{stu.name}</td>
                      {selectedTab === 'regular' && Array.from({ length: regularColumns }).map((_, colIdx) => (
                        <td key={colIdx} className="px-4 py-2 text-center">
                          <input 
                            type="number" 
                            className={`w-20 border rounded-lg px-2 py-1.5 text-center focus:ring-2 focus:ring-indigo-500 outline-none ${ (stu.regularScores[colIdx] ?? 0) < 60 ? 'text-red-500 font-bold' : ''}`}
                            value={stu.regularScores[colIdx] ?? ''}
                            onChange={(e) => handleScoreChange(stu.id, 'reg', colIdx, e.target.value)}
                          />
                        </td>
                      ))}
                      {selectedTab === 'periodic' &&
                        FIXED_PERIODIC_KEYS.map((pk) => (
                          <td key={pk} className="px-4 py-2 text-center">
                            <input
                              type="number"
                              className={`w-20 border rounded-lg px-2 py-1.5 text-center focus:ring-2 focus:ring-indigo-500 outline-none ${(stu.periodicScores?.[pk] ?? 0) < 60 ? 'text-red-500 font-bold' : ''}`}
                              value={stu.periodicScores?.[pk] ?? ''}
                              onChange={(e) => handleScoreChange(stu.id, 'peri', pk, e.target.value)}
                            />
                          </td>
                        ))}
                      {selectedTab === 'total' && (
                        <>
                          <td className="px-4 py-4 text-center font-mono">{stu.regWeighted.toFixed(1)}</td>
                          <td className="px-4 py-4 text-center font-mono">{stu.pAvg.toFixed(1)}</td>
                          <td className={`px-4 py-4 text-center font-bold text-lg ${stu.total < 60 ? 'text-red-600' : 'text-indigo-600'}`}>{stu.total}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </>
            )}
          </div>
        </div>
      )}

      {/* 權重設定 Modal */}
      <Modal open={showSettingsModal} onClose={() => setShowSettingsModal(false)} title="成績比例與採計設定" size="lg">
        {(() => {
          const s = settings ?? defaultGradeSettings;
          const regSum = s.percents.quiz + s.percents.hw + s.percents.att;
          const finalPeriodicPct = 100 - s.percents.periodic;
          return (
            <div className="space-y-6">
              <p className="text-sm text-gray-600">
                下方「小考／作業／上課態度」為<strong>平時成績內部</strong>加權（可為 0，未填視為 0）。「平時佔總成績」決定平時加權與定期平均在<strong>總成績</strong>中的比例。
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([['quiz', '小考'], ['hw', '作業'], ['att', '上課態度']] as const).map(([key, label]) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500">{label} 佔平時加權（%）</label>
                    <input
                      type="number"
                      className="w-full border rounded-lg p-2 mt-1"
                      value={s.percents[key]}
                      onChange={(e) =>
                        setSettings((prev) => {
                          const base = prev ?? defaultGradeSettings;
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
              <div>
                <label className="text-xs text-gray-500">平時加權占總成績（%）</label>
                <input
                  type="number"
                  className="w-full border rounded-lg p-2 mt-1 max-w-xs"
                  value={s.percents.periodic}
                  onChange={(e) =>
                    setSettings((prev) => {
                      const base = prev ?? defaultGradeSettings;
                      return {
                        ...base,
                        percents: { ...base.percents, periodic: Number(e.target.value) || 0 },
                      };
                    })
                  }
                />
                <p className="text-xs text-gray-500 mt-1">
                  定期平均約占總成績：{finalPeriodicPct}%（100 − 上列數值）
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-700">
                <div>平時內部權重加總：{regSum}%（建議 100%，僅用於計算平時加權）</div>
              </div>
              <div className="border-t pt-4 space-y-2">
                <div className="text-sm font-bold text-gray-700">採計「定期平均」時納入的項目</div>
                <p className="text-xs text-gray-500">
                  畫面上固定顯示：第一次定期評量、第二次定期評量、期末評量（可登記分數）。取消勾選者仍會顯示欄位，但不計入定期平均與總成績中的定期部分。
                </p>
                <div className="flex flex-col gap-2">
                  {DEFAULT_PERIODIC_ITEM_KEYS.map((k) => (
                    <label key={k} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={s.periodicEnabled[k] !== false}
                        onChange={(e) =>
                          setSettings((prev) => {
                            const base = prev ?? defaultGradeSettings;
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
              <button
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-100"
                onClick={() => setShowSettingsModal(false)}
              >
                確認設定
              </button>
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="text-xs text-gray-500">項目名稱</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg p-2 mt-1"
                    value={columnDetails[columnEditor.index]?.name ?? ''}
                    onChange={(e) =>
                      setColumnDetails((prev) => ({
                        ...prev,
                        [String(columnEditor.index)]: {
                          type: prev[String(columnEditor.index)]?.type ?? '小考',
                          name: e.target.value,
                          date: prev[String(columnEditor.index)]?.date ?? '',
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">日期</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg p-2 mt-1"
                    value={columnDetails[columnEditor.index]?.date ?? ''}
                    onChange={(e) =>
                      setColumnDetails((prev) => ({
                        ...prev,
                        [String(columnEditor.index)]: {
                          type: prev[String(columnEditor.index)]?.type ?? '小考',
                          name: prev[String(columnEditor.index)]?.name ?? '',
                          date: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">成績類別</label>
                  <select
                    className="w-full border rounded-lg p-2 mt-1"
                    value={columnDetails[columnEditor.index]?.type ?? '小考'}
                    onChange={(e) =>
                      setColumnDetails((prev) => ({
                        ...prev,
                        [String(columnEditor.index)]: {
                          type: e.target.value as RegularType,
                          name: prev[String(columnEditor.index)]?.name ?? '',
                          date: prev[String(columnEditor.index)]?.date ?? '',
                        },
                      }))
                    }
                  >
                    <option value="小考">小考</option>
                    <option value="作業">作業</option>
                    <option value="上課態度">上課態度</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 rounded-lg bg-gray-50 border border-gray-100 px-4 py-3">
                  <div className="text-xs text-gray-500">評量名稱（固定）</div>
                  <div className="text-base font-bold text-gray-900 mt-1">{columnEditor.key}</div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">日期</label>
                  <input
                    type="date"
                    className="w-full border rounded-lg p-2 mt-1"
                    value={periodicColumnDetails[columnEditor.key]?.date ?? ''}
                    onChange={(e) =>
                      setPeriodicColumnDetails((prev) => ({
                        ...prev,
                        [columnEditor.key]: {
                          name: columnEditor.key,
                          date: e.target.value,
                          type: prev[columnEditor.key]?.type ?? '定期評量',
                        },
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">成績類別</label>
                  <input
                    type="text"
                    className="w-full border rounded-lg p-2 mt-1"
                    value={periodicColumnDetails[columnEditor.key]?.type ?? '定期評量'}
                    onChange={(e) =>
                      setPeriodicColumnDetails((prev) => ({
                        ...prev,
                        [columnEditor.key]: {
                          name: columnEditor.key,
                          date: prev[columnEditor.key]?.date ?? '',
                          type: e.target.value,
                        },
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {editorDistLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner text="載入班級統計…" />
              </div>
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

            {columnEditor.kind === 'regular' && (
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