'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardDocumentCheckIcon,
  AcademicCapIcon,
  ChatBubbleLeftRightIcon,
  PencilSquareIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import type { TodoItem, TodoSummary } from '@/services/todoSummary';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import {
  dashboardSectionTitle,
  dashboardPanel,
  dashboardPanelDivide,
  dashboardRowHover,
  dashboardEmpty,
  dashboardError,
  dashboardIconShell,
} from '@/components/ui/dashboardChrome';

type Audience = 'student' | 'teacher';

function iconForKind(kind: TodoItem['kind']) {
  switch (kind) {
    case 'attendance':
      return <ClipboardDocumentCheckIcon className="w-5 h-5" />;
    case 'quiz':
      return <AcademicCapIcon className="w-5 h-5" />;
    case 'survey':
      return <QueueListIcon className="w-5 h-5" />;
    case 'tutoring':
      return <ChatBubbleLeftRightIcon className="w-5 h-5" />;
    case 'grading':
      return <PencilSquareIcon className="w-5 h-5" />;
    default:
      return <PencilSquareIcon className="w-5 h-5" />;
  }
}

function accentForKind(kind: TodoItem['kind']): string {
  switch (kind) {
    case 'attendance':
      return 'bg-amber-50 text-amber-600';
    case 'quiz':
      return 'bg-violet-50 text-violet-600';
    case 'survey':
      return 'bg-teal-50 text-teal-600';
    case 'tutoring':
      return 'bg-emerald-50 text-emerald-600';
    case 'grading':
      return 'bg-rose-50 text-rose-600';
    default:
      return 'bg-primary/10 text-primary';
  }
}

export default function DashboardTodoSummary({ audience }: { audience: Audience }) {
  const [summary, setSummary] = useState<TodoSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const url =
      audience === 'student' ? '/api/student/todo-summary' : '/api/teacher/todo-summary';

    void (async () => {
      try {
        setLoading(true);
        setError('');
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as TodoSummary;
        if (!cancelled) setSummary(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '載入失敗');
          setSummary({
            items: [],
            counts: { attendance: 0, quiz: 0, survey: 0, tutoring: 0, grading: 0, total: 0 },
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [audience]);

  const items = summary?.items ?? [];

  return (
    <div className="animate-fade-in mb-6 sm:mb-8" style={{ animationDelay: '0.2s' }}>
      <h2 className={dashboardSectionTitle}>
        待辦彙總
      </h2>

      <div className={dashboardPanel}>
        {loading ? (
          <div className="py-10">
            <PageLoadingArea minHeight="min-h-[120px]" />
          </div>
        ) : error ? (
          <div className={dashboardError}>{error}</div>
        ) : items.length === 0 ? (
          <div className={dashboardEmpty}>
            目前沒有待辦事項
          </div>
        ) : (
          <ul className={dashboardPanelDivide}>
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`flex items-start gap-3 px-4 sm:px-5 py-4 ${dashboardRowHover}`}
                >
                  <div className={`${dashboardIconShell} ${accentForKind(item.kind)}`}>
                    {iconForKind(item.kind)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm sm:text-base font-semibold text-on-surface leading-snug">
                      {item.title}
                    </p>
                    <p className="text-xs sm:text-sm text-primary mt-1.5 font-medium tabular-nums font-mono">
                      {item.timeLabel}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
