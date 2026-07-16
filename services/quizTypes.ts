import { isHtmlEmpty } from '@/utils/richText';
export type QuizStatus = 'draft' | 'published';
export type McScoringMethod = 'average' | 'taiwan_gsat';
export type OptionLabelStyle = 'letter_paren' | 'number_paren';
export type OptionLayout = 'horizontal' | 'vertical';
export type GridCellAnswer = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '-' | '±';

export type QuestionType = 'single' | 'multiple' | 'fill_in' | 'tf' | 'short_answer' | 'group';

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  content: string;
  points: number;
}

export interface ChoiceQuestion extends BaseQuestion {
  type: 'single' | 'multiple';
  options: string[];
  correctAnswers: string[];
  /** 選項標示：(A)(B) 或 (1)(2)，未設則用整卷預設 */
  optionLabelStyle?: OptionLabelStyle;
  optionLayout?: OptionLayout;
}

export interface GridCell {
  id: string;
  label: string;
  correctAnswer: GridCellAnswer;
}

export interface TaiwanFillInQuestion extends BaseQuestion {
  type: 'fill_in';
  cells: GridCell[];
}

export interface TrueFalseQuestion extends BaseQuestion {
  type: 'tf';
  correctAnswer: boolean;
}

export interface ShortAnswerQuestion extends BaseQuestion {
  type: 'short_answer';
  /** 參考答案（僅供老師批改參考，系統不自動比對） */
  referenceAnswer?: string;
}

export interface GroupQuestion extends BaseQuestion {
  type: 'group';
  subQuestions: SubQuestion[];
  /** 是否打亂此題組內子題順序（與大題題目排序獨立；大題打亂時題組仍整組移動） */
  shuffleSubQuestions?: boolean;
}

export type SubQuestion = ChoiceQuestion | TaiwanFillInQuestion | TrueFalseQuestion | ShortAnswerQuestion;
export type Question = ChoiceQuestion | TaiwanFillInQuestion | TrueFalseQuestion | ShortAnswerQuestion | GroupQuestion;

export interface QuizSection {
  id: string;
  title: string;
  description?: string;
  questions: Question[];
  /** 此大題新增題目時的預設配分（題組則套用至子題） */
  defaultPoints?: number;
  /** 是否打亂此大題內的題目順序（題組以整組為單位，不拆開子題） */
  shuffleQuestions?: boolean;
  /** 是否打亂此大題內單選／多選題的選項順序（不含題組子題） */
  shuffleOptions?: boolean;
}

export interface QuizCourseRef {
  courseId: string;
  courseName: string;
}

