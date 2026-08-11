'use client';

import React, { useMemo, useState } from 'react';
import {
  ChartBarIcon,
  ClockIcon,
  CloudArrowUpIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
  type DroppableProvided,
  type DraggableProvided,
} from '@hello-pangea/dnd';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { fixDraggableStyle } from '@/utils/dndStyle';
import {
  type Quiz,
  getQuizAnswerWindowPhase,
  formatQuizExamDateLabel,
} from '@/services/quizTypes';
import { PageLoadingArea } from './ui';

type StatusFilter = 'all' | 'active' | 'draft' | 'completed';
type SortKey = 'order' | 'recent' | 'oldest';

function quizListStatus(quiz: Quiz): 'active' | 'draft' | 'completed' {
  if (quiz.status !== 'published') return 'draft';
  const phase = getQuizAnswerWindowPhase(quiz);
  if (phase === 'ended') return 'completed';
  return 'active';
}

function StatusBadge({ status }: { status: 'active' | 'draft' | 'completed' }) {
  if (status === 'active') {
    return (
      <span className="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-medium border border-secondary/20">
        進行中
      </span>
    );
  }
  if (status === 'completed') {
    return (
      <span className="px-3 py-1 rounded-full bg-surface-containerHigh text-on-surfaceVariant text-xs font-medium border border-outline-variant/50">
        已結束
      </span>
    );
  }
  return (
    <span className="px-3 py-1 rounded-full bg-surface text-outline text-xs font-medium border border-outline-variant border-dashed">
      草稿
    </span>
  );
}

function formatRelativeEdit(iso?: string): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return '剛剛';
  if (mins < 60) return `${mins} 分鐘前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} 天前`;
  return new Date(t).toLocaleDateString('zh-TW');
}

type Props = {
  courseName: string;
  quizzes: Quiz[];
  loading: boolean;
  isArchived: boolean;
  orderSaving: boolean;
  canDeleteQuiz: (quiz: Quiz) => boolean;
  onCreate: () => void;
  onCopyFromOther: () => void;
  onEdit: (quiz: Quiz) => void;
  onAnalytics: (quiz: Quiz) => void;
  onGrading: (quiz: Quiz) => void;
  onDelete: (quiz: Quiz) => void;
  onDragEnd: (result: DropResult) => void;
};

