'use client';

import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeftIcon,
  CloudArrowUpIcon,
  PlusIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from './LoadingSpinner';
import GradeScoreInput from './GradeScoreInput';
import {
  FIXED_PERIODIC_KEYS,
  handleGradeInputKeyDown,
  type ColumnDetail,
  type ComputedStudentGradeRow,
  type GradeCourseInfo,
  type PeriodicColumnMeta,
} from '@/hooks/useCourseGrades';

type Props = {
  open: boolean;
  course: GradeCourseInfo;
  students: ComputedStudentGradeRow[];
  /** 若有值：只顯示該學生的成績 */
  focusStudentId?: string | null;
  columnDetails: Record<string, ColumnDetail>;
  regularColumns: number;
  periodicColumnDetails: Record<string, PeriodicColumnMeta>;
  isArchived: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onDiscardAndClose: () => void;
  onAddRegularColumn: () => void;
  onEditRegularColumn: (index: number) => void;
  onEditPeriodicColumn: (key: string) => void;
  onScoreChange: (id: string, type: 'reg' | 'peri', key: string | number, val: number | undefined) => void;
  onFinalChange: (id: string, val: number | undefined) => void;
};

/** 固定欄寬（px）：避免 table w-full 把平時欄撐滿螢幕 */
const ID_COL_W = 112;
const NAME_COL_W = 128;
const REG_COL_W = 102;
const PERI_COL_W = 120;
const TOTAL_COL_W = 96;
const DIVIDER_W = 12;

const sectionDividerClass = 'border-l-2 border-outline-variant bg-surface-container';

