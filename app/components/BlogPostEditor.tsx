'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Swal from '@/utils/swalTheme';
import {
  CloudArrowUpIcon,
  DocumentTextIcon,
  EyeIcon,
  PhotoIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import PageLoadingArea from './ui/PageLoadingArea';
import LoadingSpinner from './LoadingSpinner';
import BackButton from './ui/BackButton';
import Dropdown from './ui/Dropdown';
import RichTextEditor from '../../components/RichTextEditor';
import { getSession } from '@/utils/session';
import type { BlogCategory, BlogPost, BlogPostStatus } from '@/services/blogTypes';
import { resolveBlogCoverImage } from '@/services/blogTypes';

const STATUS_OPTIONS: { value: BlogPostStatus; label: string }[] = [
  { value: 'draft', label: '草稿' },
  { value: 'published', label: '已發佈' },
  { value: 'scheduled', label: '預定發佈' },
  { value: 'unlisted', label: '不公開' },
];

const inputClass =
  'w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-transparent';

type FormState = Partial<BlogPost> & { tagsText?: string };

const emptyForm = (): FormState => ({
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  contentFormat: 'html',
  coverImage: '',
  categoryId: '',
  status: 'draft',
  seoTitle: '',
  seoDescription: '',
  ogImage: '',
  relatedCourseIds: [],
  featured: false,
  tagsText: '',
  scheduledAt: '',
});

function isAuthorSession(): boolean {
  const session = getSession();
  if (!session?.id) return false;
  if (String(session.currentRole || '').toLowerCase() === 'author') return true;
  const role = session.role;
  const roles = Array.isArray(role) ? role : role ? [role] : [];
  return roles.some((r) => {
    const n = String(r).toLowerCase();
    return n === 'author' || n === '作者';
  });
}

export default function BlogPostEditor({ postId }: { postId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(emptyForm());
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editorMode, setEditorMode] = useState<'html' | 'markdown'>('html');
  const [dirty, setDirty] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const patch = useCallback((updater: (prev: FormState) => FormState) => {
    setForm((prev) => updater(prev));
    setDirty(true);
  }, []);

  useEffect(() => {
    if (!isAuthorSession()) {
      router.replace('/back-panel');
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const catsRes = await fetch('/api/blog/categories');
        if (!catsRes.ok) throw new Error('categories');
        const cats = await catsRes.json();
        if (cancelled) return;
        setCategories(cats);

        if (postId) {
          const res = await fetch(`/api/blog/posts/${encodeURIComponent(postId)}?view=0`);
          if (!res.ok) throw new Error('post');
          const data = await res.json();
          const post: BlogPost = data.post || data;
          if (cancelled) return;
          setForm({
            ...post,
            tagsText: (post.tagNames || []).join(', '),
            scheduledAt: post.scheduledAt ? post.scheduledAt.slice(0, 16) : '',
          });
          setEditorMode(post.contentFormat === 'markdown' ? 'markdown' : 'html');
        } else {
          setForm(emptyForm());
          setEditorMode('html');
        }
        setDirty(false);
      } catch {
        Swal.fire('錯誤', '無法載入編輯器', 'error').then(() => {
          router.replace('/back-panel/blog');
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [postId, router]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirty || saving) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty, saving]);

  const handleClose = () => {
    const go = () => {
      if (window.opener) {
        window.close();
        router.push('/back-panel/blog');
      } else {
        router.push('/back-panel/blog');
      }
    };
    if (!dirty) {
      go();
      return;
    }
    void Swal.fire({
      title: '離開編輯？',
      text: '尚有未儲存的變更',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '離開',
      cancelButtonText: '繼續編輯',
      confirmButtonColor: '#dc2626',
      customClass: { popup: 'rounded-2xl' },
    }).then((result) => {
      if (result.isConfirmed) go();
    });
  };


  const handleCoverUpload = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      Swal.fire('提示', '請選擇圖片檔案', 'warning');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      Swal.fire('提示', '圖片大小需小於 5MB', 'warning');
      return;
    }
    setUploadingCover(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/blog/upload-cover', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : '上傳失敗');
      }
      if (typeof data.url !== 'string' || !data.url) {
        throw new Error('上傳回應格式錯誤');
      }
      patch((prev) => ({ ...prev, coverImage: data.url }));
    } catch (e) {
      Swal.fire('錯誤', e instanceof Error ? e.message : '上傳失敗', 'error');
    } finally {
      setUploadingCover(false);
    }
  };

  const uploadContentImage = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('請選擇圖片檔案');
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error('圖片大小需小於 5MB');
    }
    const body = new FormData();
    body.append('file', file);
    const res = await fetch('/api/blog/upload-image', { method: 'POST', body });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(typeof data.error === 'string' ? data.error : '上傳失敗');
    }
    if (typeof data.url !== 'string' || !data.url) {
      throw new Error('上傳回應格式錯誤');
    }
    return data.url as string;
  }, []);

  const handleSave = async () => {
    if (!form.title?.trim()) {
      Swal.fire('提示', '請輸入文章標題', 'warning');
      return;
    }
    setSaving(true);
    try {
      const { tagsText, topicNumber: _omit, slug: _slugOmit, ...rest } = form;
      const payload = {
        ...rest,
        contentFormat: editorMode,
        tags: tagsText || '',
        scheduledAt: form.scheduledAt || null,
      };
      const res = await fetch(form.id ? `/api/blog/posts/${form.id}` : '/api/blog/posts', {
        method: form.id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || '儲存失敗');
      }
      const saved: BlogPost = await res.json();
      setForm((prev) => ({
        ...prev,
        ...saved,
        tagsText: (saved.tagNames || []).join(', ') || prev.tagsText,
        scheduledAt: saved.scheduledAt ? saved.scheduledAt.slice(0, 16) : '',
      }));
      setDirty(false);
      if (!form.id && saved.id) {
        router.replace(`/back-panel/blog/edit/${saved.id}`);
      }
      await Swal.fire({
        icon: 'success',
        title: '已儲存',
      });
    } catch (e) {
      await Swal.fire('錯誤', e instanceof Error ? e.message : '儲存失敗', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = () => {
    if (!form.slug) {
      Swal.fire('提示', '請先儲存文章以產生網址', 'info');
      return;
    }
    if (dirty) {
      void Swal.fire({
        title: '尚未儲存變更',
        text: '預覽內容可能與編輯中不一致，建議先儲存。',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: '仍要預覽',
        cancelButtonText: '取消',
        customClass: { popup: 'rounded-2xl' },
      }).then((r) => {
        if (r.isConfirmed) window.open(`/blog/${form.slug}`, '_blank', 'noopener,noreferrer');
      });
      return;
    }
    window.open(`/blog/${form.slug}`, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return (
      <div className="page-shell w-full min-w-0 flex flex-col mt-6 pb-10 min-h-[calc(100dvh-3rem)] justify-center">
        <PageLoadingArea minHeight="min-h-0" />
      </div>
    );
  }

  const isEdit = Boolean(form.id);
  const titleText = isEdit ? '編輯文章' : '新增文章';
  const subtitleText = isEdit
    ? form.title?.trim() || '編輯並管理線上文章'
    : '撰寫一篇新的線上文章';
  const coverPreviewSrc = resolveBlogCoverImage({
    coverImage: form.coverImage,
    categoryId: form.categoryId,
  });
  const usingDefaultCover = !(form.coverImage || '').trim();

  return (
    <div className="page-shell w-full min-w-0 flex flex-col min-h-full animate-fade-in mt-6 pb-10">
      {/* Title — same chrome as exam editor / back-panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-0">
        <div className="border-l-4 border-primary pl-4">
          <h1 className="font-display text-2xl font-bold text-on-surface flex items-center gap-3">
            <DocumentTextIcon className="h-8 w-8 text-primary" />
            {titleText}
          </h1>
          <p className="text-on-surfaceVariant text-sm mt-1">{subtitleText}</p>
        </div>
      </div>

      {/* Back + toolbar */}
      <div className="flex items-center justify-between gap-4 mt-4 mb-6">
        <BackButton label="返回文章列表" onClick={handleClose} withSpacing={false} />
        <div className="flex items-center gap-2 flex-shrink-0">
          {form.slug ? (
            <button
              type="button"
              onClick={handlePreview}
              className="inline-flex items-center px-4 py-2 bg-white border border-violet-200 text-violet-700 rounded-xl hover:bg-violet-50 transition-colors shadow-sm font-medium text-sm"
            >
              <EyeIcon className="w-4 h-4 mr-1.5" />
              預覽
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors shadow-sm font-medium text-sm disabled:opacity-50"
          >
            {saving ? (
              <LoadingSpinner size={16} color="white" className="mr-1.5" />
            ) : (
              <CloudArrowUpIcon className="w-4 h-4 mr-1.5" />
            )}
            {saving ? '儲存中…' : '儲存'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {form.status === 'published' && (
          <div className="rounded-xl border border-primary/20 bg-primary/20 px-4 py-3 text-sm text-on-surface">
            此文章目前為<strong>已發佈</strong>狀態。點「儲存」會更新內容；若要下架，請將發佈狀態改為草稿或不公開。
          </div>
        )}

        {/* Basic info card */}
        <div className="bg-surface-containerLowest rounded-2xl shadow-sm border border-outline-variant/40 p-6">
          <h2 className="font-display text-lg font-bold text-on-surface mb-4 border-l-4 border-primary pl-3">
            文章基本資料
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-gray-700 text-sm font-bold mb-2 block">標題 *</label>
              <input
                type="text"
                value={form.title || ''}
                onChange={(e) => patch((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="例如：學習心法第一講"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-gray-700 text-sm font-bold mb-2 block">主題</label>
              <Dropdown
                value={form.categoryId || ''}
                onChange={(v) => patch((prev) => ({ ...prev, categoryId: v }))}
                options={[
                  { value: '', label: '選擇主題' },
                  ...categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-gray-700 text-sm font-bold mb-2 block">發佈狀態</label>
              <Dropdown
                value={form.status || 'draft'}
                onChange={(v) => patch((prev) => ({ ...prev, status: v as BlogPostStatus }))}
                options={STATUS_OPTIONS}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-gray-700 text-sm font-bold mb-2 block">預定發佈時間</label>
              <input
                type="datetime-local"
                value={form.scheduledAt || ''}
                onChange={(e) => patch((prev) => ({ ...prev, scheduledAt: e.target.value }))}
                className={inputClass}
                disabled={form.status !== 'scheduled'}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-gray-700 text-sm font-bold mb-2 block">摘要</label>
              <textarea
                value={form.excerpt || ''}
                onChange={(e) => patch((prev) => ({ ...prev, excerpt: e.target.value }))}
                rows={2}
                className={`${inputClass} resize-none`}
                placeholder="摘要文字，用於列表顯示"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-gray-700 text-sm font-bold mb-2 block">文章封面</label>
              <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                <div className="relative w-full max-w-xl aspect-[16/9] rounded-lg overflow-hidden border border-gray-200 bg-white mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverPreviewSrc}
                    alt="文章封面預覽"
                    className="w-full h-full object-cover"
                  />
                  {usingDefaultCover ? (
                    <span className="absolute left-2 bottom-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white">
                      主題預設封面
                    </span>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label
                    className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium shadow-sm transition-colors cursor-pointer ${
                      uploadingCover
                        ? 'bg-primary text-white opacity-70 cursor-wait'
                        : 'bg-primary text-white hover:bg-primary-hover'
                    }`}
                  >
                    {uploadingCover ? (
                      <>
                        <LoadingSpinner size={16} color="white" className="mr-1.5" />
                        上傳中…
                      </>
                    ) : (
                      <>
                        <PhotoIcon className="w-4 h-4 mr-1.5" />
                        {usingDefaultCover ? '上傳封面' : '更換封面'}
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingCover}
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        e.target.value = '';
                        void handleCoverUpload(file);
                      }}
                    />
                  </label>
                  {!usingDefaultCover ? (
                    <button
                      type="button"
                      disabled={uploadingCover}
                      onClick={() => patch((prev) => ({ ...prev, coverImage: '' }))}
                      className="inline-flex items-center px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm font-medium text-sm disabled:opacity-50"
                    >
                      <TrashIcon className="w-4 h-4 mr-1.5" />
                      改用主題預設
                    </button>
                  ) : null}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  未上傳時使用主題預設封面（同一主題固定同一張，兩張預設圖輪流分配）。建議比例 16:9，支援 JPG／PNG／WebP，大小限 5MB。
                </p>
              </div>
            </div>
            <div>
              <label className="text-gray-700 text-sm font-bold mb-2 block">標籤（逗號分隔）</label>
              <input
                type="text"
                value={form.tagsText || ''}
                onChange={(e) => patch((prev) => ({ ...prev, tagsText: e.target.value }))}
                className={inputClass}
                placeholder="數學, 物理, 學測攻略"
              />
            </div>
            <div className="md:col-span-2 flex items-center gap-2">
              <input
                id="featured-page"
                type="checkbox"
                checked={Boolean(form.featured)}
                onChange={(e) => patch((prev) => ({ ...prev, featured: e.target.checked }))}
                className="w-4 h-4 accent-[#2D6DF6]"
              />
              <label htmlFor="featured-page" className="text-sm font-medium text-gray-700">
                設為精選文章
              </label>
            </div>
          </div>
        </div>

        {/* Content card */}
        <div className="bg-surface-containerLowest rounded-2xl shadow-sm border border-outline-variant/40 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="font-display text-lg font-bold text-on-surface border-l-4 border-primary pl-3">內容</h2>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setEditorMode('html');
                  setDirty(true);
                }}
                className={`px-3 py-1.5 ${editorMode === 'html' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                視覺編輯
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditorMode('markdown');
                  setDirty(true);
                }}
                className={`px-3 py-1.5 ${editorMode === 'markdown' ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Markdown
              </button>
            </div>
          </div>
          {editorMode === 'html' ? (
            <>
              <RichTextEditor
                value={form.content || ''}
                onChange={(html) => patch((prev) => ({ ...prev, content: html }))}
                enableLatex
                enableFontSize={false}
                enableImage
                maxImages={5}
                uploadImage={uploadContentImage}
                minHeight="360px"
                placeholder="開始撰寫文章內容…"
                instanceKey={form.id || 'new-post-page'}
              />
              <p className="mt-2 text-xs text-gray-400">內容圖片最多 5 張；工具列可插入圖片與公式。</p>
            </>
          ) : (
            <textarea
              value={form.content || ''}
              onChange={(e) => patch((prev) => ({ ...prev, content: e.target.value }))}
              rows={18}
              className={`${inputClass} font-mono text-sm`}
              placeholder={'使用 Markdown：\n# 標題\n## 小標\n$E=mc^2$'}
            />
          )}
        </div>

      </div>
    </div>
  );
}
