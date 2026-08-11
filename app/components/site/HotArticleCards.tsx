'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { BlogPost } from '@/services/blogTypes';
import { resolveBlogCoverImage } from '@/services/blogTypes';

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

export default function HotArticleCards({ limit = 3 }: { limit?: number }) {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/blog/posts?limit=50');
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        const list: BlogPost[] = Array.isArray(data) ? data : [];
        const sorted = [...list]
          .filter((p) => Boolean(String(p.title || '').trim()) && Boolean(String(p.slug || '').trim()))
          .sort((a, b) => {
            const viewsDiff = (b.viewsCount || 0) - (a.viewsCount || 0);
            if (viewsDiff !== 0) return viewsDiff;
            const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
            const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
            return bTime - aTime;
          })
          .slice(0, limit);
        if (!cancelled) setPosts(sorted);
      } catch {
        if (!cancelled) setPosts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="h-80 rounded-xl bg-surface-container animate-pulse" />
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant bg-surface-containerLowest p-12 text-center text-on-surfaceVariant">
        目前尚無文章，請稍後再查看。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {posts.map((post) => (
        <Link
          key={post.id}
          href={`/blog/${post.slug}`}
          className="bg-surface-containerLowest rounded-xl shadow-card hover:shadow-elevate hover:-translate-y-1 transition-all duration-300 overflow-hidden group flex flex-col"
        >
          <div className="h-44 relative overflow-hidden bg-surface-container">
            <Image
              src={resolveBlogCoverImage(post)}
              alt={post.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, 33vw"
              unoptimized
            />
            {post.categoryName && (
              <div className="absolute top-3 left-3 bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-full font-mono text-[10px] font-semibold tracking-wider text-on-surface">
                {post.categoryName}
              </div>
            )}
          </div>
          <div className="p-5 flex flex-col flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-outline font-mono">
              {post.publishedAt && <span>{formatDate(post.publishedAt)}</span>}
              <span>{(post.viewsCount || 0).toLocaleString('zh-TW')} 次閱讀</span>
            </div>
            <h3 className="font-display text-lg font-bold text-on-surface mb-2 line-clamp-2 group-hover:text-primary transition-colors">
              {post.title}
            </h3>
            <p className="text-sm text-on-surfaceVariant mb-6 line-clamp-2 flex-1">
              {post.excerpt || '點擊閱讀完整文章內容。'}
            </p>
            <div className="flex justify-between items-center border-t border-surface-container pt-4 gap-3">
              <span className="text-xs text-outline truncate">{post.authorName || '未具名作者'}</span>
              <span className="shrink-0 text-primary text-sm font-medium inline-flex items-center gap-1.5">
                閱讀文章
                <i className="fas fa-arrow-right text-[10px]" aria-hidden />
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