export interface Quiz {
  id: string;
  /** 考卷識別碼（URL 與學生作答入口用，大小寫英文+數字） */
  quizCode: string;
  teacherId: string;
  /** @deprecated 請改用 assignedCourses */
  courseId?: string;
  /** @deprecated 請改用 assignedCourses */
  courseName?: string;
  /** 適用班級（單一班級；舊資料可能仍有多筆，寫入時會收斂為一筆） */
  assignedCourses?: QuizCourseRef[];
  title: string;
  description?: string;
  status: QuizStatus;
  sections: QuizSection[];
  /** 向下相容舊資料 */
  questions?: Question[];
  totalPoints: number;
  timeLimitEnabled?: boolean;
  timeLimitMinutes?: number;
  /** 作答開始時間（ISO）；啟用作答期間時必填 */
  answerStartAt?: string;
  /** 作答截止時間（ISO）；啟用作答期間時必填 */
  answerEndAt?: string;
  /** 是否限制作答期間；未啟用則不限日期 */
  answerWindowEnabled?: boolean;
  /** 整份考卷多選題計分方式 */
  mcScoringMethod?: McScoringMethod;
  /** 選擇題選項標示：(A)(B) 或 (1)(2) */
  optionLabelStyle?: OptionLabelStyle;
  /** 是否允許無限次作答；false 時以 attemptLimit 為上限 */
  attemptUnlimited?: boolean;
  /** 每位學生最多可提交次數（attemptUnlimited 為 false 時有效，預設 1） */
  attemptLimit?: number;
  /** 是否已向學生公布成績與答案；false 為暫不公布 */
  resultsPublished?: boolean;
  /** 多次作答時成績採計方式；單次作答時無實質影響 */
  attemptScorePolicy?: AttemptScorePolicy;
  /** 作答期間禁止離開測驗頁（重新載入可從暫存恢復） */
  examLockEnabled?: boolean;
  /** 學生作答時要求全螢幕 */
  requireFullscreen?: boolean;
  /** 大題間題號是否連續；false 時各大題從 1 重新編號 */
  continuousQuestionNumbers?: boolean;
  /** 同一課程內的顯示順序（越小越前；老師端與學生端共用） */
  order?: number;
  /** 最近一次開放給學生的時間（status→published）；隱藏後再開放會更新 */
  publishedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type AttemptScorePolicy = 'latest' | 'highest' | 'lowest' | 'average';
export type QuizAnswerWindowPhase = 'open' | 'upcoming' | 'ended' | 'unlimited';

export type QuizInput = Omit<Quiz, 'id' | 'totalPoints' | 'createdAt' | 'updatedAt'> & {
  id?: string;
};

export const GRID_CELL_ANSWERS: GridCellAnswer[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '-', '±'];

export const GRID_CELL_ANSWER_LABELS: Record<GridCellAnswer, string> = {
  '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
  '6': '6', '7': '7', '8': '8', '9': '9', '-': '−', '±': '±',
};

export const MC_SCORING_OPTIONS: { value: McScoringMethod; label: string; hint: string }[] = [
  { value: 'average', label: '選項平分制', hint: '答對選項數 / 總正確選項數 × 該題配分' },
  { value: 'taiwan_gsat', label: '學測倒扣制', hint: '得分 = 配分 × (k − 2n) / k（k=正確數，n=答對數）' },
];

export const OPTION_LABEL_STYLE_OPTIONS: { value: OptionLabelStyle; label: string }[] = [
  { value: 'letter_paren', label: '(A)(B)(C)...' },
  { value: 'number_paren', label: '(1)(2)(3)...' },
];

export const OPTION_LAYOUT_OPTIONS: { value: OptionLayout; label: string }[] = [
  { value: 'vertical', label: '縱向排列' },
  { value: 'horizontal', label: '橫向排列' },
];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: '單選題',
  multiple: '多選題',
  fill_in: '選填題',
  tf: '是非題',
  short_answer: '簡答題',
  group: '題組題',
};

export const QUESTION_TYPE_OPTIONS = (Object.entries(QUESTION_TYPE_LABELS) as [QuestionType, string][]).map(
  ([value, label]) => ({ value, label })
);

export const SUB_QUESTION_TYPE_OPTIONS = QUESTION_TYPE_OPTIONS.filter((o) => o.value !== 'group');

export function generateQuestionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const QUIZ_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const QUIZ_CODE_LENGTH = 12;

export function generateQuizCode(): string {
  let result = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const randomValues = new Uint32Array(QUIZ_CODE_LENGTH);
    crypto.getRandomValues(randomValues);
    for (let i = 0; i < QUIZ_CODE_LENGTH; i++) {
      result += QUIZ_CODE_CHARS[randomValues[i] % QUIZ_CODE_CHARS.length];
    }
  } else {
    for (let i = 0; i < QUIZ_CODE_LENGTH; i++) {
      result += QUIZ_CODE_CHARS[Math.floor(Math.random() * QUIZ_CODE_CHARS.length)];
    }
  }
  return result;
}

export function isValidQuizCode(code: string): boolean {
  return /^[A-Za-z0-9]{8,24}$/.test(code);
}

