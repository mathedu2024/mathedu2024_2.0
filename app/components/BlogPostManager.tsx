'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Swal from '@/utils/swalTheme';
import {
  PlusIcon,
  MagnifyingGlassIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import PageLoadingArea from './ui/PageLoadingArea';
import { btnStyles, btnWithIconStyle, btnIcon, btnIconGap, tableActionStyles, tableActionRow } from './ui';
import type { BlogPost, BlogPostStatus } from '@/services/blogTypes';
import { formatTopicNumber } from '@/services/blogTypes';

type ListFilter = 'all' | 'drafts' | 'published';

const STATUS_OPTIONS: { value: BlogPostStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已發佈' },
  { value: 'scheduled', label: '預定發佈' },
  { value: 'unlisted', label: '不公開' },
];

/** 寫作進度：草稿 → 編輯中 → 審核中 → 已發布 */
function writingStage(status: BlogPostStatus): { step: number; label: string } {
  if (status === 'draft') return { step: 1, label: '草稿' };
  if (status === 'scheduled' || status === 'unlisted') return { step: 3, label: '審核／排程中' };
  if (status === 'published') return { step: 4, label: '已發布' };
  return { step: 2, label: '編輯中' };
}

function StageProgress({ status }: { status: BlogPostStatus }) {
  const { step } = writingStage(status);
  const labels = ['草稿', '編輯中', '審核中', '已發布'];
  return (
    <div className="w-full max-w-xs">
      <div className="flex gap-1 mb-1">
        {labels.map((_, i) => (
          <div
            key={labels[i]}
            className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-primary' : 'bg-surface-containerHigh'}`}
          />
        ))}
      </div>
      <p className="text-[10px] font-mono text-on-surfaceVariant uppercase tracking-wider">
        {labels[step - 1]}
      </p>
    </div>
  );
}

function statusBadge(status: BlogPostStatus) {
  const map: Record<BlogPostStatus, string> = {
    draft: 'bg-gray-100 text-gray-700',
    published: 'bg-emerald-50 text-emerald-700',
    scheduled: 'bg-amber-50 text-amber-700',
    unlisted: 'bg-primary/10 text-primary',
  };
  const label = STATUS_OPTIONS.find((s) => s.value === status)?.label || status;
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${map[status]}`}>
      {label}
    </span>
  );
}

export default function BlogPostManager() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState<ListFilter>('all');
  const [mediaOpen, setMediaOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const postsRes = await fetch('/api/blog/posts?mine=1&limit=100');
      if (!postsRes.ok) throw new Error('posts');
      setPosts(await postsRes.json());
    } catch {
      Swal.fire('錯誤', '無法載入文章列表', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onFocus = () => {
      if (document.visibilityState === 'visible') void load();
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, [load]);

  const filtered = useMemo(() => {
    let list = posts;
    if (listFilter === 'drafts') {
      list = list.filter((p) => p.status === 'draft' || p.status === 'scheduled');
    } else if (listFilter === 'published') {
      list = list.filter((p) => p.status === 'published' || p.status === 'unlisted');
    }
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      `${p.title} ${p.excerpt} ${p.authorName} ${p.categoryName || ''}`.toLowerCase().includes(q)
    );
  }, [posts, search, listFilter]);

  const openCreate = () => {
    window.open('/back-panel/blog/edit', '_blank', 'noopener,noreferrer');
  };

  const openEdit = (post: BlogPost) => {
    window.open(`/back-panel/blog/edit/${post.id}`, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (post: BlogPost) => {
    const result = await Swal.fire({
      title: '確定刪除？',
      text: `確定要刪除「${post.title}」嗎？`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '刪除',
      cancelButtonText: '取消',
      confirmButtonColor: '#dc2626',
      customClass: { popup: 'rounded-2xl' },
    });
    if (!result.isConfirmed) return;
    const res = await fetch(`/api/blog/posts/${post.id}`, { method: 'DELETE' });
    if (!res.ok) {
      Swal.fire('錯誤', '刪除失敗', 'error');
      return;
    }
    await load();
  };

  return (
    <div className="relative w-full min-w-0 flex flex-col h-full animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-6">
        <div className="border-l-4 border-primary pl-4">
          <h1 className="font-display text-2xl font-bold text-on-surface flex items-center gap-3">
            <DocumentTextIcon className="h-8 w-8 text-primary" />
            文章管理
          </h1>
          <p className="text-on-surfaceVariant text-sm mt-1">寫作進度與資源統整</p>
        </div>
        <button
          type="button"
          onClick={() => setMediaOpen((v) => !v)}
          className="text-sm font-semibold text-primary border border-primary/30 px-3 py-2 rounded-lg hover:bg-primary/5"
        >
          {mediaOpen ? '關閉資源庫' : '媒體資源庫'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {(
          [
            ['all', '全部'],
            ['drafts', '我的草稿'],
            ['published', '已發布文章'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setListFilter(k)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
              listFilter === k
                ? 'bg-primary-container text-on-primary border-primary-container'
                : 'border-outline-variant text-on-surfaceVariant hover:bg-surface-containerLow'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-4 items-stretch">
        <div className={`min-w-0 flex-1 ${mediaOpen ? 'lg:max-w-[calc(100%-20rem)]' : ''}`}>
          <div className="bg-surface-containerLowest p-4 rounded-xl shadow-sm border border-outline-variant/40 mb-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative w-full md:flex-1 min-w-0">
                <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜尋標題、摘要或作者…"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm"
                />
              </div>
              <button
                type="button"
                onClick={openCreate}
                className={`${btnWithIconStyle(btnStyles.primary)} w-full md:w-auto shrink-0`}
              >
                <PlusIcon className={`${btnIcon} ${btnIconGap}`} />
                新增文章
              </button>
            </div>
          </div>

          {loading ? (
            <PageLoadingArea minHeight="min-h-[40vh]" />
          ) : filtered.length === 0 ? (
            <div className="bg-surface-containerLowest border border-outline-variant/40 rounded-xl p-8 text-center text-gray-500 text-sm">
              尚無文章，請點擊新增文章
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((post) => (
                <div
                  key={post.id}
                  className="bg-surface-containerLowest border border-outline-variant rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4 hover:shadow-sm transition-shadow"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-display font-bold text-on-surface truncate">{post.title}</h3>
                      {statusBadge(post.status)}
                    </div>
                    <p className="text-xs text-on-surfaceVariant mb-3">
                      {post.categoryName || '尚未分類'}
                      {post.topicNumber ? ` · #${formatTopicNumber(post.topicNumber)}` : ''}
                      {' · '}
                      {post.viewsCount || 0} 次瀏覽
                    </p>
                    <StageProgress status={post.status} />
                  </div>
                  <div className={`${tableActionRow} shrink-0`}>
                    <Link href={`/blog/${post.slug}`} target="_blank" className={tableActionStyles.secondary}>
                      預覽
                    </Link>
                    <button type="button" onClick={() => openEdit(post)} className={tableActionStyles.primary}>
                      編輯
                    </button>
                    <button type="button" onClick={() => void handleDelete(post)} className={tableActionStyles.danger}>
                      刪除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 媒體資源抽屜殼 */}
        {mediaOpen ? (
          <aside className="hidden lg:flex w-80 shrink-0 flex-col bg-surface-containerLowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-outline-variant bg-surface-containerLow">
              <h3 className="font-display font-bold">媒體資源庫</h3>
              <p className="text-xs text-on-surfaceVariant mt-0.5">左欄分類 · 右欄預覽（骨架）</p>
            </div>
            <div className="flex flex-1 min-h-[320px]">
              <div className="w-28 border-r border-outline-variant p-2 space-y-1 text-sm">
                {['全部', '圖片', '影片', '講義'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="w-full text-left px-2 py-1.5 rounded-lg hover:bg-surface-containerHigh text-on-surfaceVariant"
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="flex-1 p-3 grid grid-cols-2 gap-2 content-start">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-lg bg-surface-containerHigh border border-dashed border-outline-variant flex items-center justify-center text-[10px] text-on-surfaceVariant"
                  >
                    預覽 {i}
                  </div>
                ))}
                <div className="col-span-2 mt-2 py-6 rounded-lg border-2 border-dashed border-primary/30 text-center text-xs text-primary">
                  拖拽上傳（即將開放）
                </div>
              </div>
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
