import type { Quiz } from './quizTypes';
import { normalizeAssignedCourses, sortQuizzesByOrder } from './quizTypes';
import type { QuizSubmission } from './quizSubmissionTypes';
import { pickOneSubmissionPerStudent } from './quizSubmissionTypes';
import { DEFAULT_PERIODIC_ITEM_KEYS } from './gradeShape';

export type GradeImportTarget = 'regular' | 'periodic';

export const ONLINE_QUIZ_NAME_SUFFIX = '（線上測驗）';

/** 匯入成績項目名稱後方加註線上測驗標記 */
export function formatImportedQuizName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return ONLINE_QUIZ_NAME_SUFFIX;
  if (trimmed.endsWith(ONLINE_QUIZ_NAME_SUFFIX)) return trimmed;
  return `${trimmed}${ONLINE_QUIZ_NAME_SUFFIX}`;
}

export interface ColumnDetailLike {
  type?: string;
  name?: string;
  date?: string;
  maxScore?: number;
}

export interface ImportPreviewRow {
  studentId: string;
  name: string;
  quizScore: number;
  gradeScore: number;
  status: 'matched' | 'no_submission';
}

export interface ImportPreviewResult {
  rows: ImportPreviewRow[];
  matchedCount: number;
  noSubmissionCount: number;
  quizMaxScore: number;
}

/** 篩選指派給指定課程的測驗（成績匯入預設僅已發布；課程管理請傳 publishedOnly: false） */
export function filterQuizzesForCourse(
  quizzes: Quiz[],
  courseId: string,
  options?: { publishedOnly?: boolean }
): Quiz[] {
  const publishedOnly = options?.publishedOnly !== false;
  const filtered = quizzes.filter((q) => {
    if (publishedOnly && q.status !== 'published') return false;
    return normalizeAssignedCourses(q).some((c) => c.courseId === courseId);
  });
  return sortQuizzesByOrder(filtered);
}

/** 測驗結束日期轉為 date input 格式 (YYYY-MM-DD) */
export function getQuizEndDateInput(quiz: Quiz): string {
  if (!quiz.answerWindowEnabled || !quiz.answerEndAt) return '';
  const d = new Date(quiz.answerEndAt);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 平時欄位是否尚未設定（無名稱且無日期） */
export function isRegularColumnEmpty(d?: ColumnDetailLike): boolean {
  return !d?.name?.trim() && !d?.date?.trim();
}

/** 找出下一個可填入的平時欄位索引 */
export function findNextEmptyRegularColumnIndex(
  columnDetails: Record<string, ColumnDetailLike>,
  regularColumns: number
): number {
  for (let i = 0; i < regularColumns; i++) {
    if (isRegularColumnEmpty(columnDetails[String(i)])) return i;
  }
  return regularColumns;
}

/** 將測驗原始分數換算為成績欄滿分制 */
export function scaleQuizScoreToGrade(
  totalScore: number,
  quizMaxScore: number,
  gradeMaxScore: number
): number {
  if (quizMaxScore <= 0) return 0;
  return Math.round((totalScore / quizMaxScore) * gradeMaxScore);
}

/** 建立匯入預覽：依學號比對課程學生與測驗成績 */
export function buildImportPreview(
  courseStudents: { studentId: string; name: string }[],
  submissions: QuizSubmission[],
  quiz: Quiz,
  gradeMaxScore: number
): ImportPreviewResult {
  const picked = pickOneSubmissionPerStudent(submissions, quiz);
  const byStudentId = new Map(picked.map((s) => [s.studentId, s]));
  const quizMaxScore = quiz.totalPoints || picked[0]?.maxScore || 100;

  const rows: ImportPreviewRow[] = courseStudents.map((stu) => {
    const sub = byStudentId.get(stu.studentId);
    if (!sub) {
      return {
        studentId: stu.studentId,
        name: stu.name,
        quizScore: 0,
        gradeScore: 0,
        status: 'no_submission',
      };
    }
    return {
      studentId: stu.studentId,
      name: stu.name,
      quizScore: sub.totalScore,
      gradeScore: scaleQuizScoreToGrade(sub.totalScore, quizMaxScore, gradeMaxScore),
      status: 'matched',
    };
  });

  return {
    rows,
    matchedCount: rows.filter((r) => r.status === 'matched').length,
    noSubmissionCount: rows.filter((r) => r.status === 'no_submission').length,
    quizMaxScore,
  };
}

export const PERIODIC_KEY_OPTIONS = DEFAULT_PERIODIC_ITEM_KEYS.map((k) => ({
  value: k,
  label: k,
}));