export function formatOptionLabel(index: number, style: OptionLabelStyle = 'letter_paren'): string {
  if (style === 'number_paren') return `(${index + 1})`;
  return `(${String.fromCharCode(65 + index)})`;
}

export function resolveChoiceLabelStyle(
  question: Pick<ChoiceQuestion, 'optionLabelStyle'>,
  quizDefault?: OptionLabelStyle
): OptionLabelStyle {
  return question.optionLabelStyle ?? quizDefault ?? 'letter_paren';
}

export function buildGridCellLabel(questionNumber: number, cellIndex: number): string {
  return `${questionNumber}-${cellIndex + 1}`;
}

/** 將各種儲存格式正規化為選填格答案符號 */
export function normalizeGridCellAnswer(raw: unknown): GridCellAnswer {
  if (raw === '±' || raw === '\u00b1') return '±';
  if (raw === '-' || raw === '\u2212' || raw === '−') return '-';
  if (typeof raw === 'number' && raw >= 0 && raw <= 9) {
    return String(raw) as GridCellAnswer;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '±') return '±';
    if (trimmed === '-' || trimmed === '−') return '-';
    if (/^[0-9]$/.test(trimmed)) return trimmed as GridCellAnswer;
    const sym = trimmed.replace(/[^0-9\-±−]/g, '').charAt(0);
    if (sym === '±') return '±';
    if (sym === '-' || sym === '−') return '-';
    if (sym >= '0' && sym <= '9') return sym as GridCellAnswer;
  }
  return '0';
}

function legacyFillInCorrectAnswers(q: Record<string, unknown>): GridCellAnswer[] {
  if (!Array.isArray(q.correctAnswers)) return [];
  return (q.correctAnswers as unknown[]).map(normalizeGridCellAnswer);
}

export interface NumberedQuestionEntry {
  id: string;
  number: number;
  question: Question | SubQuestion;
  isSubQuestion: boolean;
  parentGroupId?: string;
}

/** 整張考卷題號列表（題組的子題各自佔一題號） */
export function buildQuizQuestionNumberList(
  sections: QuizSection[],
  continuousQuestionNumbers = true
): NumberedQuestionEntry[] {
  const list: NumberedQuestionEntry[] = [];
  let n = 1;
  for (const section of sections) {
    if (!continuousQuestionNumbers) {
      n = 1;
    }
    for (const q of section.questions) {
      if (q.type === 'group') {
        for (const sub of q.subQuestions) {
          list.push({ id: sub.id, number: n++, question: sub, isSubQuestion: true, parentGroupId: q.id });
        }
      } else {
        list.push({ id: q.id, number: n++, question: q, isSubQuestion: false });
      }
    }
  }
  return list;
}

export function getQuestionNumberMap(
  sections: QuizSection[],
  continuousQuestionNumbers = true
): Map<string, number> {
  const map = new Map<string, number>();
  for (const entry of buildQuizQuestionNumberList(sections, continuousQuestionNumbers)) {
    map.set(entry.id, entry.number);
  }
  return map;
}

export function isContinuousQuestionNumbers(
  quiz: Pick<Quiz, 'continuousQuestionNumbers'>
): boolean {
  return quiz.continuousQuestionNumbers !== false;
}

export function formatQuizQuestionNumbering(
  quiz: Pick<Quiz, 'continuousQuestionNumbers'>
): string {
  return isContinuousQuestionNumbers(quiz) ? '大題間連續編號' : '各大題重新編號';
}

export function createEmptySection(index = 0): QuizSection {
  return {
    id: generateQuestionId(),
    title: `第 ${index + 1} 大題`,
    description: '',
    questions: [],
    defaultPoints: 1,
    shuffleQuestions: false,
    shuffleOptions: false,
  };
}

export function createEmptyGridCell(cellIndex: number, questionNumber: number): GridCell {
  return {
    id: generateQuestionId(),
    label: buildGridCellLabel(questionNumber, cellIndex),
    correctAnswer: '0',
  };
}

