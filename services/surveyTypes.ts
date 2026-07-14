/** 課程問卷型別與輔助函式（不計分、不支援圖片） */

export type SurveyStatus = 'draft' | 'published';
export type SurveyResponseMode = 'named' | 'anonymous';
export type SurveyQuestionType = 'single' | 'multiple' | 'short_answer' | 'scale' | 'matrix';

export interface SurveyCourseRef {
  courseId: string;
  courseName: string;
}

export interface SurveyBaseQuestion {
  id: string;
  type: SurveyQuestionType;
  content: string;
  required?: boolean;
}

export interface SurveyChoiceQuestion extends SurveyBaseQuestion {
  type: 'single' | 'multiple';
  options: string[];
  /** 多選題：是否在最後一格加入「其他」自由填寫 */
  allowOther?: boolean;
}

export interface SurveyShortAnswerQuestion extends SurveyBaseQuestion {
  type: 'short_answer';
}

export interface SurveyScaleQuestion extends SurveyBaseQuestion {
  type: 'scale';
  /** 滿分（1～maxScore），預設 5，範圍 2–20 */
  maxScore: number;
  minLabel?: string;
  maxLabel?: string;
}

export interface SurveyMatrixRow {
  id: string;
  label: string;
}

export interface SurveyMatrixQuestion extends SurveyBaseQuestion {
  type: 'matrix';
  /** 欄位滿分（1～maxScore），預設 5 */
  maxScore: number;
  rows: SurveyMatrixRow[];
  minLabel?: string;
  maxLabel?: string;
}

export type SurveyQuestion =
  | SurveyChoiceQuestion
  | SurveyShortAnswerQuestion
  | SurveyScaleQuestion
  | SurveyMatrixQuestion;

export interface SurveySection {
  id: string;
  title: string;
  description?: string;
  questions: SurveyQuestion[];
}

export interface Survey {
  id: string;
  surveyCode: string;
  teacherId: string;
  assignedCourses?: SurveyCourseRef[];
  courseId?: string;
  courseName?: string;
  title: string;
  description?: string;
  status: SurveyStatus;
  sections: SurveySection[];
  /** 記名 | 不記名（仍需登入、每人限填一次；不記名時教師端不顯示姓名） */
  responseMode: SurveyResponseMode;
  answerWindowEnabled?: boolean;
  answerStartAt?: string;
  answerEndAt?: string;
  /** 每位學生最多填寫次數；未設則 1 */
  attemptLimit?: number;
  /** 填寫後是否允許學生自行查看自己的填答內容 */
  responsesVisibleToStudents?: boolean;
  order?: number;
  /** 最近一次開放給學生的時間（status→published）；隱藏後再開放會更新 */
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type SurveyInput = Omit<Survey, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

/** 單選／簡答：string；多選：字串陣列（含其他文字時以 `__other__:文字`）；量表：number；矩陣：{ [rowId]: number } */
export type SurveyAnswerValue = string | string[] | number | Record<string, number>;

export type SurveyAnswers = Record<string, SurveyAnswerValue>;

export const SURVEY_OTHER_PREFIX = '__other__:';
export const SURVEY_OTHER_OPTION_ID = '__other__';

const SURVEY_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
const SURVEY_CODE_LENGTH = 10;

export function generateSurveyId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function generateSurveyCode(): string {
  let result = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const randomValues = new Uint32Array(SURVEY_CODE_LENGTH);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < SURVEY_CODE_LENGTH; i++) {
      result += SURVEY_CODE_CHARS[randomValues[i] % SURVEY_CODE_CHARS.length];
    }
  } else {
    for (let i = 0; i < SURVEY_CODE_LENGTH; i++) {
      result += SURVEY_CODE_CHARS[Math.floor(Math.random() * SURVEY_CODE_CHARS.length)];
    }
  }
  return result;
}

export function isValidSurveyCode(code: string): boolean {
  return /^[A-Za-z0-9]{8,24}$/.test(code);
}

