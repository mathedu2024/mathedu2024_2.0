'use client';

import React, { useMemo, useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowTrendingUpIcon,
  ChevronRightIcon,
  ExclamationTriangleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import { PageLoadingArea, tableActionStyles } from './ui';
import StudentVisibilityToggle, { isStudentVisible } from './StudentVisibilityToggle';

export type AttendanceListItem = {
  id: string;
  name: string;
  date: string;
  type: string;
  mode: 'manual' | 'digital' | 'qr';
  checkInCode?: string;
  status?: string;
  endTime?: string;
  checkInMethod?: 'manual' | 'numeric' | 'qr';
  visibleToStudents?: boolean;
  present?: number;
  expected?: number;
  absent?: number;
  leave?: number;
};

type DateFilter = '30d' | 'semester' | 'all';
type StatusFilter = 'all' | 'completed' | 'active' | 'scheduled';

const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
const PAGE_SIZE = 8;

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function normalizeStatus(status?: string): 'active' | 'completed' | 'scheduled' {
  if (status === 'active') return 'active';
  if (status === 'scheduled') return 'scheduled';
  return 'completed';
}

function modeLabel(item: AttendanceListItem): string {
  const method = item.checkInMethod;
  if (method === 'qr' || item.mode === 'qr') return 'QR點名';
  if (method === 'numeric' || item.mode === 'digital') return '數字點名';
  return '手動點名';
}

function StatusBadge({ status }: { status: 'active' | 'completed' | 'scheduled' }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-primary/10 text-primary text-xs font-semibold animate-pulse">
        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
        進行中
      </span>
    );
  }
  if (status === 'scheduled') {
    return (
      <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-surface-containerHigh text-on-surfaceVariant text-xs font-semibold">
        <span className="w-1.5 h-1.5 rounded-full bg-outline" />
        未開始
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 py-1 px-3 rounded-full bg-secondary/10 text-secondary text-xs font-semibold">
      <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
      已完成
    </span>
  );
}

function DateBadge({ iso, isToday }: { iso: string; isToday: boolean }) {
  if (isToday) {
    return (
      <div className="bg-primary text-on-primary w-12 h-12 rounded-lg flex flex-col items-center justify-center text-xs font-bold shrink-0">
        <span>今日</span>
      </div>
    );
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return (
      <div className="bg-surface-containerHigh text-primary w-12 h-12 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
        —
      </div>
    );
  }
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return (
    <div className="bg-surface-containerHigh text-primary w-12 h-12 rounded-lg flex flex-col items-center justify-center text-xs font-semibold shrink-0">
      <span className="font-bold">
        {mm}/{dd}
      </span>
      <span className="text-[10px] opacity-80">{WEEKDAY[d.getDay()]}</span>
    </div>
  );
}

/** Heroicons 無 HowToReg；用 CheckBadge 替代視覺語意 */
function StartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}

type Props = {
  courseName: string;
  activities: AttendanceListItem[];
  loading: boolean;
  isArchived: boolean;
  studentCount: number;
  absenceAlertCount: number;
  embedded?: boolean;
  onBack?: () => void;
  onCreate: () => void;
  onExport: () => void;
  onSelect: (item: AttendanceListItem) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (item: AttendanceListItem) => void;
  shouldShowCheckInCode: (item: AttendanceListItem) => boolean;
};