export function normalizeDefaultPoints(value: unknown, fallback = 1): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, n);
}

export function createEmptyQuestion(
  type: QuestionType,
  questionNumber = 1,
  quizOptionLabelStyle: OptionLabelStyle = 'letter_paren',
  defaultPoints = 1
): Question {
  const base = {
    id: generateQuestionId(),
    content: '',
    points: normalizeDefaultPoints(defaultPoints, 1),
  };

  switch (type) {
    case 'single':
      return {
        ...base,
        type: 'single',
        options: ['', '', '', ''],
        correctAnswers: [],
        optionLabelStyle: quizOptionLabelStyle,
        optionLayout: 'vertical',
      };
    case 'multiple':
      return {
        ...base,
        type: 'multiple',
        options: ['', '', '', ''],
        correctAnswers: [],
        optionLabelStyle: quizOptionLabelStyle,
        optionLayout: 'vertical',
      };
    case 'fill_in':
      return { ...base, type: 'fill_in', cells: [createEmptyGridCell(0, questionNumber)] };
    case 'tf':
      return { ...base, type: 'tf', correctAnswer: true };
    case 'short_answer':
      return { ...base, type: 'short_answer' };
    case 'group':
      return { ...base, type: 'group', subQuestions: [], shuffleSubQuestions: false };
    default:
      return { ...base, type: 'single', options: ['', '', '', ''], correctAnswers: [], optionLayout: 'vertical' };
  }
}

export function createEmptySubQuestion(
  type: Exclude<QuestionType, 'group'>,
  questionNumber = 1,
  quizOptionLabelStyle: OptionLabelStyle = 'letter_paren',
  defaultPoints = 1
): SubQuestion {
  return createEmptyQuestion(type, questionNumber, quizOptionLabelStyle, defaultPoints) as SubQuestion;
}

export function relabelFillInCells(question: TaiwanFillInQuestion, questionNumber: number): TaiwanFillInQuestion {
  return {
    ...question,
    cells: question.cells.map((cell, i) => ({
      ...cell,
      label: buildGridCellLabel(questionNumber, i),
    })),
  };
}

/** 將舊版題目格式轉為新版 */
export function normalizeQuestion(raw: unknown): Question {
  if (!raw || typeof raw !== 'object') {
    return createEmptyQuestion('single');
  }
  const q = raw as Record<string, unknown>;
  const type = (q.type as QuestionType) || 'single';
  const base = {
    id: String(q.id || generateQuestionId()),
    content: String(q.content ?? ''),
    points: Number(q.points) || 0,
  };

  if (type === 'tf') {
    if (typeof q.correctAnswer === 'boolean') {
      return { ...base, type: 'tf', correctAnswer: q.correctAnswer };
    }
    const answers = Array.isArray(q.correctAnswers) ? q.correctAnswers as string[] : [];
    const opts = Array.isArray(q.options) ? q.options as string[] : ['是', '否'];
    const correct = answers[0];
    const isTrue = correct === opts[0] || correct === '是' || correct === 'O' || correct === '○';
    return { ...base, type: 'tf', correctAnswer: isTrue };
  }

  if (type === 'fill_in') {
    const legacyAnswers = legacyFillInCorrectAnswers(q);
    if (Array.isArray(q.cells) && q.cells.length > 0) {
      return {
        ...base,
        type: 'fill_in',
        cells: (q.cells as GridCell[]).map((c, i) => {
          const fromCell = normalizeGridCellAnswer(c.correctAnswer);
          const fromLegacy = legacyAnswers[i];
          const correctAnswer =
            fromCell !== '0'
              ? fromCell
              : fromLegacy && fromLegacy !== '0'
                ? fromLegacy
                : fromCell;
          return {
            id: String(c.id || generateQuestionId()),
            label: String(c.label || `第 ${i + 1} 格`),
            correctAnswer,
          };
        }),
      };
    }
    const legacy = legacyAnswers.length > 0 ? legacyAnswers : ['0' as GridCellAnswer];
    return {
      ...base,
      type: 'fill_in',
      cells: legacy.map((ans, i) => ({
        id: generateQuestionId(),
        label: `第 ${i + 1} 格`,
        correctAnswer: ans,
      })),
    };
  }

  if (type === 'short_answer') {
    return {
      ...base,
      type: 'short_answer',
      referenceAnswer: typeof q.referenceAnswer === 'string' ? q.referenceAnswer : '',
    };
  }

  if (type === 'group') {
    const subs = Array.isArray(q.subQuestions) ? q.subQuestions.map(normalizeQuestion) as SubQuestion[] : [];
    return {
      ...base,
      type: 'group',
      subQuestions: subs,
      shuffleSubQuestions: !!q.shuffleSubQuestions,
    };
  }

  if (type === 'multiple' || type === 'single') {
    return {
      ...base,
      type,
      options: Array.isArray(q.options) ? (q.options as string[]) : ['', ''],
      correctAnswers: Array.isArray(q.correctAnswers) ? (q.correctAnswers as string[]) : [],
      ...(q.optionLabelStyle
        ? { optionLabelStyle: q.optionLabelStyle as OptionLabelStyle }
        : {}),
      optionLayout: (q.optionLayout as OptionLayout) || 'vertical',
    };
  }

  return createEmptyQuestion('single');
}

