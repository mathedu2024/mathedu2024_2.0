'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MegaphoneIcon,
  BookOpenIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  PencilSquareIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import type { CourseActivityItem, CourseActivityType } from '@/services/courseActivityTypes';
import { formatActivityDateTime } from '@/services/courseActivityTypes';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import { fetchCached } from '@/utils/clientFetchCache';

type Audience = 'student' | 'teacher' | 'admin';

const PAGE_SIZE = 10;
const FEED_CACHE_TTL_MS = 120_000;

function feedCacheKey(audience: Audience): string {
  return `activity-feed-v2:${audience}`;
}

function sessionCacheKey(audience: Audience): string {
  return `course-activity-feed-v2:${audience}`;
}

function readSessionCache(audience: Audience): CourseActivityItem[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(sessionCacheKey(audience));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at?: number; items?: CourseActivityItem[] };
    if (!Array.isArray(parsed.items)) return null;
    if (typeof parsed.at === 'number' && Date.now() - parsed.at > FEED_CACHE_TTL_MS * 3) {
      return null;
    }
    return parsed.items;
  } catch {
    return null;
  }
}

function writeSessionCache(audience: Audience, items: CourseActivityItem[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      sessionCacheKey(audience),
      JSON.stringify({ at: Date.now(), items })
    );
  } catch {
    // ignore quota errors
  }
}

function iconForType(type: CourseActivityType) {
  switch (type) {
    case 'lesson':
      return <BookOpenIcon className="w-5 h-5" />;
    case 'announcement':
      return <MegaphoneIcon className="w-5 h-5" />;
    case 'quiz':
    case 'quiz_pending_grade':
      return <ClipboardDocumentCheckIcon className="w-5 h-5" />;
    case 'survey':
      return <ClipboardDocumentListIcon className="w-5 h-5" />;
    default:
      return <PencilSquareIcon className="w-5 h-5" />;
  }
}

function accentForType(type: CourseActivityType): string {
  switch (type) {
    case 'lesson':
      return 'bg-indigo-50 text-indigo-600';
    case 'announcement':
      return 'bg-amber-50 text-amber-600';
    case 'quiz':
      return 'bg-violet-50 text-violet-600';
    case 'survey':
      return 'bg-teal-50 text-teal-600';
    case 'quiz_pending_grade':
      return 'bg-rose-50 text-rose-600';
    default:
      return 'bg-indigo-50 text-indigo-600';
  }
}

function FeedPagination({
  currentPage,
  totalPages,
  setCurrentPage,
}: {
  currentPage: number;
  totalPages: number;
  setCurrentPage: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  const pageNumbers: number[] = [];
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

  return (
    <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-5 flex-wrap px-4 pb-4">
      <button
        type="button"
        onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm ${
          currentPage === 1
            ? 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed shadow-none'
            : 'bg-white text-gray-600 hover:bg-indigo-50 border border-gray-200 hover:text-indigo-600'
        }`}
      >
        <ChevronLeftIcon className="w-5 h-5 stroke-2" />
      </button>
      {startPage > 1 && (
        <>
          <button
            type="button"
            onClick={() => setCurrentPage(1)}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200"
          >
            1
          </button>
          {startPage > 2 && <span className="px-1 sm:px-2 text-gray-400">...</span>}
        </>
      )}
      {pageNumbers.map((number) => (
        <button
          key={number}
          type="button"
          onClick={() => setCurrentPage(number)}
          className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm ${
            currentPage === number
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 border border-indigo-600'
              : 'bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200'
          }`}
        >
          {number}
        </button>
      ))}
      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="px-1 sm:px-2 text-gray-400">...</span>}
          <button
            type="button"
            onClick={() => setCurrentPage(totalPages)}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm bg-white text-gray-600 hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200"
          >
            {totalPages}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-all shadow-sm ${
          currentPage === totalPages
            ? 'bg-gray-50 text-gray-300 border border-gray-200 cursor-not-allowed shadow-none'
            : 'bg-white text-gray-600 hover:bg-indigo-50 border border-gray-200 hover:text-indigo-600'
        }`}
      >
        <ChevronRightIcon className="w-5 h-5 stroke-2" />
      </button>
    </div>
  );
}

interface CourseActivityFeedProps {
  audience: Audience;
}

export default function CourseActivityFeed({ audience }: CourseActivityFeedProps) {
  const initialCacheRef = useRef<CourseActivityItem[] | null>(
    audience === 'admin' ? [] : readSessionCache(audience)
  );
  const [items, setItems] = useState<CourseActivityItem[]>(() => initialCacheRef.current ?? []);
  const [loading, setLoading] = useState(
    () => audience !== 'admin' && initialCacheRef.current === null
  );
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (audience === 'admin') {
      setLoading(false);
      setItems([]);
      return;
    }

    let cancelled = false;
    const endpoint =
      audience === 'student' ? '/api/student/activity-feed' : '/api/teacher/activity-feed';
    const hasCache = initialCacheRef.current !== null || items.length > 0;

    void (async () => {
      try {
        if (!hasCache) setLoading(true);
        setError('');
        const data = await fetchCached(
          feedCacheKey(audience),
          async () => {
            const res = await fetch(endpoint, { method: 'GET', cache: 'no-store' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return (await res.json()) as { items?: CourseActivityItem[] };
          },
          FEED_CACHE_TTL_MS
        );
        if (cancelled) return;
        const next = Array.isArray(data.items) ? data.items : [];
        setItems(next);
        writeSessionCache(audience, next);
        initialCacheRef.current = next;
      } catch (e) {
        if (!cancelled && !hasCache) {
          setError(e instanceof Error ? e.message : '載入失敗');
          setItems([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- audience-scoped; cache covers revisit
  }, [audience]);

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return items.slice(start, start + PAGE_SIZE);
  }, [items, safePage]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="animate-fade-in pb-16 sm:pb-24" style={{ animationDelay: '0.25s' }}>
      <h2 className="text-xl font-bold text-gray-800 border-l-4 border-indigo-500 pl-4 mb-6">
        課程公告
      </h2>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-10">
            <PageLoadingArea minHeight="min-h-[120px]" />
          </div>
        ) : error ? (
          <div className="px-5 py-8 text-center text-red-600 text-sm">{error}</div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center text-gray-700 text-sm font-medium">
            目前沒有課程公告
          </div>
        ) : (
          <>
            <ul className="divide-y divide-gray-100">
              {pageItems.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex items-start gap-3 px-4 sm:px-5 py-4 hover:bg-indigo-50/40 transition-colors"
                  >
                    <div
                      className={`mt-0.5 p-2 rounded-xl shrink-0 ${accentForType(item.type)}`}
                    >
                      {iconForType(item.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm sm:text-base font-semibold text-gray-900 leading-snug">
                        {item.message}
                      </p>
                      <p className="text-xs sm:text-sm text-indigo-600 mt-1.5 font-medium tabular-nums">
                        {formatActivityDateTime(item.at)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <FeedPagination
              currentPage={safePage}
              totalPages={totalPages}
              setCurrentPage={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
