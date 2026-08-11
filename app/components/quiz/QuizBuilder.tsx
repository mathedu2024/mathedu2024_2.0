'use client';

import React, { useState, useMemo, useRef, useCallback, useEffect, startTransition } from 'react';
import {
  PlusIcon,
  CloudArrowUpIcon,
  DocumentCheckIcon,
  Cog6ToothIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import Swal from '@/utils/swalTheme';
import SectionEditor from './SectionEditor';
import RichTextField from './RichTextField';
import QuizSettingsModal from './QuizSettingsModal';
import { openBlankPreviewTab, openTeacherExamPreviewInNewTab } from '@/utils/teacherExamPreview';
import {
  type Quiz,
  type QuizSection,
  ensureQuizSections,
  createEmptySection,
  calculateQuizTotalPoints,
  countQuizQuestions,
  validateQuizForPublish,
  formatQuizExamDateLabel,
  formatQuizTimeLimit,
  formatQuizAttemptLimit,
  formatQuizAttemptScorePolicy,
  formatQuizQuestionNumbering,
  isQuizMultipleAttemptsAllowed,
  isQuizResultsPublished,
} from '@/services/quizTypes';
import {
  formatQuizImageLimitHint,
  flushPendingQuizImagesInQuiz,
  registerPendingQuizImage,
  getPendingQuizImageFile,
} from '@/utils/quizImageUpload';
import type { QuizImageUploadParams } from '@/utils/quizImageUpload';
import {
  countQuizImagesInQuiz,
  listPendingQuizImageUrls,
  stripPendingQuizImagesFromQuiz,
  validateQuizImageCount,
} from '@/utils/quizImageHtml';
import { QuizImageProvider } from './QuizImageContext';

interface QuizBuilderProps {
  quiz: Quiz;
  onBack: () => void;
  onSaved: (quiz: Quiz) => void;
  onToolbarChange?: (toolbar: React.ReactNode) => void;
}

function quizEditSnapshot(quiz: Quiz, totalPoints: number): string {
  return JSON.stringify({
    title: quiz.title,
    description: quiz.description,
    status: quiz.status,
    sections: quiz.sections,
    assignedCourses: quiz.assignedCourses,
    timeLimitEnabled: quiz.timeLimitEnabled,
    timeLimitMinutes: quiz.timeLimitMinutes,
    answerWindowEnabled: quiz.answerWindowEnabled,
    answerStartAt: quiz.answerStartAt,
    answerEndAt: quiz.answerEndAt,
    attemptUnlimited: quiz.attemptUnlimited,
    attemptLimit: quiz.attemptLimit,
    resultsPublished: quiz.resultsPublished,
    attemptScorePolicy: quiz.attemptScorePolicy,
    examLockEnabled: quiz.examLockEnabled,
    requireFullscreen: quiz.requireFullscreen,
    mcScoringMethod: quiz.mcScoringMethod,
    optionLabelStyle: quiz.optionLabelStyle,
    continuousQuestionNumbers: quiz.continuousQuestionNumbers,
    totalPoints,
  });
}

export default function QuizBuilder({
  quiz: initialQuiz,
  onBack: _onBack,
  onSaved,
  onToolbarChange,
}: QuizBuilderProps) {
  const [quiz, setQuiz] = useState<Quiz>(() => ensureQuizSections(initialQuiz));
  const [saving, setSaving] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const savedSnapshotRef = useRef<string | null>(null);
  const snapshotReadyRef = useRef(false);

  useEffect(() => {
    snapshotReadyRef.current = false;
    savedSnapshotRef.current = null;

    const buildSnapshot = () => {
      savedSnapshotRef.current = quizEditSnapshot(
        ensureQuizSections(initialQuiz),
        calculateQuizTotalPoints(initialQuiz)
      );
      snapshotReadyRef.current = true;
    };

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(buildSnapshot);
      return () => window.cancelIdleCallback(id);
    }

    const id = window.setTimeout(buildSnapshot, 0);
    return () => window.clearTimeout(id);
  }, [initialQuiz]);

  const totalPoints = useMemo(() => calculateQuizTotalPoints(quiz), [quiz]);
  const totalQuestions = useMemo(() => countQuizQuestions(quiz), [quiz]);
  const imageCount = useMemo(() => countQuizImagesInQuiz(quiz), [quiz]);
  const imageCountRef = useRef(imageCount);
  imageCountRef.current = imageCount;

  const quizImageParams = useMemo<QuizImageUploadParams>(
    () => ({
      quizCode: quiz.quizCode,
      teacherId: quiz.teacherId,
      isPersisted: Boolean(quiz.id),
      getImageCount: () => imageCountRef.current,
      registerPendingImage: registerPendingQuizImage,
      getPendingFile: getPendingQuizImageFile,
    }),
    [quiz.quizCode, quiz.teacherId, quiz.id]
  );

  const quizRef = useRef(quiz);
  const totalPointsRef = useRef(totalPoints);
  quizRef.current = quiz;
  totalPointsRef.current = totalPoints;

  const isQuizDirty = useCallback(
    () => {
      if (!snapshotReadyRef.current || savedSnapshotRef.current === null) return false;
      return quizEditSnapshot(quizRef.current, totalPointsRef.current) !== savedSnapshotRef.current;
    },
    []
  );

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isQuizDirty()) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isQuizDirty]);

  const updateSection = (sIndex: number, section: QuizSection) => {
    // 輕量設定（打亂開關等）同步更新，避免 deferred 造成畫面跳動
    const prev = quizRef.current.sections[sIndex];
    const isLightweightMetaOnly =
      prev &&
      prev.questions === section.questions &&
      prev.title === section.title &&
      prev.description === section.description &&
      (prev.shuffleQuestions !== section.shuffleQuestions ||
        prev.shuffleOptions !== section.shuffleOptions);

    const apply = () => {
      setQuiz((current) => {
        const sections = [...current.sections];
        sections[sIndex] = section;
        return { ...current, sections };
      });
    };

    if (isLightweightMetaOnly) {
      apply();
    } else {
      startTransition(apply);
    }
  };

  const deleteSection = (sIndex: number) => {
    setQuiz((prev) => ({
      ...prev,
      sections: prev.sections.filter((_, i) => i !== sIndex),
    }));
  };

  const addSection = () => {
    setQuiz((prev) => ({
      ...prev,
      sections: [...prev.sections, createEmptySection(prev.sections.length)],
    }));
  };

  const saveQuiz = async (
    status?: Quiz['status'],
    options?: { silentSuccess?: boolean; silent?: boolean }
  ): Promise<boolean> => {
    const silent = !!options?.silent;
    const quietSuccess = silent || !!options?.silentSuccess;

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    await new Promise((resolve) => window.setTimeout(resolve, silent ? 50 : 220));

    const currentQuiz = quizRef.current;
    if (!currentQuiz.title.trim()) {
      if (!silent) {
        Swal.fire({ icon: 'warning', title: '請輸入測驗標題', confirmButtonColor: '#2D6DF6' });
      }
      return false;
    }

    const imageLimitError = validateQuizImageCount(currentQuiz);
    if (imageLimitError) {
      if (!silent) {
        Swal.fire({ icon: 'warning', title: imageLimitError, confirmButtonColor: '#2D6DF6' });
      }
      return false;
    }

    if (currentQuiz.timeLimitEnabled && (!currentQuiz.timeLimitMinutes || currentQuiz.timeLimitMinutes < 1)) {
      if (!silent) {
        Swal.fire({
          icon: 'warning',
          title: '請設定有效的考試時間（至少 1 分鐘）',
          confirmButtonColor: '#2D6DF6',
        });
      }
      return false;
    }

    const nextStatus = status ?? currentQuiz.status;
    if (nextStatus === 'draft' && currentQuiz.status === 'published') {
      if (silent) return false;
      const demote = await Swal.fire({
        icon: 'warning',
        title: '改為隱藏？',
        html: '<p class="text-sm text-gray-600 leading-relaxed">此測驗將對<strong>學生隱藏</strong>，學生將無法再進入作答。</p><p class="text-sm text-gray-600 leading-relaxed mt-2">一般修改內容只需點「儲存」，不會改為隱藏。</p>',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#9ca3af',
        confirmButtonText: '改為隱藏',
        cancelButtonText: '取消',
      });
      if (!demote.isConfirmed) return false;
    }

    if (nextStatus === 'published') {
      const publishError = validateQuizForPublish(currentQuiz);
      if (publishError) {
        if (!silent) {
          Swal.fire({ icon: 'warning', title: publishError, confirmButtonColor: '#2D6DF6' });
        }
        return false;
      }
    }

    setSaving(true);
    const currentTotalPoints = totalPointsRef.current;
    let workingQuiz: Quiz = {
      ...currentQuiz,
      status: nextStatus,
      totalPoints: currentTotalPoints,
    };

    try {
      const isNew = !currentQuiz.id;
      const timeFields = {
        timeLimitEnabled: !!workingQuiz.timeLimitEnabled,
        timeLimitMinutes: workingQuiz.timeLimitEnabled
          ? (workingQuiz.timeLimitMinutes ?? 60)
          : undefined,
      };
      const buildSharedFields = (q: Quiz) => ({
        assignedCourses: q.assignedCourses ?? [],
        title: q.title,
        description: q.description,
        status: q.status,
        sections: q.sections,
        answerStartAt: q.answerWindowEnabled ? q.answerStartAt : undefined,
        answerEndAt: q.answerWindowEnabled ? q.answerEndAt : undefined,
        answerWindowEnabled: !!q.answerWindowEnabled,
        attemptUnlimited: !!q.attemptUnlimited,
        attemptLimit: q.attemptUnlimited ? undefined : Math.max(1, q.attemptLimit ?? 1),
        resultsPublished: q.resultsPublished !== false,
        attemptScorePolicy: q.attemptScorePolicy ?? 'latest',
        examLockEnabled: !!q.examLockEnabled,
        requireFullscreen: !!q.requireFullscreen,
        ...timeFields,
        mcScoringMethod: q.mcScoringMethod ?? 'average',
        optionLabelStyle: q.optionLabelStyle ?? 'letter_paren',
        continuousQuestionNumbers: q.continuousQuestionNumbers !== false,
      });

      const postJson = async (url: string, body: unknown) => {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof data.error === 'string' ? data.error : '儲存失敗');
        }
        return data;
      };

      // 1) 新測驗先建立（暫存圖先剝除，避免 blob URL 寫入資料庫）
      const pendingCount = listPendingQuizImageUrls(workingQuiz).length;
      if (isNew) {
        const createPayload =
          pendingCount > 0 ? stripPendingQuizImagesFromQuiz(workingQuiz) : workingQuiz;
        const data = await postJson('/api/quizzes/create', {
          teacherId: createPayload.teacherId,
          quizCode: createPayload.quizCode,
          ...buildSharedFields(createPayload),
        });
        workingQuiz = {
          ...workingQuiz,
          id: data.quizId,
          quizCode: data.quizCode ?? workingQuiz.quizCode,
        };
      }

      // 2) 按下儲存才上傳暫存圖片，並替換 blob／data URL
      if (pendingCount > 0) {
        workingQuiz = await flushPendingQuizImagesInQuiz(workingQuiz, {
          quizCode: workingQuiz.quizCode,
          teacherId: workingQuiz.teacherId,
        });
      }

      // 3) 寫入最終內容；既有測驗必更新；新建且有圖片也需再更新一次
      if (!isNew || pendingCount > 0) {
        await postJson('/api/quizzes/update', {
          quizId: workingQuiz.id,
          teacherId: workingQuiz.teacherId,
          ...buildSharedFields(workingQuiz),
        });
      }

      const savedQuiz: Quiz = workingQuiz;

      setQuiz(savedQuiz);
      savedSnapshotRef.current = quizEditSnapshot(savedQuiz, currentTotalPoints);
      snapshotReadyRef.current = true;
      onSaved(savedQuiz);

      if (!quietSuccess) {
        const wasPublished = currentQuiz.status === 'published';
        let successTitle = '測驗已儲存';
        let successText: string | undefined;

        if (nextStatus === 'published' && !wasPublished) {
          successTitle = '已開放測驗';
          successText = '學生端現在可以進入此測驗作答。';
        } else if (nextStatus === 'published' && wasPublished) {
          successTitle = '變更已儲存';
          successText = '測驗仍維持開放，學生端將顯示最新內容。';
        } else if (nextStatus === 'draft' && wasPublished) {
          successTitle = '已改為隱藏';
          successText = '學生端將無法看到此測驗。若要再次開放，請點「開放測驗」。';
        }

        await Swal.fire({
          icon: 'success',
          title: successTitle,
          text: successText,
          confirmButtonColor: '#2D6DF6',
        });
      }
      return true;
    } catch (error) {
      if (!silent) {
        Swal.fire({
          icon: 'error',
          title: '儲存失敗',
          text: error instanceof Error ? error.message : '請稍後再試',
          confirmButtonColor: '#2D6DF6',
        });
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const launchStudentPreview = (previewWin?: Window | null) => {
    const win = previewWin ?? openBlankPreviewTab();
    if (!win) {
      Swal.fire({
        icon: 'warning',
        title: '無法開啟預覽',
        text: '瀏覽器封鎖了新分頁，請允許此網站開啟彈出式視窗',
        confirmButtonColor: '#2D6DF6',
      });
      return;
    }

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    window.setTimeout(() => {
      try {
        openTeacherExamPreviewInNewTab(quizRef.current, { targetWindow: win });
      } catch (error) {
        try {
          win.close();
        } catch {
          /* ignore */
        }
        Swal.fire({
          icon: 'warning',
          title: '無法開啟預覽',
          text: error instanceof Error ? error.message : '請稍後再試',
          confirmButtonColor: '#2D6DF6',
        });
      }
    }, 220);
  };

  const openStudentPreview = async () => {
    const current = quizRef.current;
    if (!current.sections.some((s) => s.questions.length > 0)) {
      Swal.fire({
        icon: 'info',
        title: '尚無題目',
        text: '請先新增至少一題再預覽學生作答畫面。',
        confirmButtonColor: '#2D6DF6',
      });
      return;
    }

    if (isQuizDirty()) {
      const result = await Swal.fire({
        icon: 'warning',
        title: '尚未儲存變更',
        text: '目前有未儲存的內容。請先儲存後再預覽，以免預覽與編輯內容不一致。',
        showCancelButton: true,
        confirmButtonText: '儲存並預覽',
        cancelButtonText: '取消',
        confirmButtonColor: '#2D6DF6',
        cancelButtonColor: '#9ca3af',
      });
      if (!result.isConfirmed) return;

      // 在 await 儲存前先開分頁，保留使用者點擊手勢，降低被瀏覽器封鎖的機率
      const previewWin = openBlankPreviewTab();
      const saveStatus = current.status === 'published' ? undefined : 'draft';
      const ok = await saveQuiz(saveStatus, { silentSuccess: true });
      if (!ok) {
        try {
          previewWin?.close();
        } catch {
          /* ignore */
        }
        return;
      }
      launchStudentPreview(previewWin);
      return;
    }

    launchStudentPreview();
  };

  const saveQuizRef = useRef(saveQuiz);
  saveQuizRef.current = saveQuiz;
  const openStudentPreviewRef = useRef(openStudentPreview);
  openStudentPreviewRef.current = openStudentPreview;
  const savingRef = useRef(saving);
  savingRef.current = saving;
  const isQuizDirtyRef = useRef(isQuizDirty);
  isQuizDirtyRef.current = isQuizDirty;

  // 每 5 分鐘靜默自動儲存（無彈窗）；維持目前開放／隱藏狀態
  useEffect(() => {
    const AUTO_SAVE_MS = 5 * 60 * 1000;
    const timer = window.setInterval(() => {
      if (savingRef.current) return;
      if (!isQuizDirtyRef.current()) return;
      const current = quizRef.current;
      if (!current.title.trim()) return;
      void saveQuizRef.current(current.status, { silent: true });
    }, AUTO_SAVE_MS);
    return () => window.clearInterval(timer);
  }, []);

  const toolbar = useMemo(
    () => {
      const previewBtn = (
        <button
          type="button"
          onClick={() => openStudentPreviewRef.current()}
          disabled={saving}
          className="inline-flex items-center px-4 py-2 bg-surface-containerLowest border border-primary text-primary rounded-xl hover:bg-primary/5 transition-colors shadow-sm font-medium text-sm disabled:opacity-50"
        >
          <EyeIcon className="w-4 h-4 mr-1.5" />
          預覽
        </button>
      );

      if (quiz.status === 'published') {
        return (
          <>
            {previewBtn}
            <button
              type="button"
              onClick={() => void saveQuizRef.current()}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 bg-primary-container text-on-primary rounded-xl hover:bg-primary transition-colors shadow-sm font-medium text-sm disabled:opacity-50"
            >
              <CloudArrowUpIcon className="w-4 h-4 mr-1.5" />
              儲存
            </button>
          </>
        );
      }

      return (
        <>
          {previewBtn}
          <button
            type="button"
            onClick={() => void saveQuizRef.current('draft')}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-surface-containerLowest border border-outline-variant text-on-surface rounded-xl hover:bg-surface-containerLow transition-colors shadow-sm font-medium text-sm disabled:opacity-50"
          >
            <CloudArrowUpIcon className="w-4 h-4 mr-1.5" />
            儲存草稿
          </button>
          <button
            type="button"
            onClick={() => void saveQuizRef.current('published')}
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-primary-container text-on-primary rounded-xl hover:bg-primary transition-colors shadow-sm font-medium text-sm disabled:opacity-50"
          >
            <DocumentCheckIcon className="w-4 h-4 mr-1.5" />
            發佈測驗
          </button>
        </>
      );
    },
    [saving, quiz.status]
  );

  useEffect(() => {
    onToolbarChange?.(toolbar);
    return () => onToolbarChange?.(null);
  }, [toolbar, onToolbarChange]);

  return (
    <QuizImageProvider value={quizImageParams}>
    <div className="space-y-6 pb-8">
      {quiz.status === 'published' && (
        <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-on-surface flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p>
            此測驗目前<strong>開放</strong>給學生。點「<strong>儲存</strong>」只會更新內容，不會改為隱藏。
          </p>
          <button
            type="button"
            onClick={() => void saveQuizRef.current('draft')}
            disabled={saving}
            className="shrink-0 text-error hover:text-error text-sm font-medium underline-offset-2 hover:underline disabled:opacity-50"
          >
            改為隱藏
          </button>
        </div>
      )}

      <section className="bg-surface-containerLowest rounded-xl shadow-sm border border-outline-variant/30 p-6">
        <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2 text-on-surface">
          <Cog6ToothIcon className="w-5 h-5 text-primary" />
          測驗設定
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
          <div className="md:col-span-3">
            <label className="block text-sm text-on-surfaceVariant mb-2 font-medium">測驗標題 *</label>
            <input
              type="text"
              value={quiz.title}
              onChange={(e) => setQuiz((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="例如：第一章小測驗"
              className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-on-surface bg-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-on-surfaceVariant mb-2 font-medium">限時（分鐘）</label>
            <input
              type="number"
              min={1}
              value={quiz.timeLimitEnabled ? quiz.timeLimitMinutes ?? '' : ''}
              placeholder="不限時"
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  setQuiz((prev) => ({ ...prev, timeLimitEnabled: false, timeLimitMinutes: undefined }));
                  return;
                }
                const n = parseInt(raw, 10);
                if (Number.isNaN(n)) return;
                setQuiz((prev) => ({
                  ...prev,
                  timeLimitEnabled: true,
                  timeLimitMinutes: Math.max(1, n),
                }));
              }}
              className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-on-surface bg-surface focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-on-surfaceVariant mb-2 font-medium">狀態</label>
            <span
              className={`inline-flex text-xs font-semibold px-3 py-2 rounded-full ${
                quiz.status === 'published'
                  ? 'bg-secondary/10 text-secondary border border-secondary/20'
                  : 'bg-surface-containerHigh text-on-surfaceVariant border border-outline-variant border-dashed'
              }`}
            >
              {quiz.status === 'published' ? '已發佈' : '草稿'}
            </span>
          </div>
          <div>
            <label className="block text-sm text-on-surfaceVariant mb-2 font-medium">發佈對象</label>
            <input
              type="text"
              readOnly
              value={
                (quiz.assignedCourses || [])
                  .map((c) => c.courseName)
                  .filter(Boolean)
                  .join('、') || '本課程學生'
              }
              className="w-full px-4 py-2.5 border border-outline-variant rounded-lg text-on-surfaceVariant bg-surface-containerLow"
            />
          </div>
        </div>

        <div className="mb-5">
          <RichTextField
            label="測驗說明"
            value={quiz.description ?? ''}
            onChange={(description) => setQuiz((prev) => ({ ...prev, description }))}
            placeholder="選填：測驗說明或注意事項"
            minHeight="100px"
          />
        </div>

        <div className="pt-5 border-t border-outline-variant/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <h4 className="text-sm font-bold text-on-surface">詳細設定摘要</h4>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/15 transition-colors"
            >
              <Cog6ToothIcon className="w-4 h-4 mr-1.5" />
              開啟詳細設定
            </button>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex gap-2">
              <dt className="text-on-surfaceVariant shrink-0">測驗日期</dt>
              <dd className="text-on-surface">{formatQuizExamDateLabel(quiz)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-on-surfaceVariant shrink-0">限時</dt>
              <dd className="text-on-surface">{formatQuizTimeLimit(quiz)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-on-surfaceVariant shrink-0">作答次數</dt>
              <dd className="text-on-surface">{formatQuizAttemptLimit(quiz)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-on-surfaceVariant shrink-0">成績公布</dt>
              <dd className="text-on-surface">
                {isQuizResultsPublished(quiz) ? '已向學生公布' : '暫不公布'}
              </dd>
            </div>
            {isQuizMultipleAttemptsAllowed(quiz) && (
              <div className="flex gap-2">
                <dt className="text-on-surfaceVariant shrink-0">成績採計</dt>
                <dd className="text-on-surface">{formatQuizAttemptScorePolicy(quiz)}</dd>
              </div>
            )}
            <div className="flex gap-2">
              <dt className="text-on-surfaceVariant shrink-0">題號編排</dt>
              <dd className="text-on-surface">{formatQuizQuestionNumbering(quiz)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="text-on-surfaceVariant shrink-0">作答環境</dt>
              <dd className="text-on-surface">
                {[
                  quiz.examLockEnabled ? '禁止離開' : null,
                  quiz.requireFullscreen ? '全螢幕' : null,
                ]
                  .filter(Boolean)
                  .join('、') || '一般'}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <QuizSettingsModal
        open={settingsOpen}
        quiz={quiz}
        onChange={setQuiz}
        onClose={() => setSettingsOpen(false)}
      />

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-on-surface flex items-center gap-2">
              試卷題目
            </h2>
            <p className="text-sm text-on-surfaceVariant mt-1">
              {quiz.sections.length} 大題 · 共 {totalQuestions} 題 · 總分 {totalPoints} 分
              <span className="mx-2 text-outline-variant">·</span>
              <span className={imageCount >= 10 ? 'text-amber-600 font-medium' : ''}>
                {formatQuizImageLimitHint(imageCount)}
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors shadow-sm font-medium text-sm"
          >
            <PlusIcon className="w-4 h-4 mr-1.5" />
            新增大題
          </button>
        </div>

        {quiz.sections.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center text-gray-400">
            <p className="font-medium text-gray-500 mb-2">尚未建立大題</p>
            <button type="button" onClick={addSection} className="text-primary text-sm font-medium hover:underline">
              建立第一個大題
            </button>
          </div>
        ) : (
          quiz.sections.map((section, sIndex) => (
            <SectionEditor
              key={section.id}
              section={section}
              sectionIndex={sIndex}
              allSections={quiz.sections}
              optionLabelStyle={quiz.optionLabelStyle}
              continuousQuestionNumbers={quiz.continuousQuestionNumbers}
              onChange={(updated) => updateSection(sIndex, updated)}
              onDelete={() => deleteSection(sIndex)}
              canDelete={quiz.sections.length > 1}
            />
          ))
        )}
      </div>
    </div>
    </QuizImageProvider>
  );
}
