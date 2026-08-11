'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Swal from '@/utils/swalTheme';
import { ChatBubbleLeftRightIcon, CheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import PageLoadingArea from './ui/PageLoadingArea';
import { tableActionStyles, tableActionRow } from './ui';
import { courseListTableStyles } from './studentCourseListShared';
import type { BlogComment } from '@/services/blogTypes';

export default function BlogCommentManager() {
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/blog/comments?moderate=1&limit=200');
      if (!res.ok) throw new Error('fail');
      setComments(await res.json());
    } catch {
      Swal.fire('錯誤', '載入留言失敗', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id: string, isApproved: boolean) => {
    const res = await fetch('/api/blog/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isApproved }),
    });
    if (!res.ok) {
      Swal.fire('錯誤', '更新失敗', 'error');
      return;
    }
    await load();
  };

  const remove = async (id: string) => {
    const result = await Swal.fire({
      title: '刪除留言？',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '刪除',
      cancelButtonText: '取消',
      confirmButtonColor: '#dc2626',
      customClass: { popup: 'rounded-2xl' },
    });
    if (!result.isConfirmed) return;
    const res = await fetch('/api/blog/comments', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (!res.ok) {
      Swal.fire('錯誤', '刪除失敗', 'error');
      return;
    }
    await load();
  };

  return (
    <div className="page-shell max-w-7xl mx-auto w-full min-w-0 flex flex-col h-full overflow-y-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
        <div className="border-l-4 border-primary pl-4">
          <h1 className="font-display text-2xl font-bold text-on-surface flex items-center gap-3">
            <ChatBubbleLeftRightIcon className="h-8 w-8 text-primary" />
            留言審核
          </h1>
          <p className="text-on-surfaceVariant text-sm mt-1">審核與回覆文章留言</p>
        </div>
      </div>

      {loading ? (
        <PageLoadingArea minHeight="min-h-[40vh]" />
      ) : (
        <>
          <div className={courseListTableStyles.mobile.wrapper}>
            {comments.length === 0 ? (
              <div className="bg-surface-containerLowest border border-outline-variant/40 rounded-xl p-8 text-center text-gray-500 text-sm">
                目前沒有留言
              </div>
            ) : (
              comments.map((c) => (
                <div key={c.id} className={courseListTableStyles.mobile.card}>
                  <div className="text-xs text-gray-500 mb-1">{c.postTitle}</div>
                  <div className={courseListTableStyles.mobile.courseName}>{c.userName}</div>
                  <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{c.content}</p>
                  <div className="mt-2">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        c.isApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {c.isApproved ? '已通過' : '待審核'}
                    </span>
                  </div>
                  <div className={`${tableActionRow} border-t border-gray-100 pt-3 mt-3`}>
                    {!c.isApproved && (
                      <button
                        type="button"
                        onClick={() => void approve(c.id, true)}
                        className={tableActionStyles.success}
                        title="通過"
                      >
                        <CheckIcon className="h-4 w-4 mr-1" />
                        通過
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(c.id)}
                      className={tableActionStyles.danger}
                      title="刪除"
                    >
                      <TrashIcon className="h-4 w-4 mr-1" />
                      刪除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className={courseListTableStyles.desktop.wrapper}>
            <table className={courseListTableStyles.desktop.table}>
              <thead className={courseListTableStyles.desktop.thead}>
                <tr>
                  <th scope="col" className={courseListTableStyles.desktop.th}>文章</th>
                  <th scope="col" className={courseListTableStyles.desktop.th}>留言者</th>
                  <th scope="col" className={courseListTableStyles.desktop.th}>內容</th>
                  <th scope="col" className={courseListTableStyles.desktop.th}>狀態</th>
                  <th scope="col" className={`${courseListTableStyles.desktop.th} text-right min-w-[180px]`}>操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {comments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                      目前沒有留言
                    </td>
                  </tr>
                ) : (
                  comments.map((c) => (
                    <tr key={c.id} className={courseListTableStyles.desktop.row}>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 line-clamp-2">{c.postTitle || c.postId}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{c.userName}</td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-3">{c.content}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            c.isApproved ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}
                        >
                          {c.isApproved ? '已通過' : '待審核'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <div className={courseListTableStyles.desktop.actionRow}>
                          {!c.isApproved && (
                            <button
                              type="button"
                              onClick={() => void approve(c.id, true)}
                              className={tableActionStyles.success}
                              title="通過"
                            >
                              <CheckIcon className="h-4 w-4 mr-1" />
                              通過
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => void remove(c.id)}
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
        </>
      )}
    </div>
  );
}
