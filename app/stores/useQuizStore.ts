'use client';

import { create } from 'zustand';
import type { Quiz } from '@/services/quizTypes';
import type { QuizSubmission, StudentAnswers } from '@/services/quizSubmissionTypes';
import { isQuestionAnswered } from '@/utils/examAnswerStatus';
import { shouldRestoreExamDraft } from '@/utils/examDraftPolicy';
import { examDraftStorageKey, clearTakeActiveSession } from '@/utils/examDraftStorage';
import { applyQuizShuffle, buildQuizShuffleSeed } from '@/utils/quizShuffle';

interface QuizStoreState {
  quizCode: string | null;
  studentId: string | null;
  quiz: Quiz | null;
  answers: StudentAnswers;
  skippedIds: string[];
  startedAt: number | null;
  deadlineAt: number | null;
  submission: QuizSubmission | null;
  readOnly: boolean;
  /** 老師預覽學生作答環境：可作答但不暫存／不送出 */
  previewMode: boolean;
  submitting: boolean;

  initExam: (params: {
    quiz: Quiz;
    quizCode: string;
    studentId: string;
    readOnly: boolean;
    previewMode?: boolean;
    submission?: QuizSubmission | null;
  }) => void;
  setAnswer: (questionId: string, value: StudentAnswers[string]) => void;
  toggleSkip: (questionId: string) => void;
  loadDraft: () => void;
  persistDraft: () => void;
  clearDraft: () => void;
  abandonVoluntaryExit: () => void;
  reset: () => void;
  setSubmitting: (v: boolean) => void;
  setSubmission: (submission: QuizSubmission) => void;
}

