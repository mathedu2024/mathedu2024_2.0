'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import Dropdown from './ui/Dropdown';
import PageLoadingArea from './ui/PageLoadingArea';
import Swal from '@/utils/swalTheme';
import type { Quiz } from '@/services/quizTypes';
import type { QuizSubmission } from '@/services/quizSubmissionTypes';
import {
  filterQuizzesForCourse,
  getQuizEndDateInput,
  findNextEmptyRegularColumnIndex,
  buildImportPreview,
  PERIODIC_KEY_OPTIONS,
  type GradeImportTarget,
} from '@/services/gradeQuizImport';

type RegularType = '小考' | '作業' | '上課態度';

const regularTypeOptions = [
  { value: '小考', label: '小考' },
  { value: '作業', label: '作業' },
  { value: '上課態度', label: '上課態度' },
];

interface ColumnDetail {
  type: RegularType;
  name: string;
  date: string;
  maxScore?: number;
}

interface PeriodicColumnMeta {
  name: string;
  date: string;
  type: string;
  maxScore?: number;
}

interface StudentGradeRow {
  id: string;
  studentId: string;
  name: string;
}

interface GradeImportModalProps {
  open: boolean;
  onClose: () => void;
  courseId: string;
  teacherId: string;
  students: StudentGradeRow[];
  columnDetails: Record<string, ColumnDetail>;
  regularColumns: number;
  onImportRegular: (params: {
    columnIndex: number;
    columnDetail: ColumnDetail;
    scoresByStudentId: Record<string, number>;
  }) => void;
  onImportPeriodic: (params: {
    periodicKey: string;
    columnMeta: PeriodicColumnMeta;
    scoresByStudentId: Record<string, number>;
  }) => void;
}