export function normalizeSection(raw: unknown, index: number): QuizSection {
  if (!raw || typeof raw !== 'object') {
    return createEmptySection(index);
  }
  const s = raw as Record<string, unknown>;
  const questions = Array.isArray(s.questions)
    ? (s.questions as unknown[]).map(normalizeQuestion)
    : [];
  return {
    id: String(s.id || generateQuestionId()),
    title: String(s.title || `第 ${index + 1} 大題`),
    description: String(s.description ?? ''),
    questions,
    defaultPoints: normalizeDefaultPoints(s.defaultPoints, 1),
    shuffleQuestions: !!s.shuffleQuestions,
    shuffleOptions: !!s.shuffleOptions,
  };
}

export function ensureQuizSections(quiz: Quiz): Quiz {
  const mcScoringMethod = quiz.mcScoringMethod ?? 'average';
  const optionLabelStyle = quiz.optionLabelStyle ?? 'letter_paren';
  const assignedCourses = normalizeAssignedCourses(quiz);

  const base = {
    ...quiz,
    mcScoringMethod,
    optionLabelStyle,
    attemptUnlimited: quiz.attemptUnlimited ?? false,
    attemptLimit: quiz.attemptUnlimited ? undefined : Math.max(1, quiz.attemptLimit ?? 1),
    resultsPublished: quiz.resultsPublished !== false,
    continuousQuestionNumbers: isContinuousQuestionNumbers(quiz),
    assignedCourses,
    courseId: assignedCourses[0]?.courseId,
    courseName: assignedCourses[0]?.courseName,
  };

  if (quiz.sections?.length) {
    return {
      ...base,
      sections: quiz.sections.map((s, i) => normalizeSection(s, i)),
    };
  }
  const legacyQuestions = (quiz.questions ?? []).map(normalizeQuestion);
  return {
    ...base,
    sections: [{
      id: generateQuestionId(),
      title: '第一大題',
      description: '',
      questions: legacyQuestions,
    }],
  };
}

export function normalizeAssignedCourses(
  quiz: Pick<Quiz, 'assignedCourses' | 'courseId' | 'courseName'>
): QuizCourseRef[] {
  if (Array.isArray(quiz.assignedCourses) && quiz.assignedCourses.length > 0) {
    return quiz.assignedCourses
      .filter((c) => c?.courseId)
      .map((c) => ({
        courseId: String(c.courseId),
        courseName: String(c.courseName ?? c.courseId),
      }));
  }
  if (quiz.courseId) {
    return [{
      courseId: String(quiz.courseId),
      courseName: String(quiz.courseName ?? quiz.courseId),
    }];
  }
  return [];
}

