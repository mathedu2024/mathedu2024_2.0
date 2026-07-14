import { FieldValue } from 'firebase-admin/firestore';
import { removeQuizFromAllLessons } from './lessonQuizCleanup';
import {
  canTeacherAccessQuiz,
  canTeacherDeleteQuiz,
  canTeacherEditQuiz,
  extractAssignedCourseIds,
  getTeacherCourseRecords,
} from './quizTeacherAccess';
import {
  deleteAllQuizImages,
  syncOrphanedQuizImages,
  cloneQuizImageFolder,
} from './quizImageStorage';
import { isSiteImgError } from './siteErrorCodes';
import {
  findQuizDocument,
  findQuizDocumentByCode,
  isQuizDbSeparated,
  mergeDocsById,
  migrateQuizAndSubmissionsFromCore,
  quizzesCollection,
  type QuizDataLocation,
} from './quizDbSplit';
import {
  calculateQuizTotalPoints,
  ensureQuizSections,
  flattenQuestions,
  generateQuizCode,
  isValidQuizCode,
  normalizeQuestion,
  normalizeSection,
  normalizeAssignedCourses,
  normalizeSingleAssignedCourse,
  type Quiz,
  type QuizCourseRef,
  type QuizInput,
  type QuizSection,
} from './quizTypes';
import { rewriteQuizImageCodeInQuiz, validateQuizImageCount } from '@/utils/quizImageHtml';

async function safeQuizImageOperation(label: string, operation: () => Promise<void>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    console.error(`[quiz-images] ${label}:`, error);
    // 刪除／同步失敗需向上拋出，讓 API 回傳 SITE-IMG-* 代碼
    if (isSiteImgError(error)) throw error;
  }
}

class QuizService {
  /** 新測驗一律寫入測驗專用庫（延遲取值，避免模組載入時序問題） */
  private get collection() {
    return quizzesCollection('quiz');
  }

  private serializeQuiz(docId: string, data: FirebaseFirestore.DocumentData): Quiz {
    const rawSections = Array.isArray(data.sections) ? data.sections : [];
    const legacyQuestions = Array.isArray(data.questions) ? data.questions : [];

    let sections: QuizSection[];
    if (rawSections.length > 0) {
      sections = rawSections.map((s: unknown, i: number) => normalizeSection(s, i));
    } else {
      sections = [{
        id: 'legacy-section',
        title: '第一大題',
        description: '',
        questions: legacyQuestions.map((q) => normalizeQuestion(q)),
      }];
    }

    const assignedCourses = normalizeAssignedCourses(data);

    const quiz: Quiz = {
      id: docId,
      quizCode: String(data.quizCode ?? ''),
      teacherId: data.teacherId ?? '',
      assignedCourses,
      courseId: assignedCourses[0]?.courseId,
      courseName: assignedCourses[0]?.courseName,
      title: data.title ?? '',
      description: data.description ?? '',
      status: data.status ?? 'draft',
      sections,
      totalPoints: data.totalPoints ?? calculateQuizTotalPoints({ sections }),
      timeLimitEnabled: !!data.timeLimitEnabled,
      timeLimitMinutes: typeof data.timeLimitMinutes === 'number' ? data.timeLimitMinutes : undefined,
      answerStartAt: data.answerStartAt?.toDate?.()?.toISOString?.() ?? data.answerStartAt ?? undefined,
      answerEndAt: data.answerEndAt?.toDate?.()?.toISOString?.() ?? data.answerEndAt ?? undefined,
      answerWindowEnabled:
        data.answerWindowEnabled !== undefined
          ? !!data.answerWindowEnabled
          : !!(data.answerStartAt && data.answerEndAt),
      mcScoringMethod: data.mcScoringMethod ?? 'average',
      optionLabelStyle: data.optionLabelStyle ?? 'letter_paren',
      attemptUnlimited: data.attemptUnlimited === true,
      attemptLimit:
        data.attemptUnlimited
          ? undefined
          : Math.max(1, typeof data.attemptLimit === 'number' ? data.attemptLimit : 1),
      resultsPublished: data.resultsPublished !== false,
      attemptScorePolicy: data.attemptScorePolicy ?? 'latest',
      examLockEnabled: !!data.examLockEnabled,
      requireFullscreen: !!data.requireFullscreen,
      continuousQuestionNumbers: data.continuousQuestionNumbers !== false,
      order: typeof data.order === 'number' ? data.order : undefined,
      publishedAt: data.publishedAt?.toDate?.()?.toISOString?.() ?? data.publishedAt ?? undefined,
      createdAt: data.createdAt?.toDate?.()?.toISOString?.() ?? data.createdAt,
      updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() ?? data.updatedAt,
    };

    return ensureQuizSections(quiz);
  }