export default function TeacherExamList({
  courseName,
  quizzes,
  loading,
  isArchived,
  orderSaving,
  canDeleteQuiz,
  onCreate,
  onCopyFromOther,
  onEdit,
  onAnalytics,
  onGrading,
  onDelete,
  onDragEnd,
}: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('order');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = quizzes.filter((quiz) => {
      const st = quizListStatus(quiz);
      if (statusFilter !== 'all' && st !== statusFilter) return false;
      if (!q) return true;
      return (
        quiz.title.toLowerCase().includes(q) ||
        quiz.quizCode.toLowerCase().includes(q)
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
        .sort(
          (a, b) =>
            Date.parse(a.createdAt || '') - Date.parse(b.createdAt || '')
        );
    }
    return list;
  }, [quizzes, search, statusFilter, sortKey]);

  /** 搜尋／篩選／改排序時關閉拖曳，避免順序與顯示不一致 */
  const canDrag =
    !isArchived && !orderSaving && statusFilter === 'all' && !search.trim() && sortKey === 'order';

  const activeCount = useMemo(
    () => quizzes.filter((q) => quizListStatus(q) === 'active').length,
    [quizzes]
  );
  const publishedCount = useMemo(
    () => quizzes.filter((q) => q.status === 'published').length,
    [quizzes]
  );

  const recentActivity = useMemo(() => {
    return quizzes
      .slice()
      .sort(
        (a, b) =>
          Date.parse(b.updatedAt || b.createdAt || '') -
          Date.parse(a.updatedAt || a.createdAt || '')
      )
      .slice(0, 4)
      .map((quiz) => {
        const published = quiz.status === 'published';
        return {
          id: quiz.id,
          title: published
            ? `發布了「${quiz.title}」`
            : `編輯了「${quiz.title}」草稿`,
          when: formatRelativeEdit(quiz.updatedAt || quiz.createdAt),
          kind: published ? ('publish' as const) : ('edit' as const),
        };
      });
  }, [quizzes]);

  return (
    <div className="animate-fade-in w-full min-w-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="font-display text-xl md:text-2xl font-bold text-on-surface">測驗管理中心</h2>
          <p className="text-on-surfaceVariant text-sm mt-1">
            管理「{courseName}」的線上測驗，追蹤學生成效。
          </p>
        </div>
        {!isArchived && (
          <div className="flex gap-2 w-full md:w-auto">
            {orderSaving ? (
              <p className="text-sm text-on-surfaceVariant self-center mr-auto md:mr-2">正在儲存順序…</p>
            ) : null}
            <button
              type="button"
              onClick={onCopyFromOther}
              disabled={orderSaving || loading}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 border border-primary text-primary rounded-xl hover:bg-primary/5 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <DocumentDuplicateIcon className="w-4 h-4" />
              從其他班複製
            </button>
            <button
              type="button"
              onClick={onCreate}
              disabled={orderSaving}
              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-xl hover:bg-primary-container transition-colors shadow-sm text-sm font-medium disabled:opacity-50"
            >
              <PlusIcon className="w-4 h-4" />
              新增測驗
            </button>
          </div>
        )}
      </div>

      {isArchived && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-4">
          <span className="font-bold mr-2">提示：</span>
          此課程已封存，您只能查看測驗，無法新增或修改。
        </div>
      )}

      <div className="bg-surface-containerLowest rounded-xl p-4 shadow-sm mb-6 flex flex-col md:flex-row gap-3 border border-outline-variant/30">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜尋測驗名稱…"
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-outline-variant bg-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-4 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
          >
            <option value="all">所有狀態</option>
            <option value="active">進行中</option>
            <option value="draft">草稿</option>
            <option value="completed">已結束</option>
          </select>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="px-4 py-2 rounded-lg border border-outline-variant bg-surface text-on-surface text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none hidden md:block"
          >
            <option value="order">課程順序</option>
            <option value="recent">最新編輯</option>
            <option value="oldest">最舊建立</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[280px] flex items-center justify-center">
          <PageLoadingArea />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-3 min-w-0">
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-surface-containerLow rounded-lg text-sm font-medium text-on-surfaceVariant">
              <div className="col-span-5">測驗名稱</div>
              <div className="col-span-2 text-center">狀態</div>
              <div className="col-span-2 text-center">受測人數</div>
              <div className="col-span-1 text-center">平均分</div>
              <div className="col-span-2 text-right">操作</div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center min-h-[240px] flex flex-col items-center justify-center bg-surface-containerLowest rounded-xl border-2 border-dashed border-outline-variant/50">
                <DocumentTextIcon className="w-12 h-12 mb-3 text-outline-variant" />
                <p className="text-on-surfaceVariant font-medium">
                  {quizzes.length === 0 ? '此課程尚無關聯的線上測驗' : '沒有符合條件的測驗'}
                </p>
                {!isArchived && quizzes.length === 0 && (
                  <button
                    type="button"
                    onClick={onCreate}
                    className="mt-4 inline-flex items-center gap-1 text-primary font-semibold text-sm hover:underline"
                  >
                    <PlusIcon className="w-4 h-4" />
                    新增第一則測驗
                  </button>
                )}
              </div>
            ) : (
              <DragDropContext onDragEnd={onDragEnd}>
                <Droppable droppableId="course-exam-list" isDropDisabled={!canDrag}>
                  {(provided: DroppableProvided) => (
                    <div className="flex flex-col gap-3" ref={provided.innerRef} {...provided.droppableProps}>
                      {filtered.map((quiz, idx) => {
                        const status = quizListStatus(quiz);
                        const dateLabel =
                          status === 'draft'
                            ? `最後編輯: ${formatRelativeEdit(quiz.updatedAt || quiz.createdAt)}`
                            : formatQuizExamDateLabel(quiz);
                        return (
                          <Draggable
                            key={quiz.id}
                            draggableId={quiz.id}
                            index={idx}
                            isDragDisabled={!canDrag}
                          >
                            {(dragProvided: DraggableProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                style={fixDraggableStyle(dragProvided.draggableProps.style)}
                                className={`group grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-5 md:p-6 bg-surface-containerLowest rounded-xl shadow-sm hover:shadow-md border border-outline-variant/20 transition-all relative overflow-hidden ${
                                  status === 'draft' ? 'opacity-80 hover:opacity-100' : ''
                                }`}
                              >
                                <div
                                  className={`absolute left-0 top-0 bottom-0 w-1 hidden group-hover:block ${
                                    status === 'active'
                                      ? 'bg-secondary'
                                      : status === 'draft'
                                        ? 'bg-outline-variant'
                                        : 'bg-primary/40'
                                  }`}
                                />
                                <div className="col-span-5 flex gap-2 min-w-0">
                                  {canDrag ? (
                                    <button
                                      type="button"
                                      className="cursor-move text-outline hover:text-on-surfaceVariant shrink-0 mt-1"
                                      {...dragProvided.dragHandleProps}
                                      title="拖曳排序"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Bars3Icon className="w-5 h-5" />
                                    </button>
                                  ) : (
                                    <span className="hidden" {...dragProvided.dragHandleProps} />
                                  )}
                                  <div className="flex flex-col gap-1 min-w-0">
                                    <span className="text-xs text-outline font-mono tracking-wider">
                                      {quiz.quizCode}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => onEdit(quiz)}
                                      className="text-left font-medium text-on-surface hover:text-primary line-clamp-2"
                                      disabled={orderSaving}
                                    >
                                      {quiz.title || '未命名測驗'}
                                    </button>
                                    <p className="text-xs text-on-surfaceVariant flex items-center gap-1 mt-0.5">
                                      <ClockIcon className="w-3.5 h-3.5 shrink-0" />
                                      <span className="truncate">{dateLabel}</span>
                                    </p>
                                  </div>
                                </div>
                                <div className="col-span-2 flex justify-start md:justify-center">
                                  <StatusBadge status={status} />
                                </div>
                                <div className="col-span-2 flex justify-start md:justify-center items-center gap-2">
                                  <UserGroupIcon className="w-4 h-4 text-outline" />
                                  <span className="text-sm font-medium text-outline">—</span>
                                </div>
                                <div className="col-span-1 flex justify-start md:justify-center">
                                  <span className="text-sm font-bold text-outline">—</span>
                                </div>
                                <div className="col-span-2 flex justify-end gap-1 mt-2 md:mt-0">
                                  <button
                                    type="button"
                                    onClick={() => onEdit(quiz)}
                                    className="p-2 text-on-surfaceVariant hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                                    title="編輯"
                                    disabled={orderSaving}
                                  >
                                    <PencilSquareIcon className="w-5 h-5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onAnalytics(quiz)}
                                    disabled={orderSaving || status === 'draft'}
                                    className="p-2 text-on-surfaceVariant hover:text-tertiary hover:bg-tertiary/5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    title={status === 'draft' ? '草稿無法分析' : '分析'}
                                  >
                                    <ChartBarIcon className="w-5 h-5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => onGrading(quiz)}
                                    disabled={orderSaving || status === 'draft'}
                                    className="p-2 text-on-surfaceVariant hover:text-secondary hover:bg-secondary/5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold px-2"
                                    title="批改"
                                  >
                                    批改
                                  </button>
                                  {!isArchived && (
                                    <button
                                      type="button"
                                      onClick={() => onDelete(quiz)}
                                      disabled={orderSaving || !canDeleteQuiz(quiz)}
                                      className="p-2 text-on-surfaceVariant hover:text-error hover:bg-error/5 rounded-lg transition-colors disabled:opacity-40"
                                      title={
                                        canDeleteQuiz(quiz) ? '刪除' : '僅建立者可刪除測驗'
                                      }
                                    >
                                      <TrashIcon className="w-5 h-5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            )}
          </div>

          <div className="lg:col-span-1 flex flex-col gap-5">
            <div className="bg-primary text-on-primary rounded-xl p-6 shadow-md relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2 relative">
                <ChartBarIcon className="w-5 h-5" />
                本課程測驗概況
              </h3>
              <div className="grid grid-cols-2 gap-4 relative">
                <div>
                  <p className="text-sm opacity-80 mb-1">活躍測驗</p>
                  <p className="font-mono text-3xl font-bold">{activeCount}</p>
                </div>
                <div>
                  <p className="text-sm opacity-80 mb-1">已開放</p>
                  <p className="font-mono text-3xl font-bold">{publishedCount}</p>
                </div>
              </div>
            </div>

            <div className="bg-surface-containerLowest border border-outline-variant/30 rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-on-surface mb-4 flex items-center gap-2">
                <ClockIcon className="w-5 h-5 text-primary" />
                最近動態
              </h3>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-on-surfaceVariant">尚無動態</p>
              ) : (
                <div className="flex flex-col gap-4">
                  {recentActivity.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-3 items-start pb-4 border-b border-outline-variant/20 last:border-0 last:pb-0"
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                          item.kind === 'publish' ? 'bg-secondary/10 text-secondary' : 'bg-primary/10 text-primary'
                        }`}
                      >
                        {item.kind === 'publish' ? (
                          <CloudArrowUpIcon className="w-4 h-4" />
                        ) : (
                          <DocumentTextIcon className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-on-surface font-medium line-clamp-2">{item.title}</p>
                        <p className="text-xs text-on-surfaceVariant mt-1">{item.when}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