export default function GradeImportModal({
  open,
  onClose,
  courseId,
  teacherId,
  students,
  columnDetails,
  regularColumns,
  onImportRegular,
  onImportPeriodic,
}: GradeImportModalProps) {
  const [mounted, setMounted] = useState(false);
  const [importTarget, setImportTarget] = useState<GradeImportTarget>('regular');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);

  // 平時成績設定
  const [regularName, setRegularName] = useState('');
  const [regularDate, setRegularDate] = useState('');
  const [regularType, setRegularType] = useState<RegularType>('小考');
  const [regularMaxScore, setRegularMaxScore] = useState(100);

  // 定期評量設定
  const [periodicKey, setPeriodicKey] = useState('');
  const [periodicDate, setPeriodicDate] = useState('');
  const [periodicMaxScore, setPeriodicMaxScore] = useState(100);
  const [markNoSubmissionAsZero, setMarkNoSubmissionAsZero] = useState(false);

  const selectedQuiz = useMemo(
    () => quizzes.find((q) => q.id === selectedQuizId) ?? null,
    [quizzes, selectedQuizId]
  );

  const targetMaxScore = importTarget === 'regular' ? regularMaxScore : periodicMaxScore;

  const preview = useMemo(() => {
    if (!selectedQuiz || submissionsLoading) return null;
    return buildImportPreview(students, submissions, selectedQuiz, targetMaxScore);
  }, [selectedQuiz, submissions, students, targetMaxScore, submissionsLoading]);

  const nextRegularColumnIndex = useMemo(
    () => findNextEmptyRegularColumnIndex(columnDetails, regularColumns),
    [columnDetails, regularColumns]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const resetForm = useCallback(() => {
    setImportTarget('regular');
    setSelectedQuizId('');
    setSubmissions([]);
    setRegularName('');
    setRegularDate('');
    setRegularType('小考');
    setRegularMaxScore(100);
    setPeriodicKey('');
    setPeriodicDate('');
    setPeriodicMaxScore(100);
    setMarkNoSubmissionAsZero(false);
  }, []);

  useEffect(() => {
    if (!open) {
      resetForm();
      return;
    }
    if (!teacherId || !courseId) return;

    let cancelled = false;
    setQuizzesLoading(true);
    fetch('/api/quizzes/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) {
          setQuizzes(filterQuizzesForCourse(data.quizzes ?? [], courseId));
        }
      })
      .catch(() => {
        if (!cancelled) setQuizzes([]);
      })
      .finally(() => {
        if (!cancelled) setQuizzesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, teacherId, courseId, resetForm]);

  useEffect(() => {
    if (!selectedQuizId || !teacherId) {
      setSubmissions([]);
      return;
    }

    let cancelled = false;
    setSubmissionsLoading(true);
    fetch('/api/quiz-submissions/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId: selectedQuizId, teacherId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSubmissions(data.submissions ?? []);
      })
      .catch(() => {
        if (!cancelled) setSubmissions([]);
      })
      .finally(() => {
        if (!cancelled) setSubmissionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedQuizId, teacherId]);

  useEffect(() => {
    if (!selectedQuiz) return;
    const endDate = getQuizEndDateInput(selectedQuiz);
    const maxScore = selectedQuiz.totalPoints || 100;
    setRegularName(selectedQuiz.title);
    setRegularDate(endDate);
    setRegularMaxScore(maxScore);
    setPeriodicDate(endDate);
    setPeriodicMaxScore(maxScore);
  }, [selectedQuiz]);

  const quizOptions = useMemo(
    () =>
      quizzes.map((q) => ({
        value: q.id,
        label: `${q.title}（${q.totalPoints} 分）`,
      })),
    [quizzes]
  );

  const importableCount = useMemo(() => {
    if (!preview) return 0;
    return (
      preview.matchedCount +
      (markNoSubmissionAsZero ? preview.noSubmissionCount : 0)
    );
  }, [preview, markNoSubmissionAsZero]);

  const handleImport = () => {
    if (!selectedQuiz || !preview) return;

    if (importableCount === 0) {
      Swal.fire({
        icon: 'warning',
        title: '無可匯入成績',
        text: '沒有任何學生的測驗成績可對應到此課程學號。',
        confirmButtonColor: '#2D6DF6',
        customClass: { popup: 'rounded-2xl' },
      });
      return;
    }

    const scoresByStudentId: Record<string, number> = {};
    for (const row of preview.rows) {
      if (row.status === 'matched') {
        scoresByStudentId[row.studentId] = row.gradeScore;
      } else if (markNoSubmissionAsZero && row.status === 'no_submission') {
        scoresByStudentId[row.studentId] = 0;
      }
    }

    if (importTarget === 'regular') {
      if (!regularName.trim()) {
        Swal.fire({ icon: 'warning', title: '請輸入項目名稱', confirmButtonColor: '#2D6DF6' });
        return;
      }
      if (!regularDate.trim()) {
        Swal.fire({ icon: 'warning', title: '請設定日期', confirmButtonColor: '#2D6DF6' });
        return;
      }

      onImportRegular({
        columnIndex: nextRegularColumnIndex,
        columnDetail: {
          type: regularType,
          name: regularName.trim(),
          date: regularDate,
          maxScore: regularMaxScore,
        },
        scoresByStudentId,
      });
    } else {
      if (!periodicKey) {
        Swal.fire({ icon: 'warning', title: '請選擇要匯入的定期評量', confirmButtonColor: '#2D6DF6' });
        return;
      }
      if (!periodicDate.trim()) {
        Swal.fire({ icon: 'warning', title: '請設定日期', confirmButtonColor: '#2D6DF6' });
        return;
      }

      onImportPeriodic({
        periodicKey,
        columnMeta: {
          name: periodicKey,
          date: periodicDate,
          type: '定期評量',
          maxScore: periodicMaxScore,
        },
        scoresByStudentId,
      });
    }

    const zeroMarkedCount = markNoSubmissionAsZero ? preview.noSubmissionCount : 0;
    const skippedCount = markNoSubmissionAsZero ? 0 : preview.noSubmissionCount;

    Swal.fire({
      icon: 'success',
      title: '匯入成功',
      html: `已匯入 <b>${importableCount}</b> 位學生成績${
        zeroMarkedCount > 0
          ? `<br><span class="text-sm text-gray-500">（其中 ${zeroMarkedCount} 位未繳交，已登記為 0 分）</span>`
          : ''
      }${
        skippedCount > 0
          ? `<br><span class="text-sm text-gray-500">（${skippedCount} 位學生無測驗紀錄，已略過）</span>`
          : ''
      }`,
      confirmButtonColor: '#2D6DF6',
      customClass: { popup: 'rounded-2xl' },
    });
    onClose();
  };

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[99999] flex justify-center items-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-full sm:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-primary to-tertiary p-4 flex justify-between items-center text-white shrink-0">
          <h3 className="font-bold flex items-center gap-2">
            <ArrowDownTrayIcon className="w-5 h-5 rotate-180" />
            匯入線上測驗成績
          </h3>
          <button type="button" onClick={onClose} className="text-white/80 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar space-y-6">
          {/* 匯入類型 */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">匯入至</label>
            <div className="flex gap-3">
              {([
                ['regular', '平時成績'],
                ['periodic', '定期評量'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setImportTarget(value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                    importTarget === value
                      ? 'bg-primary text-white border-primary shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 選擇測驗 */}
          <div>
            <label className="text-sm font-bold text-gray-700 mb-2 block">選擇線上測驗</label>
            {quizzesLoading ? (
              <PageLoadingArea minHeight="min-h-[4rem]" />
            ) : quizzes.length === 0 ? (
              <p className="text-sm text-gray-500 bg-gray-50 rounded-xl p-4 border border-dashed border-gray-200">
                此課程尚無已開放的線上測驗。請先在測驗管理中建立並開放測驗，並指定適用班級。
              </p>
            ) : (
              <Dropdown
                value={selectedQuizId}
                onChange={setSelectedQuizId}
                options={quizOptions}
                placeholder="請選擇要匯入的測驗"
                className="w-full"
              />
            )}
          </div>

          {selectedQuiz && (
            <>
              {submissionsLoading ? (
                <PageLoadingArea minHeight="min-h-[6rem]" />
              ) : (
                <>
                  {/* 平時成績項目設定 */}
                  {importTarget === 'regular' && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-4">
                      <h4 className="text-sm font-bold text-gray-800">
                        平時成績項目設定
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="sm:col-span-2">
                          <label className="text-xs text-gray-500">項目名稱</label>
                          <input
                            type="text"
                            className="w-full border rounded-lg p-2 mt-1"
                            value={regularName}
                            onChange={(e) => setRegularName(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">日期</label>
                          <input
                            type="date"
                            className="w-full border rounded-lg p-2 mt-1"
                            value={regularDate}
                            onChange={(e) => setRegularDate(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500">滿分</label>
                          <input
                            type="number"
                            className="w-full border rounded-lg p-2 mt-1 bg-gray-100 text-gray-600 cursor-not-allowed"
                            value={regularMaxScore}
                            readOnly
                            disabled
                          />
                          <p className="text-xs text-gray-400 mt-1">取自測驗總分</p>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs text-gray-500">成績類別</label>
                          <div className="mt-1">
                            <Dropdown
                              value={regularType}
                              onChange={(v) => setRegularType(v as RegularType)}
                              options={regularTypeOptions}
                              placeholder="選擇成績類別"
                              className="w-full"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 定期評量項目設定 */}
                  {importTarget === 'periodic' && (
                    <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-4">
                      <h4 className="text-sm font-bold text-gray-800">定期評量項目設定</h4>
                      <div>
                        <label className="text-xs text-gray-500">選擇定期評量</label>
                        <div className="mt-1">
                          <Dropdown
                            value={periodicKey}
                            onChange={setPeriodicKey}
                            options={PERIODIC_KEY_OPTIONS}
                            placeholder="請選擇要匯入的定期評量"
                            className="w-full"
                          />
                        </div>
                      </div>
                      {periodicKey && (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="sm:col-span-3">
                            <label className="text-xs text-gray-500">評量名稱（固定）</label>
                            <div className="mt-1 px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-bold text-gray-800">
                              {periodicKey}
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">日期</label>
                            <input
                              type="date"
                              className="w-full border rounded-lg p-2 mt-1"
                              value={periodicDate}
                              onChange={(e) => setPeriodicDate(e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">成績類別</label>
                            <input
                              type="text"
                              className="w-full border rounded-lg p-2 mt-1 bg-gray-100 text-gray-500 cursor-not-allowed"
                              value="定期評量"
                              readOnly
                              disabled
                            />
                          </div>
                          <div>
                            <label className="text-xs text-gray-500">滿分</label>
                            <input
                              type="number"
                              className="w-full border rounded-lg p-2 mt-1"
                              value={periodicMaxScore}
                              onChange={(e) => setPeriodicMaxScore(Number(e.target.value) || 100)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 預覽 */}
                  {preview && (
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-primary/10 px-4 py-3 flex flex-wrap gap-4 text-sm">
                        <span>
                          可匯入：<b className="text-primary">{importableCount}</b> 人
                        </span>
                        {preview.matchedCount > 0 && (
                          <span className="text-primary">
                            已繳交：{preview.matchedCount} 人
                          </span>
                        )}
                        {preview.noSubmissionCount > 0 && (
                          <span className="text-amber-700">
                            未繳交：{preview.noSubmissionCount} 人
                          </span>
                        )}
                        <span className="text-gray-500">
                          測驗滿分 {preview.quizMaxScore} 分
                        </span>
                      </div>
                      {preview.noSubmissionCount > 0 && (
                        <label className="flex items-start gap-2 px-4 py-3 bg-amber-50 border-b border-amber-100 text-sm cursor-pointer">
                          <input
                            type="checkbox"
                            className="mt-0.5 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={markNoSubmissionAsZero}
                            onChange={(e) => setMarkNoSubmissionAsZero(e.target.checked)}
                          />
                          <span>
                            <span className="font-medium text-amber-900">將未繳交的同學登記為 0 分</span>
                            <span className="block text-xs text-amber-700 mt-0.5">
                              勾選後，{preview.noSubmissionCount} 位未繳交學生將一併匯入並記為 0 分
                            </span>
                          </span>
                        </label>
                      )}
                      <div className="max-h-48 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-xs text-gray-500 uppercase sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left">學號</th>
                              <th className="px-4 py-2 text-left">姓名</th>
                              <th className="px-4 py-2 text-right">測驗分數</th>
                              <th className="px-4 py-2 text-right">匯入分數</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {preview.rows
                              .filter(
                                (r) =>
                                  r.status === 'matched' ||
                                  (markNoSubmissionAsZero && r.status === 'no_submission')
                              )
                              .map((row) => (
                                <tr
                                  key={row.studentId}
                                  className={row.status === 'no_submission' ? 'bg-amber-50/50' : ''}
                                >
                                  <td className="px-4 py-2 font-mono">{row.studentId}</td>
                                  <td className="px-4 py-2">
                                    {row.name}
                                    {row.status === 'no_submission' && (
                                      <span className="ml-2 text-xs text-amber-700">未繳交</span>
                                    )}
                                  </td>
                                  <td className="px-4 py-2 text-right font-mono">
                                    {row.status === 'no_submission' ? '—' : row.quizScore}
                                  </td>
                                  <td
                                    className={`px-4 py-2 text-right font-mono font-semibold ${
                                      row.status === 'no_submission'
                                        ? 'text-amber-700'
                                        : 'text-primary'
                                    }`}
                                  >
                                    {row.gradeScore}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {importableCount === 0 && (
                          <p className="text-center text-sm text-gray-400 py-6">尚無可匯入的學生成績</p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={!selectedQuiz || submissionsLoading || !preview || importableCount === 0}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            確認匯入
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