export function clampScaleMax(value: unknown, fallback = 5): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(20, Math.max(2, Math.round(n)));
}

export function createEmptySurveySection(index = 0): SurveySection {
  return {
    id: generateSurveyId(),
    title: index === 0 ? '' : `第 ${index + 1} 部分`,
    description: '',
    questions: [],
  };
}

export function createEmptyChoiceQuestion(type: 'single' | 'multiple'): SurveyChoiceQuestion {
  return {
    id: generateSurveyId(),
    type,
    content: '',
    options: ['選項 1', '選項 2'],
    allowOther: type === 'multiple' ? false : undefined,
    required: true,
  };
}

export function createEmptyShortAnswerQuestion(): SurveyShortAnswerQuestion {
  return {
    id: generateSurveyId(),
    type: 'short_answer',
    content: '',
    required: true,
  };
}

export function createEmptyScaleQuestion(maxScore = 5): SurveyScaleQuestion {
  return {
    id: generateSurveyId(),
    type: 'scale',
    content: '',
    maxScore: clampScaleMax(maxScore),
    minLabel: '低',
    maxLabel: '高',
    required: true,
  };
}

export function createEmptyMatrixQuestion(maxScore = 5): SurveyMatrixQuestion {
  return {
    id: generateSurveyId(),
    type: 'matrix',
    content: '',
    maxScore: clampScaleMax(maxScore),
    rows: [
      { id: generateSurveyId(), label: '' },
      { id: generateSurveyId(), label: '' },
    ],
    minLabel: '非常不同意',
    maxLabel: '非常同意',
    required: true,
  };
}

export function normalizeAssignedCourses(data: {
  assignedCourses?: SurveyCourseRef[];
  courseId?: string;
  courseName?: string;
}): SurveyCourseRef[] {
  if (Array.isArray(data.assignedCourses) && data.assignedCourses.length > 0) {
    return data.assignedCourses
      .filter((c) => c && c.courseId)
      .map((c) => ({
        courseId: String(c.courseId),
        courseName: String(c.courseName ?? ''),
      }));
  }
  if (data.courseId) {
    return [{ courseId: String(data.courseId), courseName: String(data.courseName ?? '') }];
  }
  return [];
}

export function normalizeSingleAssignedCourse(input: {
  assignedCourses?: SurveyCourseRef[];
  courseId?: string;
  courseName?: string;
}): SurveyCourseRef[] {
  const list = normalizeAssignedCourses(input);
  return list.length > 0 ? [list[0]] : [];
}

export function extractAssignedCourseIds(survey: Pick<Survey, 'assignedCourses' | 'courseId'>): string[] {
  return normalizeAssignedCourses(survey).map((c) => c.courseId);
}

function normalizeQuestion(raw: unknown): SurveyQuestion {
  const q = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const type = String(q.type || 'short_answer') as SurveyQuestionType;
  const base = {
    id: String(q.id || generateSurveyId()),
    content: String(q.content ?? ''),
    required: q.required !== false,
  };

  if (type === 'single' || type === 'multiple') {
    const options = Array.isArray(q.options)
      ? (q.options as unknown[]).map((o) => String(o ?? ''))
      : ['選項 1', '選項 2'];
    return {
      ...base,
      type,
      options: options.length > 0 ? options : ['選項 1'],
      allowOther: type === 'multiple' ? !!q.allowOther : undefined,
    };
  }

  if (type === 'scale') {
    return {
      ...base,
      type: 'scale',
      maxScore: clampScaleMax(q.maxScore, 5),
      minLabel: String(q.minLabel ?? '低'),
      maxLabel: String(q.maxLabel ?? '高'),
    };
  }

  if (type === 'matrix') {
    const rowsRaw = Array.isArray(q.rows) ? (q.rows as unknown[]) : [];
    const rows: SurveyMatrixRow[] =
      rowsRaw.length > 0
        ? rowsRaw.map((r) => {
            const row = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
            return {
              id: String(row.id || generateSurveyId()),
              label: String(row.label ?? ''),
            };
          })
        : [
            { id: generateSurveyId(), label: '' },
            { id: generateSurveyId(), label: '' },
          ];
    return {
      ...base,
      type: 'matrix',
      maxScore: clampScaleMax(q.maxScore, 5),
      rows,
      minLabel: String(q.minLabel ?? '非常不同意'),
      maxLabel: String(q.maxLabel ?? '非常同意'),
    };
  }

  return {
    ...base,
    type: 'short_answer',
  };
}

