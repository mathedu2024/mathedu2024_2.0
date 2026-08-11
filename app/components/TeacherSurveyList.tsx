'use client';

import React, { useMemo, useState } from 'react';
import {
  Bars3Icon,
  ChartBarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardDocumentListIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
  type DroppableProvided,
  type DraggableProvided,
} from '@hello-pangea/dnd';
import { fixDraggableStyle } from '@/utils/dndStyle';
import {
  type Survey,
  formatSurveyResponseMode,
  getSurveyAnswerWindowPhase,
} from '@/services/surveyTypes';
import { PageLoadingArea } from './ui';

type StatusFilter = 'all' | 'active' | 'ended' | 'draft';
type SortKey = 'order' | 'recent' | 'oldest';

const PAGE_SIZE = 10;

function surveyListStatus(survey: Survey): 'active' | 'ended' | 'draft' {
  if (survey.status !== 'published') return 'draft';
  const phase = getSurveyAnswerWindowPhase(survey);
  if (phase === 'ended') return 'ended';
  return 'active';
}

function StatusBadge({ status }: { status: 'active' | 'ended' | 'draft' }) {
  if (status === 'active') {
    return (
      <span className="bg-secondary/10 text-secondary border border-secondary/30 px-3 py-1 rounded-full text-sm inline-flex items-center gap-1.5 font-medium">
        <span className="w-2 h-2 rounded-full bg-secondary" />
        進行中
      </span>
    );
  }
  if (status === 'ended') {
    return (
      <span className="bg-surface-containerHigh text-on-surfaceVariant px-3 py-1 rounded-full text-sm inline-flex items-center gap-1.5 font-medium">
        <span className="w-2 h-2 rounded-full bg-outline" />
        已結束
      </span>
    );
  }
  return (
    <span className="border border-dashed border-outline-variant text-on-surfaceVariant bg-surface px-3 py-1 rounded-full text-sm inline-flex items-center gap-1.5 font-medium">
      <span className="w-2 h-2 rounded-full bg-outline-variant" />
      草稿
    </span>
  );
}

function formatCreatedDate(iso?: string): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

type Props = {
  courseName: string;
  surveys: Survey[];
  loading: boolean;
  isArchived: boolean;
  orderSaving: boolean;
  canDeleteSurvey: (survey: Survey) => boolean;
  onCreate: () => void;
  onCopyFromOther: () => void;
  onEdit: (survey: Survey) => void;
  onAnalytics: (survey: Survey) => void;
  onDelete: (survey: Survey) => void;
  onDragEnd: (result: DropResult) => void;
};

