'use client';

import React, { useMemo, useState } from 'react';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  MagnifyingGlassIcon,
  MegaphoneIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import Swal from '@/utils/swalTheme';
import {
  announcementPreviewText,
  formatAnnouncementDateTime,
  getAnnouncementDisplayStatus,
  type AnnouncementStatusFilter,
} from '@/utils/announcementStatus';
import type { CourseAnnouncement } from './TeacherAnnouncementEditor';

const PAGE_SIZE = 10;

const FILTERS: { id: AnnouncementStatusFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'published', label: '已發佈' },
  { id: 'draft', label: '草稿' },
  { id: 'scheduled', label: '預定' },
];

type Props = {
  courseName: string;
  announcements: CourseAnnouncement[];
  isArchived: boolean;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
  onToggleVisibility: (ann: CourseAnnouncement) => Promise<void>;
  onBatchDelete: (ids: string[]) => Promise<void>;
};

function StatusBadge({ ann }: { ann: CourseAnnouncement }) {
  const status = getAnnouncementDisplayStatus(ann);
  if (status === 'published') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary font-mono text-[11px] font-semibold uppercase tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
        已發佈
      </span>
    );
  }
  if (status === 'scheduled') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-tertiary/10 text-tertiary font-mono text-[11px] font-semibold uppercase tracking-wider">
        預定
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-containerHigh text-on-surfaceVariant font-mono text-[11px] font-semibold uppercase tracking-wider">
      草稿
    </span>
  );
}

