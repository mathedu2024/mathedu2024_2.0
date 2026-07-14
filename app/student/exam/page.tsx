'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardDocumentCheckIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import TabNav from '@/components/ui/TabNav';
import StudentExamAttemptPickerModal from '@/components/student-exam/StudentExamAttemptPickerModal';
import StudentExamStartModal from '@/components/student-exam/StudentExamStartModal';
import { useStudentInfo } from '../StudentInfoContext';
import { useHydrated } from '@/utils/useHydrated';
import {
  fetchStudentExamList,
  type StudentExamListItem,
} from '@/utils/studentClientApi';
import { ATTEMPT_SCORE_POLICY_OPTIONS } from '@/services/quizTypes';
import { canStartExamTake } from '@/utils/examDraftStorage';
import { openStudentExamReviewInNewTab } from '@/utils/examAttemptLabel';
import { showExamTakeBlockedAlert } from '@/utils/examTakeAlerts';

type ExamListTab = 'active' | 'ended';

function formatScorePolicyLabel(policy?: string): string {
  const opt = ATTEMPT_SCORE_POLICY_OPTIONS.find((o) => o.value === policy);
  return opt?.label ?? '以最後一次';
}

function ExamCard({
  exam,
  isActiveTab,
  studentId,
  resolveExamTitle,
}: {
  exam: StudentExamListItem;
  isActiveTab: boolean;
  studentId: string;
  resolveExamTitle: (quizCode: string) => string | undefined;
}) {
  const [startOpen, setStartOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const isRetake = exam.submitted && exam.canRetake;

  const openHistory = () => {
    if (exam.attempts && exam.attempts.length > 0) {
      setHistoryOpen(true);
      return;
    }
    if (exam.latestSubmissionId) {
      openStudentExamReviewInNewTab(exam.quizCode, { submissionId: exam.latestSubmissionId });
      return;
    }
    openStudentExamReviewInNewTab(exam.quizCode, { review: true });
  };

  const openStartModal = async () => {
    const check = canStartExamTake(studentId, exam.quizCode);
    if (!check.allowed) {
      const alertResult = await showExamTakeBlockedAlert(check, {
        blockingTitle: check.blockingQuizCode
          ? resolveExamTitle(check.blockingQuizCode)
          : undefined,
        studentId,
        targetQuizCode: exam.quizCode,
      });
      if (alertResult !== 'retry-allowed') return;
    }
    setStartOpen(true);
  };

  const canStart =
    isActiveTab && exam.accessible && (!exam.submitted || exam.canRetake);

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="font-bold text-gray-900 truncate">{exam.title}</h2>
          {isActiveTab ? (
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                <span>作答期間 {exam.answerWindowLabel}</span>
                <span>作答次數 {exam.attemptLimitLabel}</span>
              </div>
              {exam.submitted && (
                <p className="text-sm text-emerald-700 mt-2 font-medium">
                  {exam.multipleAttempts && (exam.submissionCount ?? 0) > 1 ? '採計成績' : '最近提交'}
                  {exam.resultsPublished ? (
                    <>
                      {' '}
                      · 得分 {exam.submissionScore ?? '—'} 分
                      {exam.submissionStatus === 'grading' && '（含待批改簡答）'}
                    </>
                  ) : (
                    <span className="text-gray-500 font-normal"> · 成績尚未公布</span>
                  )}
                  {!exam.attemptUnlimited && exam.maxAttempts != null && exam.maxAttempts > 1 && (
                    <span className="text-gray-500 font-normal">
                      {' '}
                      （已作答 {exam.submissionCount ?? 0} / {exam.maxAttempts} 次）
                    </span>
                  )}
                </p>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
                <span>總分 {exam.totalPoints}</span>
                <span>{exam.timeLimitLabel}</span>
                <span>作答期間 {exam.answerWindowLabel}</span>
                <span>作答次數 {exam.attemptLimitLabel}</span>
              </div>
              {exam.submitted && (
                <p className="text-sm text-emerald-700 mt-2 font-medium">
                  {exam.multipleAttempts && (exam.submissionCount ?? 0) > 1 ? '採計成績' : '最近提交'}
                  {exam.resultsPublished ? (
                    <>
                      {' '}
                      · 得分 {exam.submissionScore ?? '—'} 分
                      {exam.submissionStatus === 'grading' && '（含待批改簡答）'}
                    </>
                  ) : (
                    <span className="text-gray-500 font-normal"> · 成績尚未公布</span>
                  )}
                  {exam.multipleAttempts && (exam.submissionCount ?? 0) > 1 && (
                    <span className="text-gray-500 font-normal">
                      {' '}
                      · 採計：{formatScorePolicyLabel(exam.scorePolicy)}
                    </span>
                  )}
                  {!exam.attemptUnlimited && exam.maxAttempts != null && exam.maxAttempts > 1 && (
                    <span className="text-gray-500 font-normal">
                      {' '}
                      （已作答 {exam.submissionCount ?? 0} / {exam.maxAttempts} 次）
                    </span>
                  )}
                </p>
              )}
              {exam.windowEnded && !exam.submitted && (
                <p className="text-sm text-gray-500 mt-2">作答期間已截止，尚未提交</p>
              )}
            </>
          )}
          {isActiveTab && !exam.accessible && !exam.submitted && exam.inaccessibleReason && (
            <p className="text-sm text-amber-700 mt-2">{exam.inaccessibleReason}</p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto sm:min-w-[12rem]">
          {exam.submitted && (
            <button
              type="button"
              onClick={openHistory}
              className="inline-flex items-center justify-center px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
            >
              查看作答紀錄
            </button>
          )}
          {canStart ? (
            <button
              type="button"
              onClick={() => void openStartModal()}
              className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
            >
              {isRetake ? '再次作答' : '開始作答'}
              <ArrowRightIcon className="w-4 h-4 ml-1.5" />
            </button>
          ) : isActiveTab && !exam.submitted ? (
            <button
              type="button"
              disabled
              className="inline-flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg opacity-50 cursor-not-allowed"
            >
              無法作答
            </button>
          ) : null}
        </div>
      </div>

      {exam.submitted && (
        <StudentExamAttemptPickerModal
          open={historyOpen}
          onClose={() => setHistoryOpen(false)}
          quizCode={exam.quizCode}
          examTitle={exam.title}
          attempts={exam.attempts ?? []}
          resultsPublished={exam.resultsPublished}
        />
      )}

      {isActiveTab && (
        <StudentExamStartModal
          open={startOpen}
          onClose={() => setStartOpen(false)}
          exam={exam}
          studentId={studentId}
          mode={isRetake ? 'retake' : 'start'}
          resolveExamTitle={resolveExamTitle}
        />
      )}
    </>
  );
}

export default function StudentExamListPage() {
  const hydrated = useHydrated();
  const { studentInfo, loading: studentLoading } = useStudentInfo();
  const [exams, setExams] = useState<StudentExamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<ExamListTab>('active');

  useEffect(() => {
    const studentId = studentInfo?.id;
    if (!studentId) return;

    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const list = await fetchStudentExamList(studentId);
        if (!cancelled) setExams(list);
      } catch {
        if (!cancelled) setExams([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [studentInfo?.id]);

  const { activeExams, endedExams } = useMemo(() => {
    const active: StudentExamListItem[] = [];
    const ended: StudentExamListItem[] = [];
    for (const exam of exams) {
      if (exam.windowEnded) ended.push(exam);
      else active.push(exam);
    }
    return { activeExams: active, endedExams: ended };
  }, [exams]);

  const visibleExams = tab === 'active' ? activeExams : endedExams;
  const emptyText =
    tab === 'active' ? '目前沒有進行中的測驗' : '目前沒有已截止的測驗';
  const studentId = studentInfo?.id ?? '';

  const resolveExamTitle = useMemo(() => {
    const titleByCode = new Map(exams.map((e) => [e.quizCode, e.title]));
    return (quizCode: string) => titleByCode.get(quizCode);
  }, [exams]);

  if (!hydrated || studentLoading || !studentInfo) {
    return (
      <div className="page-shell w-full min-w-0 py-4 sm:py-6 md:py-8">
        <PageLoadingArea minHeight="min-h-[50vh]" />
      </div>
    );
  }

  return (
    <div className="page-shell w-full min-w-0 py-4 sm:py-6 md:py-8">
      <div className="border-l-4 border-indigo-500 pl-4 mb-8">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          <ClipboardDocumentCheckIcon className="h-8 w-8 text-indigo-600" />
          線上測驗
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          查看適用於您班級的測驗；開始作答將於新分頁開啟。
        </p>
      </div>

      {loading ? (
        <PageLoadingArea />
      ) : (
        <>
          <TabNav
            items={[
              {
                id: 'active',
                label: (
                  <>
                    進行中
                    <span className="ml-2 text-xs font-bold text-indigo-500">({activeExams.length})</span>
                  </>
                ),
              },
              {
                id: 'ended',
                label: (
                  <>
                    已截止
                    <span className="ml-2 text-xs font-bold text-indigo-500">({endedExams.length})</span>
                  </>
                ),
              },
            ]}
            activeId={tab}
            onChange={(id) => setTab(id as 'active' | 'ended')}
          />

          <p className="text-sm text-gray-500 mb-4">
            {tab === 'active'
              ? '尚未截止的測驗，可開始或繼續作答。'
              : '作答期間已結束的測驗。'}
          </p>

          {visibleExams.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200">
              <ClipboardDocumentCheckIcon className="w-10 h-10 mx-auto text-gray-300 mb-3" />
              <p className="text-sm text-gray-400">{emptyText}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleExams.map((exam) => (
                <ExamCard
                  key={exam.id}
                  exam={exam}
                  isActiveTab={tab === 'active'}
                  studentId={studentId}
                  resolveExamTitle={resolveExamTitle}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
