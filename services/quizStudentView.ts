import type { GridCellAnswer, Question, Quiz, SubQuestion, QuizCourseRef } from './quizTypes';
import {
  ensureQuizSections,
  getFillInCellSubNumber,
  isChoiceQuestion,
  isFillInQuestion,
  isGroupQuestion,
  isShortAnswerQuestion,
  isTrueFalseQuestion,
  normalizeAssignedCourses,
  isQuizAnswerWindowOpen,
  getQuizAnswerWindowPhase,
  isQuizResultsPublished,
} from './quizTypes';
import type { QuizSubmission } from './quizSubmissionTypes';
import {
  enrolledKeyMatchesCourse,
  getCourseCompositeKey,
  parseCourseDisplayName,
  parseCourseCompositeId,
  type CourseRefTarget,
} from './courseId';

function stripSubQuestion(q: SubQuestion): SubQuestion {
  if (isChoiceQuestion(q)) {
    return { ...q, correctAnswers: [] };
  }
  if (isTrueFalseQuestion(q)) {
    return { ...q, correctAnswer: false };
  }
  if (isFillInQuestion(q)) {
    return {
      ...q,
      cells: q.cells.map((c) => ({ ...c, correctAnswer: '0' as GridCellAnswer })),
    };
  }
  if (isShortAnswerQuestion(q)) {
    return { ...q, referenceAnswer: undefined };
  }
  return q;
}

function stripQuestion(q: Question): Question {
  if (isGroupQuestion(q)) {
    return { ...q, subQuestions: q.subQuestions.map(stripSubQuestion) };
  }
  return stripSubQuestion(q) as Question;
}

/** 移除正確答案，供學生端載入測驗 */
export function sanitizeQuizForStudent(quiz: Quiz): Quiz {
  const safe = ensureQuizSections(quiz);
  return {
    ...safe,
    sections: safe.sections.map((section) => ({
      ...section,
      questions: section.questions.map(stripQuestion),
    })),
  };
}

/** 學生作答中隱藏答案；檢視已公布成績的紀錄時保留正確答案 */
export function getQuizForStudentExam(
  quiz: Quiz,
  options: { reviewMode: boolean; resultsPublished: boolean }
): Quiz {
  if (options.reviewMode && options.resultsPublished) {
    return ensureQuizSections(quiz);
  }
  return sanitizeQuizForStudent(quiz);
}

export interface QuizAnswerKeyEntry {
  correctAnswers?: string[];
  correctAnswer?: boolean;
  cells?: Array<{ id: string; correctAnswer: GridCellAnswer; subNumber?: number }>;
  referenceAnswer?: string;
}

export interface QuizAnswerKey {
  byQuestionId: Record<string, QuizAnswerKeyEntry>;
}

function collectAnswerKeyEntry(q: Question | SubQuestion): QuizAnswerKeyEntry | null {
  if (isChoiceQuestion(q)) {
    return { correctAnswers: [...q.correctAnswers] };
  }
  if (isTrueFalseQuestion(q)) {
    return { correctAnswer: q.correctAnswer };
  }
  if (isFillInQuestion(q)) {
    return {
      cells: q.cells.map((c, i) => ({
        id: c.id,
        subNumber: getFillInCellSubNumber(c, i),
        correctAnswer: c.correctAnswer,
      })),
    };
  }
  if (isShortAnswerQuestion(q)) {
    return q.referenceAnswer ? { referenceAnswer: q.referenceAnswer } : null;
  }
  return null;
}

/** 從完整測驗抽出正確答案（供檢視紀錄時獨立回傳，避免題目被脫敏） */
export function extractQuizAnswerKey(quiz: Quiz): QuizAnswerKey {
  const full = ensureQuizSections(quiz);
  const byQuestionId: Record<string, QuizAnswerKeyEntry> = {};

  for (const section of full.sections) {
    for (const question of section.questions) {
      if (isGroupQuestion(question)) {
        for (const sub of question.subQuestions) {
          const entry = collectAnswerKeyEntry(sub);
          if (entry) byQuestionId[sub.id] = entry;
        }
      } else {
        const entry = collectAnswerKeyEntry(question);
        if (entry) byQuestionId[question.id] = entry;
      }
    }
  }

  return { byQuestionId };
}

function mergeAnswerKeyIntoSubQuestion(
  q: SubQuestion,
  byQuestionId: Record<string, QuizAnswerKeyEntry>
): SubQuestion {
  const entry = byQuestionId[q.id];
  if (!entry) return q;

  if (isChoiceQuestion(q) && entry.correctAnswers && entry.correctAnswers.length > 0) {
    return { ...q, correctAnswers: [...entry.correctAnswers] };
  }
  if (isTrueFalseQuestion(q) && typeof entry.correctAnswer === 'boolean') {
    return { ...q, correctAnswer: entry.correctAnswer };
  }
  if (isFillInQuestion(q) && entry.cells) {
    const byId = new Map(entry.cells.map((c) => [c.id, c.correctAnswer]));
    const bySubNumber = new Map<number, GridCellAnswer>();
    entry.cells.forEach((c, i) => {
      const sub = c.subNumber ?? i + 1;
      bySubNumber.set(sub, c.correctAnswer);
    });
    return {
      ...q,
      cells: q.cells.map((c, i) => {
        const sub = getFillInCellSubNumber(c, i);
        return {
          ...c,
          correctAnswer: byId.get(c.id) ?? bySubNumber.get(sub) ?? c.correctAnswer,
        };
      }),
    };
  }
  if (isShortAnswerQuestion(q) && entry.referenceAnswer !== undefined) {
    return { ...q, referenceAnswer: entry.referenceAnswer };
  }
  return q;
}