export function normalizeSection(raw: unknown, index = 0): SurveySection {
  if (!raw || typeof raw !== 'object') return createEmptySurveySection(index);
  const s = raw as Record<string, unknown>;
  const questions = Array.isArray(s.questions)
    ? (s.questions as unknown[]).map(normalizeQuestion)
    : [];
  return {
    id: String(s.id || generateSurveyId()),
    title: String(s.title || `第 ${index + 1} 部分`),
    description: String(s.description ?? ''),
    questions,
  };
}

export function ensureSurveySections(survey: Survey): Survey {
  const raw =
    Array.isArray(survey.sections) && survey.sections.length > 0
      ? survey.sections.map((s, i) => normalizeSection(s, i))
      : [createEmptySurveySection(0)];
  // 問卷不分區塊：一律收斂為單一 section
  const questions = raw.flatMap((s) => s.questions);
  const sections: SurveySection[] = [
    {
      id: raw[0]?.id || generateSurveyId(),
      title: '',
      description: '',
      questions,
    },
  ];
  return { ...survey, sections };
}

export function flattenSurveyQuestions(sections: SurveySection[]): SurveyQuestion[] {
  return sections.flatMap((s) => s.questions);
}

export function countSurveyQuestions(survey: Pick<Survey, 'sections'>): number {
  return flattenSurveyQuestions(survey.sections ?? []).length;
}

export function getSurveyMaxAttempts(survey: Pick<Survey, 'attemptLimit'>): number {
  return Math.max(1, typeof survey.attemptLimit === 'number' ? survey.attemptLimit : 1);
}

export function isSurveyAnonymous(survey: Pick<Survey, 'responseMode'>): boolean {
  return survey.responseMode === 'anonymous';
}

/** 預設允許學生查看自己的填答；明確設為 false 時關閉 */
export function isSurveyResponsesVisibleToStudents(
  survey: Pick<Survey, 'responsesVisibleToStudents'>
): boolean {
  return survey.responsesVisibleToStudents !== false;
}

export type SurveyWindowPhase = 'open' | 'upcoming' | 'ended' | 'unlimited';

export function getSurveyAnswerWindowPhase(
  survey: Pick<Survey, 'answerWindowEnabled' | 'answerStartAt' | 'answerEndAt'>
): SurveyWindowPhase {
  if (!survey.answerWindowEnabled) return 'unlimited';
  if (!survey.answerStartAt || !survey.answerEndAt) return 'ended';
  const now = Date.now();
  const start = new Date(survey.answerStartAt).getTime();
  const end = new Date(survey.answerEndAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 'ended';
  if (now < start) return 'upcoming';
  if (now > end) return 'ended';
  return 'open';
}

export function formatSurveyAnswerWindow(
  survey: Pick<Survey, 'answerWindowEnabled' | 'answerStartAt' | 'answerEndAt'>
): string {
  if (!survey.answerWindowEnabled) return '不限期間';
  const fmt = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };
  return `${fmt(survey.answerStartAt)} ~ ${fmt(survey.answerEndAt)}`;
}

export function formatSurveyResponseMode(mode: SurveyResponseMode): string {
  return mode === 'anonymous' ? '不記名' : '記名';
}

