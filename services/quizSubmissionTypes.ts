import type { GridCellAnswer, McScoringMethod, Question, SubQuestion, ChoiceQuestion, AttemptScorePolicy } from './quizTypes';
import {
  buildQuizQuestionNumberList,
  isContinuousQuestionNumbers,
  getQuizAttemptScorePolicy,
  isChoiceQuestion,
  isFillInQuestion,
  isGroupQuestion,
  isShortAnswerQuestion,
  isTrueFalseQuestion,
  type Quiz,
} from './quizTypes';
import { isHtmlEmpty } from '@/utils/richText';
import { choiceListIncludes } from '@/utils/quizChoiceMatch';
import type { FiveMarkStatistics } from './fiveMarkStats';
import { getTaiwanPercentileLevels } from './fiveMarkStats';

export type SubmissionStatus = 'submitted' | 'grading' | 'graded';
export type AnswerGradingStatus = 'auto' | 'manual' | 'pending';

/** 學生作答狀態（以題目 id 為鍵） */
export interface StudentAnswers {
  [questionId: string]: string | string[] | boolean | Record<string, GridCellAnswer>;
}

export interface GradeResult {
  answers: QuestionAnswerRecord[];
  totalScore: number;
  maxScore: number;
  objectiveScore: number;
  hasPendingManual: boolean;
  status: SubmissionStatus;
}

export interface QuestionAnswerRecord {
  questionId: string;
  questionNumber: number;
  questionType: string;
  /** 學生作答 */
  response: unknown;
  score: number;
  maxScore: number;
  gradingStatus: AnswerGradingStatus;
  teacherComment?: string;
  isCorrect?: boolean;
}

/** 簡答題手動給分：限制在 0～該題配分 */
export function clampManualAnswerScore(score: number, maxScore: number): number {
  const max = Math.max(0, maxScore);
  const n = Number.isFinite(score) ? score : 0;
  return Math.round(Math.min(max, Math.max(0, n)) * 100) / 100;
}

/** 簡答題僅滿分視為正確，其餘（含部分給分）皆標示不正確 */
export function isShortAnswerFullCredit(score: number, maxScore: number): boolean {
  if (maxScore <= 0) return true;
  return clampManualAnswerScore(score, maxScore) >= maxScore;
}

export function shortAnswerCorrectnessLabel(score: number, maxScore: number): 'correct' | 'incorrect' | 'pending' {
  if (maxScore <= 0) return 'correct';
  const clamped = clampManualAnswerScore(score, maxScore);
  if (clamped >= maxScore) return 'correct';
  return clamped > 0 ? 'incorrect' : 'incorrect';
}

export interface QuizSubmission {
  id: string;
  quizId: string;
  teacherId: string;
  studentId: string;
  studentName: string;
  answers: QuestionAnswerRecord[];
  totalScore: number;
  maxScore: number;
  status: SubmissionStatus;
  submittedAt: string;
  gradedAt?: string;
  /** 最後手動批改此份作答的老師 ID */
  gradedByTeacherId?: string;
  /** 顯示用：最後手動批改的老師姓名 */
  gradedByTeacherName?: string;
  /** 第幾次提交（從 1 起算） */
  attemptIndex?: number;
}

export interface QuizAnalytics {
  quizId: string;
  submissionCount: number;
  /** 測驗適用課程學生總數 */
  enrolledCount: number;
  /** 已繳交的課程學生數（以學號計，多次提交算一人） */
  submittedStudentCount: number;
  /** 尚未繳交的課程學生數 */
  notSubmittedStudentCount: number;
  averageScore: number;
  maxScore: number;
  highestScore: number;
  lowestScore: number;
  passRate: number;
  /** 五標（與成績管理相同百分位算法，以原始分數計算） */
  fiveMarkStats: FiveMarkStatistics | null;
  scoreDistribution: { range: string; count: number }[];
  questionStats: {
    questionId: string;
    questionNumber: number;
    questionType: string;
    maxScore: number;
    averageScore: number;
    correctRate: number;
    attemptCount: number;
  }[];
  courseScopes?: { id: string; label: string }[];
  activeCourseScope?: string;
}

