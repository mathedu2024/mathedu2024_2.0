'use client';

import React, { useMemo, useState } from 'react';
import {
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ChartBarIcon,
  PencilSquareIcon,
  TableCellsIcon,
} from '@heroicons/react/24/outline';
import LoadingSpinner from './LoadingSpinner';
import GradeScoreInput from './GradeScoreInput';
import {
  FIXED_PERIODIC_KEYS,
  handleGradeInputKeyDown,
  type ComputedStudentGradeRow,
  type GradeCourseInfo,
  type PeriodicColumnMeta,
} from '@/hooks/useCourseGrades';

const PASS_LINE = 60;

const BUCKETS = [
  { key: '0-59', min: 0, max: 59, color: 'bg-error/80' },
  { key: '60-69', min: 60, max: 69, color: 'bg-primary/40' },
  { key: '70-79', min: 70, max: 79, color: 'bg-primary/60' },
  { key: '80-89', min: 80, max: 89, color: 'bg-primary/80' },
  { key: '90-100', min: 90, max: 100, color: 'bg-primary' },
] as const;

type Props = {
  course: GradeCourseInfo;
  students: ComputedStudentGradeRow[];
  periodicColumnDetails: Record<string, PeriodicColumnMeta>;
  isArchived: boolean;
  isDirty: boolean;
  isSaving: boolean;
  onOpenSettings: () => void;
  onOpenImport: () => void;
  onExport: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onOpenEntry: (studentId?: string) => void;
  onScoreChange: (id: string, type: 'reg' | 'peri', key: string | number, val: number | undefined) => void;
  onFinalChange: (id: string, val: number | undefined) => void;
};

