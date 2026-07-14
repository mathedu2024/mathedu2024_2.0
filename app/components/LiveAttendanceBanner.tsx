'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClockIcon,
  QrCodeIcon,
  HashtagIcon,
  PencilSquareIcon,
  HandRaisedIcon,
} from '@heroicons/react/24/outline';
import { fetchCached, invalidateFetchCache } from '@/utils/clientFetchCache';
import { withReturnTo, teacherCourseHubPath } from '@/utils/teacherCourseHub';
import PageLoadingArea from '@/components/ui/PageLoadingArea';

export interface LiveAttendanceItem {
  id: string;
  courseId: string;
  courseName: string;
  courseCode: string;
  title: string;
  checkInMethod: 'qr' | 'numeric' | 'manual';
  checkInCode?: string;
  startTime: string;
  endTime: string;
}

type Audience = 'student' | 'teacher';

const CACHE_TTL_MS = 12_000;
const POLL_MS = 20_000;

function cacheKey(audience: Audience): string {
  return `attendance-live-v2:${audience}`;
}

function buildStudentHref(item: LiveAttendanceItem): string {
  const returnTo = item.courseCode
    ? `/student/courses/${encodeURIComponent(item.courseCode)}?tab=attendance`
    : '/student/courses';
  return `/student/attendance?courseId=${encodeURIComponent(item.courseId)}&activity=${encodeURIComponent(item.id)}&returnTo=${encodeURIComponent(returnTo)}`;
}

function buildTeacherHref(item: LiveAttendanceItem): string {
  const routeKey = item.checkInCode || item.id;
  const base = `/back-panel/teacher-attendance/${encodeURIComponent(item.courseCode)}/${encodeURIComponent(routeKey)}`;
  return withReturnTo(base, teacherCourseHubPath(item.courseCode, 'attendance'));
}

function methodHint(method: LiveAttendanceItem['checkInMethod'], audience: Audience): string {
  if (audience === 'teacher') {
    if (method === 'qr') return 'QR點名 · 編輯點名';
    if (method === 'numeric') return '數字點名 · 編輯點名';
    return '手動點名 · 編輯點名';
  }
  if (method === 'qr') return '掃描 QR 簽到';
  return '輸入簽到碼';
}

async function fetchLiveAttendance(audience: Audience): Promise<LiveAttendanceItem[]> {
  const endpoint =
    audience === 'student'
      ? '/api/student/attendance/live'
      : '/api/teacher/attendance/live';

  return fetchCached(
    cacheKey(audience),
    async () => {
      const res = await fetch(endpoint, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { activities?: LiveAttendanceItem[] };
      const list = Array.isArray(data.activities) ? data.activities : [];
      if (audience === 'student') {
        return list.filter((a) => a.checkInMethod === 'qr' || a.checkInMethod === 'numeric');
      }
      return list;
    },
    CACHE_TTL_MS
  );
}

interface LiveAttendanceBannerProps {
  audience?: Audience;
}

export default function LiveAttendanceBanner({ audience = 'student' }: LiveAttendanceBannerProps) {
  const router = useRouter();
  const [items, setItems] = useState<LiveAttendanceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(
    async () => {
      try {
        invalidateFetchCache(cacheKey(audience));
        const next = await fetchLiveAttendance(audience);
        setItems(next);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [audience]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const next = await fetchLiveAttendance(audience);
        if (!cancelled) setItems(next);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [audience, refresh]);

  useEffect(() => {
    if (items.length === 0) return;
    const soonestEnd = Math.min(...items.map((i) => new Date(i.endTime).getTime()));
    const delay = Math.max(500, soonestEnd - Date.now() + 300);
    if (!Number.isFinite(delay)) return;
    const t = window.setTimeout(() => {
      void refresh();
    }, delay);
    return () => window.clearTimeout(t);
  }, [items, refresh]);

  return (
    <div className="animate-fade-in mb-8 sm:mb-10">
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-indigo-500 pl-4 mb-6">
        線上點名
      </h2>
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden min-h-[7.5rem]">
        {loading ? (
          <div className="py-8">
            <PageLoadingArea minHeight="min-h-[4.5rem]" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-700 text-sm font-medium">
            目前沒有進行中的點名
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => {
              const isQr = item.checkInMethod === 'qr';
              const isManual = item.checkInMethod === 'manual';
              return (
                <li key={`${item.courseId}:${item.id}`}>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        audience === 'teacher' ? buildTeacherHref(item) : buildStudentHref(item)
                      )
                    }
                    className="w-full text-left flex items-center gap-3 px-4 sm:px-5 py-4 hover:bg-indigo-50/40 transition-colors"
                  >
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
                        isQr
                          ? 'bg-indigo-50 text-indigo-600'
                          : isManual
                            ? 'bg-amber-50 text-amber-600'
                            : 'bg-violet-50 text-violet-600'
                      }`}
                    >
                      {isQr ? (
                        <QrCodeIcon className="w-5 h-5" />
                      ) : isManual ? (
                        <HandRaisedIcon className="w-5 h-5" />
                      ) : (
                        <HashtagIcon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm sm:text-base font-bold text-gray-900 truncate">
                        {item.courseName}
                      </p>
                      <p className="text-sm text-indigo-600 font-medium mt-0.5 truncate">
                        {item.title}
                        {' · '}
                        {methodHint(item.checkInMethod, audience)}
                      </p>
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-bold">
                      {audience === 'teacher' ? (
                        <>
                          <PencilSquareIcon className="w-4 h-4" />
                          編輯
                        </>
                      ) : (
                        <>
                          <ClockIcon className="w-4 h-4" />
                          簽到
                        </>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