export function flattenGradableQuestions(quiz: Quiz): (Question | SubQuestion)[] {
  const list: (Question | SubQuestion)[] = [];
  for (const section of quiz.sections) {
    for (const q of section.questions) {
      if (isGroupQuestion(q)) {
        list.push(...q.subQuestions);
      } else {
        list.push(q);
      }
    }
  }
  return list;
}

export function getQuestionMaxScore(q: Question | SubQuestion): number {
  return q.points || 0;
}

function countMultipleChoiceErrors(question: ChoiceQuestion, selected: string[]): number {
  if (question.type !== 'multiple') return 0;
  let n = 0;
  for (const opt of question.options) {
    if (isHtmlEmpty(opt)) continue;
    const shouldSelect = choiceListIncludes(question.correctAnswers, opt);
    const isSelected = choiceListIncludes(selected, opt);
    if (shouldSelect !== isSelected) n++;
  }
  return n;
}

function readFillInCellAnswer(
  response: unknown,
  cellId: string,
  cellIndex: number
): GridCellAnswer | undefined {
  if (response && typeof response === 'object' && !Array.isArray(response)) {
    const val = (response as Record<string, string>)[cellId];
    return val as GridCellAnswer | undefined;
  }
  if (Array.isArray(response)) {
    return response[cellIndex] as GridCellAnswer | undefined;
  }
  return undefined;
}

export function autoGradeAnswer(
  question: Question | SubQuestion,
  response: unknown,
  mcScoringMethod: McScoringMethod = 'average'
): { score: number; isCorrect: boolean; gradingStatus: AnswerGradingStatus } {
  const max = getQuestionMaxScore(question);

  if (isChoiceQuestion(question)) {
    const selected = Array.isArray(response) ? (response as string[]) : response ? [String(response)] : [];

    if (question.type === 'single') {
      const correct = question.correctAnswers.filter((a) => !isHtmlEmpty(a));
      const isCorrect = selected.length === 1 && choiceListIncludes(correct, selected[0]);
      return { score: isCorrect ? max : 0, isCorrect, gradingStatus: 'auto' };
    }

    const k = question.options.filter((o) => !isHtmlEmpty(o)).length;
    if (k === 0) return { score: 0, isCorrect: false, gradingStatus: 'auto' };

    const n = countMultipleChoiceErrors(question, selected);
    let score = 0;
    if (mcScoringMethod === 'taiwan_gsat') {
      score = max * Math.max(0, (k - 2 * n) / k);
    } else {
      score = max * ((k - n) / k);
    }
    const isCorrect = n === 0;
    return { score: Math.round(score * 100) / 100, isCorrect, gradingStatus: 'auto' };
  }

  if (isTrueFalseQuestion(question)) {
    const isCorrect = response === question.correctAnswer;
    return { score: isCorrect ? max : 0, isCorrect, gradingStatus: 'auto' };
  }

  if (isFillInQuestion(question)) {
    if (question.cells.length === 0) {
      return { score: 0, isCorrect: false, gradingStatus: 'auto' };
    }
    const allMatch = question.cells.every((cell, i) => {
      const studentAns = readFillInCellAnswer(response, cell.id, i);
      return studentAns === cell.correctAnswer;
    });
    const allFilled = question.cells.every((cell, i) => {
      const studentAns = readFillInCellAnswer(response, cell.id, i);
      return studentAns !== undefined && studentAns !== null;
    });
    const isCorrect = allMatch && allFilled;
    return { score: isCorrect ? max : 0, isCorrect, gradingStatus: 'auto' };
  }

  if (isShortAnswerQuestion(question)) {
    return { score: 0, isCorrect: false, gradingStatus: 'pending' };
  }

  return { score: 0, isCorrect: false, gradingStatus: 'auto' };
}

