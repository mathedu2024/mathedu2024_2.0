'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import RichHtmlContent from '@/components/RichHtmlContent';
import type { BlogPost } from '@/services/blogTypes';
import { resolveBlogCoverImage } from '@/services/blogTypes';
import SiteFooter from '@/components/site/SiteFooter';
import {
  findSiteTeacherByAuthorName,
  siteTeacherProfileHref,
  type SiteTeacher,
} from '@/data/siteTeachers';
import 'react-quill-new/dist/quill.snow.css';
import 'katex/dist/katex.min.css';

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

function extractToc(html: string) {
  const headings: { id: string; text: string; level: 2 | 3 }[] = [];
  const re = /<h([23])[^>]*>(.*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(html))) {
    const level = Number(match[1]) as 2 | 3;
    const text = match[2].replace(/<[^>]+>/g, '').trim();
    if (text) headings.push({ id: `h-${i++}`, text, level });
  }
  return headings;
}

function renderMarkdownLite(md: string): string {
  let html = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^\> (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/\n\n/g, '</p><p>');
  return `<p>${html}</p>`;
}

function AuthorAvatar({ name, size = 48 }: { name?: string; size?: number }) {
  const teacher: SiteTeacher | null = findSiteTeacherByAuthorName(name);
  if (teacher?.photo) {
    return (
      <div
        className="rounded-full overflow-hidden bg-surface-container relative shrink-0"
        style={{ width: size, height: size }}
      >
        <Image src={teacher.photo} alt={name || ''} fill className="object-cover" sizes={`${size}px`} unoptimized />
      </div>
    );
  }
  const initial = (name || '文').trim().charAt(0) || '文';
  return (
    <div
      className="rounded-full overflow-hidden bg-surface-container flex items-center justify-center text-primary font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {initial}
    </div>
  );
}