export default function GradeOverview({
  course,
  students,
  periodicColumnDetails,
  isArchived,
  isDirty,
  isSaving,
  onOpenSettings,
  onOpenImport,
  onExport,
  onSave,
  onDiscard,
  onOpenEntry,
  onScoreChange,
  onFinalChange,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pass' | 'fail'>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      if (q) {
        const hit =
          s.name.toLowerCase().includes(q) || s.studentId.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (statusFilter === 'pass' && s.finalTotal < PASS_LINE) return false;
      if (statusFilter === 'fail' && s.finalTotal >= PASS_LINE) return false;
      return true;
    });
  }, [students, search, statusFilter]);

  const stats = useMemo(() => {
    const emptyBuckets = BUCKETS.map((b) => ({ ...b, count: 0, pct: 0, heightPct: 0 }));
    if (students.length === 0) {
      return { avg: 0, pass: 0, total: 0, max: 0, min: 0, buckets: emptyBuckets };
    }
    const scores = students.map((s) => s.finalTotal);
    const sum = scores.reduce((a, b) => a + b, 0);
    const pass = scores.filter((n) => n >= PASS_LINE).length;
    const buckets = BUCKETS.map((b) => {
      const count = scores.filter((n) => n >= b.min && n <= b.max).length;
      return { ...b, count, pct: Math.round((count / scores.length) * 100) };
    });
    const maxH = Math.max(...buckets.map((b) => b.count), 1);
    return {
      avg: sum / scores.length,
      pass,
      total: scores.length,
      max: Math.max(...scores),
      min: Math.min(...scores),
      buckets: buckets.map((b) => ({ ...b, heightPct: Math.round((b.count / maxH) * 100) })),
    };
  }, [students]);

  const avgPct = Math.min(100, Math.max(0, stats.avg));

  return (
    <div className="w-full min-w-0 space-y-6 pb-28 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold text-on-surface">學生成績管理</h1>
          <p className="text-on-surfaceVariant mt-1 flex items-center gap-2 text-sm md:text-base">
            <span className="font-mono text-[11px] uppercase tracking-wider text-primary">課程</span>
            <span className="font-semibold text-primary">{course.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            disabled={isArchived}
            className="px-4 py-2.5 rounded-xl border-2 border-primary text-primary text-sm font-semibold flex items-center gap-2 hover:bg-primary/5 disabled:opacity-50"
          >
            <AdjustmentsHorizontalIcon className="w-5 h-5" />
            學生成績設定
          </button>
          {!isArchived && (
            <button
              type="button"
              onClick={onOpenImport}
              className="px-4 py-2.5 rounded-xl border-2 border-outline-variant text-on-surfaceVariant text-sm font-semibold flex items-center gap-2 hover:bg-surface-containerLow"
            >
              <ArrowUpTrayIcon className="w-5 h-5" />
              自線上測驗匯入
            </button>
          )}
          <button
            type="button"
            onClick={onExport}
            className="px-4 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold flex items-center gap-2 hover:bg-primary-container shadow-sm"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            匯出成績報表
          </button>
          <button
            type="button"
            onClick={() => onOpenEntry()}
            className="px-4 py-2.5 rounded-xl bg-secondary text-white text-sm font-semibold flex items-center gap-2 hover:opacity-90 shadow-sm"
          >
            <TableCellsIcon className="w-5 h-5 text-white" />
            成績登記
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface-containerLowest rounded-xl p-4 border border-outline-variant/40 flex items-center justify-between shadow-sm">
          <div>
            <h3 className="text-on-surfaceVariant text-xs font-semibold uppercase tracking-wider mb-1">
              全班平均成績
            </h3>
            <div className="text-3xl font-mono font-bold text-primary">
              {stats.total ? stats.avg.toFixed(1) : '—'}
              <span className="text-lg text-on-surfaceVariant ml-1">分</span>
            </div>
          </div>
          <div className="relative w-16 h-16">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-surface-containerHigh"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="text-primary"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeDasharray={`${avgPct}, 100`}
                strokeWidth="4"
              />
            </svg>
          </div>
        </div>
        <div className="bg-surface-containerLowest rounded-xl p-4 border border-outline-variant/40 flex items-center justify-between shadow-sm">
          <div>
            <h3 className="text-on-surfaceVariant text-xs font-semibold uppercase tracking-wider mb-1">
              及格人數
            </h3>
            <div className="text-3xl font-mono font-bold text-secondary">
              {stats.pass}
              <span className="text-lg text-on-surfaceVariant ml-1">/ {stats.total}</span>
            </div>
          </div>
          <div className="w-12 h-12 rounded-full bg-secondary-container/30 flex items-center justify-center text-secondary">
            <ChartBarIcon className="w-7 h-7" />
          </div>
        </div>
        <div className="bg-surface-containerLowest rounded-xl p-4 border border-outline-variant/40 flex items-center justify-between shadow-sm">
          <div>
            <h3 className="text-on-surfaceVariant text-xs font-semibold uppercase tracking-wider mb-1">
              最高 / 最低分
            </h3>
            <div className="text-3xl font-mono font-bold text-on-surface">
              {stats.total ? stats.max : '—'}{' '}
              <span className="text-lg text-on-surfaceVariant mx-1">/</span>{' '}
              <span className="text-error">{stats.total ? stats.min : '—'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Distribution + filters */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface-containerLowest rounded-xl p-6 border border-outline-variant/40 shadow-sm">
          <h2 className="font-display font-bold text-on-surface text-lg mb-6">成績分佈（總成績）</h2>
          <div className="h-48 flex items-end justify-between gap-2 px-2">
            {stats.buckets.map((b) => (
              <div key={b.key} className="flex flex-col items-center w-full group">
                <div
                  className={`w-full ${b.color} rounded-t-sm transition-all min-h-[4px]`}
                  style={{ height: `${Math.max(4, b.heightPct)}%` }}
                  title={`${b.count} 人`}
                />
                <span className="text-[10px] font-mono text-on-surfaceVariant mt-2">{b.key}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-surface-containerLowest rounded-xl p-6 border border-outline-variant/40 shadow-sm flex flex-col">
          <h2 className="font-display font-bold text-on-surface text-lg mb-4">篩選與搜尋</h2>
          <div className="space-y-4 flex-1">
            <input
              type="search"
              className="w-full px-4 py-2.5 bg-surface border border-outline-variant rounded-xl text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              placeholder="輸入學號或姓名…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div>
              <label className="block text-xs font-semibold text-on-surfaceVariant mb-1">狀態</label>
              <select
                className="w-full bg-surface border border-outline-variant rounded-xl px-3 py-2 text-sm outline-none focus:border-primary"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pass' | 'fail')}
              >
                <option value="all">所有狀態</option>
                <option value="pass">及格</option>
                <option value="fail">不及格</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatusFilter('all');
            }}
            className="w-full mt-4 py-2 text-primary border border-outline-variant rounded-xl font-semibold hover:bg-surface-containerLow text-sm"
          >
            重置條件
          </button>
        </div>
      </div>

      {/* 試算表＋表格（同一區塊） */}
      <div className="rounded-xl border border-outline-variant/40 overflow-hidden shadow-sm bg-surface-containerLowest">
        <div className="sticky top-0 z-20 bg-surface-containerLow border-b border-outline-variant/40 px-4 py-3 flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-on-surfaceVariant">
            <PencilSquareIcon className="w-5 h-5 text-primary" />
            <span className="font-semibold text-on-surface">試算表編輯模式</span>
            <span className="text-outline-variant mx-1">|</span>
            <span>
              顯示 {filtered.length} / {students.length} 人
              {isDirty ? ' · 有未儲存變更' : ''}
            </span>
          </div>
          <div className="flex gap-2">
            {!isArchived && (
              <>
                <button
                  type="button"
                  onClick={onDiscard}
                  disabled={!isDirty || isSaving}
                  className="px-4 py-1.5 text-sm font-semibold text-on-surfaceVariant hover:text-error disabled:opacity-40"
                >
                  捨棄變更
                </button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={!isDirty || isSaving}
                  className="px-5 py-1.5 bg-primary text-on-primary rounded-xl text-sm font-bold shadow-sm hover:bg-primary-container disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {isSaving ? <LoadingSpinner size={14} color="white" /> : null}
                  批次儲存
                </button>
              </>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[960px]">
            <thead className="bg-surface-containerLow/80 text-on-surfaceVariant font-mono text-[11px] uppercase tracking-wider border-b border-outline-variant/30">
              <tr>
                <th className="px-4 py-3 font-semibold sticky left-0 z-10 bg-surface-containerLow/80">學號／姓名</th>
                {FIXED_PERIODIC_KEYS.map((pk) => (
                  <th key={pk} className="px-3 py-3 font-semibold text-right whitespace-nowrap">
                    {periodicColumnDetails[pk]?.name || pk}
                  </th>
                ))}
                <th className="px-3 py-3 font-semibold text-right">小考加權</th>
                <th className="px-3 py-3 font-semibold text-right">作業加權</th>
                <th className="px-3 py-3 font-semibold text-right">上課態度</th>
                <th className="px-3 py-3 font-semibold text-right">平時加權</th>
                <th className="px-3 py-3 font-semibold text-right text-primary">總成績</th>
                <th className="px-3 py-3 font-semibold text-center">狀態</th>
                <th className="px-3 py-3 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-on-surfaceVariant">
                    沒有符合條件的學生
                  </td>
                </tr>
              ) : (
                filtered.map((stu, rowIndex) => {
                  const fail = stu.finalTotal < PASS_LINE;
                  return (
                    <tr
                      key={stu.id}
                      className={`hover:bg-surface-containerLow/50 transition-colors ${
                        fail ? 'bg-error/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3 sticky left-0 z-10 bg-inherit">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                              fail
                                ? 'bg-error-container/50 text-error'
                                : 'bg-surface-containerHigh text-primary'
                            }`}
                          >
                            {(stu.name || '?').slice(0, 1)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-on-surface truncate">{stu.name}</div>
                            <div className="text-xs font-mono text-outline truncate">
                              {stu.studentId}
                              {stu.grade ? ` · ${stu.grade}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>
                      {FIXED_PERIODIC_KEYS.map((pk) => {
                        const isSetup = !!periodicColumnDetails[pk]?.date;
                        const colKey = `ov-peri-${pk}`;
                        const score = stu.periodicScores?.[pk];
                        return (
                          <td key={pk} className="px-2 py-2 text-right">
                            <GradeScoreInput
                              data-grade-col={colKey}
                              data-grade-row={rowIndex}
                              title={!isSetup ? '請先在成績登記設定日期' : ''}
                              className={`w-16 ml-auto bg-transparent border-none focus:ring-1 focus:ring-primary hover:bg-surface-containerHigh/40 text-right font-mono text-base p-1 rounded ${
                                (score ?? 0) < PASS_LINE && score != null ? 'text-error font-bold' : ''
                              } ${isArchived || !isSetup ? 'opacity-60 cursor-not-allowed' : ''}`}
                              value={score}
                              onCommit={(n) => onScoreChange(stu.id, 'peri', pk, n)}
                              onKeyDown={(e) => handleGradeInputKeyDown(e, colKey, rowIndex)}
                              disabled={isArchived || !isSetup}
                              placeholder="—"
                            />
                          </td>
                        );
                      })}
                      <td className="px-3 py-3 text-right font-mono">{stu.qAvg.toFixed(1)}</td>
                      <td className="px-3 py-3 text-right font-mono">{stu.hAvg.toFixed(1)}</td>
                      <td className="px-3 py-3 text-right font-mono">{stu.aAvg.toFixed(1)}</td>
                      <td className="px-3 py-3 text-right font-mono font-semibold">
                        {stu.regWeighted.toFixed(1)}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <GradeScoreInput
                          data-grade-col="ov-final"
                          data-grade-row={rowIndex}
                          className={`w-20 ml-auto bg-transparent border-none focus:ring-1 focus:ring-primary hover:bg-surface-containerHigh/40 text-right font-mono text-lg font-bold p-1 rounded ${
                            fail ? 'text-error' : 'text-primary'
                          } ${isArchived ? 'opacity-60 cursor-not-allowed' : ''}`}
                          value={stu.manualAdjust !== undefined ? stu.manualAdjust : stu.finalTotal}
                          onCommit={(n) => onFinalChange(stu.id, n)}
                          onKeyDown={(e) => handleGradeInputKeyDown(e, 'ov-final', rowIndex)}
                          disabled={isArchived}
                        />
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold border ${
                            fail
                              ? 'bg-error-container text-error border-error/20'
                              : 'bg-secondary/10 text-secondary border-secondary/20'
                          }`}
                        >
                          {fail ? '不及格' : '及格'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onOpenEntry(stu.id)}
                          className="p-1.5 text-outline hover:text-primary hover:bg-surface-container rounded-md"
                          title="登記此學生成績"
                        >
                          <PencilSquareIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