export function buildAnswerRecordsFromStudentAnswers(
  quiz: Quiz,
  studentAnswers: StudentAnswers
): QuestionAnswerRecord[] {
  const numbered = buildQuizQuestionNumberList(
    quiz.sections,
    isContinuousQuestionNumbers(quiz)
  );
  return numbered.map((entry) => ({
    questionId: entry.id,
    questionNumber: entry.number,
    questionType: entry.question.type,
    response: studentAnswers[entry.id] ?? null,
    score: 0,
    maxScore: getQuestionMaxScore(entry.question),
    gradingStatus: entry.question.type === 'short_answer' ? ('pending' as const) : ('auto' as const),
  }));
}

/** 依學生作答執行自動閱卷 */
export function gradeStudentSubmission(quiz: Quiz, studentAnswers: StudentAnswers): GradeResult {
  const records = buildAnswerRecordsFromStudentAnswers(quiz, studentAnswers);
  const graded = gradeSubmission(quiz, records);
  const totals = calculateSubmissionTotal(graded);
  const hasPendingManual = graded.some((a) => a.gradingStatus === 'pending');
  const objectiveScore = graded
    .filter((a) => a.gradingStatus !== 'pending')
    .reduce((sum, a) => sum + a.score, 0);

  return {
    answers: graded,
    totalScore: totals.total,
    maxScore: totals.max,
    objectiveScore,
    hasPendingManual,
    status: hasPendingManual ? 'grading' : 'graded',
  };
}

export function gradeSubmission(quiz: Quiz, answers: QuestionAnswerRecord[]): QuestionAnswerRecord[] {
  const mcMethod = quiz.mcScoringMethod ?? 'average';
  const questionMap = new Map<string, Question | SubQuestion>();
  for (const q of flattenGradableQuestions(quiz)) {
    questionMap.set(q.id, q);
  }

  return answers.map((a) => {
    const q = questionMap.get(a.questionId);
    if (!q) return a;
    if (isShortAnswerQuestion(q)) {
      const maxScore = getQuestionMaxScore(q);
      if (a.gradingStatus === 'manual') {
        return {
          ...a,
          maxScore,
          isCorrect: isShortAnswerFullCredit(a.score, maxScore),
          gradingStatus: 'manual' as const,
        };
      }
      return { ...a, maxScore, gradingStatus: 'pending' as const, isCorrect: false };
    }
    const graded = autoGradeAnswer(q, a.response, mcMethod);
    return {
      ...a,
      maxScore: getQuestionMaxScore(q),
      score: graded.score,
      isCorrect: graded.isCorrect,
      gradingStatus: graded.gradingStatus,
    };
  });
}

export function calculateSubmissionTotal(answers: QuestionAnswerRecord[]): { total: number; max: number } {
  return answers.reduce(
    (acc, a) => ({ total: acc.total + (a.score || 0), max: acc.max + (a.maxScore || 0) }),
    { total: 0, max: 0 }
  );
}