export function sortSurveysByOrder<T extends { order?: number; createdAt?: string }>(surveys: T[]): T[] {
  return [...surveys].sort((a, b) => {
    const aOrder = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
}

export function filterSurveysForCourse(
  surveys: Survey[],
  courseId: string,
  options?: { publishedOnly?: boolean }
): Survey[] {
  const publishedOnly = options?.publishedOnly === true;
  const filtered = surveys.filter((s) => {
    if (publishedOnly && s.status !== 'published') return false;
    const ids = extractAssignedCourseIds(s);
    return ids.includes(courseId);
  });
  return sortSurveysByOrder(filtered);
}

export function validateSurveyForPublish(survey: Survey): string | null {
  if (!survey.title?.trim()) return '請填寫問卷標題';
  const questions = flattenSurveyQuestions(survey.sections ?? []);
  if (questions.length === 0) return '請至少新增一題';

  for (const q of questions) {
    if (!q.content?.trim() && q.type !== 'matrix') {
      return '請填寫所有題目內容';
    }
    if (q.type === 'single' || q.type === 'multiple') {
      const opts = q.options.filter((o) => o.trim());
      if (opts.length < 2) return '選擇題至少需要兩個選項';
    }
    if (q.type === 'matrix') {
      if (!q.content?.trim() && q.rows.every((r) => !r.label.trim())) {
        return '請填寫矩陣題標題或列敘述';
      }
      const rows = q.rows.filter((r) => r.label.trim());
      if (rows.length === 0) return '矩陣題至少需要一列敘述';
      const labels = rows.map((r) => r.label.trim());
      if (new Set(labels).size !== labels.length) {
        return '矩陣量表的列敘述不可重複';
      }
    }
  }

  if (survey.answerWindowEnabled) {
    if (!survey.answerStartAt || !survey.answerEndAt) {
      return '請設定填答開始與截止時間，或改為不限日期';
    }
    const start = new Date(survey.answerStartAt).getTime();
    const end = new Date(survey.answerEndAt).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return '填答時間格式不正確';
    }
    if (end <= start) {
      return '填答截止時間必須晚於開始時間';
    }
  }

  return null;
}

export function isSurveyAssignedToCourse(
  assignedCourses: SurveyCourseRef[],
  course: { id?: string; code?: string; name?: string }
): boolean {
  return assignedCourses.some(
    (c) =>
      (course.id && c.courseId === course.id) ||
      (course.code && c.courseId === course.code) ||
      (course.name && c.courseName.includes(course.name))
  );
}

export function toDatetimeLocalValue(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(local: string): string | undefined {
  if (!local.trim()) return undefined;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function parseOtherAnswer(value: string): { isOther: boolean; text: string } {
  if (value.startsWith(SURVEY_OTHER_PREFIX)) {
    return { isOther: true, text: value.slice(SURVEY_OTHER_PREFIX.length) };
  }
  return { isOther: false, text: value };
}

export function encodeOtherAnswer(text: string): string {
  return `${SURVEY_OTHER_PREFIX}${text}`;
}

/** 教師端／總表：將作答值格式化為可讀文字 */
export function formatSurveyAnswerForDisplay(
  question: SurveyQuestion,
  value: SurveyAnswerValue | undefined
): string {
  if (value === undefined || value === null || value === '') return '—';

  if (question.type === 'single') {
    return typeof value === 'string' ? value : String(value);
  }

  if (question.type === 'multiple') {
    if (!Array.isArray(value) || value.length === 0) return '—';
    return value
      .map((item) => {
        const parsed = parseOtherAnswer(String(item));
        if (parsed.isOther) {
          return parsed.text.trim() ? `其他：${parsed.text.trim()}` : '其他';
        }
        return String(item);
      })
      .join('、');
  }

  if (question.type === 'short_answer') {
    const text = typeof value === 'string' ? value.trim() : String(value).trim();
    return text || '—';
  }

  if (question.type === 'scale') {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? String(n) : '—';
  }

  if (question.type === 'matrix') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return '—';
    const map = value as Record<string, number>;
    const parts = question.rows
      .filter((r) => r.label.trim())
      .map((row) => {
        const score = map[row.id];
        if (score === undefined || score === null) return null;
        return `${row.label}：${score}`;
      })
      .filter(Boolean);
    return parts.length > 0 ? parts.join('；') : '—';
  }

  return '—';
}

