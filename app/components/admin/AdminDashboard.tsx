'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import StatCard from '@/components/console/StatCard';
import DataTable, { type DataTableColumn } from '@/components/console/DataTable';
import type { AdminStatsPayload, AdminSystemLogRow } from '@/utils/adminStatsTypes';

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function formatMetric(value: number | null | undefined, opts?: { prefix?: string; stub?: string }) {
  if (value === null || value === undefined) return opts?.stub ?? '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return opts?.stub ?? '—';
  const formatted = n.toLocaleString('zh-TW');
  return opts?.prefix ? `${opts.prefix}${formatted}` : formatted;
}

function weekdayLabelForIndex(indexFromOldest: number, length: number): string {
  const daysAgo = length - 1 - indexFromOldest;
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  const dayNum = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Taipei' })).getDay();
  // WEEKDAY_LABELS: 一…日；JS getDay: Sun=0 → Mon=0 … Sun=6
  const idx = dayNum === 0 ? 6 : dayNum - 1;
  return WEEKDAY_LABELS[idx] ?? '';
}

type Props = {
  stats: AdminStatsPayload;
  activeCourseCount?: number;
  userName?: string;
};

export default function AdminDashboard({ stats, activeCourseCount, userName }: Props) {
  const [range, setRange] = useState<'7d' | '30d'>('7d');

  const courseCount =
    typeof activeCourseCount === 'number' ? activeCourseCount : stats.activeCourseCount;

  const barValues = useMemo(() => {
    if (range === '7d') {
      const weekly = stats.weeklyGrowth;
      return Array.isArray(weekly) && weekly.length === 7 ? weekly : Array.from({ length: 7 }, () => 0);
    }
    const monthly = stats.monthlyGrowth;
    return Array.isArray(monthly) && monthly.length === 30
      ? monthly
      : Array.from({ length: 30 }, () => 0);
  }, [range, stats.weeklyGrowth, stats.monthlyGrowth]);

  const barMax = Math.max(...barValues, 1);
  const periodTotal = barValues.reduce((sum, n) => sum + (Number(n) || 0), 0);

  const pending = stats.pendingReviews ?? { posts: 0, teachers: 0 };
  const logs = stats.recentLogs ?? [];

  const todoItems = [
    {
      key: 'posts',
      title: '待審核文章／留言',
      desc: `${pending.posts} 則待處理`,
      href: '/back-panel/blog-comments',
      countLabel: `${pending.posts} 則`,
      dot: 'bg-secondary',
      badge: 'bg-secondary-container text-secondary-onContainer',
    },
    {
      key: 'teachers',
      title: '教師邀請待開通',
      desc: `${pending.teachers} 件待處理`,
      href: '/back-panel/admin-teachers',
      countLabel: `${pending.teachers} 件`,
      dot: 'bg-outline',
      badge: 'bg-surface-variant text-on-surfaceVariant',
    },
  ];

  const logColumns: DataTableColumn<AdminSystemLogRow>[] = [
    { key: 'time', header: '時間', render: (r) => <span className="text-on-surfaceVariant whitespace-nowrap">{r.time}</span> },
    { key: 'actor', header: '操作者', render: (r) => <span className="font-medium">{r.actor}</span> },
    { key: 'action', header: '動作', render: (r) => r.action },
    {
      key: 'status',
      header: '狀態',
      render: (r) => (
        <span
          className={`text-xs px-2 py-1 rounded-full ${
            r.status === 'error'
              ? 'bg-error/10 text-error'
              : r.status === 'success'
                ? 'bg-secondary-container text-secondary-onContainer'
                : 'bg-surface-variant text-on-surfaceVariant'
          }`}
        >
          {r.statusLabel}
        </span>
      ),
    },
  ];

  const weekdayLabels = useMemo(
    () => barValues.map((_, i) => weekdayLabelForIndex(i, barValues.length)),
    [barValues]
  );

  return (
    <div className="w-full min-w-0 animate-fade-in text-on-surface">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight">營運總覽</h2>
          <p className="text-on-surfaceVariant mt-1">
            {userName ? `你好，${userName} · ` : null}
            即時人數、註冊趨勢與待辦審核
          </p>
          <p className="mt-2 text-xs font-mono text-on-surfaceVariant tracking-wide">
            教師 {stats.teacherCount.toLocaleString('zh-TW')} · 開放課程{' '}
            {courseCount.toLocaleString('zh-TW')} · 學生{' '}
            {stats.studentCount.toLocaleString('zh-TW')}
          </p>
        </div>
        <Link
          href="/back-panel/courses"
          className="inline-flex items-center justify-center gap-2 self-start sm:self-auto px-4 py-2.5 rounded-lg bg-primary-container text-on-primary font-semibold text-sm hover:bg-primary transition-colors shadow-sm"
        >
          <i className="fas fa-plus" aria-hidden />
          建立／管理課程
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <StatCard
              tone="primary"
              label="本月新註冊"
              value={formatMetric(stats.monthNewStudents)}
              hint="依台灣時區計算"
              icon={<i className="fas fa-user-check" aria-hidden />}
            />
            <StatCard
              tone="secondary"
              label="總註冊人數"
              value={formatMetric(stats.studentCount)}
              icon={<i className="fas fa-user-plus" aria-hidden />}
            />
            <StatCard
              tone="tertiary"
              label="開放中課程"
              value={formatMetric(stats.activeCourseCount)}
              hint={`全站共 ${formatMetric(stats.courseCount)} 門`}
              icon={<i className="fas fa-book-open" aria-hidden />}
            />
          </div>

          <div className="bg-surface-containerLowest rounded-xl p-6 shadow-sm border border-outline-variant w-full min-h-[320px] md:min-h-[400px] flex flex-col">
            <div className="flex flex-wrap justify-between items-center mb-6 gap-3">
              <div>
                <h3 className="font-display text-lg font-bold">註冊增長趨勢</h3>
                <p className="text-xs text-on-surfaceVariant mt-1">
                  此區間新註冊 {periodTotal.toLocaleString('zh-TW')} 人
                </p>
              </div>
              <div className="flex items-center gap-2">
                {(['7d', '30d'] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRange(r)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      range === r
                        ? 'bg-primary-container text-on-primary border-primary-container'
                        : 'border-outline-variant text-on-surfaceVariant hover:bg-surface-containerLow'
                    }`}
                  >
                    {r === '7d' ? '近 7 天' : '近 30 天'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 relative flex items-end justify-between gap-0.5 sm:gap-1 pt-10 pb-4 px-1 min-h-[200px]">
              <div className="absolute inset-0 flex flex-col justify-between pt-12 pb-10 z-0 pointer-events-none">
                <div className="border-b border-outline-variant/30 w-full h-0" />
                <div className="border-b border-outline-variant/30 w-full h-0" />
                <div className="border-b border-outline-variant/30 w-full h-0" />
                <div className="border-b border-outline-variant/30 w-full h-0" />
              </div>
              {barValues.map((v, i) => {
                const h = v <= 0 ? 4 : Math.max(8, Math.round((v / barMax) * 100));
                return (
                  <div
                    key={`${range}-${i}`}
                    className={`flex-1 min-w-0 rounded-t-sm relative z-10 bg-primary-container/60 hover:bg-primary transition-colors group ${
                      i === barValues.length - 1 ? 'bg-primary' : ''
                    }`}
                    style={{ height: `${h}%` }}
                    title={`${v} 人`}
                  />
                );
              })}
            </div>
            {range === '7d' ? (
              <div className="flex justify-between px-1 text-xs font-mono text-on-surfaceVariant pt-2 border-t border-outline-variant">
                {weekdayLabels.map((d, i) => (
                  <span key={`${d}-${i}`}>{d}</span>
                ))}
              </div>
            ) : (
              <div className="flex justify-between px-1 text-xs font-mono text-on-surfaceVariant pt-2 border-t border-outline-variant">
                <span>30 日前</span>
                <span>20</span>
                <span>10</span>
                <span>今天</span>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-4 flex flex-col gap-6">
          <div className="bg-surface-containerLowest/90 backdrop-blur-md rounded-xl p-6 shadow-sm border border-outline-variant flex-1">
            <div className="flex items-center gap-2 mb-6 pb-4 border-b border-outline-variant">
              <i className="fas fa-list-check text-primary" aria-hidden />
              <h3 className="font-display text-lg font-bold">待辦審核清單</h3>
            </div>
            <div className="space-y-2">
              {todoItems.map((item) => (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-start justify-between p-3 rounded-lg hover:bg-surface-containerHighest transition-colors group"
                >
                  <div className="flex gap-3 min-w-0">
                    <div className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.dot}`} />
                    <div className="min-w-0">
                      <p className="font-bold group-hover:text-primary transition-colors">{item.title}</p>
                      <p className="text-sm text-on-surfaceVariant truncate">{item.desc}</p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 ml-2 font-mono text-[11px] uppercase tracking-wider px-2 py-1 rounded-full ${item.badge}`}
                  >
                    {item.countLabel}
                  </span>
                </Link>
              ))}
            </div>
            <Link
              href={pending.posts > 0 ? '/back-panel/blog-comments' : '/back-panel/admin-teachers'}
              className="block w-full mt-6 py-2 border-2 border-primary text-primary text-center font-mono text-xs uppercase tracking-wider rounded-lg hover:bg-primary/5 transition-colors"
            >
              查看全部待辦
            </Link>
          </div>

          <div className="bg-primary-container text-on-primary rounded-xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <h4 className="font-display text-lg font-bold mb-2 relative z-10">系統維護通知</h4>
            <p className="text-sm mb-4 text-on-primary/80 relative z-10">
              目前無排程中的全站維護。可於系統設定或公告管理發布通知。
            </p>
            <Link
              href="/back-panel/system-settings"
              className="inline-block bg-white text-primary font-mono text-xs uppercase tracking-wider px-4 py-2 rounded-md hover:bg-surface-containerLowest transition-colors relative z-10"
            >
              系統設定
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="mb-3 flex justify-between items-center">
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <i className="fas fa-clock-rotate-left text-outline" aria-hidden />
            最近營運動態
          </h3>
          <span className="text-on-surfaceVariant font-mono text-xs uppercase tracking-wider">
            {logs.length > 0 ? '即時' : '尚無資料'}
          </span>
        </div>
        {logs.length > 0 ? (
          <DataTable columns={logColumns} rows={logs} rowKey={(r) => r.id} dense />
        ) : (
          <div className="rounded-xl border border-outline-variant bg-surface-containerLowest px-4 py-8 text-center text-sm text-on-surfaceVariant">
            尚無近期註冊、課程、公告或審核動態
          </div>
        )}
      </div>
    </div>
  );
}
