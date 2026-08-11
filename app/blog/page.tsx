'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import type { BlogCategory, BlogPost } from '@/services/blogTypes';
import SiteFooter from '@/components/site/SiteFooter';
import {
  findSiteTeacherByAuthorName,
  type SiteTeacher,
} from '@/data/siteTeachers';

const PAGE_SIZE = 8;

function formatDate(value?: string | null) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

const CATEGORY_PILL_STYLES = [
  'bg-primary-fixed text-primary',
  'bg-secondary-container text-secondary',
  'bg-tertiary-container text-white',
  'bg-surface-containerHigh text-on-surfaceVariant',
];

function categoryStyle(index: number) {
  return CATEGORY_PILL_STYLES[index % CATEGORY_PILL_STYLES.length];
}

function AuthorAvatar({ name }: { name?: string }) {
  const teacher: SiteTeacher | null = findSiteTeacherByAuthorName(name);
  if (teacher?.photo) {
    return (
      <div className="relative w-8 h-8 rounded-full overflow-hidden bg-surface-variant shrink-0">
        <Image src={teacher.photo} alt={name || ''} fill className="object-cover" sizes="32px" unoptimized />
      </div>
    );
  }
  const initial = (name || '文').trim().charAt(0) || '文';
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-variant flex items-center justify-center text-primary text-sm font-bold shrink-0">
      {initial}
    </div>
  );
}

function ArticleCard({
  post,
  categoryIndex,
}: {
  post: BlogPost;
  categoryIndex: number;
}) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="bg-surface-containerLowest p-6 md:p-8 rounded-lg shadow-card hover:shadow-elevate transition-all duration-300 border-l-[4px] border-secondary flex flex-col gap-4 group"
    >
      <div className="flex flex-wrap items-center gap-3">
        {post.categoryName && (
          <span
            className={`px-2 py-1 rounded text-sm font-bold tracking-wide ${categoryStyle(categoryIndex)}`}
          >
            {post.categoryName}
          </span>
        )}
        {post.publishedAt && (
          <span className="text-on-surfaceVariant text-sm">{formatDate(post.publishedAt)}</span>
        )}
      </div>
      <h2 className="font-display text-xl font-bold text-on-surface group-hover:text-primary transition-colors leading-snug">
        {post.title}
      </h2>
      {post.excerpt ? (
        <p className="text-base text-on-surfaceVariant line-clamp-2 leading-relaxed">{post.excerpt}</p>
      ) : null}
      <div className="flex items-center gap-3 mt-1">
        <AuthorAvatar name={post.authorName} />
        <span className="text-on-surface font-bold text-sm md:text-base">
          {post.authorName || '未具名作者'}
        </span>
      </div>
    </Link>
  );
}