  private async codeExists(quizCode: string, excludeId?: string): Promise<boolean> {
    const found = await findQuizDocumentByCode(quizCode);
    if (!found) return false;
    if (excludeId && found.id === excludeId) return false;
    return true;
  }

  private async generateUniqueQuizCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt++) {
      const code = generateQuizCode();
      if (!(await this.codeExists(code))) return code;
    }
    throw new Error('Failed to generate unique quiz code');
  }

  private async ensureDocumentQuizCode(
    docRef: FirebaseFirestore.DocumentReference,
    data: FirebaseFirestore.DocumentData
  ): Promise<string> {
    const existing = String(data.quizCode ?? '');
    if (existing && isValidQuizCode(existing)) return existing;

    const quizCode = await this.generateUniqueQuizCode();
    await docRef.update({
      quizCode,
      updatedAt: FieldValue.serverTimestamp(),
    });
    return quizCode;
  }

  private async loadQuizDocs(
    queryFn: (
      col: FirebaseFirestore.CollectionReference
    ) => Promise<FirebaseFirestore.QuerySnapshot>
  ): Promise<FirebaseFirestore.QueryDocumentSnapshot[]> {
    const quizSnap = await queryFn(quizzesCollection('quiz'));
    if (!isQuizDbSeparated()) return quizSnap.docs;

    const coreSnap = await queryFn(quizzesCollection('core'));
    return mergeDocsById(quizSnap.docs, coreSnap.docs);
  }

  private buildPayload(input: Partial<QuizInput>) {
    const sections = input.sections ?? [];
    const flat = flattenQuestions(sections);
    return {
      sections,
      questions: flat,
      totalPoints: calculateQuizTotalPoints({ sections }),
    };
  }

  async listByTeacher(teacherId: string): Promise<Quiz[]> {
    const docs = await this.loadQuizDocs((col) => col.where('teacherId', '==', teacherId).get());
    return this.serializeQuizDocs(docs);
  }

  /** 自己建立 + 適用班級為共同授課課程的已發布測驗 */
  async listAccessibleByTeacher(teacherId: string): Promise<Quiz[]> {
    const teacherCourses = await getTeacherCourseRecords(teacherId);
    const own = await this.listByTeacher(teacherId);
    const map = new Map(own.map((q) => [q.id, q]));

    if (teacherCourses.length > 0) {
      const publishedDocs = await this.loadQuizDocs((col) =>
        col.where('status', '==', 'published').get()
      );
      for (const doc of publishedDocs) {
        if (map.has(doc.id)) continue;
        const quiz = await this.serializeQuizDoc(doc);
        if (canTeacherAccessQuiz(quiz, teacherId, teacherCourses)) {
          map.set(quiz.id, quiz);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  private async serializeQuizDoc(
    doc: FirebaseFirestore.QueryDocumentSnapshot
  ): Promise<Quiz> {
    const data = doc.data();
    if (!data.quizCode || !isValidQuizCode(String(data.quizCode))) {
      const quizCode = await this.ensureDocumentQuizCode(doc.ref, data);
      return this.serializeQuiz(doc.id, { ...data, quizCode });
    }
    return this.serializeQuiz(doc.id, data);
  }

  private async serializeQuizDocs(
    docs: FirebaseFirestore.QueryDocumentSnapshot[]
  ): Promise<Quiz[]> {
    const quizzes = await Promise.all(docs.map((doc) => this.serializeQuizDoc(doc)));
    return quizzes.sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
  }

  async getById(quizId: string): Promise<Quiz | null> {
    const found = await findQuizDocument(quizId);
    if (!found) return null;
    const { data, ref } = found;
    if (!data.quizCode || !isValidQuizCode(String(data.quizCode))) {
      const quizCode = await this.ensureDocumentQuizCode(ref, data);
      return this.serializeQuiz(quizId, { ...data, quizCode });
    }
    return this.serializeQuiz(quizId, data);
  }

  async getByCode(quizCode: string): Promise<Quiz | null> {
    if (!isValidQuizCode(quizCode)) return null;
    const found = await findQuizDocumentByCode(quizCode);
    if (!found) return null;
    return this.getById(found.id);
  }

  private async nextOrderForCourse(courseId: string): Promise<number> {
    const [byAssignedIds, byCourseId] = await Promise.all([
      this.loadQuizDocs((col) => col.where('assignedCourseIds', 'array-contains', courseId).get()),
      this.loadQuizDocs((col) => col.where('courseId', '==', courseId).get()),
    ]);
    const seen = new Set<string>();
    let max = -1;
    for (const doc of [...byAssignedIds, ...byCourseId]) {
      if (seen.has(doc.id)) continue;
      seen.add(doc.id);
      const value = doc.data().order;
      if (typeof value === 'number' && value > max) max = value;
    }
    return max + 1;
  }

  async create(input: QuizInput): Promise<{ quizId: string; quizCode: string }> {
    if (!input.teacherId || !input.title?.trim()) {
      throw new Error('Missing required fields');
    }

    const { sections, questions, totalPoints } = this.buildPayload(input);

    let quizCode = input.quizCode?.trim() ?? '';
    if (!quizCode || !isValidQuizCode(quizCode) || (await this.codeExists(quizCode))) {
      quizCode = await this.generateUniqueQuizCode();
    }

    const imageError = validateQuizImageCount({
      quizCode,
      sections,
      description: input.description,
    });
    if (imageError) {
      throw new Error(imageError);
    }

    const assignedCourses = normalizeSingleAssignedCourse(input);
    const courseId = assignedCourses[0]?.courseId ?? '';
    const order =
      typeof input.order === 'number'
        ? input.order
        : courseId
          ? await this.nextOrderForCourse(courseId)
          : 0;

    const payload = {
      quizCode,
      teacherId: input.teacherId,
      assignedCourses,
      assignedCourseIds: extractAssignedCourseIds({ assignedCourses }),
      courseId,
      courseName: assignedCourses[0]?.courseName ?? '',
      title: input.title.trim(),
      description: input.description?.trim() ?? '',
      status: input.status ?? 'draft',
      sections,
      questions,
      totalPoints,
      timeLimitEnabled: !!input.timeLimitEnabled,
      timeLimitMinutes: input.timeLimitEnabled ? (input.timeLimitMinutes ?? 60) : null,
      answerStartAt: input.answerWindowEnabled ? (input.answerStartAt ?? null) : null,
      answerEndAt: input.answerWindowEnabled ? (input.answerEndAt ?? null) : null,
      answerWindowEnabled: !!input.answerWindowEnabled,
      mcScoringMethod: input.mcScoringMethod ?? 'average',
      optionLabelStyle: input.optionLabelStyle ?? 'letter_paren',
      attemptUnlimited: !!input.attemptUnlimited,
      attemptLimit: input.attemptUnlimited ? null : Math.max(1, input.attemptLimit ?? 1),
      resultsPublished: input.resultsPublished !== false,
      attemptScorePolicy: input.attemptScorePolicy ?? 'latest',
      examLockEnabled: !!input.examLockEnabled,
      requireFullscreen: !!input.requireFullscreen,
      continuousQuestionNumbers: input.continuousQuestionNumbers !== false,
      order,
      ...(input.status === 'published' ? { publishedAt: FieldValue.serverTimestamp() } : {}),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await this.collection.add(payload);

    await safeQuizImageOperation('sync on create', async () => {
      await syncOrphanedQuizImages({
        quizCode,
        sections,
        description: input.description,
      });
    });

    return { quizId: docRef.id, quizCode };
  }

  async update(quizId: string, teacherId: string, input: Partial<QuizInput>): Promise<void> {
    const found = await findQuizDocument(quizId);
    if (!found) {
      throw new Error('Quiz not found');
    }

    const existingQuiz = this.serializeQuiz(quizId, found.data);
    if (!canTeacherEditQuiz(existingQuiz, teacherId)) {
      throw new Error('Unauthorized');
    }

    const payload: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (input.title !== undefined) payload.title = input.title.trim();
    if (input.description !== undefined) payload.description = input.description.trim();
    if (input.assignedCourses !== undefined || input.courseId !== undefined || input.courseName !== undefined) {
      const assignedCourses = normalizeSingleAssignedCourse({
        assignedCourses: input.assignedCourses,
        courseId: input.courseId,
        courseName: input.courseName,
      });
      payload.assignedCourses = assignedCourses;
      payload.assignedCourseIds = extractAssignedCourseIds({ assignedCourses });
      payload.courseId = assignedCourses[0]?.courseId ?? '';
      payload.courseName = assignedCourses[0]?.courseName ?? '';

      const nextCourseId = assignedCourses[0]?.courseId ?? '';
      const prevCourseId = normalizeAssignedCourses(existingQuiz)[0]?.courseId ?? '';
      if (nextCourseId && nextCourseId !== prevCourseId && typeof input.order !== 'number') {
        payload.order = await this.nextOrderForCourse(nextCourseId);
      } else if (!nextCourseId) {
        payload.order = FieldValue.delete();
      }
    }
    if (typeof input.order === 'number') payload.order = input.order;
    if (input.status !== undefined) {
      payload.status = input.status;
      if (input.status === 'published' && existingQuiz.status !== 'published') {
        payload.publishedAt = FieldValue.serverTimestamp();
      }
    }
    if (input.answerWindowEnabled !== undefined) {
      payload.answerWindowEnabled = !!input.answerWindowEnabled;
      if (!input.answerWindowEnabled) {
        payload.answerStartAt = null;
        payload.answerEndAt = null;
      }
    }
    if (input.answerStartAt !== undefined) payload.answerStartAt = input.answerStartAt || null;
    if (input.answerEndAt !== undefined) payload.answerEndAt = input.answerEndAt || null;
    if (input.timeLimitEnabled !== undefined) {
      payload.timeLimitEnabled = !!input.timeLimitEnabled;
      payload.timeLimitMinutes = input.timeLimitEnabled ? (input.timeLimitMinutes ?? 60) : null;
    } else if (input.timeLimitMinutes !== undefined) {
      payload.timeLimitMinutes = input.timeLimitMinutes;
    }
    if (input.mcScoringMethod !== undefined) payload.mcScoringMethod = input.mcScoringMethod;
    if (input.optionLabelStyle !== undefined) payload.optionLabelStyle = input.optionLabelStyle;
    if (input.attemptUnlimited !== undefined) {
      payload.attemptUnlimited = !!input.attemptUnlimited;
      if (input.attemptUnlimited) {
        payload.attemptLimit = null;
      }
    }
    if (input.attemptLimit !== undefined && !input.attemptUnlimited) {
      payload.attemptLimit = Math.max(1, input.attemptLimit ?? 1);
    }
    if (input.resultsPublished !== undefined) {
      payload.resultsPublished = !!input.resultsPublished;
    }
    if (input.attemptScorePolicy !== undefined) {
      payload.attemptScorePolicy = input.attemptScorePolicy;
    }
    if (input.examLockEnabled !== undefined) {
      payload.examLockEnabled = !!input.examLockEnabled;
    }
    if (input.requireFullscreen !== undefined) {
      payload.requireFullscreen = !!input.requireFullscreen;
    }
    if (input.continuousQuestionNumbers !== undefined) {
      payload.continuousQuestionNumbers = !!input.continuousQuestionNumbers;
    }
    if (input.sections !== undefined) {
      const built = this.buildPayload({ sections: input.sections });
      payload.sections = built.sections;
      payload.questions = built.questions;
      payload.totalPoints = built.totalPoints;
    }

    const nextQuiz = ensureQuizSections({
      ...existingQuiz,
      ...input,
      sections: (payload.sections as QuizSection[] | undefined) ?? existingQuiz.sections,
      description:
        input.description !== undefined ? input.description : existingQuiz.description,
    });
    const imageError = validateQuizImageCount(nextQuiz);
    if (imageError) {
      throw new Error(imageError);
    }

    // 仍在舊庫：寫入新庫（含本次修改）→ 搬作答 → 刪舊庫
    if (found.location === 'core' && isQuizDbSeparated()) {
      const migratedData = {
        ...found.data,
        ...payload,
      };
      await migrateQuizAndSubmissionsFromCore(quizId, migratedData);
    } else {
      await found.ref.update(payload);
    }

    await safeQuizImageOperation('sync on update', async () => {
      await syncOrphanedQuizImages(nextQuiz);
    });
  }

  /**
   * 複製考卷為獨立新測驗（新 quizCode、草稿、單一班級），題目與設定沿用來源；作答紀錄不複製。
   */
  async duplicate(
    sourceQuizCode: string,
    teacherId: string,
    options?: { courseId?: string; courseName?: string; title?: string }
  ): Promise<{ quizId: string; quizCode: string }> {
    if (!teacherId) throw new Error('Missing required fields');
    if (!isValidQuizCode(sourceQuizCode)) throw new Error('Quiz not found');

    const source = await this.getByCode(sourceQuizCode);
    if (!source) throw new Error('Quiz not found');

    const teacherCourses = await getTeacherCourseRecords(teacherId);
    if (!canTeacherAccessQuiz(source, teacherId, teacherCourses)) {
      throw new Error('Unauthorized');
    }

    const newQuizCode = await this.generateUniqueQuizCode();
    const sourceNormalized = ensureQuizSections(source);

    await safeQuizImageOperation('clone images on duplicate', async () => {
      await cloneQuizImageFolder(source.quizCode, newQuizCode);
    });

    const rewritten = rewriteQuizImageCodeInQuiz(
      {
        sections: sourceNormalized.sections,
        description: sourceNormalized.description,
      },
      source.quizCode,
      newQuizCode
    );

    let assignedCourses: QuizCourseRef[] = [];
    if (options?.courseId) {
      const matched = teacherCourses.find((c) => c.id === options.courseId);
      assignedCourses = [{
        courseId: options.courseId,
        courseName: options.courseName
          || (matched ? `${matched.name}（${matched.code}）` : options.courseId),
      }];
    }

    const baseTitle = (options?.title ?? source.title).trim() || '未命名測驗';
    const title = options?.title?.trim()
      ? baseTitle
      : `${baseTitle.replace(/\s*（複製）\s*$/, '')}（複製）`;

    return this.create({
      quizCode: newQuizCode,
      teacherId,
      title,
      description: rewritten.description,
      status: 'draft',
      sections: rewritten.sections,
      assignedCourses,
      timeLimitEnabled: !!source.timeLimitEnabled,
      timeLimitMinutes: source.timeLimitMinutes,
      answerWindowEnabled: !!source.answerWindowEnabled,
      answerStartAt: source.answerStartAt,
      answerEndAt: source.answerEndAt,
      mcScoringMethod: source.mcScoringMethod ?? 'average',
      optionLabelStyle: source.optionLabelStyle ?? 'letter_paren',
      attemptUnlimited: !!source.attemptUnlimited,
      attemptLimit: source.attemptLimit,
      resultsPublished: source.resultsPublished !== false,
      attemptScorePolicy: source.attemptScorePolicy ?? 'latest',
      examLockEnabled: !!source.examLockEnabled,
      requireFullscreen: !!source.requireFullscreen,
      continuousQuestionNumbers: source.continuousQuestionNumbers !== false,
    });
  }

  async listPublished(): Promise<Quiz[]> {
    const docs = await this.loadQuizDocs((col) => col.where('status', '==', 'published').get());
    return this.serializeQuizDocs(docs);
  }

  async reorderForCourse(
    teacherId: string,
    courseId: string,
    orderedQuizIds: string[]
  ): Promise<void> {
    if (!teacherId || !courseId || !Array.isArray(orderedQuizIds)) {
      throw new Error('Missing required fields');
    }

    const teacherCourses = await getTeacherCourseRecords(teacherId);
    const canManageCourse = teacherCourses.some((c) => c.id === courseId);
    if (!canManageCourse) {
      throw new Error('Unauthorized');
    }

    for (let index = 0; index < orderedQuizIds.length; index++) {
      const quizId = orderedQuizIds[index];
      const found = await findQuizDocument(quizId);
      if (!found) {
        throw new Error(`Quiz not found: ${quizId}`);
      }
      const quiz = this.serializeQuiz(quizId, found.data);
      const assigned = normalizeAssignedCourses(quiz);
      if (!assigned.some((c) => c.courseId === courseId)) {
        throw new Error(`Quiz not assigned to course: ${quizId}`);
      }
      if (!canTeacherEditQuiz(quiz, teacherId) && !canTeacherAccessQuiz(quiz, teacherId, teacherCourses)) {
        throw new Error('Unauthorized');
      }
      await found.ref.update({
        order: index,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  }

  async delete(quizId: string, teacherId: string): Promise<void> {
    const found = await findQuizDocument(quizId);
    if (!found) {
      throw new Error('Quiz not found');
    }
    const existingQuiz = this.serializeQuiz(quizId, found.data);
    if (!canTeacherDeleteQuiz(existingQuiz, teacherId)) {
      throw new Error('Unauthorized');
    }

    const quizCode = String(found.data.quizCode ?? '');
    if (quizCode) {
      await removeQuizFromAllLessons(quizCode);
      await safeQuizImageOperation('delete all images', async () => {
        await deleteAllQuizImages(quizCode);
      });
    }

    await found.ref.delete();

    // 若兩庫各有殘留，一併清掉
    if (isQuizDbSeparated()) {
      const otherLocation: QuizDataLocation = found.location === 'quiz' ? 'core' : 'quiz';
      const other = await quizzesCollection(otherLocation).doc(quizId).get();
      if (other.exists) await other.ref.delete();
    }
  }
}

export const quizService = new QuizService();
