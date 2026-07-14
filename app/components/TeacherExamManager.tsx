'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ClipboardDocumentCheckIcon,
  PlusIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import Swal from '@/utils/swalTheme';
import PageLoadingArea from './ui/PageLoadingArea';
import BackButton from './ui/BackButton';
import Dropdown from './ui/Dropdown';
import { btnStyles, btnWithIconStyle, tableActionStyles, tableActionRow } from './ui';
import QuizBuilder from './quiz/QuizBuilder';
import QuizGradingPanel from './quiz/QuizGradingPanel';
import QuizAnalyticsPanel from './quiz/QuizAnalyticsPanel';
import type { Course } from './TeacherCourseManager';
import type { Quiz } from '@/services/quizTypes';
import {
  ensureQuizSections,
  createEmptySection,
  generateQuizCode,
  formatQuizExamDateLabel,
} from '@/services/quizTypes';
import {
  fetchTeacherQuizzes,
  fetchQuizByCode as fetchQuizByCodeApi,
  invalidateTeacherQuizzes,
  invalidateQuizByCode,
} from '@/utils/teacherClientApi';
import { EXAM_LIST_PATH, examDetailPath } from '@/utils/examRoutes';
import { resolveReturnTo, teacherCourseHubPath, withReturnTo } from '@/utils/teacherCourseHub';

const EXAM_FALLBACK_PATH = '/back-panel/teacher-courses';

interface UserInfo {
  id: string;
  name: string;
  account: string;
  role: '管理員' | '老師' | '學生';
}

type ExamSubView = '' | 'new' | 'builder' | 'grading' | 'analytics';

function ExamSubViewHeader({
  examSubView,
  quizTitle,
  onBack,
  backLabel = '返回測驗列表',
  actions,
}: {
  examSubView: ExamSubView;
  quizTitle?: string;
  onBack?: () => void;
  backLabel?: string;
  actions?: React.ReactNode;
}) {
  const title =
    examSubView === 'grading'
      ? '檢視批改'
      : examSubView === 'analytics'
        ? '成績分析'
        : examSubView === 'new' || examSubView === 'builder'
          ? '建立測驗'
          : '測驗管理';

  const subtitle =
    examSubView === 'grading'
      ? `${quizTitle || '未命名測驗'} · 檢視學生作答並手動批改。`
      : examSubView === 'analytics'
        ? `${quizTitle || '未命名測驗'} · 檢視全班成績分布與各題作答表現。`
        : examSubView === 'builder'
          ? `${quizTitle || '未命名測驗'} · 設定題目、配分與作答規則；開放後學生即可作答。`
          : examSubView === 'new'
            ? '設定題目、配分與作答規則；開放後學生即可作答。'
            : '建立與管理您的課堂測驗。';

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-0">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <ClipboardDocumentCheckIcon className="h-8 w-8 text-indigo-600" />
            {examSubView === 'builder' && quizTitle ? '編輯測驗' : title}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{subtitle}</p>
        </div>
      </div>
      {onBack || actions ? (
        <div className="flex items-center justify-between gap-4 mt-4 mb-6">
          {onBack ? <BackButton label={backLabel} onClick={onBack} withSpacing={false} /> : <span />}
          {actions ? <div className="flex items-center gap-2 flex-shrink-0">{actions}</div> : null}
        </div>
      ) : null}
    </>
  );
}

interface TeacherExamManagerProps {
  userInfo?: UserInfo | null;
  courses?: Course[];
  quizCodeFromUrl?: string;
  examSubView?: ExamSubView;
  /** 從課程頁建立測驗時預填適用班級 */
  initialCourseId?: string;
}

function createEmptyQuiz(teacherId: string, assignedCourse?: { courseId: string; courseName: string }): Quiz {
  return ensureQuizSections({
    id: '',
    quizCode: generateQuizCode(),
    teacherId,
    title: '',
    description: '',
    status: 'draft',
    sections: [createEmptySection(0)],
    totalPoints: 0,
    timeLimitEnabled: false,
    timeLimitMinutes: undefined,
    assignedCourses: assignedCourse ? [assignedCourse] : [],
    mcScoringMethod: 'average',
    optionLabelStyle: 'letter_paren',
    attemptUnlimited: false,
    attemptLimit: 1,
    continuousQuestionNumbers: true,
  });
}

