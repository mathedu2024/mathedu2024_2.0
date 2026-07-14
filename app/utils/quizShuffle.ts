import {
  isChoiceQuestion,
  isGroupQuestion,
  type ChoiceQuestion,
  type GroupQuestion,
  type Question,
  type Quiz,
  type QuizSection,
} from '@/services/quizTypes';

/** 簡易可重現亂數（同一 seed 順序固定，重整頁面不重排） */
function createSeededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleArray<T>(items: T[], random: () => number): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function shuffleChoiceOptions(question: ChoiceQuestion, random: () => number): ChoiceQuestion {
  if (question.options.length <= 1) return question;
  return {
    ...question,
    options: shuffleArray(question.options, random),
  };
}

function applyGroupShuffle(question: GroupQuestion, random: () => number): GroupQuestion {
  let subQuestions = question.subQuestions;
  if (question.shuffleSubQuestions && subQuestions.length > 1) {
    subQuestions = shuffleArray(subQuestions, random);
  }
  return { ...question, subQuestions };
}

function applySectionQuestionShuffle(
  question: Question,
  section: QuizSection,
  random: () => number
): Question {
  if (isGroupQuestion(question)) {
    return applyGroupShuffle(question, random);
  }
  if (section.shuffleOptions && isChoiceQuestion(question)) {
    return shuffleChoiceOptions(question, random);
  }
  return question;
}

/**
 * 依大題／題組設定打亂題目與選項（僅影響學生作答時的顯示順序）。
 *
 * 規則：
 * - 大題 shuffleQuestions：以「題目／題組」為單位打亂；題組整組移動，不拆開子題。
 * - 題組 shuffleSubQuestions：各題組自行決定是否打亂內部子題順序。
 * - 大題 shuffleOptions：只打亂一般單選／多選的選項，不含題組子題。
 *
 * 重要：答案以 questionId + 選項內容（HTML）儲存與批改，不以顯示序號／陣列 index。
 * 因此打亂不會改變作答結果；檢視紀錄／批改請使用原稿順序（勿呼叫此函式）。
 *
 * seed 建議含 studentId + quizCode + startedAt，同一作答期間順序固定。
 */
export function applyQuizShuffle(quiz: Quiz, seed: string): Quiz {
  const needsShuffle = quiz.sections.some(
    (section) =>
      section.shuffleQuestions ||
      section.shuffleOptions ||
      section.questions.some((q) => isGroupQuestion(q) && q.shuffleSubQuestions)
  );
  if (!needsShuffle) return quiz;

  const random = createSeededRandom(seed);
  const sections = quiz.sections.map((section) => {
    let questions = section.questions.map((q) =>
      applySectionQuestionShuffle(q, section, random)
    );
    if (section.shuffleQuestions && questions.length > 1) {
      questions = shuffleArray(questions, random);
    }
    return { ...section, questions };
  });
  return { ...quiz, sections };
}

export function buildQuizShuffleSeed(parts: {
  quizCode: string;
  studentId: string;
  startedAt?: number | null;
  submissionId?: string | null;
}): string {
  return [
    parts.quizCode,
    parts.studentId,
    parts.startedAt ?? 'live',
    parts.submissionId ?? 'take',
  ].join(':');
}