export default function BlogPostPage() {
  const params = useParams();
  const slug = String(params?.slug || '');
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareHint, setShareHint] = useState<string | null>(null);
  const [activeTocId, setActiveTocId] = useState<string>('');

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/blog/posts/${encodeURIComponent(slug)}`);
        if (!res.ok) {
          setError('找不到這篇文章');
          setPost(null);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setPost(data.post);
        setRelated(data.related || []);
      } catch {
        if (!cancelled) setError('載入失敗，請稍後再試');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const contentHtml = useMemo(() => {
    if (!post) return '';
    let html = post.contentFormat === 'markdown' ? renderMarkdownLite(post.content) : post.content;
    let i = 0;
    html = html.replace(/<h([23])([^>]*)>/gi, (_m, level, attrs) => {
      const id = `h-${i++}`;
      if (/\sid=/.test(attrs)) return `<h${level}${attrs}>`;
      return `<h${level}${attrs} id="${id}">`;
    });
    return html;
  }, [post]);

  const toc = useMemo(() => extractToc(contentHtml), [contentHtml]);

  useEffect(() => {
    if (toc.length === 0) return;

    const onScroll = () => {
      let current = toc[0]?.id || '';
      for (const item of toc) {
        const el = document.getElementById(item.id);
        if (!el) continue;
        if (window.scrollY >= el.offsetTop - 140) current = item.id;
      }
      setActiveTocId(current);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [toc]);

  const shareArticle = async () => {
    const url = window.location.href;
    const title = post?.title || '線上文章';
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      /* fall through */
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareHint('已複製連結');
      window.setTimeout(() => setShareHint(null), 1500);
    } catch {
      setShareHint('無法分享');
      window.setTimeout(() => setShareHint(null), 1500);
    }
  };

  const scrollToHeading = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const siteTeacher = findSiteTeacherByAuthorName(post?.authorName);
  const hasRelatedCourses = (post?.relatedCourseIds?.length || 0) > 0;

  if (loading) {
    return (
      <div className="min-h-full flex flex-col bg-surface">
        <div className="page-shell py-10 flex-1">
          <PageLoadingArea minHeight="min-h-[50vh]" />
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-full flex flex-col bg-surface">
        <div className="page-shell py-10 flex-1">
          <div className="text-center py-24 bg-surface-containerLowest rounded-2xl border border-dashed border-outline-variant">
            <h3 className="text-lg font-medium text-on-surface mb-2">{error || '找不到文章'}</h3>
            <Link
              href="/blog"
              className="inline-flex mt-4 px-4 py-2 bg-primary text-on-primary text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors"
            >
              返回線上文章
            </Link>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-surface text-on-surface antialiased">
      <main className="page-shell flex-grow pt-8 md:pt-12 pb-20 w-full">
        {/* Header: breadcrumb, title, meta, cover */}
        <div className="max-w-[720px] mx-auto mb-8 md:mb-10">
          <nav className="flex flex-wrap items-center gap-2 text-xs font-mono font-semibold tracking-wider uppercase text-on-surfaceVariant mb-6">
            <Link href="/blog" className="hover:text-primary transition-colors">
              線上文章
            </Link>
            {post.categoryName && (
              <>
                <i className="fas fa-chevron-right text-[10px] opacity-60" aria-hidden />
                <Link
                  href={`/blog?category=${encodeURIComponent(post.categoryId || post.categoryName)}`}
                  className="hover:text-primary transition-colors"
                >
                  {post.categoryName}
                </Link>
              </>
            )}
            <i className="fas fa-chevron-right text-[10px] opacity-60" aria-hidden />
            <span className="text-outline normal-case tracking-normal font-sans font-normal line-clamp-1 max-w-[12rem] sm:max-w-xs">
              {post.title}
            </span>
          </nav>

          <h1 className="font-display text-2xl md:text-3xl font-extrabold text-on-surface mb-6 tracking-tight leading-snug">
            {post.title}
          </h1>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-y border-outline-variant py-4 mb-8">
            <div className="flex items-center gap-4 min-w-0">
              <AuthorAvatar name={post.authorName} size={48} />
              <div className="min-w-0">
                <div className="font-bold text-on-surface truncate">{post.authorName || '未具名作者'}</div>
                <div className="text-sm text-on-surfaceVariant truncate">
                  {siteTeacher?.subject || post.categoryName || '線上文章作者'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-on-surfaceVariant text-xs font-mono font-semibold tracking-wider uppercase">
              {post.publishedAt && (
                <div className="flex items-center gap-1.5">
                  <i className="far fa-calendar-alt" aria-hidden />
                  <span className="normal-case tracking-normal font-sans font-normal">
                    {formatDate(post.publishedAt)}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <i className="far fa-clock" aria-hidden />
                <span>{post.readingMinutes || 1} 分鐘閱讀</span>
              </div>
              <button
                type="button"
                onClick={() => void shareArticle()}
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
                aria-label="分享文章"
              >
                <i className="fas fa-share-alt" aria-hidden />
                <span>{shareHint || '分享'}</span>
              </button>
            </div>
          </div>

          <div className="relative w-full h-[220px] sm:h-[320px] md:h-[400px] rounded-xl overflow-hidden mb-4 shadow-sm bg-surface-containerHigh">
            <Image
              src={resolveBlogCoverImage(post)}
              alt={post.title}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 720px"
              unoptimized
              priority
            />
          </div>
        </div>

        {/* Article grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <aside className="hidden lg:block lg:col-span-3 relative">
            {toc.length > 0 ? (
              <div className="sticky top-24 bg-surface-containerLow rounded-xl p-6 shadow-sm border border-outline-variant/30">
                <h3 className="font-mono text-[11px] font-semibold tracking-wider uppercase text-on-surface mb-4">
                  文章目錄
                </h3>
                <ul className="space-y-3 text-sm text-on-surfaceVariant border-l-2 border-surface-containerHigh pl-4">
                  {toc.map((item) => (
                    <li key={item.id} className={item.level === 3 ? 'pl-2' : ''}>
                      <a
                        href={`#${item.id}`}
                        className={`block transition-colors hover:text-primary line-clamp-2 ${
                          activeTocId === item.id ? 'text-primary font-semibold' : ''
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          scrollToHeading(item.id);
                        }}
                      >
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="sticky top-24 bg-surface-containerLow rounded-xl p-6 shadow-sm border border-outline-variant/30">
                <h3 className="font-mono text-[11px] font-semibold tracking-wider uppercase text-on-surface mb-3">
                  瀏覽
                </h3>
                <Link href="/blog" className="text-sm text-primary hover:underline">
                  返回線上文章列表
                </Link>
              </div>
            )}
          </aside>

          <article className="col-span-1 lg:col-span-7 article-content text-lg leading-relaxed text-on-surface min-w-0">
            {post.excerpt ? (
              <p className="text-xl leading-relaxed text-on-surfaceVariant mb-8 font-medium">
                {post.excerpt}
              </p>
            ) : null}

            {toc.length > 0 && (
              <div className="lg:hidden mb-8 bg-surface-containerLow rounded-xl p-5 border border-outline-variant/30">
                <h3 className="font-mono text-[11px] font-semibold tracking-wider uppercase text-on-surface mb-3">
                  文章目錄
                </h3>
                <ul className="space-y-2 text-sm text-on-surfaceVariant">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className="hover:text-primary"
                        onClick={(e) => {
                          e.preventDefault();
                          scrollToHeading(item.id);
                        }}
                      >
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="prose max-w-none blog-article-body">
              <RichHtmlContent html={contentHtml} className="text-on-surface leading-relaxed" />
            </div>

            {(post.tagNames?.length || 0) > 0 && (
              <div className="mt-12 pt-8 border-t border-outline-variant flex flex-wrap gap-2">
                {post.tagNames!.map((tag) => (
                  <span
                    key={tag}
                    className="bg-surface-containerHigh text-on-surface px-4 py-1.5 rounded-full text-xs font-mono font-semibold tracking-wider"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </article>

          <aside className="col-span-1 lg:col-span-2 space-y-6 mt-4 lg:mt-0">
            <div className="bg-primary-container text-on-primary rounded-xl p-6 shadow-sm text-center">
              <div className="w-16 h-16 mx-auto bg-white/20 rounded-full flex items-center justify-center mb-4">
                <i className="fas fa-graduation-cap text-2xl" aria-hidden />
              </div>
              {hasRelatedCourses ? (
                <>
                  <h4 className="font-display text-lg font-bold mb-2">想延伸學習？</h4>
                  <p className="text-sm mb-6 opacity-90">這篇文章關聯了課程資源，可到課程介紹進一步了解。</p>
                  <Link
                    href="/courses"
                    className="block w-full bg-surface text-primary font-mono text-xs font-semibold tracking-wider uppercase py-3 rounded-lg hover:bg-surface-container transition-colors shadow-sm"
                  >
                    瀏覽課程介紹
                  </Link>
                </>
              ) : (
                <>
                  <h4 className="font-display text-lg font-bold mb-2">探索更多文章</h4>
                  <p className="text-sm mb-6 opacity-90">繼續閱讀考試攻略、學習心得與觀念解析。</p>
                  <Link
                    href="/blog"
                    className="block w-full bg-surface text-primary font-mono text-xs font-semibold tracking-wider uppercase py-3 rounded-lg hover:bg-surface-container transition-colors shadow-sm"
                  >
                    返回線上文章
                  </Link>
                </>
              )}
            </div>

            {siteTeacher && (
              <div className="bg-surface-containerLowest rounded-xl p-5 shadow-card border border-outline-variant/40 text-center">
                <div className="flex justify-center mb-3">
                  <AuthorAvatar name={post.authorName} size={56} />
                </div>
                <div className="font-bold text-on-surface mb-1">{siteTeacher.name}</div>
                <div className="text-sm text-on-surfaceVariant mb-4">{siteTeacher.subject}</div>
                <Link
                  href={siteTeacherProfileHref(siteTeacher)}
                  className="inline-flex text-sm font-medium text-primary border border-primary rounded-lg px-3 py-1.5 hover:bg-primary hover:text-on-primary transition-colors"
                >
                  查看老師介紹
                </Link>
              </div>
            )}
          </aside>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <section className="max-w-[720px] mx-auto mt-20 md:mt-24">
            <h3 className="font-display text-2xl font-bold text-on-surface mb-8 border-l-4 border-secondary pl-4">
              相關閱讀
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {related.slice(0, 4).map((r) => (
                <Link
                  key={r.id}
                  href={`/blog/${r.slug}`}
                  className="group block bg-surface rounded-xl overflow-hidden border border-outline-variant/50 shadow-sm flex flex-col h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-elevate"
                >
                  <div className="h-40 bg-surface-containerHigh relative">
                    <Image
                      src={resolveBlogCoverImage(r)}
                      alt={r.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, 360px"
                      unoptimized
                    />
                    {r.categoryName && (
                      <div className="absolute top-3 left-3 bg-surface/90 backdrop-blur-sm px-3 py-1 rounded-full font-mono text-[10px] font-semibold tracking-wider text-on-surface">
                        {r.categoryName}
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex flex-col flex-grow">
                    <h4 className="font-display text-lg font-bold text-on-surface mb-2 line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {r.title}
                    </h4>
                    {r.excerpt ? (
                      <p className="text-sm text-on-surfaceVariant mb-4 line-clamp-2 flex-grow">{r.excerpt}</p>
                    ) : (
                      <div className="flex-grow" />
                    )}
                    <div className="flex items-center text-primary text-xs font-mono font-semibold tracking-wider uppercase mt-auto">
                      閱讀文章
                      <i className="fas fa-arrow-right text-[10px] ml-1.5" aria-hidden />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />

      <style jsx global>{`
        .article-content .blog-article-body h2,
        .article-content .rich-html-content h2,
        .article-content .ql-editor h2 {
          font-family: var(--font-display), 'Plus Jakarta Sans', 'Noto Sans TC', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          line-height: 2rem;
          color: #111c2d;
          margin-top: 2.5rem;
          margin-bottom: 1rem;
        }
        .article-content .blog-article-body h3,
        .article-content .rich-html-content h3,
        .article-content .ql-editor h3 {
          font-family: var(--font-display), 'Plus Jakarta Sans', 'Noto Sans TC', sans-serif;
          font-size: 1.25rem;
          font-weight: 700;
          margin-top: 2rem;
          margin-bottom: 0.75rem;
          color: #111c2d;
        }
        .article-content .blog-article-body p,
        .article-content .rich-html-content p,
        .article-content .ql-editor p {
          margin-bottom: 1.5rem;
        }
        .article-content .blog-article-body ul,
        .article-content .rich-html-content ul,
        .article-content .ql-editor ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .article-content .blog-article-body li,
        .article-content .rich-html-content li,
        .article-content .ql-editor li {
          margin-bottom: 0.5rem;
        }
        .article-content .blog-article-body pre,
        .article-content .rich-html-content pre,
        .article-content .ql-editor pre,
        .article-content .blog-article-body .ql-code-block-container {
          background-color: #f0f3ff;
          border-left: 4px solid #006a62;
          padding: 1rem 1.5rem;
          margin: 1.5rem 0;
          border-radius: 0 0.5rem 0.5rem 0;
          font-family: var(--font-mono), 'JetBrains Mono', monospace;
          overflow-x: auto;
        }
        .article-content .blog-article-body blockquote,
        .article-content .rich-html-content blockquote,
        .article-content .ql-editor blockquote {
          background-color: #e7eeff;
          border: 1px solid rgba(195, 198, 215, 0.5);
          border-radius: 0.75rem;
          padding: 1.25rem 1.5rem;
          margin: 2rem 0;
        }
      `}</style>
    </div>
  );
}