/** 考卷以單一班級運作；寫入時收斂為至多一個班級（舊多班資料讀取仍用 normalizeAssignedCourses） */
export function normalizeSingleAssignedCourse(
  quiz: Pick<Quiz, 'assignedCourses' | 'courseId' | 'courseName'>
): QuizCourseRef[] {
  const all = normalizeAssignedCourses(quiz);
  return all.length > 0 ? [all[0]] : [];
}

/** 依課程內顯示順序排序（未設定 order 的排在後面） */
export function sortQuizzesByOrder<T extends { order?: number; createdAt?: string }>(quizzes: T[]): T[] {
  return [...quizzes].sort((a, b) => {
    const aOrder = typeof a.order === 'number' ? a.order : Number.MAX_SAFE_INTEGER;
    const bOrder = typeof b.order === 'number' ? b.order : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aTime - bTime;
  });
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

export function formatQuizDateTimeRange(
  startIso: string,
  endIso: string,
  options?: { withYear?: boolean }
): string {
  const withYear = options?.withYear !== false;
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('zh-TW', {
      ...(withYear ? { year: 'numeric' as const } : {}),
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };
  return `${fmt(startIso)} ~ ${fmt(endIso)}`;
}

export function formatQuizAnswerWindow(
  quiz: Pick<Quiz, 'answerWindowEnabled' | 'answerStartAt' | 'answerEndAt'>
): string {
  if (!quiz.answerWindowEnabled) return '不限';
  if (!quiz.answerStartAt || !quiz.answerEndAt) return '未設定';
  return formatQuizDateTimeRange(quiz.answerStartAt, quiz.answerEndAt, { withYear: false });
}

export function isQuizAnswerWindowOpen(
  quiz: Pick<Quiz, 'answerWindowEnabled' | 'answerStartAt' | 'answerEndAt'>,
  at: Date = new Date()
): boolean {
  if (!quiz.answerWindowEnabled) return true;
  if (!quiz.answerStartAt || !quiz.answerEndAt) return false;
  const start = new Date(quiz.answerStartAt).getTime();
  const end = new Date(quiz.answerEndAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  const now = at.getTime();
  return now >= start && now <= end;
}

export function formatQuizExamDateLabel(
  quiz: Pick<Quiz, 'answerWindowEnabled' | 'answerStartAt' | 'answerEndAt'>
): string {
  if (!quiz.answerWindowEnabled) return '不限';
  if (!quiz.answerStartAt || !quiz.answerEndAt) return '未設定';
  return formatQuizDateTimeRange(quiz.answerStartAt, quiz.answerEndAt);
}

export function isQuizResultsPublished(quiz: Pick<Quiz, 'resultsPublished'>): boolean {
  return quiz.resultsPublished !== false;
}

export function validateQuizAnswerKeys(
  quiz: Pick<Quiz, 'sections' | 'continuousQuestionNumbers'>
): string | null {
  const numbered = buildQuizQuestionNumberList(
    quiz.sections,
    isContinuousQuestionNumbers(quiz)
  );
  for (const entry of numbered) {
    const q = entry.question;
    if (isShortAnswerQuestion(q)) continue;

    if (isChoiceQuestion(q)) {
      const valid = q.correctAnswers.filter((a) => !isHtmlEmpty(a));
      if (valid.length === 0) {
        return `第 ${entry.number} 題尚未設定正確答案`;
      }
      continue;
    }

    if (isTrueFalseQuestion(q)) continue;

    if (isFillInQuestion(q)) {
      if (!q.cells.length) {
        return `第 ${entry.number} 題尚未設定正確答案`;
      }
      // 「0」為合法答案（學測畫卡），不可再當成未設定
    }
  }
  return null;
}

export function validateQuizForPublish(
  quiz: Pick<
    Quiz,
    'answerWindowEnabled' | 'answerStartAt' | 'answerEndAt' | 'assignedCourses' | 'courseId' | 'sections'
  >
): string | null {
  const assignedCourses = normalizeAssignedCourses(quiz);
  if (assignedCourses.length === 0) {
    return '請選擇適用班級後再發布';
  }
  if (countQuizQuestions(quiz) === 0) {
    const hasEmptyGroup = quiz.sections.some((s) =>
      s.questions.some((q) => q.type === 'group' && q.subQuestions.length === 0)
    );
    if (hasEmptyGroup) {
      return '題組題至少需新增一題子題後再發布';
    }
    return '請至少新增一題後再發布';
  }
  const answerError = validateQuizAnswerKeys(quiz);
  if (answerError) return answerError;
  if (!quiz.answerWindowEnabled) return null;
  if (!quiz.answerStartAt || !quiz.answerEndAt) {
    return '請設定作答開始與截止時間，或改為不限日期';
  }
  const start = new Date(quiz.answerStartAt).getTime();
  const end = new Date(quiz.answerEndAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return '作答時間格式不正確';
  }
  if (end <= start) {
    return '作答截止時間必須晚於開始時間';
  }
  return null;
}

export function flattenQuestions(sections: QuizSection[]): Question[] {
  return sections.flatMap((s) => s.questions);
}

export function calculateTotalPoints(questions: Question[]): number {
  return questions.reduce((sum, q) => {
    if (q.type === 'group') {
      return sum + q.subQuestions.reduce((s, sub) => s + (sub.points || 0), 0);
    }
    return sum + (q.points || 0);
  }, 0);
}

export function calculateSectionPoints(section: QuizSection): number {
  return calculateTotalPoints(section.questions);
}

/** 將大題預設配分套用至現有題目（題組則套用至各子題） */
export function applySectionDefaultPoints(section: QuizSection): QuizSection {
  const points = normalizeDefaultPoints(section.defaultPoints, 1);
  return {
    ...section,
    questions: section.questions.map((q) => {
      if (isGroupQuestion(q)) {
        return {
          ...q,
          subQuestions: q.subQuestions.map((sub) => ({ ...sub, points })),
        };
      }
      return { ...q, points };
    }),
  };
}

export function countSectionQuestions(section: QuizSection): number {
  return section.questions.reduce((count, q) => {
    if (q.type === 'group') return count + q.subQuestions.length;
    return count + 1;
  }, 0);
}

export function calculateQuizTotalPoints(quiz: Pick<Quiz, 'sections'>): number {
  return calculateTotalPoints(flattenQuestions(quiz.sections));
}

export function countQuizQuestions(quiz: Pick<Quiz, 'sections'>): number {
  return buildQuizQuestionNumberList(quiz.sections).length;
}

export function isChoiceQuestion(q: Question | SubQuestion): q is ChoiceQuestion {
  return q.type === 'single' || q.type === 'multiple';
}

export function isTrueFalseQuestion(q: Question | SubQuestion): q is TrueFalseQuestion {
  return q.type === 'tf';
}

export function isFillInQuestion(q: Question | SubQuestion): q is TaiwanFillInQuestion {
  return q.type === 'fill_in';
}

export function isGroupQuestion(q: Question): q is GroupQuestion {
  return q.type === 'group';
}

export function isShortAnswerQuestion(q: Question | SubQuestion): q is ShortAnswerQuestion {
  return q.type === 'short_answer';
}

export function formatQuizTimeLimit(quiz: Pick<Quiz, 'timeLimitEnabled' | 'timeLimitMinutes'>): string {
  if (!quiz.timeLimitEnabled) return '不限時';
  const minutes = quiz.timeLimitMinutes ?? 0;
  if (minutes <= 0) return '不限時';
  if (minutes < 60) return `${minutes} 分鐘`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} 小時 ${m} 分鐘` : `${h} 小時`;
}

export function isQuizAttemptUnlimited(quiz: Pick<Quiz, 'attemptUnlimited'>): boolean {
  return quiz.attemptUnlimited === true;
}

/** 每位學生最多提交次數；null 表示無限次 */
export function getQuizMaxAttempts(quiz: Pick<Quiz, 'attemptUnlimited' | 'attemptLimit'>): number | null {
  if (isQuizAttemptUnlimited(quiz)) return null;
  const n = Number(quiz.attemptLimit);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function formatQuizAttemptLimit(quiz: Pick<Quiz, 'attemptUnlimited' | 'attemptLimit'>): string {
  const max = getQuizMaxAttempts(quiz);
  return max === null ? '無限次' : `${max} 次`;
}

export function canStudentRetakeQuiz(
  quiz: Pick<Quiz, 'attemptUnlimited' | 'attemptLimit'>,
  submissionCount: number
): boolean {
  const max = getQuizMaxAttempts(quiz);
  if (max === null) return true;
  return submissionCount < max;
}

export const ATTEMPT_SCORE_POLICY_OPTIONS: {
  value: AttemptScorePolicy;
  label: string;
  hint: string;
}[] = [
  { value: 'latest', label: '以最後一次', hint: '採計學生最近提交的成績' },
  { value: 'highest', label: '取最高分', hint: '多次作答中取最高分成績' },
  { value: 'lowest', label: '取最低分', hint: '多次作答中取最低分成績' },
  { value: 'average', label: '取平均分', hint: '多次作答成績的平均值' },
];

export function getQuizAttemptScorePolicy(
  quiz: Pick<Quiz, 'attemptScorePolicy'>
): AttemptScorePolicy {
  const p = quiz.attemptScorePolicy;
  if (p === 'highest' || p === 'lowest' || p === 'average' || p === 'latest') return p;
  return 'latest';
}

export function formatQuizAttemptScorePolicy(
  quiz: Pick<Quiz, 'attemptScorePolicy' | 'attemptUnlimited' | 'attemptLimit'>
): string {
  if (!isQuizMultipleAttemptsAllowed(quiz)) return '—';
  const opt = ATTEMPT_SCORE_POLICY_OPTIONS.find(
    (o) => o.value === getQuizAttemptScorePolicy(quiz)
  );
  return opt?.label ?? '以最後一次';
}

export function isQuizMultipleAttemptsAllowed(
  quiz: Pick<Quiz, 'attemptUnlimited' | 'attemptLimit'>
): boolean {
  if (isQuizAttemptUnlimited(quiz)) return true;
  return (getQuizMaxAttempts(quiz) ?? 1) > 1;
}

export function isQuizExamLockEnabled(quiz: Pick<Quiz, 'examLockEnabled'>): boolean {
  return !!quiz.examLockEnabled;
}

export function isQuizRequireFullscreen(quiz: Pick<Quiz, 'requireFullscreen'>): boolean {
  return !!quiz.requireFullscreen;
}

export function getQuizAnswerWindowPhase(
  quiz: Pick<Quiz, 'answerWindowEnabled' | 'answerStartAt' | 'answerEndAt'>,
  at: Date = new Date()
): QuizAnswerWindowPhase {
  if (!quiz.answerWindowEnabled) return 'unlimited';
  if (!quiz.answerStartAt || !quiz.answerEndAt) return 'ended';
  const start = new Date(quiz.answerStartAt).getTime();
  const end = new Date(quiz.answerEndAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 'ended';
  const now = at.getTime();
  if (now < start) return 'upcoming';
  if (now > end) return 'ended';
  return 'open';
}

export function isQuizAnswerWindowEnded(
  quiz: Pick<Quiz, 'answerWindowEnabled' | 'answerStartAt' | 'answerEndAt'>,
  at: Date = new Date()
): boolean {
  return getQuizAnswerWindowPhase(quiz, at) === 'ended';
}