export default function BlogHubPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [postsRes, catsRes] = await Promise.all([
          fetch('/api/blog/posts?limit=100'),
          fetch('/api/blog/categories'),
        ]);
        if (cancelled) return;
        const nextPosts: BlogPost[] = postsRes.ok ? await postsRes.json() : [];
        const nextCats: BlogCategory[] = catsRes.ok ? await catsRes.json() : [];
        setPosts(nextPosts);
        setCategories(nextCats);

        try {
          const raw = new URLSearchParams(window.location.search).get('category');
          if (raw) {
            const byId = nextCats.find((c) => c.id === raw);
            const byName = nextCats.find((c) => c.name === decodeURIComponent(raw));
            const matched = byId || byName;
            if (matched) setSelectedCategoryId(matched.id);
          }
        } catch {
          /* ignore */
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categoryIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    categories.forEach((c, i) => map.set(c.id, i));
    return map;
  }, [categories]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      if (!post.categoryId) continue;
      counts.set(post.categoryId, (counts.get(post.categoryId) || 0) + 1);
    }
    return counts;
  }, [posts]);

  const filteredPosts = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return posts.filter((post) => {
      if (selectedCategoryId) {
        if (post.categoryId !== selectedCategoryId) return false;
      }
      if (!q) return true;
      const hay = `${post.title} ${post.excerpt || ''} ${post.authorName || ''} ${post.categoryName || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [posts, selectedCategoryId, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [selectedCategoryId, debouncedSearch]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pagePosts = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredPosts.slice(start, start + PAGE_SIZE);
  }, [filteredPosts, page]);

  const popularPosts = useMemo(() => {
    return [...posts]
      .sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0))
      .slice(0, 5);
  }, [posts]);

  const sortedCategories = useMemo(() => {
    return [...categories].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0) || a.name.localeCompare(b.name, 'zh-Hant')
    );
  }, [categories]);

  const pageNumbers = useMemo(() => {
    const maxButtons = 5;
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + maxButtons - 1);
    start = Math.max(1, end - maxButtons + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [page, totalPages]);

  return (
    <div className="min-h-full flex flex-col bg-surface text-on-surface">
      <main className="page-shell flex-grow w-full py-10 md:py-16">
        <header className="mb-10 md:mb-12">
          <h1 className="font-display text-3xl md:text-4xl font-extrabold text-on-surface mb-3 tracking-tight">
            線上文章
          </h1>
          <p className="text-lg text-on-surfaceVariant max-w-2xl leading-relaxed">
            探索考試攻略、學習心得與觀念解析，掌握最新學習資源與平台動態。
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className="lg:col-span-8 flex flex-col gap-6 md:gap-8 min-w-0">
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setSelectedCategoryId(null)}
                className={`px-4 py-2 rounded-full text-sm md:text-base transition-all ${
                  selectedCategoryId === null
                    ? 'bg-primary text-on-primary font-bold shadow-sm'
                    : 'bg-surface-containerLow text-on-surfaceVariant hover:bg-surface-containerHigh'
                }`}
              >
                全部文章
              </button>
              {sortedCategories.map((cat, idx) => {
                const active = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategoryId(active ? null : cat.id)}
                    className={`px-4 py-2 rounded-full text-sm md:text-base transition-all ${
                      active
                        ? 'bg-primary text-on-primary font-bold shadow-sm'
                        : `${categoryStyle(idx)} hover:opacity-90`
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {loading ? (
              <PageLoadingArea minHeight="min-h-[40vh]" />
            ) : pagePosts.length === 0 ? (
              <div className="text-center py-20 bg-surface-containerLowest rounded-xl border border-dashed border-outline-variant">
                <h3 className="text-lg font-medium text-on-surface mb-1">沒有找到相關文章</h3>
                <p className="text-on-surfaceVariant text-sm">請嘗試其他分類或關鍵字</p>
              </div>
            ) : (
              <div className="flex flex-col gap-6 md:gap-8">
                {pagePosts.map((post) => (
                  <ArticleCard
                    key={post.id}
                    post={post}
                    categoryIndex={
                      post.categoryId != null
                        ? categoryIndexMap.get(post.categoryId) ?? 0
                        : 0
                    }
                  />
                ))}
              </div>
            )}

            {!loading && filteredPosts.length > PAGE_SIZE && (
              <div className="flex justify-center mt-2 gap-2 flex-wrap">
                <button
                  type="button"
                  aria-label="上一頁"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-on-surfaceVariant hover:bg-surface-containerHigh transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <i className="fas fa-chevron-left text-sm" />
                </button>
                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
                      n === page
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'text-on-surface hover:bg-surface-containerHigh'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  aria-label="下一頁"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-on-surfaceVariant hover:bg-surface-containerHigh transition-colors disabled:opacity-40 disabled:pointer-events-none"
                >
                  <i className="fas fa-chevron-right text-sm" />
                </button>
              </div>
            )}
          </div>

          <aside className="lg:col-span-4 flex flex-col gap-6 min-w-0">
            <div className="bg-surface-containerLowest rounded-lg p-6 shadow-card">
              <h3 className="font-display text-xl font-bold text-on-surface mb-4">搜尋文章</h3>
              <div className="relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-outline pointer-events-none" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="輸入關鍵字…"
                  className="w-full pl-10 pr-10 py-3 bg-surface border border-outline-variant rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-on-surface text-sm md:text-base"
                  type="search"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surfaceVariant hover:text-on-surface"
                    aria-label="清除搜尋"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                )}
              </div>
            </div>

            <div className="bg-surface-containerLowest rounded-lg p-6 shadow-card">
              <h3 className="font-display text-xl font-bold text-on-surface mb-4 flex items-center gap-2">
                <i className="fas fa-fire text-tertiary" aria-hidden />
                熱門文章
              </h3>
              {popularPosts.length === 0 ? (
                <p className="text-sm text-on-surfaceVariant">尚無文章</p>
              ) : (
                <ol className="flex flex-col gap-4">
                  {popularPosts.map((post, idx) => (
                    <li key={post.id}>
                      <Link href={`/blog/${post.slug}`} className="flex gap-4 items-start group">
                        <span className="font-mono text-3xl md:text-4xl font-bold text-tertiary opacity-40 group-hover:opacity-100 transition-opacity leading-none tabular-nums">
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                        <div className="min-w-0">
                          <h4 className="text-base font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                            {post.title}
                          </h4>
                          <span className="text-sm text-on-surfaceVariant">
                            {(post.viewsCount || 0).toLocaleString('zh-TW')} 次閱讀
                          </span>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="bg-surface-containerLowest rounded-lg p-6 shadow-card">
              <h3 className="font-display text-xl font-bold text-on-surface mb-4 flex items-center gap-2">
                <i className="fas fa-folder text-secondary" aria-hidden />
                分類索引
              </h3>
              {sortedCategories.length === 0 ? (
                <p className="text-sm text-on-surfaceVariant">尚無分類</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {sortedCategories.map((cat) => (
                    <li key={cat.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCategoryId((prev) => (prev === cat.id ? null : cat.id))
                        }
                        className={`w-full flex justify-between items-center py-2 px-3 rounded-md text-left transition-colors ${
                          selectedCategoryId === cat.id
                            ? 'bg-surface-containerHigh text-primary'
                            : 'hover:bg-surface-containerHigh text-on-surface'
                        }`}
                      >
                        <span className="text-sm md:text-base">{cat.name}</span>
                        <span className="bg-surface-variant text-on-surfaceVariant px-2 py-0.5 rounded-full text-xs font-bold">
                          {categoryCounts.get(cat.id) || 0}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