export default function TeacherAnnouncementList({
  courseName,
  announcements,
  isArchived,
  onCreate,
  onEdit,
  onDelete,
  onToggleVisibility,
  onBatchDelete,
}: Props) {
  const [filter, setFilter] = useState<AnnouncementStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return announcements
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .filter((ann) => {
        const status = getAnnouncementDisplayStatus(ann);
        if (filter !== 'all' && status !== filter) return false;
        if (!q) return true;
        const preview = announcementPreviewText(ann.content || '', 200).toLowerCase();
        return ann.title.toLowerCase().includes(q) || preview.includes(q);
      });
  }, [announcements, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const pageIds = pageRows.map((a) => a.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });
  };

  const handleBatchDelete = async () => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const result = await Swal.fire({
      title: `刪除 ${ids.length} 則公告？`,
      text: '刪除後無法復原',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '確定刪除',
      cancelButtonText: '取消',
      confirmButtonColor: '#ef4444',
    });
    if (!result.isConfirmed) return;
    await onBatchDelete(ids);
    setSelected(new Set());
  };

  const handlePreview = async (ann: CourseAnnouncement) => {
    await Swal.fire({
      title: ann.title || '（無標題）',
      html: `<div class="text-left text-sm text-gray-700 max-h-80 overflow-y-auto">${ann.content || '<p class="text-gray-400">（無內容）</p>'}</div>`,
      confirmButtonText: '關閉',
      width: 560,
      customClass: { popup: 'rounded-2xl' },
    });
  };

  const displayFrom = filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const displayTo = Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <div className="animate-fade-in flex flex-col w-full min-w-0">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl md:text-2xl font-bold text-on-surface mb-1">
            課程公告管理
          </h2>
          <p className="text-on-surfaceVariant text-sm md:text-base">
            管理「{courseName}」的所有課堂通知與系統公告
          </p>
        </div>
        {!isArchived && (
          <button
            type="button"
            onClick={onCreate}
            className="bg-primary-container text-on-primary px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm hover:bg-primary transition-colors inline-flex items-center gap-2 shrink-0"
          >
            <MegaphoneIcon className="w-5 h-5" />
            發佈新公告
          </button>
        )}
      </div>

      {isArchived && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-4">
          <span className="font-bold mr-2">提示：</span>
          此課程已封存，您只能查看公告，無法新增或修改。
        </div>
      )}

      <div className="mb-4 relative max-w-xl">
        <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="搜尋公告…"
          className="w-full bg-surface-containerLowest border border-outline-variant rounded-full py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="bg-surface-containerLowest p-4 rounded-xl shadow-sm border border-outline-variant/40 mb-5 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                setFilter(f.id);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-full font-mono text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors ${
                filter === f.id
                  ? 'bg-primary-container text-on-primary'
                  : 'bg-surface-containerLow text-on-surfaceVariant hover:bg-surface-containerHigh'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <label className="flex items-center gap-2 text-sm text-on-surfaceVariant cursor-pointer">
            <input
              type="checkbox"
              checked={allPageSelected}
              onChange={toggleSelectAllPage}
              className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer"
            />
            全選
          </label>
          <div className="h-6 w-px bg-outline-variant mx-1" />
          <button
            type="button"
            disabled={selected.size === 0 || isArchived}
            onClick={() => void handleBatchDelete()}
            className="text-on-surfaceVariant hover:text-primary disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 text-sm transition-colors"
          >
            <TrashIcon className="w-5 h-5" />
            批次刪除
          </button>
          <button
            type="button"
            disabled={selected.size === 0 || isArchived}
            onClick={() => {
              const first = announcements.find((a) => selected.has(a.id));
              if (first) void onToggleVisibility(first);
            }}
            className="text-on-surfaceVariant hover:text-primary disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 text-sm transition-colors"
            title="切換第一則已選公告的學生可見狀態"
          >
            更改狀態
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center min-h-[280px] flex flex-col items-center justify-center bg-surface-containerLowest rounded-xl border-2 border-dashed border-outline-variant/50 shadow-sm">
          <MegaphoneIcon className="w-12 h-12 mb-3 text-outline-variant" />
          <p className="text-on-surfaceVariant font-medium">
            {announcements.length === 0 ? '目前沒有課程公告' : '沒有符合條件的公告'}
          </p>
          {!isArchived && announcements.length === 0 && (
            <button
              type="button"
              onClick={onCreate}
              className="mt-4 inline-flex items-center gap-1 text-primary font-semibold text-sm hover:underline"
            >
              <PlusIcon className="w-4 h-4" />
              發佈第一則公告
            </button>
          )}
        </div>
      ) : (
        <div className="bg-surface-containerLowest rounded-xl shadow-sm border border-outline-variant/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead>
                <tr className="bg-surface-containerLow border-b border-outline-variant/40 text-on-surfaceVariant font-mono text-[11px] uppercase tracking-wider">
                  <th className="py-4 px-6 font-semibold w-12 text-center">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleSelectAllPage}
                      className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="py-4 px-6 font-semibold">標題</th>
                  <th className="py-4 px-6 font-semibold w-32">發佈狀態</th>
                  <th className="py-4 px-6 font-semibold w-40">發佈日期</th>
                  <th className="py-4 px-6 font-semibold w-24 text-right">點閱數</th>
                  <th className="py-4 px-6 font-semibold w-36 text-center">操作</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((ann) => {
                  const status = getAnnouncementDisplayStatus(ann);
                  const dateIso =
                    status === 'scheduled'
                      ? ann.scheduledAt
                      : ann.visiblePublishedAt || ann.createdAt;
                  const preview = announcementPreviewText(ann.content || '');
                  const isDraft = status === 'draft';
                  return (
                    <tr
                      key={ann.id}
                      className="border-b border-outline-variant/30 last:border-0 hover:bg-surface-containerLow/50 transition-colors group"
                    >
                      <td className="py-4 px-6 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(ann.id)}
                          onChange={() => toggleSelect(ann.id)}
                          className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                        />
                      </td>
                      <td className="py-4 px-6">
                        <button
                          type="button"
                          onClick={() => onEdit(ann.id)}
                          className="text-left w-full"
                        >
                          <div
                            className={`font-semibold mb-1 ${
                              isDraft ? 'text-outline' : 'text-on-surface'
                            }`}
                          >
                            {isDraft ? `【草稿】${ann.title || '未命名'}` : ann.title || '未命名'}
                          </div>
                          {preview ? (
                            <div className="text-sm text-outline truncate max-w-md">{preview}</div>
                          ) : null}
                        </button>
                      </td>
                      <td className="py-4 px-6">
                        <StatusBadge ann={ann} />
                      </td>
                      <td className="py-4 px-6 text-on-surfaceVariant text-sm">
                        {status === 'draft' ? '—' : formatAnnouncementDateTime(dateIso)}
                      </td>
                      <td className="py-4 px-6 text-right text-on-surfaceVariant font-mono text-sm">
                        {typeof ann.viewsCount === 'number'
                          ? ann.viewsCount.toLocaleString()
                          : '—'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => void handlePreview(ann)}
                            className="p-1.5 text-on-surfaceVariant hover:text-primary rounded-lg hover:bg-surface-containerHigh transition-colors"
                            title="預覽"
                          >
                            <EyeIcon className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onEdit(ann.id)}
                            className="p-1.5 text-on-surfaceVariant hover:text-primary rounded-lg hover:bg-surface-containerHigh transition-colors"
                            title="編輯"
                          >
                            <PencilSquareIcon className="w-5 h-5" />
                          </button>
                          {!isArchived && (
                            <button
                              type="button"
                              onClick={async () => {
                                const result = await Swal.fire({
                                  title: '確定刪除？',
                                  text: '刪除後無法復原',
                                  icon: 'warning',
                                  showCancelButton: true,
                                  confirmButtonText: '確定',
                                  cancelButtonText: '取消',
                                  confirmButtonColor: '#ef4444',
                                });
                                if (result.isConfirmed) await onDelete(ann.id);
                              }}
                              className="p-1.5 text-on-surfaceVariant hover:text-error rounded-lg hover:bg-error-container transition-colors"
                              title="刪除"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t border-outline-variant/40 p-4 flex items-center justify-between bg-surface-containerLowest">
            <div className="text-sm text-on-surfaceVariant">
              顯示 {displayFrom} 至 {displayTo} 筆，共 {filtered.length} 筆
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="w-8 h-8 rounded-lg border border-outline-variant flex items-center justify-center text-outline disabled:opacity-50"
              >
                <ChevronLeftIcon className="w-5 h-5" />
              </button>
              <span className="w-8 h-8 rounded-lg bg-primary-container text-on-primary text-sm flex items-center justify-center font-medium">
                {safePage}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="w-8 h-8 rounded-lg border border-outline-variant flex items-center justify-center text-outline disabled:opacity-50"
              >
                <ChevronRightIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