export default function TeacherAttendanceList({
  courseName,
  activities,
  loading,
  isArchived,
  studentCount,
  absenceAlertCount,
  embedded = false,
  onBack,
  onCreate,
  onExport,
  onSelect,
  onDelete,
  onToggleVisibility,
  shouldShowCheckInCode,
}: Props) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    const cutoff =
      dateFilter === '30d'
        ? Date.now() - 30 * 24 * 60 * 60 * 1000
        : dateFilter === 'semester'
          ? Date.now() - 180 * 24 * 60 * 60 * 1000
          : 0;

    return activities.filter((a) => {
      const st = normalizeStatus(a.status);
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (cutoff > 0) {
        const t = Date.parse(a.date);
        if (!Number.isNaN(t) && t < cutoff) return false;
      }
      return true;
    });
  }, [activities, dateFilter, statusFilter]);

  const visible = filtered.slice(0, visibleCount);

  const todayStats = useMemo(() => {
    const todays = activities.filter((a) => {
      const d = new Date(a.date);
      return !Number.isNaN(d.getTime()) && isSameDay(d, now);
    });
    if (todays.length === 0) {
      return { rate: null as number | null, hasToday: false };
    }
    let present = 0;
    let expected = 0;
    todays.forEach((a) => {
      present += a.present ?? 0;
      expected += a.expected && a.expected > 0 ? a.expected : studentCount || 0;
    });
    if (expected <= 0) return { rate: null, hasToday: true };
    return { rate: Math.round((present / expected) * 100), hasToday: true };
  }, [activities, now, studentCount]);

  return (
    <div
      className={
        embedded
          ? 'w-full min-w-0 flex flex-col animate-fade-in'
          : 'page-shell w-full min-w-0 pb-10 flex flex-col h-full animate-fade-in'
      }
    >
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-on-surface tracking-tight mb-2">
            出勤管理中心
          </h1>
          <p className="text-lg text-on-surfaceVariant">{courseName}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!embedded && onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-3 rounded-lg border border-outline-variant text-on-surfaceVariant text-sm font-semibold hover:bg-surface-containerHigh"
            >
              返回課程
            </button>
          ) : null}
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-2 px-4 py-3 rounded-lg border border-outline-variant text-on-surfaceVariant text-sm font-semibold hover:bg-surface-containerHigh"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            匯出紀錄
          </button>
          {!isArchived ? (
            <button
              type="button"
              onClick={onCreate}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary-container text-on-primary text-sm font-bold hover:bg-primary shadow-sm"
            >
              <StartIcon className="w-5 h-5" />
              開始新點名
            </button>
          ) : null}
        </div>
      </div>

      {isArchived ? (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-6">
          <span className="font-bold mr-2">提示：</span>
          此課程已封存，您只能查看活動列表及匯出紀錄，無法新增或刪除點名活動。
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-surface-containerLowest rounded-xl p-6 shadow-sm border-t-4 border-primary hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-on-surfaceVariant font-bold">今日出席率</h3>
            <span className="p-2 bg-surface-container rounded-full text-primary">
              <ArrowTrendingUpIcon className="w-5 h-5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold text-on-surface">
              {todayStats.rate == null ? '—' : todayStats.rate}
            </span>
            {todayStats.rate != null ? (
              <span className="text-xl font-bold text-on-surfaceVariant">%</span>
            ) : null}
          </div>
          <p className="text-xs font-semibold text-on-surfaceVariant mt-2">
            {todayStats.hasToday ? '依今日點名活動計算' : '今日尚無點名'}
          </p>
        </div>

        <div className="bg-surface-containerLowest rounded-xl p-6 shadow-sm border-t-4 border-secondary hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-on-surfaceVariant font-bold">總學生人數</h3>
            <span className="p-2 bg-surface-container rounded-full text-secondary">
              <UserGroupIcon className="w-5 h-5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold text-on-surface">{studentCount || '—'}</span>
            <span className="text-base text-on-surfaceVariant">人</span>
          </div>
          <div className="w-full bg-surface-containerHigh h-2 rounded-full mt-4 overflow-hidden">
            <div className="bg-secondary h-full w-full rounded-full" />
          </div>
        </div>

        <div className="bg-surface-containerLowest rounded-xl p-6 shadow-sm border-t-4 border-error hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-on-surfaceVariant font-bold">缺席警報</h3>
            <span className="p-2 bg-error/10 rounded-full text-error">
              <ExclamationTriangleIcon className="w-5 h-5" />
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold text-error">{absenceAlertCount}</span>
            <span className="text-base text-on-surfaceVariant">名學生</span>
          </div>
          <p className="text-xs font-semibold text-error mt-2">連續缺席超過兩次</p>
        </div>
      </div>

      <div className="bg-surface-containerLowest rounded-xl shadow-sm overflow-hidden border border-outline-variant/40">
        <div className="p-6 border-b border-outline-variant bg-surface-bright flex flex-col sm:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-bold text-on-surface w-full sm:w-auto">出勤紀錄</h2>
          <div className="flex flex-wrap gap-3 w-full sm:w-auto">
            <select
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value as DateFilter);
                setVisibleCount(PAGE_SIZE);
              }}
              className="appearance-none bg-surface-container border border-outline-variant rounded-lg py-2 pl-4 pr-10 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none cursor-pointer"
            >
              <option value="30d">最近30天</option>
              <option value="semester">本學期</option>
              <option value="all">全部</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setVisibleCount(PAGE_SIZE);
              }}
              className="appearance-none bg-surface-container border border-outline-variant rounded-lg py-2 pl-4 pr-10 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none cursor-pointer"
            >
              <option value="all">所有狀態</option>
              <option value="completed">已完成</option>
              <option value="active">進行中</option>
              <option value="scheduled">未開始</option>
            </select>
          </div>
        </div>

        {loading ? (
          <PageLoadingArea />
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-on-surfaceVariant">
            <p className="font-medium">目前沒有點名活動</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-outline-variant">
              {visible.map((activity) => {
                const st = normalizeStatus(activity.status);
                const isToday = (() => {
                  const d = new Date(activity.date);
                  return !Number.isNaN(d.getTime()) && isSameDay(d, now);
                })();
                const expected =
                  activity.expected && activity.expected > 0
                    ? activity.expected
                    : studentCount || 0;
                const presentLabel =
                  activity.present == null && st === 'active'
                    ? `--/${expected || '—'}`
                    : `${activity.present ?? 0}/${expected || '—'}`;

                return (
                  <div
                    key={activity.id}
                    className={
                      st === 'active'
                        ? 'p-4 bg-primary/5 hover:bg-primary/10 transition-colors flex flex-col sm:flex-row items-center justify-between gap-4 border-l-4 border-primary'
                        : 'p-4 hover:bg-surface-containerLow transition-colors flex flex-col sm:flex-row items-center justify-between gap-4'
                    }
                  >
                    <button
                      type="button"
                      onClick={() => onSelect(activity)}
                      className="flex items-center gap-4 w-full sm:w-auto text-left min-w-0"
                    >
                      <DateBadge iso={activity.date} isToday={isToday && st === 'active'} />
                      <div className="min-w-0">
                        <h4 className="font-bold text-on-surface truncate">{activity.name}</h4>
                        <p className="text-xs font-semibold text-on-surfaceVariant mt-0.5">
                          {modeLabel(activity)}
                          {activity.type ? ` · ${activity.type}` : ''}
                          {shouldShowCheckInCode(activity) && activity.checkInCode
                            ? ` · 簽到碼 ${activity.checkInCode}`
                            : ''}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                      <StatusBadge status={st} />
                      <div className="text-right">
                        <div className="font-mono text-xl font-bold text-on-surface">{presentLabel}</div>
                        <div className="text-xs font-semibold text-on-surfaceVariant">
                          {st === 'active' ? '點名中...' : '出席人數'}
                        </div>
                      </div>
                      <StudentVisibilityToggle
                        open={isStudentVisible(activity.visibleToStudents)}
                        disabled={isArchived}
                        onToggle={() => onToggleVisibility(activity)}
                      />
                      {!isArchived ? (
                        <button
                          type="button"
                          onClick={() => onDelete(activity.id)}
                          className={tableActionStyles.danger}
                        >
                          刪除
                        </button>
                      ) : null}
                      {st === 'active' && !isArchived ? (
                        <button
                          type="button"
                          onClick={() => onSelect(activity)}
                          className="bg-primary-container text-on-primary px-4 py-2 rounded-lg text-xs font-bold hover:bg-primary transition-colors"
                        >
                          繼續點名
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onSelect(activity)}
                          className="text-primary hover:text-primary-container p-2 rounded-full hover:bg-surface-container transition-colors"
                          aria-label="查看點名"
                        >
                          <ChevronRightIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {filtered.length > visibleCount ? (
              <div className="p-4 border-t border-outline-variant bg-surface-bright flex justify-center">
                <button
                  type="button"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="text-primary font-bold hover:underline"
                >
                  載入更多歷史紀錄
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
