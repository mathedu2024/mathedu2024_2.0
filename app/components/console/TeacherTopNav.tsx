'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  MagnifyingGlassIcon,
  BellIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import type { CourseActivityItem } from '@/services/courseActivityTypes';
import { formatActivityDateTime } from '@/services/courseActivityTypes';

const READ_KEY = 'teacher-notifications-read-at';

type Props = {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  userName?: string;
  userAccount?: string;
  userRole?: string;
  settingsHref?: string;
  onLogout?: () => void;
};

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '剛剛';
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

/** 老師後台頂欄：搜尋（桌面）／通知／協助／帳號選單 */
export default function TeacherTopNav({
  searchValue,
  onSearchChange,
  searchPlaceholder = '搜尋課程...',
  userName,
  userAccount,
  userRole = '老師',
  settingsHref = '/back-panel/password',
  onLogout,
}: Props) {
  const initial = (userName?.trim()?.[0] || '?').toUpperCase();
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [items, setItems] = useState<CourseActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [readAt, setReadAt] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    const raw = localStorage.getItem(READ_KEY);
    const n = raw ? Number(raw) : 0;
    return Number.isFinite(n) ? n : 0;
  });
  const notifyRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/teacher/activity-feed', { cache: 'no-store' });
      if (!res.ok) {
        setItems([]);
        return;
      }
      const data = await res.json();
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setItems(list.slice(0, 12));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (notifyRef.current && !notifyRef.current.contains(t)) setNotifyOpen(false);
      if (accountRef.current && !accountRef.current.contains(t)) setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNotifyOpen(false);
        setAccountOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const unreadCount = items.filter((it) => {
    const t = new Date(it.at).getTime();
    return Number.isFinite(t) && t > readAt;
  }).length;

  const openNotify = () => {
    setAccountOpen(false);
    setNotifyOpen((v) => !v);
    if (!notifyOpen) void loadNotifications();
  };

  const markAllRead = () => {
    const now = Date.now();
    setReadAt(now);
    try {
      localStorage.setItem(READ_KEY, String(now));
    } catch {
      /* ignore */
    }
  };

  return (
    <nav className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center justify-between gap-4 border-b border-outline-variant/40 bg-surface/80 px-4 md:px-6 lg:px-8 backdrop-blur-md">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="relative hidden md:block w-full max-w-xs lg:max-w-sm">
          <MagnifyingGlassIcon
            className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-on-surfaceVariant"
            aria-hidden
          />
          <input
            type="search"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="h-10 w-full rounded-full border border-outline-variant bg-surface-containerLow pl-10 pr-4 text-sm text-on-surface placeholder:text-on-surfaceVariant outline-none transition-shadow focus:border-primary focus:ring-1 focus:ring-primary"
            aria-label={searchPlaceholder}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <div className="relative" ref={notifyRef}>
          <button
            type="button"
            onClick={openNotify}
            className="relative rounded-full p-2 text-on-surfaceVariant transition-colors hover:bg-surface-containerHigh hover:text-primary"
            title="通知"
            aria-expanded={notifyOpen}
            aria-haspopup="dialog"
          >
            <BellIcon className="h-5 w-5" aria-hidden />
            {unreadCount > 0 ? (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-on-primary">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </button>

          {notifyOpen ? (
            <div
              className="absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] overflow-hidden rounded-2xl border border-outline-variant/50 bg-surface-containerLowest shadow-elevate"
              role="dialog"
              aria-label="通知"
            >
              <div className="flex items-center justify-between border-b border-outline-variant/40 px-4 py-3">
                <h3 className="font-display text-sm font-bold text-on-surface">通知</h3>
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  全部已讀
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {loading ? (
                  <p className="px-4 py-8 text-center text-sm text-on-surfaceVariant">載入中…</p>
                ) : items.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-on-surfaceVariant">目前沒有通知</p>
                ) : (
                  <ul className="divide-y divide-outline-variant/30">
                    {items.map((item) => {
                      const t = new Date(item.at).getTime();
                      const unread = Number.isFinite(t) && t > readAt;
                      return (
                        <li key={item.id}>
                          <Link
                            href={item.href || '/back-panel/teacher-courses'}
                            onClick={() => {
                              setNotifyOpen(false);
                              if (Number.isFinite(t) && t > readAt) {
                                const next = Math.max(readAt, t);
                                setReadAt(next);
                                try {
                                  localStorage.setItem(READ_KEY, String(next));
                                } catch {
                                  /* ignore */
                                }
                              }
                            }}
                            className={`block px-4 py-3 transition-colors hover:bg-surface-containerLow ${
                              unread ? 'bg-primary/5' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-on-surface line-clamp-1">
                                {item.title}
                              </p>
                              <span className="shrink-0 text-[10px] text-outline whitespace-nowrap">
                                {relativeTime(item.at) || formatActivityDateTime(item.at)}
                              </span>
                            </div>
                            {item.message ? (
                              <p className="mt-0.5 text-xs text-on-surfaceVariant line-clamp-2">
                                {item.message}
                              </p>
                            ) : null}
                            <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-on-surfaceVariant">
                              {item.courseName || item.type}
                            </p>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="border-t border-outline-variant/40 px-4 py-2">
                <Link
                  href="/back-panel/teacher-courses"
                  onClick={() => setNotifyOpen(false)}
                  className="block py-1.5 text-center text-xs font-semibold text-primary hover:underline"
                >
                  查看授課動態
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <Link
          href="/faq"
          className="rounded-full p-2 text-on-surfaceVariant transition-colors hover:bg-surface-containerHigh hover:text-primary"
          title="協助中心"
        >
          <QuestionMarkCircleIcon className="h-5 w-5" aria-hidden />
        </Link>

        <div className="relative" ref={accountRef}>
          <button
            type="button"
            onClick={() => {
              setNotifyOpen(false);
              setAccountOpen((v) => !v);
            }}
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-outline-variant bg-primary text-sm font-bold text-on-primary transition-colors hover:border-primary"
            title={userName || '帳號'}
            aria-expanded={accountOpen}
            aria-haspopup="menu"
          >
            {initial}
          </button>

          {accountOpen ? (
            <div
              className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-outline-variant/50 bg-surface-containerLowest shadow-elevate"
              role="menu"
            >
              <div className="border-b border-outline-variant/40 px-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-on-primary">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-on-surface">{userName || '使用者'}</p>
                    <p className="truncate text-xs text-on-surfaceVariant">
                      {userAccount || '—'}
                    </p>
                    <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      {userRole}
                    </span>
                  </div>
                </div>
              </div>
              <div className="p-2">
                <Link
                  href={settingsHref}
                  role="menuitem"
                  onClick={() => setAccountOpen(false)}
                  className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-containerLow"
                >
                  個人設定
                </Link>
                <Link
                  href="/back-panel"
                  role="menuitem"
                  onClick={() => setAccountOpen(false)}
                  className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-containerLow"
                >
                  教學總覽
                </Link>
                {onLogout ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setAccountOpen(false);
                      onLogout();
                    }}
                    className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-error transition-colors hover:bg-error/10"
                  >
                    登出
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