export const useQuizStore = create<QuizStoreState>((set, get) => ({
  quizCode: null,
  studentId: null,
  quiz: null,
  answers: {},
  skippedIds: [],
  startedAt: null,
  deadlineAt: null,
  submission: null,
  readOnly: false,
  previewMode: false,
  submitting: false,

  initExam: ({ quiz, quizCode, studentId, readOnly, previewMode = false, submission }) => {
    // 檢視作答紀錄／批改：一律使用原稿題目與選項順序，不套用打亂
    if (readOnly) {
      set({
        quiz,
        quizCode,
        studentId,
        readOnly: true,
        previewMode: false,
        submission: submission ?? null,
        startedAt: null,
        deadlineAt: null,
        answers: {},
        skippedIds: [],
        submitting: false,
      });
      if (submission) {
        const restored: StudentAnswers = {};
        for (const a of submission.answers) {
          if (a.response !== null && a.response !== undefined) {
            restored[a.questionId] = a.response as StudentAnswers[string];
          }
        }
        set({ answers: restored });
      }
      return;
    }

    // 老師預覽：模擬學生作答（含打亂／計時），但不讀寫草稿
    if (previewMode) {
      const now = Date.now();
      const deadlineAt =
        quiz.timeLimitEnabled && quiz.timeLimitMinutes
          ? now + quiz.timeLimitMinutes * 60 * 1000
          : null;
      set({
        quiz: applyQuizShuffle(
          quiz,
          buildQuizShuffleSeed({ quizCode, studentId, startedAt: now })
        ),
        quizCode,
        studentId,
        readOnly: false,
        previewMode: true,
        submission: null,
        startedAt: now,
        deadlineAt,
        answers: {},
        skippedIds: [],
        submitting: false,
      });
      return;
    }

    const restoreDraft = shouldRestoreExamDraft(quiz);
    let draft: {
      answers?: StudentAnswers;
      skippedIds?: string[];
      startedAt?: number;
      deadlineAt?: number;
    } | null = null;

    if (typeof window !== 'undefined') {
      const key = examDraftStorageKey(quizCode, studentId);
      if (restoreDraft) {
        try {
          const raw = localStorage.getItem(key);
          if (raw) draft = JSON.parse(raw) as typeof draft;
        } catch {
          draft = null;
        }
      } else {
        localStorage.removeItem(key);
      }
    }

    const now = Date.now();
    let startedAt = now;
    let deadlineAt: number | null = null;

    if (restoreDraft && draft?.startedAt) {
      startedAt = draft.startedAt;
      if (draft.deadlineAt) {
        deadlineAt = draft.deadlineAt;
      } else if (quiz.timeLimitEnabled && quiz.timeLimitMinutes) {
        deadlineAt = draft.startedAt + quiz.timeLimitMinutes * 60 * 1000;
      }
    } else if (quiz.timeLimitEnabled && quiz.timeLimitMinutes) {
      deadlineAt = now + quiz.timeLimitMinutes * 60 * 1000;
    }

    // 僅「作答中」打亂顯示；答案以 questionId／選項內容儲存，伺服器以原稿批改
    set({
      quiz: applyQuizShuffle(
        quiz,
        buildQuizShuffleSeed({ quizCode, studentId, startedAt })
      ),
      quizCode,
      studentId,
      readOnly: false,
      previewMode: false,
      submission: null,
      startedAt,
      deadlineAt,
      answers: restoreDraft ? (draft?.answers ?? {}) : {},
      skippedIds: restoreDraft && Array.isArray(draft?.skippedIds) ? draft.skippedIds : [],
      submitting: false,
    });

    get().persistDraft();
  },

  setAnswer: (questionId, value) => {
    if (get().readOnly) return;
    set((state) => ({
      answers: { ...state.answers, [questionId]: value },
      skippedIds: state.skippedIds.filter((id) => id !== questionId),
    }));
    get().persistDraft();
  },

  toggleSkip: (questionId) => {
    if (get().readOnly) return;
    set((state) => {
      const isSkipped = state.skippedIds.includes(questionId);
      if (isSkipped) {
        return { skippedIds: state.skippedIds.filter((id) => id !== questionId) };
      }
      if (isQuestionAnswered(state.answers[questionId])) {
        return state;
      }
      return { skippedIds: [...state.skippedIds, questionId] };
    });
    get().persistDraft();
  },

  loadDraft: () => {
    if (get().previewMode) return;
    const { quizCode, studentId } = get();
    if (!quizCode || !studentId || typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(examDraftStorageKey(quizCode, studentId));
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        answers?: StudentAnswers;
        skippedIds?: string[];
        startedAt?: number;
        deadlineAt?: number;
      };
      if (parsed.answers || parsed.startedAt || parsed.deadlineAt) {
        set({
          answers: parsed.answers ?? get().answers,
          skippedIds: Array.isArray(parsed.skippedIds) ? parsed.skippedIds : [],
          startedAt: parsed.startedAt ?? get().startedAt,
          deadlineAt: parsed.deadlineAt ?? get().deadlineAt,
        });
      }
    } catch {
      /* ignore corrupt draft */
    }
  },

  persistDraft: () => {
    const { quizCode, studentId, answers, skippedIds, startedAt, deadlineAt, readOnly, previewMode } =
      get();
    if (readOnly || previewMode || !quizCode || !studentId || typeof window === 'undefined') return;
    localStorage.setItem(
      examDraftStorageKey(quizCode, studentId),
      JSON.stringify({ answers, skippedIds, startedAt, deadlineAt })
    );
  },

  clearDraft: () => {
    if (get().previewMode) return;
    const { quizCode, studentId } = get();
    if (!quizCode || !studentId || typeof window === 'undefined') return;
    localStorage.removeItem(examDraftStorageKey(quizCode, studentId));
    clearTakeActiveSession(studentId);
  },

  abandonVoluntaryExit: () => {
    const { quiz, readOnly, previewMode } = get();
    if (readOnly || previewMode || !quiz) return;
    get().clearDraft();
  },

  reset: () => {
    set({
      quizCode: null,
      studentId: null,
      quiz: null,
      answers: {},
      skippedIds: [],
      startedAt: null,
      deadlineAt: null,
      submission: null,
      readOnly: false,
      previewMode: false,
      submitting: false,
    });
  },

  setSubmitting: (submitting) => set({ submitting }),
  setSubmission: (submission) => set({ submission, readOnly: true, previewMode: false }),
}));

export function countAnsweredQuestions(
  answers: StudentAnswers,
  questionIds: string[]
): number {
  return questionIds.filter((id) => isQuestionAnswered(answers[id])).length;
}