export default function GradeEntrySheet({
  open,
  course,
  students,
  focusStudentId = null,
  columnDetails,
  regularColumns,
  periodicColumnDetails,
  isArchived,
  isDirty,
  isSaving,
  onClose,
  onSave,
  onDiscardAndClose,
  onAddRegularColumn,
  onEditRegularColumn,
  onEditPeriodicColumn,
  onScoreChange,
  onFinalChange,
}: Props) {
  const [search, setSearch] = useState('');
  const [mounted, setMounted] = useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (open) setSearch('');
  }, [open, focusStudentId]);

  const focusStudent = useMemo(
    () => (focusStudentId ? students.find((s) => s.id === focusStudentId) : null),
    [students, focusStudentId]
  );

  const filtered = useMemo(() => {
    if (focusStudent) return [focusStudent];
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q)
    );
  }, [students, search, focusStudent]);

  const regularIndices = useMemo(
    () => Array.from({ length: Math.max(0, regularColumns) }, (_, i) => i),
    [regularColumns]
  );

  if (!mounted || !open) return null;

  const leave = () => {
    if (isDirty) onDiscardAndClose();
    else onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[99990] flex flex-col bg-surface-containerLowest">
      <header className="shrink-0 h-14 md:h-16 px-4 md:px-8 border-b border-outline-variant/40 flex items-center justify-between gap-3 bg-surface shadow-sm">
        <nav className="flex items-center gap-2 text-sm text-on-surfaceVariant min-w-0">
          <button
            type="button"
            onClick={leave}
            className="inline-flex items-center gap-1 hover:text-primary shrink-0"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span className="hidden sm:inline">學生成績</span>
          </button>
          <span className="text-outline-variant">/</span>
          <span className="font-semibold text-on-surface truncate">{course.name}</span>
          <span className="text-outline-variant">/</span>
          <span className="font-semibold text-primary shrink-0">
            {focusStudent ? '個人成績' : '成績登記'}
          </span>
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          {!isArchived && (
            <>
              <button
                type="button"
                onClick={onDiscardAndClose}
                className="px-3 py-2 text-xs font-mono uppercase tracking-wider text-on-surfaceVariant hover:text-error"
              >
                取消
              </button>
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving || !isDirty}
                className="px-4 py-2 bg-primary text-on-primary rounded-xl text-xs font-mono uppercase tracking-wider font-bold shadow-sm hover:bg-primary-container disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {isSaving ? <LoadingSpinner size={14} color="white" /> : <CloudArrowUpIcon className="w-4 h-4" />}
                儲存
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-container text-on-surfaceVariant"
            aria-label="關閉"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="shrink-0 px-4 md:px-8 py-3 border-b border-outline-variant/30 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-lg text-on-surface">
            {focusStudent
              ? `${focusStudent.name}（${focusStudent.studentId}）`
              : course.name}
          </h1>
          <p className="text-sm text-on-surfaceVariant">
            {focusStudent
              ? '編輯此學生平時／定期／總成績'
              : `${course.code} · ${students.length} 位學生`}
            {isDirty ? ' · 有未儲存變更' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {!focusStudent && (
            <input
              type="search"
              className="pl-3 pr-3 py-2 border border-outline-variant rounded-xl bg-surface text-sm w-48 md:w-64 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              placeholder="搜尋學生…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          )}
          {!isArchived && (
            <button
              type="button"
              onClick={onAddRegularColumn}
              className="px-3 py-2 rounded-xl border border-dashed border-primary/40 text-primary text-sm font-medium inline-flex items-center gap-1 hover:bg-primary/5"
            >
              <PlusIcon className="w-4 h-4" />
              新增平時
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="px-8 py-16 text-center text-on-surfaceVariant text-sm">
            {students.length === 0
              ? '尚無學生資料，請確認課程是否已有學生名單。'
              : '沒有符合搜尋條件的學生'}
          </div>
        ) : (
          <table className="text-left border-collapse table-fixed w-max">
            <colgroup>
              <col style={{ width: ID_COL_W, minWidth: ID_COL_W }} />
              <col style={{ width: NAME_COL_W, minWidth: NAME_COL_W }} />
              {regularIndices.map((i) => (
                <col key={`cr-${i}`} style={{ width: REG_COL_W, minWidth: REG_COL_W }} />
              ))}
              <col style={{ width: DIVIDER_W, minWidth: DIVIDER_W }} />
              {FIXED_PERIODIC_KEYS.map((pk) => (
                <col key={`cp-${pk}`} style={{ width: PERI_COL_W, minWidth: PERI_COL_W }} />
              ))}
              <col style={{ width: DIVIDER_W, minWidth: DIVIDER_W }} />
              <col style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }} />
              <col style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }} />
              <col style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }} />
              <col style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }} />
            </colgroup>

            <thead className="sticky top-0 z-20 bg-surface-containerLow shadow-[0_1px_0_0_rgba(195,198,215,0.8)]">
              {/* 區塊標題列 */}
              <tr>
                <th
                  colSpan={2}
                  className="py-2 px-3 bg-surface-containerLow sticky left-0 z-30 border-b border-outline-variant/40"
                />
                <th
                  colSpan={Math.max(regularIndices.length, 1)}
                  className="py-2 px-2 text-center text-xs font-bold text-on-surface border-b border-outline-variant/40 bg-surface-containerLow"
                >
                  平時成績
                </th>
                <th className={`${sectionDividerClass} border-b border-outline-variant/40`} aria-hidden />
                <th
                  colSpan={FIXED_PERIODIC_KEYS.length}
                  className="py-2 px-2 text-center text-xs font-bold text-on-surface border-b border-outline-variant/40 bg-surface-containerLow"
                >
                  定期評量
                </th>
                <th className={`${sectionDividerClass} border-b border-outline-variant/40`} aria-hidden />
                <th
                  colSpan={4}
                  className="py-2 px-2 text-center text-xs font-bold text-on-surface border-b border-outline-variant/40 bg-surface-containerLow"
                >
                  總成績
                </th>
              </tr>

              {/* 欄位標題列 */}
              <tr>
                <th
                  className="py-3 px-3 font-mono text-[11px] uppercase tracking-wider text-on-surfaceVariant border-r border-outline-variant/30 bg-surface-containerLow sticky left-0 z-30"
                  style={{ width: ID_COL_W, minWidth: ID_COL_W, maxWidth: ID_COL_W }}
                >
                  學號
                </th>
                <th
                  className="py-3 px-3 font-mono text-[11px] uppercase tracking-wider text-on-surfaceVariant border-r border-outline-variant/30 bg-surface-containerLow sticky z-30 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]"
                  style={{
                    width: NAME_COL_W,
                    minWidth: NAME_COL_W,
                    maxWidth: NAME_COL_W,
                    left: ID_COL_W,
                  }}
                >
                  姓名
                </th>

                {regularIndices.map((i) => {
                  const detail = columnDetails[String(i)] ?? columnDetails[i];
                  const setup = !!(detail?.name?.trim() && detail?.date);
                  return (
                    <th
                      key={`r-${i}`}
                      className="py-2 px-1 font-mono text-[10px] uppercase tracking-wider text-on-surfaceVariant border-r border-outline-variant/30 text-center cursor-pointer hover:text-primary"
                      style={{ width: REG_COL_W, minWidth: REG_COL_W, maxWidth: REG_COL_W }}
                      onClick={() => onEditRegularColumn(i)}
                      title="點擊編輯欄位設定"
                    >
                      <div className="truncate font-semibold normal-case text-xs">
                        {detail?.name || `成績${i + 1}`}
                      </div>
                      <div className={`text-[10px] mt-0.5 truncate ${setup ? 'text-outline' : 'text-error'}`}>
                        {setup ? detail.date : '尚未設定'}
                      </div>
                    </th>
                  );
                })}

                <th className={sectionDividerClass} aria-hidden />

                {FIXED_PERIODIC_KEYS.map((pk) => {
                  const meta = periodicColumnDetails[pk];
                  return (
                    <th
                      key={pk}
                      className="py-2 px-2 font-mono text-[10px] uppercase tracking-wider text-on-surfaceVariant border-r border-outline-variant/30 text-center cursor-pointer hover:text-primary"
                      style={{ width: PERI_COL_W, minWidth: PERI_COL_W }}
                      onClick={() => onEditPeriodicColumn(pk)}
                      title="點擊編輯日期／滿分"
                    >
                      <div className="truncate font-semibold normal-case text-xs">
                        {meta?.name || pk}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${meta?.date ? 'text-outline' : 'text-error'}`}>
                        {meta?.date || '尚未設定'}
                      </div>
                    </th>
                  );
                })}

                <th className={sectionDividerClass} aria-hidden />

                <th
                  className="py-2 px-3 font-mono text-[10px] uppercase tracking-wider text-on-surfaceVariant text-center border-r border-outline-variant/30"
                  style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }}
                >
                  <div className="font-semibold normal-case text-xs">平時加權</div>
                  <div className="text-[10px] mt-0.5 text-transparent select-none">—</div>
                </th>
                <th
                  className="py-2 px-3 font-mono text-[10px] uppercase tracking-wider text-on-surfaceVariant text-center border-r border-outline-variant/30"
                  style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }}
                >
                  <div className="font-semibold normal-case text-xs">定期平均</div>
                  <div className="text-[10px] mt-0.5 text-transparent select-none">—</div>
                </th>
                <th
                  className="py-2 px-3 font-mono text-[10px] uppercase tracking-wider text-on-surfaceVariant text-center border-r border-outline-variant/30"
                  style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }}
                >
                  <div className="font-semibold normal-case text-xs">原始成績</div>
                  <div className="text-[10px] mt-0.5 text-transparent select-none">—</div>
                </th>
                <th
                  className="py-2 px-3 font-mono text-[10px] uppercase tracking-wider text-primary text-center bg-surface-containerHigh"
                  style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }}
                >
                  <div className="font-semibold normal-case text-xs">最終成績</div>
                  <div className="text-[10px] mt-0.5 text-transparent select-none">—</div>
                </th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((stu, rowIndex) => (
                <tr
                  key={stu.id}
                  className="border-b border-outline-variant/20 hover:bg-surface-containerLow/50 group"
                >
                  <td
                    className="py-2 px-3 font-mono text-sm text-on-surface border-r border-outline-variant/30 bg-surface-containerLowest sticky left-0 z-10 group-hover:bg-surface-containerLow/50"
                    style={{ width: ID_COL_W, minWidth: ID_COL_W, maxWidth: ID_COL_W }}
                  >
                    {stu.studentId}
                  </td>
                  <td
                    className="py-2 px-3 text-sm font-medium text-on-surface border-r border-outline-variant/30 bg-surface-containerLowest sticky z-10 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)] group-hover:bg-surface-containerLow/50 truncate"
                    style={{
                      width: NAME_COL_W,
                      minWidth: NAME_COL_W,
                      maxWidth: NAME_COL_W,
                      left: ID_COL_W,
                    }}
                  >
                    {stu.name}
                  </td>

                  {regularIndices.map((colIdx) => {
                    const detail = columnDetails[String(colIdx)] ?? columnDetails[colIdx];
                    const isSetup = !!(detail?.name?.trim() && detail?.date);
                    const colKey = `entry-reg-${colIdx}`;
                    const score =
                      stu.regularScores?.[String(colIdx)] ??
                      stu.regularScores?.[colIdx as unknown as string];
                    return (
                      <td
                        key={colKey}
                        className="p-1 border-r border-outline-variant/30"
                        style={{ width: REG_COL_W, minWidth: REG_COL_W, maxWidth: REG_COL_W }}
                      >
                        <GradeScoreInput
                          data-grade-col={colKey}
                          data-grade-row={rowIndex}
                          className={`w-full min-h-[36px] px-1 text-center border rounded bg-transparent hover:bg-surface focus:bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono text-base ${
                            (score ?? 0) < 60 && score != null ? 'text-error font-bold' : ''
                          } ${isArchived || !isSetup ? 'opacity-50 cursor-not-allowed border-transparent' : 'border-transparent'}`}
                          value={score}
                          onCommit={(n) => onScoreChange(stu.id, 'reg', colIdx, n)}
                          onKeyDown={(e) => handleGradeInputKeyDown(e, colKey, rowIndex)}
                          disabled={isArchived || !isSetup}
                          placeholder="—"
                          title={!isSetup ? '請先設定項目名稱與日期' : undefined}
                        />
                      </td>
                    );
                  })}

                  <td className={sectionDividerClass} aria-hidden />

                  {FIXED_PERIODIC_KEYS.map((pk) => {
                    const isSetup = !!periodicColumnDetails[pk]?.date;
                    const colKey = `entry-peri-${pk}`;
                    const score = stu.periodicScores?.[pk];
                    return (
                      <td
                        key={colKey}
                        className="p-1 border-r border-outline-variant/30"
                        style={{ width: PERI_COL_W, minWidth: PERI_COL_W }}
                      >
                        <GradeScoreInput
                          data-grade-col={colKey}
                          data-grade-row={rowIndex}
                          className={`w-full min-h-[36px] px-2 text-center border rounded bg-transparent hover:bg-surface focus:bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono text-base ${
                            (score ?? 0) < 60 && score != null ? 'text-error font-bold' : ''
                          } ${isArchived || !isSetup ? 'opacity-50 cursor-not-allowed border-transparent' : 'border-transparent'}`}
                          value={score}
                          onCommit={(n) => onScoreChange(stu.id, 'peri', pk, n)}
                          onKeyDown={(e) => handleGradeInputKeyDown(e, colKey, rowIndex)}
                          disabled={isArchived || !isSetup}
                          placeholder="—"
                          title={!isSetup ? '請先設定日期' : undefined}
                        />
                      </td>
                    );
                  })}

                  <td className={sectionDividerClass} aria-hidden />

                  <td
                    className="py-2 px-3 text-center font-mono text-base font-semibold border-r border-outline-variant/30"
                    style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }}
                  >
                    {stu.regWeighted.toFixed(1)}
                  </td>
                  <td
                    className="py-2 px-3 text-center font-mono text-base font-semibold border-r border-outline-variant/30"
                    style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }}
                  >
                    {stu.pAvg.toFixed(1)}
                  </td>
                  <td
                    className="py-2 px-3 text-center font-mono text-base font-semibold border-r border-outline-variant/30"
                    style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }}
                  >
                    {stu.originalTotal}
                  </td>
                  <td
                    className="p-1 bg-surface-containerLow/40"
                    style={{ width: TOTAL_COL_W, minWidth: TOTAL_COL_W }}
                  >
                    <GradeScoreInput
                      data-grade-col="entry-final"
                      data-grade-row={rowIndex}
                      className={`w-full min-h-[36px] px-2 text-center border border-transparent rounded bg-transparent hover:bg-surface focus:bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none font-mono text-base font-bold ${
                        stu.finalTotal < 60 ? 'text-error' : 'text-primary'
                      } ${isArchived ? 'opacity-50 cursor-not-allowed' : ''}`}
                      value={stu.finalTotal}
                      onCommit={(n) => onFinalChange(stu.id, n)}
                      onKeyDown={(e) => handleGradeInputKeyDown(e, 'entry-final', rowIndex)}
                      disabled={isArchived}
                      placeholder="—"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>,
    document.body
  );
}