function mergeAnswerKeyIntoQuestion(
  q: Question,
  byQuestionId: Record<string, QuizAnswerKeyEntry>
): Question {
  if (isGroupQuestion(q)) {
    return {
      ...q,
      subQuestions: q.subQuestions.map((sub) => mergeAnswerKeyIntoSubQuestion(sub, byQuestionId)),
    };
  }
  return mergeAnswerKeyIntoSubQuestion(q, byQuestionId) as Question;
}

/** 將獨立答案鍵合併回學生端測驗（檢視作答紀錄用） */
export function applyQuizAnswerKey(quiz: Quiz, answerKey: QuizAnswerKey | undefined | null): Quiz {
  if (!answerKey?.byQuestionId || Object.keys(answerKey.byQuestionId).length === 0) {
    return quiz;
  }
  return {
    ...quiz,
    sections: quiz.sections.map((section) => ({
      ...section,
      questions: section.questions.map((q) =>
        mergeAnswerKeyIntoQuestion(q, answerKey.byQuestionId)
      ),
    })),
  };
}

function assignedCourseToTarget(ref: QuizCourseRef): CourseRefTarget {
  const fromName = parseCourseDisplayName(ref.courseName);
  if (fromName) {
    return { id: ref.courseId, name: fromName.name, code: fromName.code };
  }
  const fromId = parseCourseDisplayName(ref.courseId) ?? parseCourseCompositeId(ref.courseId);
  if (fromId) {
    return { id: ref.courseId, name: fromId.name, code: fromId.code };
  }
  return { id: ref.courseId, name: ref.courseName, code: '' };
}

/** 學生是否已報名測驗的任一適用課程 */
export function isStudentEnrolledInQuiz(quiz: Quiz, enrolledCourseKeys: string[]): boolean {
  const assigned = normalizeAssignedCourses(quiz);
  if (assigned.length === 0) return false;
  if (enrolledCourseKeys.length === 0) return false;

  return assigned.some((ref) => {
    const target = assignedCourseToTarget(ref);
    return enrolledCourseKeys.some((key) => enrolledKeyMatchesCourse(key, target));
  });
}

/** 測驗指派課程是否包含指定課程（依 id / 名稱+代碼比對） */
export function isQuizAssignedToCourse(
  assignedCourses: QuizCourseRef[] | undefined,
  course: CourseRefTarget
): boolean {
  if (!assignedCourses || assignedCourses.length === 0) return false;
  const courseKeys = [
    course.id,
    course.code ? getCourseCompositeKey(course.name, course.code) : '',
  ].filter(Boolean);

  return assignedCourses.some((ref) => {
    const target = assignedCourseToTarget(ref);
    return courseKeys.some((key) => enrolledKeyMatchesCourse(key, target));
  });
}

export function isQuizAccessibleToStudent(
  quiz: Quiz,
  enrolledCourseIds: string[]
): { ok: boolean; reason?: string } {
  if (quiz.status !== 'published') {
    return { ok: false, reason: '此測驗尚未開放' };
  }

  const windowPhase = getQuizAnswerWindowPhase(quiz);
  if (windowPhase === 'upcoming') {
    return { ok: false, reason: '作答期間尚未開始' };
  }
  if (windowPhase === 'ended') {
    return { ok: false, reason: '作答期間已截止' };
  }
  // Defensive: enabled window but incomplete dates → treat as closed
  if (quiz.answerWindowEnabled && !isQuizAnswerWindowOpen(quiz)) {
    return { ok: false, reason: '目前不在作答開放時間內' };
  }

  const assigned = normalizeAssignedCourses(quiz);
  if (assigned.length === 0) {
    return { ok: false, reason: '此測驗尚未指定適用班級' };
  }

  if (!isStudentEnrolledInQuiz(quiz, enrolledCourseIds)) {
    return { ok: false, reason: '您未報名此測驗的適用課程，無法作答' };
  }

  return { ok: true };
}

/** 學生端隱藏尚未公布的成績與逐題批改結果（仍可檢視自己的作答內容） */
export function sanitizeSubmissionForStudent(
  submission: QuizSubmission,
  quiz: Pick<Quiz, 'resultsPublished'>
): QuizSubmission {
  if (isQuizResultsPublished(quiz)) return submission;
  return {
    ...submission,
    totalScore: 0,
    answers: submission.answers.map((a) => ({
      ...a,
      score: 0,
      isCorrect: undefined,
      teacherComment: undefined,
    })),
  };
}

export interface StudentExamAttemptSummary {
  id: string;
  attemptIndex: number;
  submittedAt: string;
  totalScore: number | null;
  status: string;
}

/** 學生端作答紀錄列表（依提交時間排序） */
export function buildStudentAttemptSummaries(
  quiz: Pick<Quiz, 'resultsPublished'>,
  submissions: QuizSubmission[]
): StudentExamAttemptSummary[] {
  return [...submissions]
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    .map((sub, index) => {
      const safe = sanitizeSubmissionForStudent(sub, quiz);
      return {
        id: sub.id,
        attemptIndex: sub.attemptIndex ?? index + 1,
        submittedAt: sub.submittedAt,
        totalScore: safe.totalScore,
        status: sub.status,
      };
    });
}
