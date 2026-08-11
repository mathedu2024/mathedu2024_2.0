'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardDocumentCheckIcon,
} from '@heroicons/react/24/outline';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import TabNav from '@/components/ui/TabNav';
import { useStudentInfo } from '../StudentInfoContext';
import { useHydrated } from '@/utils/useHydrated';
import {
  fetchStudentExamList,
  type StudentExamListItem,
} from '@/utils/studentClientApi';
import { ATTEMPT_SCORE_POLICY_OPTIONS } from '@/services/quizTypes';
import { canStartExamTake } from '@/utils/examDraftStorage';
import {
  buildStudentCourseExamsUrl,
  buildStudentExamStartUrl,
} from '@/utils/examAttemptLabel';
import { showExamTakeBlockedAlert } from '@/utils/examTakeAlerts';
import { courseHubFeatureListStyles } from '@/components/CourseHubTabNav';

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
  const router = useRouter();

  const isRetake = exam.submitted && exam.canRetake;
  const examsBackHref =
    exam.assignedCourses?.[0]?.courseId
      ? buildStudentCourseExamsUrl(exam.assignedCourses[0].courseId)
      : '/student/exam';

  const openStartPage = async () => {
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
    router.push(
      buildStudentExamStartUrl(exam.quizCode, {
        mode: isRetake ? 'retake' : 'start',
        from: examsBackHref,
      })
    );
  };

  return (
    <button
      type="button"
      onClick={() => void openStartPage()}
      className={courseHubFeatureListStyles.row}
    >
      <h2 className="font-bold text-on-surface truncate group-hover:text-primary transition-colors">
        {exam.title}
      </h2>
      {isActiveTab ? (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-surfaceVariant mt-1">
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
                <span className="text-on-surfaceVariant font-normal"> · 成績尚未公布</span>
              )}
              {!exam.attemptUnlimited && exam.maxAttempts != null && exam.maxAttempts > 1 && (
                <span className="text-on-surfaceVariant font-normal">
                  {' '}
                  （已作答 {exam.submissionCount ?? 0} / {exam.maxAttempts} 次）
                </span>
              )}
            </p>
          )}
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-on-surfaceVariant mt-1">
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
                <span className="text-on-surfaceVariant font-normal"> · 成績尚未公布</span>
              )}
              {exam.multipleAttempts && (exam.submissionCount ?? 0) > 1 && (
                <span className="text-on-surfaceVariant font-normal">
                  {' '}
                  · 採計：{formatScorePolicyLabel(exam.scorePolicy)}
                </span>
              )}
              {!exam.attemptUnlimited && exam.maxAttempts != null && exam.maxAttempts > 1 && (
                <span className="text-on-surfaceVariant font-normal">
                  {' '}
                  （已作答 {exam.submissionCount ?? 0} / {exam.maxAttempts} 次）
                </span>
              )}
            </p>
          )}
          {exam.windowEnded && !exam.submitted && (
            <p className="text-sm text-on-surfaceVariant mt-2">作答期間已截止，尚未提交</p>
          )}
        </>
      )}
      {isActiveTab && !exam.accessible && !exam.submitted && exam.inaccessibleReason && (
        <p className="text-sm text-amber-700 mt-2">{exam.inaccessibleReason}</p>
      )}
    </button>
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
      <div className="border-l-4 border-primary pl-4 mb-8">
        <h1 className="font-display text-2xl font-extrabold text-on-surface flex items-center gap-3">
          <ClipboardDocumentCheckIcon className="h-8 w-8 text-primary" />
          線上測驗
        </h1>
        <p className="text-on-surfaceVariant text-sm mt-1">
          查看適用於您班級的測驗；點擊標題進入測驗資訊頁。
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
                    <span className="ml-2 text-xs font-bold text-primary">({activeExams.length})</span>
                  </>
                ),
              },
              {
                id: 'ended',
                label: (
                  <>
                    已截止
                    <span className="ml-2 text-xs font-bold text-primary">({endedExams.length})</span>
                  </>
                ),
              },
            ]}
            activeId={tab}
            onChange={(id) => setTab(id as 'active' | 'ended')}
          />

          <p className="text-sm text-on-surfaceVariant mb-4">
            {tab === 'active'
              ? '尚未截止的測驗，可開始或繼續作答。'
              : '作答期間已結束的測驗。'}
          </p>

          {visibleExams.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-outline-variant/40">
              <ClipboardDocumentCheckIcon className="w-10 h-10 mx-auto text-outline mb-3" />
              <p className="text-sm text-on-surfaceVariant">{emptyText}</p>
            </div>
          ) : (
            <div className={courseHubFeatureListStyles.shell}>
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
