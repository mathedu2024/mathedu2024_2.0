export interface LessonAssignedQuiz {
  quizCode: string;
  requireBeforeVideo?: boolean;
}

export interface LessonQuizFields {
  noOnlineExam?: boolean;
  onlineExam?: string;
  assignedQuizzes?: LessonAssignedQuiz[];
  /** @deprecated 請改用 assignedQuizzes */
  assignedQuizCodes?: string[];
  /** @deprecated 請改用 assignedQuizzes */
  requireQuizBeforeVideo?: boolean;
}

/** 正規化課堂指派的測驗（相容舊版 assignedQuizCodes + requireQuizBeforeVideo） */
export function normalizeLessonAssignedQuizzes(lesson: LessonQuizFields): LessonAssignedQuiz[] {
  if (lesson.noOnlineExam) return [];
  if (Array.isArray(lesson.assignedQuizzes) && lesson.assignedQuizzes.length > 0) {
    return lesson.assignedQuizzes
      .filter((q) => typeof q.quizCode === 'string' && q.quizCode.trim() !== '')
      .map((q) => ({
        quizCode: q.quizCode.trim(),
        requireBeforeVideo: !!q.requireBeforeVideo,
      }));
  }
  const codes = (lesson.assignedQuizCodes ?? []).filter(
    (code) => typeof code === 'string' && code.trim() !== ''
  );
  const globalRequire = !!lesson.requireQuizBeforeVideo;
  return codes.map((quizCode) => ({
    quizCode: quizCode.trim(),
    requireBeforeVideo: globalRequire,
  }));
}

/** 取得課堂指派的測驗代碼（不含 legacy 外部連結） */
export function getLessonAssignedQuizCodes(lesson: LessonQuizFields): string[] {
  return normalizeLessonAssignedQuizzes(lesson).map((q) => q.quizCode);
}

/** 須完成後才可觀課的測驗代碼 */
export function getLessonVideoLockQuizCodes(lesson: LessonQuizFields): string[] {
  return normalizeLessonAssignedQuizzes(lesson)
    .filter((q) => q.requireBeforeVideo)
    .map((q) => q.quizCode);
}

/** 是否顯示線上測驗區塊（含 legacy 外部連結） */
export function hasLessonOnlineExam(lesson: LessonQuizFields): boolean {
  if (lesson.noOnlineExam) return false;
  if (normalizeLessonAssignedQuizzes(lesson).length > 0) return true;
  return !!lesson.onlineExam?.trim();
}

/** 篩選仍存在的測驗指派（用於儲存前過濾） */
export function filterLessonAssignedQuizzes(
  quizzes: LessonAssignedQuiz[],
  validQuizCodes: ReadonlySet<string> | string[]
): LessonAssignedQuiz[] {
  const valid =
    validQuizCodes instanceof Set ? validQuizCodes : new Set(validQuizCodes);
  return quizzes.filter((q) => valid.has(q.quizCode));
}

/** 找出已不存在於有效清單的測驗指派 */
export function getOrphanedLessonQuizzes(
  quizzes: LessonAssignedQuiz[],
  validQuizCodes: ReadonlySet<string> | string[]
): LessonAssignedQuiz[] {
  const valid =
    validQuizCodes instanceof Set ? validQuizCodes : new Set(validQuizCodes);
  return quizzes.filter((q) => !valid.has(q.quizCode));
}

export interface LessonQuizCompletionInput {
  quizCode: string;
  submitted?: boolean;
  accessible?: boolean;
}

/** 是否仍有須完成且已開放作答的測驗（用於影片解鎖判斷） */
export function hasPendingAccessibleLessonQuizzes(
  assignedQuizCodes: string[],
  examsByCode: Map<string, LessonQuizCompletionInput>
): boolean {
  return assignedQuizCodes.some((code) => {
    const exam = examsByCode.get(code);
    if (!exam) return false;
    if (exam.submitted) return false;
    return exam.accessible !== false;
  });
}
