'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Swal from '@/utils/swalTheme';
import { PlusIcon, TagIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';
import PageLoadingArea from './ui/PageLoadingArea';
import LoadingSpinner from './LoadingSpinner';
import { btnStyles, btnWithIconStyle, btnIcon, btnIconGap } from './ui';
import { courseListTableStyles } from './studentCourseListShared';
import type { BlogCategory } from '@/services/blogTypes';
import { sanitizeSlugInput, slugify } from '@/services/blogTypes';

const modalInputClass =
  'w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all text-sm';

export default function BlogCategoryManager() {
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/blog/categories');
      if (!res.ok) throw new Error('fail');
      setCategories(await res.json());
    } catch {
      Swal.fire('錯誤', '載入主題失敗', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openModal = () => {
    setName('');
    setSlug('');
    setSlugTouched(false);
    setShowModal(true);
  };

  const closeModal = () => {
    if (saving) return;
    setShowModal(false);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Swal.fire('提示', '請輸入主題名稱', 'warning');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/blog/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          slug: slugify(slug.trim() || name.trim()),
        }),
      });
      if (!res.ok) throw new Error('fail');
      setShowModal(false);
      setName('');
      setSlug('');
      setSlugTouched(false);
      await load();
    } catch {
      Swal.fire('錯誤', '新增主題失敗', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cat: BlogCategory) => {
    const result = await Swal.fire({
      title: '刪除主題？',
      text: cat.name,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '刪除',
      cancelButtonText: '取消',
      confirmButtonColor: '#dc2626',
      customClass: { popup: 'rounded-2xl' },
    });
    if (!result.isConfirmed) return;
    const res = await fetch('/api/blog/categories', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: cat.id }),
    });
    if (!res.ok) {
      Swal.fire('錯誤', '刪除主題失敗', 'error');
      return;
    }
    await load();
  };

  return (
    <div className="page-shell max-w-7xl mx-auto w-full min-w-0 flex flex-col h-full overflow-y-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
        <div className="border-l-4 border-primary pl-4">
          <h1 className="font-display text-2xl font-bold text-on-surface flex items-center gap-3">
            <TagIcon className="h-8 w-8 text-primary" />
            主題管理
          </h1>
          <p className="text-on-surfaceVariant text-sm mt-1">
            新增與管理文章主題
          </p>
        </div>
        <button
          type="button"
          onClick={openModal}
          className={`${btnWithIconStyle(btnStyles.primary)} w-full md:w-auto shrink-0`}
        >
          <PlusIcon className={`${btnIcon} ${btnIconGap}`} />
          新增主題
        </button>
      </div>

      {loading ? (
        <PageLoadingArea />
      ) : (
        <div className={courseListTableStyles.desktop.wrapper}>
          <table className={courseListTableStyles.desktop.table}>
            <thead className={courseListTableStyles.desktop.thead}>
              <tr>
                <th scope="col" className={courseListTableStyles.desktop.th}>
                  名稱
                </th>
                <th scope="col" className={courseListTableStyles.desktop.th}>
                  網址名稱
                </th>
                <th
                  scope="col"
                  className={`${courseListTableStyles.desktop.th} text-right min-w-[120px]`}
                >
                  操作
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-gray-500">
                    尚無主題，請先新增
                  </td>
                </tr>
              ) : (
                categories.map((cat) => (
                  <tr key={cat.id} className={courseListTableStyles.desktop.row}>
                    <td className="px-6 py-4">
                      <div className={courseListTableStyles.desktop.courseName}>{cat.name}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{cat.slug}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className={courseListTableStyles.desktop.actionRow}>
                        <button
                          type="button"
                          onClick={() => void handleDelete(cat)}
                          className={courseListTableStyles.desktop.actionDanger}
                          title="刪除"
                        >
                          <TrashIcon className="h-4 w-4 mr-1" />
                          刪除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden transform scale-100 flex flex-col">
              <div className="bg-gradient-to-r from-primary to-tertiary p-4 flex justify-between items-center text-white shrink-0">
                <h3 className="font-bold flex items-center gap-2">
                  <TagIcon className="w-5 h-5" />
                  新增主題
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  className="text-white/80 hover:text-white"
                  aria-label="關閉"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-5">
                <div>
                  <label htmlFor="topicName" className="block text-sm font-bold text-gray-700 mb-2">
                    主題名稱
                  </label>
                  <input
                    id="topicName"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setName(v);
                      if (!slugTouched) setSlug(sanitizeSlugInput(v));
                    }}
                    placeholder="例如：學習心法"
                    className={modalInputClass}
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="topicSlug" className="block text-sm font-bold text-gray-700 mb-2">
                    網址名稱（可中文）
                  </label>
                  <input
                    id="topicSlug"
                    type="text"
                    value={slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setSlug(sanitizeSlugInput(e.target.value));
                    }}
                    placeholder="例如：學習心法"
                    className={`${modalInputClass} font-mono`}
                  />
                  <p className="text-xs text-gray-400 mt-1.5">顯示於文章網址；留空將依主題名稱自動產生。</p>
                </div>
              </div>

              <div className="p-4 bg-surface-containerLow border-t border-outline-variant/40 flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => void handleCreate()}
                  disabled={saving}
                  className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <LoadingSpinner size={16} color="white" />
                      新增中…
                    </>
                  ) : (
                    '新增主題'
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