export default function TeacherSurveyList({
  courseName,
  surveys,
  loading,
  isArchived,
  orderSaving,
  canDeleteSurvey,
  onCreate,
  onCopyFromOther,
  onEdit,
  onAnalytics,
  onDelete,
  onDragEnd,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('order');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = surveys.filter((s) => {
      const st = surveyListStatus(s);
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.surveyCode.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q)
      );
    });
    if (sortKey === 'recent') {
      list = list
        .slice()
        .sort(
          (a, b) =>
            Date.parse(b.updatedAt || b.createdAt || '') -
            Date.parse(a.updatedAt || a.createdAt || '')
        );
    } else if (sortKey === 'oldest') {
      list = list
        .slice()
        .sort((a, b) => Date.parse(a.createdAt || '') - Date.parse(b.createdAt || ''));
    }
    return list;
  }, [surveys, search, statusFilter, sortKey]);

  const canDrag =
    !isArchived &&
    !orderSaving &&
    statusFilter === 'all' &&
    !search.trim() &&
    sortKey === 'order';

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = canDrag
    ? filtered
    : filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const activeCount = useMemo(
    () => surveys.filter((s) => surveyListStatus(s) === 'active').length,
    [surveys]
  );
  const draftCount = useMemo(
    () => surveys.filter((s) => surveyListStatus(s) === 'draft').length,
    [surveys]
  );

  const displayFrom = filtered.length === 0 ? 0 : canDrag ? 1 : (safePage - 1) * PAGE_SIZE + 1;
  const displayTo = canDrag
    ? filtered.length
    : Math.min(safePage * PAGE_SIZE, filtered.length);

  return (
    <div className="animate-fade-in w-full min-w-0">
      <div className="mb-6">
        <h2 className="font-display text-xl md:text-2xl font-bold text-on-surface">問卷管理中心</h2>
        <p className="text-on-surfaceVariant text-sm mt-1">
          管理「{courseName}」的學生意見反饋與調查。
        </p>
      </div>

      {isArchived && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-4">
          <span className="font-bold mr-2">提示：</span>
          此課程已封存，您只能查看問卷，無法新增或修改。
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-surface-containerLowest rounded-xl p-5 shadow-sm border border-outline-variant/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-bl-full -mr-2 -mt-2" />
          <div className="flex items-center gap-3 mb-3 relative">
            <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
              <DocumentTextIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-on-surfaceVariant">問卷總數</span>
          </div>
          <div className="font-mono text-3xl font-bold text-on-surface relative">{surveys.length}</div>
        </div>
        <div className="bg-surface-containerLowest rounded-xl p-5 shadow-sm border border-outline-variant/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-secondary/10 rounded-bl-full -mr-2 -mt-2" />
          <div className="flex items-center gap-3 mb-3 relative">
            <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
              <UserGroupIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-on-surfaceVariant">進行中</span>
          </div>
          <div className="font-mono text-3xl font-bold text-on-surface relative">{activeCount}</div>
        </div>
        <div className="bg-surface-containerLowest rounded-xl p-5 shadow-sm border border-outline-variant/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-20 h-20 bg-tertiary/10 rounded-bl-full -mr-2 -mt-2" />
          <div className="flex items-center gap-3 mb-3 relative">
            <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-tertiary">
              <ArrowTrendingUpIcon className="w-5 h-5" />
            </div>
            <span className="text-sm text-on-surfaceVariant">草稿</span>
          </div>
          <div className="font-mono text-3xl font-bold text-on-surface relative">{draftCount}</div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="搜尋問卷名稱…"
              className="w-full pl-10 pr-4 py-2 bg-surface-containerLowest border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as StatusFilter);
              setPage(1);
            }}
            className="px-4 py-2 bg-surface-containerLowest border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="all">所有狀態</option>
            <option value="active">進行中</option>
            <option value="ended">已結束</option>
            <option value="draft">草稿</option>
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-4 py-2 bg-surface-containerLowest border border-outline-variant rounded-lg text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none hidden md:block"
          >
            <option value="order">課程順序</option>
            <option value="recent">最新編輯</option>
            <option value="oldest">最舊建立</option>
          </select>
        </div>
        {!isArchived && (
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            {orderSaving ? (
              <p className="text-sm text-on-surfaceVariant mr-auto md:mr-2">正在儲存順序…</p>
            ) : null}
            <button
              type="button"
              onClick={onCopyFromOther}
              disabled={orderSaving || loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-primary text-primary text-sm font-semibold hover:bg-primary/5 disabled:opacity-50"
            >
              <DocumentDuplicateIcon className="w-5 h-5" />
              從其他班複製
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={orderSaving}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:bg-primary-container disabled:opacity-50"
            >
              <PlusIcon className="w-5 h-5" />
              建立新問卷
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="min-h-[280px] flex items-center justify-center">
          <PageLoadingArea />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center min-h-[240px] flex flex-col items-center justify-center bg-surface-containerLowest rounded-xl border-2 border-dashed border-outline-variant/50">
          <ClipboardDocumentListIcon className="w-12 h-12 mb-3 text-outline-variant" />
          <p className="text-on-surfaceVariant font-medium">
            {surveys.length === 0 ? '此課程尚無關聯的課程問卷' : '沒有符合條件的問卷'}
          </p>
          {!isArchived && surveys.length === 0 && (
            <button
              type="button"
              onClick={onCreate}
              className="mt-4 inline-flex items-center gap-1 text-primary font-semibold text-sm hover:underline"
            >
              <PlusIcon className="w-4 h-4" />
              建立第一則問卷
            </button>
          )}
        </div>
      ) : (
        <div className="bg-surface-containerLowest rounded-xl shadow-sm border border-outline-variant/40 overflow-hidden">
          <div className="overflow-x-auto">
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="course-survey-list" isDropDisabled={!canDrag}>
                {(provided: DroppableProvided) => (
                  <table className="w-full text-left border-collapse min-w-[720px]">
                    <thead className="bg-surface-containerLow border-b border-outline-variant/40">
                      <tr className="font-mono text-[11px] uppercase tracking-wider text-on-surfaceVariant">
                        <th className="px-4 py-4 font-semibold w-8" />
                        <th className="px-4 py-4 font-semibold">問卷名稱</th>
                        <th className="px-4 py-4 font-semibold w-32">狀態</th>
                        <th className="px-4 py-4 font-semibold w-28">回收份數</th>
                        <th className="px-4 py-4 font-semibold w-32">建立日期</th>
                        <th className="px-4 py-4 font-semibold w-36 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="divide-y divide-outline-variant/30"
                    >
                      {pageRows.map((survey, idx) => {
                        const status = surveyListStatus(survey);
                        const preview = (survey.description || '').trim();
                        return (
                          <Draggable
                            key={survey.id}
                            draggableId={survey.id}
                            index={idx}
                            isDragDisabled={!canDrag}
                          >
                            {(dragProvided: DraggableProvided) => (
                              <tr
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                style={fixDraggableStyle(dragProvided.draggableProps.style)}
                                className="hover:bg-surface-containerLow/40 transition-colors group"
                              >
                                <td className="px-2 py-4 align-middle">
                                  {canDrag ? (
                                    <button
                                      type="button"
                                      className="cursor-move text-outline hover:text-on-surfaceVariant p-1"
                                      {...dragProvided.dragHandleProps}
                                      title="拖曳排序"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Bars3Icon className="w-5 h-5" />
                                    </button>
                                  ) : (
                                    <span className="hidden" {...dragProvided.dragHandleProps} />
                                  )}
                                </td>
                                <td className="px-4 py-4">
                                  <button
                                    type="button"
                                    onClick={() => onEdit(survey)}
                                    className="text-left w-full"
                                    disabled={orderSaving}
                                  >
                                    <div className="font-semibold text-on-surface group-hover:text-primary transition-colors">
                                      {survey.title || '未命名問卷'}
                                    </div>
                                    <div className="text-on-surfaceVariant text-sm mt-0.5 line-clamp-1">
                                      {preview ||
                                        `${formatSurveyResponseMode(survey.responseMode)} · ${survey.surveyCode}`}
                                    </div>
                                  </button>
                                </td>
                                <td className="px-4 py-4">
                                  <StatusBadge status={status} />
                                </td>
                                <td className="px-4 py-4 text-outline font-mono text-sm">—</td>
                                <td className="px-4 py-4 text-on-surfaceVariant text-sm">
                                  {formatCreatedDate(survey.createdAt)}
                                </td>
                                <td className="px-4 py-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onEdit(survey)}
                                      disabled={orderSaving}
                                      className="w-8 h-8 rounded-lg hover:bg-surface-container text-on-surfaceVariant hover:text-primary transition-colors flex items-center justify-center disabled:opacity-40"
                                      title="編輯"
                                    >
                                      <PencilSquareIcon className="w-5 h-5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onAnalytics(survey)}
                                      disabled={orderSaving || status === 'draft'}
                                      className="w-8 h-8 rounded-lg hover:bg-surface-container text-on-surfaceVariant hover:text-primary transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                                      title={status === 'draft' ? '草稿無數據' : '數據分析'}
                                    >
                                      <ChartBarIcon className="w-5 h-5" />
                                    </button>
                                    {!isArchived && (
                                      <button
                                        type="button"
                                        onClick={() => onDelete(survey)}
                                        disabled={orderSaving || !canDeleteSurvey(survey)}
                                        className="w-8 h-8 rounded-lg hover:bg-error-container/50 text-on-surfaceVariant hover:text-error transition-colors flex items-center justify-center disabled:opacity-40"
                                        title={
                                          canDeleteSurvey(survey)
                                            ? '刪除'
                                            : '僅建立者可刪除問卷'
                                        }
                                      >
                                        <TrashIcon className="w-5 h-5" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </tbody>
                  </table>
                )}
              </Droppable>
            </DragDropContext>
          </div>
          {!canDrag && (
            <div className="border-t border-outline-variant/40 px-6 py-4 flex items-center justify-between text-sm">
              <span className="text-on-surfaceVariant">
                顯示 {displayFrom} 至 {displayTo} 筆，共 {filtered.length} 筆
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant text-outline disabled:opacity-40"
                >
                  <ChevronLeftIcon className="w-5 h-5" />
                </button>
                <span className="w-8 h-8 flex items-center justify-center rounded-lg bg-primary-container text-on-primary font-semibold text-sm">
                  {safePage}
                </span>
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant text-outline disabled:opacity-40"
                >
                  <ChevronRightIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