function sortSubmissionsByDateDesc(submissions: QuizSubmission[]): QuizSubmission[] {
  return [...submissions].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

export function groupSubmissionsByStudent(
  submissions: QuizSubmission[]
): Map<string, QuizSubmission[]> {
  const map = new Map<string, QuizSubmission[]>();
  for (const sub of submissions) {
    const list = map.get(sub.studentId) ?? [];
    list.push(sub);
    map.set(sub.studentId, list);
  }
  return map;
}

export function resolveEffectiveScore(
  submissions: QuizSubmission[],
  policy: AttemptScorePolicy
): number | null {
  if (!submissions.length) return null;
  const scores = submissions.map((s) => s.totalScore);
  switch (policy) {
    case 'highest':
      return Math.max(...scores);
    case 'lowest':
      return Math.min(...scores);
    case 'average':
      return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
    case 'latest':
    default:
      return sortSubmissionsByDateDesc(submissions)[0].totalScore;
  }
}

export function resolveEffectiveSubmission(
  submissions: QuizSubmission[],
  policy: AttemptScorePolicy
): QuizSubmission | null {
  if (!submissions.length) return null;
  const sorted = sortSubmissionsByDateDesc(submissions);
  switch (policy) {
    case 'highest':
      return [...submissions].sort((a, b) => b.totalScore - a.totalScore)[0];
    case 'lowest':
      return [...submissions].sort((a, b) => a.totalScore - b.totalScore)[0];
    case 'average': {
      const avg = resolveEffectiveScore(submissions, 'average') ?? 0;
      return { ...sorted[0], totalScore: avg };
    }
    case 'latest':
    default:
      return sorted[0];
  }
}

export function pickOneSubmissionPerStudent(
  submissions: QuizSubmission[],
  quiz: Pick<Quiz, 'attemptScorePolicy'>
): QuizSubmission[] {
  const policy = getQuizAttemptScorePolicy(quiz);
  const byStudent = groupSubmissionsByStudent(submissions);
  const result: QuizSubmission[] = [];
  for (const subs of byStudent.values()) {
    const picked = resolveEffectiveSubmission(subs, policy);
    if (picked) result.push(picked);
  }
  return result;
}

export function buildAnalytics(
  quiz: Quiz,
  submissions: QuizSubmission[],
  rosterCounts?: { enrolledCount: number; submittedStudentCount: number; notSubmittedStudentCount: number }
): QuizAnalytics {
  const scoredSubmissions = pickOneSubmissionPerStudent(submissions, quiz);
  const numbered = buildQuizQuestionNumberList(
    quiz.sections,
    isContinuousQuestionNumbers(quiz)
  );
  const maxScore = quiz.totalPoints || calculateSubmissionTotal(
    numbered.map((n) => ({
      questionId: n.id,
      questionNumber: n.number,
      questionType: n.question.type,
      response: null,
      score: 0,
      maxScore: getQuestionMaxScore(n.question),
      gradingStatus: 'auto' as const,
    }))
  ).max;

  const scores = scoredSubmissions.map((s) => s.totalScore);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const passThreshold = maxScore * 0.6;

  const buckets = [
    { range: '0-59%', count: 0 },
    { range: '60-69%', count: 0 },
    { range: '70-79%', count: 0 },
    { range: '80-89%', count: 0 },
    { range: '90-100%', count: 0 },
  ];
  for (const s of scores) {
    const pct = maxScore > 0 ? (s / maxScore) * 100 : 0;
    if (pct < 60) buckets[0].count++;
    else if (pct < 70) buckets[1].count++;
    else if (pct < 80) buckets[2].count++;
    else if (pct < 90) buckets[3].count++;
    else buckets[4].count++;
  }

  const questionStats = numbered.map((entry) => {
    const qAnswers = scoredSubmissions.flatMap((sub) =>
      sub.answers.filter((a) => a.questionId === entry.id)
    );
    const attemptCount = qAnswers.length;
    const averageScore = attemptCount
      ? qAnswers.reduce((s, a) => s + a.score, 0) / attemptCount
      : 0;
    const correctCount = qAnswers.filter((a) => a.isCorrect).length;
    return {
      questionId: entry.id,
      questionNumber: entry.number,
      questionType: entry.question.type,
      maxScore: getQuestionMaxScore(entry.question),
      averageScore: Math.round(averageScore * 100) / 100,
      correctRate: attemptCount ? Math.round((correctCount / attemptCount) * 100) : 0,
      attemptCount,
    };
  });

  const submittedStudentIds = new Set(scoredSubmissions.map((s) => s.studentId));
  const enrolledCount = rosterCounts?.enrolledCount ?? submittedStudentIds.size;
  const submittedStudentCount =
    rosterCounts?.submittedStudentCount ??
    submittedStudentIds.size;
  const notSubmittedStudentCount =
    rosterCounts?.notSubmittedStudentCount ??
    Math.max(0, enrolledCount - submittedStudentCount);

  return {
    quizId: quiz.id,
    submissionCount: submissions.length,
    enrolledCount,
    submittedStudentCount,
    notSubmittedStudentCount,
    averageScore: Math.round(avg * 100) / 100,
    maxScore,
    highestScore: scores.length ? Math.max(...scores) : 0,
    lowestScore: scores.length ? Math.min(...scores) : 0,
    passRate: scores.length ? Math.round((scores.filter((s) => s >= passThreshold).length / scores.length) * 100) : 0,
    fiveMarkStats: scores.length ? getTaiwanPercentileLevels(scores) : null,
    scoreDistribution: buckets,
    questionStats,
  };
}