export default function TeacherExamManager({
  userInfo,
  courses = [],
  quizCodeFromUrl = '',
  examSubView = '',
  initialCourseId = '',
}: TeacherExamManagerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnToParam = searchParams.get('returnTo');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('all');
  const [editingQuiz, setEditingQuiz] = useState<Quiz | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [builderToolbar, setBuilderToolbar] = useState<React.ReactNode>(null);
  const blockedBuilderRedirectRef = useRef(false);

  const examsHubReturnTo = useMemo(() => {
    if (returnToParam) return resolveReturnTo(returnToParam, EXAM_FALLBACK_PATH);
    if (!initialCourseId) return EXAM_FALLBACK_PATH;
    const course = courses.find((c) => c.id === initialCourseId || c.code === initialCourseId);
    if (!course?.code) return EXAM_FALLBACK_PATH;
    return teacherCourseHubPath(course.code, 'exams');
  }, [returnToParam, initialCourseId, courses]);

  const examBackLabel = examsHubReturnTo.startsWith('/back-panel/teacher-courses/')
    ? '返回線上測驗'
    : '返回授課管理';

  const withExamReturn = useCallback(
    (path: string) => withReturnTo(path, examsHubReturnTo !== EXAM_FALLBACK_PATH ? examsHubReturnTo : null),
    [examsHubReturnTo]
  );

  const isQuizCreator = useCallback(
    (quiz: Quiz) => !!userInfo?.id && quiz.teacherId === userInfo.id,
    [userInfo?.id]
  );

  const fetchQuizzes = useCallback(async () => {
    if (!userInfo?.id) return;
    setLoading(true);
    try {
      const list = await fetchTeacherQuizzes(userInfo.id);
      setQuizzes(list.map((q) => ensureQuizSections(q)));
    } catch (error) {
      console.error('Error fetching quizzes:', error);
    } finally {
      setLoading(false);
    }
  }, [userInfo?.id]);

  useEffect(() => {
    if (examSubView) return;
    void fetchQuizzes();
  }, [fetchQuizzes, examSubView]);

  const fetchQuizByCode = useCallback(async (quizCode: string) => {
    const quiz = await fetchQuizByCodeApi(quizCode);
    return ensureQuizSections(quiz);
  }, []);

  useEffect(() => {
    if (!examSubView) {
      setEditingQuiz(null);
      setDetailLoading(false);
      return;
    }

    if (examSubView === 'new') {
      if (!userInfo?.id) return;
      const course = initialCourseId
        ? courses.find((c) => c.id === initialCourseId || c.code === initialCourseId)
        : undefined;
      setEditingQuiz(
        createEmptyQuiz(
          userInfo.id,
          course
            ? { courseId: course.id, courseName: `${course.name}（${course.code}）` }
            : undefined
        )
      );
      setDetailLoading(false);
      return;
    }

    if (!quizCodeFromUrl) return;

    let cancelled = false;
    setDetailLoading(true);
    void fetchQuizByCode(quizCodeFromUrl)
      .then((quiz) => {
        if (!cancelled) setEditingQuiz(quiz);
      })
      .catch(() => {
        if (!cancelled) {
          Swal.fire({ icon: 'error', title: '載入失敗', confirmButtonColor: '#4f46e5' });
          router.push(examsHubReturnTo);
        }
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [examSubView, quizCodeFromUrl, userInfo?.id, fetchQuizByCode, router, initialCourseId, courses]);

  useEffect(() => {
    blockedBuilderRedirectRef.current = false;
  }, [examSubView, quizCodeFromUrl]);

  useEffect(() => {
    if (!editingQuiz || !userInfo?.id || examSubView !== 'builder') return;
    if (isQuizCreator(editingQuiz)) return;
    if (blockedBuilderRedirectRef.current) return;
    blockedBuilderRedirectRef.current = true;
    void Swal.fire({
      icon: 'info',
      title: '無法編輯此測驗',
      text: '此測驗由其他老師建立，您僅能進行批改與分析。',
      confirmButtonColor: '#4f46e5',
      customClass: { popup: 'rounded-2xl' },
    }).then(() => {
      router.replace(withExamReturn(examDetailPath(editingQuiz.quizCode, 'grading')));
    });
  }, [editingQuiz, userInfo?.id, examSubView, isQuizCreator, router]);

  const courseFilterOptions = useMemo(() => {
    const activeCourses = courses.filter((c) => c.status !== '已封存');
    const activeCourseIds = new Set(activeCourses.map((c) => c.id));
    const courseMap = new Map<string, string>();
    activeCourses.forEach((c) => courseMap.set(c.id, `${c.name}（${c.code}）`));
    quizzes.forEach((q) => {
      (q.assignedCourses ?? []).forEach((c) => {
        if (c.courseId && !courseMap.has(c.courseId) && activeCourseIds.has(c.courseId)) {
          courseMap.set(c.courseId, c.courseName || c.courseId);
        }
      });
    });
    const sorted = Array.from(courseMap.entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'zh-Hant'))
      .map(([value, label]) => ({ value, label }));
    return [{ value: 'all', label: '全部班級' }, ...sorted];
  }, [courses, quizzes]);

  useEffect(() => {
    if (selectedCourseId !== 'all' && !courseFilterOptions.some((o) => o.value === selectedCourseId)) {
      setSelectedCourseId('all');
    }
  }, [courseFilterOptions, selectedCourseId]);

  const hasActiveFilters = searchTerm.trim().length > 0 || selectedCourseId !== 'all';

  const filteredQuizzes = quizzes.filter((q) => {
    if (selectedCourseId !== 'all') {
      const assigned = q.assignedCourses ?? [];
      if (!assigned.some((c) => c.courseId === selectedCourseId)) return false;
    }
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return (
      q.title.toLowerCase().includes(term) ||
      (q.assignedCourses ?? []).some((c) => c.courseName.toLowerCase().includes(term))
    );
  });

  const handleCreate = () => {
    router.push(`${EXAM_LIST_PATH}/new`);
  };

  const handleDuplicate = async (quiz: Quiz) => {
    if (!userInfo?.id) return;

    const activeCourses = (courses ?? []).filter((c) => c.status !== '已封存');
    const inputOptions: Record<string, string> = { '': '稍後再指定班級' };
    for (const c of activeCourses) {
      inputOptions[c.id] = `${c.name}（${c.code}）`;
    }

    const result = await Swal.fire({
      title: '複製考卷',
      html: `<p class="text-sm text-gray-600 text-left mb-2">將建立一份獨立草稿（新測驗代碼），題目與設定會一併複製，作答紀錄不會帶入。</p>`,
      input: 'select',
      inputOptions,
      inputValue: quiz.assignedCourses?.[0]?.courseId ?? '',
      inputLabel: '適用班級',
      showCancelButton: true,
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: '建立副本',
      cancelButtonText: '取消',
      customClass: { popup: 'rounded-2xl' },
    });

    if (!result.isConfirmed) return;

    const courseId = typeof result.value === 'string' ? result.value : '';
    const course = activeCourses.find((c) => c.id === courseId);

    try {
      Swal.fire({
        title: '複製中…',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading(),
      });

      const res = await fetch('/api/quizzes/duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teacherId: userInfo.id,
          sourceQuizCode: quiz.quizCode,
          courseId: courseId || undefined,
          courseName: course ? `${course.name}（${course.code}）` : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '複製失敗');

      invalidateTeacherQuizzes(userInfo.id);
      Swal.close();
      router.push(withExamReturn(examDetailPath(data.quizCode)));
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: '複製失敗',
        text: error instanceof Error ? error.message : '請稍後再試',
        confirmButtonColor: '#4f46e5',
      });
    }
  };

  const handleDelete = async (quiz: Quiz) => {
    const result = await Swal.fire({
      title: '確定要刪除此測驗？',
      text: '刪除後無法復原，請確認。',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: '是的，刪除',
      cancelButtonText: '取消',
      customClass: { popup: 'rounded-2xl' },
    });

    if (!result.isConfirmed || !userInfo?.id) return;

    try {
      const res = await fetch('/api/quizzes/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quizId: quiz.id, teacherId: userInfo.id }),
      });
      if (!res.ok) throw new Error('刪除失敗');
      invalidateTeacherQuizzes(userInfo.id);
      invalidateQuizByCode(quiz.quizCode);
      setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
      Swal.fire({ icon: 'success', title: '已刪除', confirmButtonColor: '#4f46e5' });
    } catch {
      Swal.fire({ icon: 'error', title: '刪除失敗', confirmButtonColor: '#4f46e5' });
    }
  };

  const handleSaved = (saved: Quiz) => {
    if (userInfo?.id) invalidateTeacherQuizzes(userInfo.id);
    if (saved.quizCode) invalidateQuizByCode(saved.quizCode);
    setEditingQuiz(saved);
    setQuizzes((prev) => {
      const exists = prev.some((q) => q.id === saved.id);
      if (exists) return prev.map((q) => (q.id === saved.id ? saved : q));
      return [saved, ...prev];
    });
    if (saved.quizCode) {
      router.replace(withExamReturn(examDetailPath(saved.quizCode)));
    }
  };

  const handleBack = () => {
    router.push(examsHubReturnTo);
  };

  if (detailLoading && examSubView && examSubView !== 'new') {
    return (
      <div className="page-shell w-full min-w-0 flex flex-col h-full">
        <ExamSubViewHeader examSubView={examSubView} quizTitle={editingQuiz?.title} onBack={handleBack} backLabel={examBackLabel} />
        <PageLoadingArea />
      </div>
    );
  }

  if (examSubView === 'grading' && editingQuiz && userInfo?.id) {
    return (
      <div className="page-shell w-full min-w-0 flex flex-col h-full">
        <ExamSubViewHeader examSubView="grading" quizTitle={editingQuiz.title} onBack={handleBack} backLabel={examBackLabel} />
        <QuizGradingPanel
          quiz={editingQuiz}
          teacherId={userInfo.id}
          viewerRole={userInfo.role}
        />
      </div>
    );
  }

  if (examSubView === 'analytics' && editingQuiz && userInfo?.id) {
    return (
      <div className="page-shell w-full min-w-0 flex flex-col h-full">
        <ExamSubViewHeader examSubView="analytics" quizTitle={editingQuiz.title} onBack={handleBack} backLabel={examBackLabel} />
        <QuizAnalyticsPanel quiz={editingQuiz} teacherId={userInfo.id} />
      </div>
    );
  }

  if ((examSubView === 'builder' || examSubView === 'new') && editingQuiz) {
    if (examSubView === 'builder' && userInfo?.id && !isQuizCreator(editingQuiz)) {
      return (
        <div className="page-shell w-full min-w-0 flex flex-col h-full">
          <ExamSubViewHeader examSubView="grading" quizTitle={editingQuiz.title} onBack={handleBack} backLabel={examBackLabel} />
          <PageLoadingArea />
        </div>
      );
    }

    return (
      <div className="page-shell w-full min-w-0 flex flex-col h-full">
        <ExamSubViewHeader
          examSubView={examSubView}
          quizTitle={editingQuiz.title}
          onBack={handleBack}
          backLabel={examBackLabel}
          actions={builderToolbar}
        />
        <QuizBuilder
          key={editingQuiz.quizCode || editingQuiz.id || 'new'}
          quiz={editingQuiz}
          onBack={handleBack}
          onSaved={handleSaved}
          onToolbarChange={setBuilderToolbar}
        />
      </div>
    );
  }

  return (
    <div className="page-shell w-full min-w-0 flex flex-col h-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <ClipboardDocumentCheckIcon className="h-8 w-8 text-indigo-600" />
            測驗管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">建立、管理您的課堂測驗</p>
        </div>
      </div>

      <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="w-full md:w-64 lg:w-72 flex-shrink-0">
            <Dropdown
              value={selectedCourseId}
              onChange={setSelectedCourseId}
              options={courseFilterOptions}
              placeholder="全部班級"
              className="w-full"
            />
          </div>
          <div className="w-full md:flex-1 relative min-w-0">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋測驗標題..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent text-sm"
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={!userInfo}
            className={`${btnWithIconStyle(btnStyles.primary)} w-full md:w-auto shrink-0 disabled:opacity-50`}
          >
            <PlusIcon className="w-5 h-5 mr-2" />
            建立測驗
          </button>
        </div>
      </div>

      {loading ? (
        <PageLoadingArea />
      ) : filteredQuizzes.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <ClipboardDocumentCheckIcon className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 font-medium">
              {hasActiveFilters ? '找不到符合的測驗' : '尚未建立任何測驗'}
            </p>
            {!hasActiveFilters && (
              <button
                onClick={handleCreate}
                className={btnWithIconStyle(btnStyles.primary)}
              >
                <PlusIcon className="w-4 h-4 mr-1.5" />
                建立第一個測驗
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 font-bold min-w-[200px]">測驗名稱</th>
                <th className="px-4 py-4 font-bold text-center whitespace-nowrap hidden md:table-cell min-w-[160px]">適用班級</th>
                <th className="px-4 py-4 font-bold text-center whitespace-nowrap hidden sm:table-cell min-w-[240px]">測驗日期</th>
                <th className="px-4 py-4 font-bold text-center whitespace-nowrap">狀態</th>
                <th className="px-6 py-4 font-bold text-right whitespace-nowrap min-w-[320px]">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredQuizzes.map((quiz) => (
                <tr key={quiz.id} className="hover:bg-indigo-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center flex-shrink-0">
                        <ClipboardDocumentCheckIcon className="w-4 h-4" />
                      </div>
                      <span className="font-medium text-gray-900 truncate">
                        {quiz.title}
                        {userInfo?.id && quiz.teacherId !== userInfo.id && (
                          <span className="ml-2 text-xs font-normal text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                            共同課程
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center hidden md:table-cell">
                    <span className="text-xs text-gray-600 line-clamp-2">
                      {(quiz.assignedCourses ?? [])[0]?.courseName
                        || (quiz.assignedCourses ?? []).map((c) => c.courseName).join('、')
                        || '未指定'}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center hidden sm:table-cell">
                    <span className="text-xs text-gray-600 whitespace-nowrap">{formatQuizExamDateLabel(quiz)}</span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className={`px-2.5 py-0.5 inline-flex text-xs font-semibold rounded-full ${
                          quiz.status === 'published'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {quiz.status === 'published' ? '開放' : '隱藏'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <div className={tableActionRow}>
                      {isQuizCreator(quiz) && (
                        <button
                          type="button"
                          onClick={() => router.push(examDetailPath(quiz.quizCode))}
                          className={tableActionStyles.primary}
                        >
                          編輯
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDuplicate(quiz)}
                        className={tableActionStyles.secondary}
                        title="複製為新草稿，可指定其他班級"
                      >
                        複製
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(examDetailPath(quiz.quizCode, 'grading'))}
                        className={tableActionStyles.success}
                      >
                        批改
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(examDetailPath(quiz.quizCode, 'analytics'))}
                        className={tableActionStyles.secondary}
                      >
                        分析
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(quiz)}
                        disabled={quiz.teacherId !== userInfo?.id}
                        className={tableActionStyles.danger}
                        title={quiz.teacherId !== userInfo?.id ? '僅建立者可刪除測驗' : '刪除測驗'}
                      >
                        刪除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
