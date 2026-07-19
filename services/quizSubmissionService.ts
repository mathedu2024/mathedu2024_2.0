import { FieldValue } from 'firebase-admin/firestore';
import { quizService } from './quizService';
import { getQuizCourseRoster, type QuizRosterStudent } from './quizRosterService';
import { getQuizMaxAttempts, type Quiz } from './quizTypes';
import {
  isQuizDbSeparated,
  mergeDocsById,
  resolveSubmissionLocation,
  submissionsCollection,
} from './quizDbSplit';
import {
  buildQuizAccessContext,
  buildQuizCourseScopeOptions,
  filterRosterByCourseScope,
  resolveScopeCourseIds,
  resolveTeacherNamesByIds,
  type QuizCourseScope,
  type QuizCourseScopeOption,
} from './quizTeacherAccess';
import {
  buildAnalytics,
  calculateSubmissionTotal,
  clampManualAnswerScore,
  gradeSubmission,
  isShortAnswerFullCredit,
  remapSubmissionFillInResponses,
  type QuizAnalytics,
  type QuizSubmission,
  type QuestionAnswerRecord,
  type SubmissionStatus,
} from './quizSubmissionTypes';

export interface QuizGradingOverview {
  roster: QuizRosterStudent[];
  submissions: QuizSubmission[];
  enrolledCount: number;
  submittedStudentCount: number;
  notSubmittedStudentCount: number;
  courseScopes: QuizCourseScopeOption[];
  activeCourseScope: QuizCourseScope;
  isCreator: boolean;
  quizCreatorName?: string;
}

function isDemoStudentId(studentId: string): boolean {
  return /^demo_/i.test(studentId);
}

class QuizSubmissionService {
  private serialize(docId: string, data: FirebaseFirestore.DocumentData): QuizSubmission {
    return {
      id: docId,
      quizId: data.quizId ?? '',
      teacherId: data.teacherId ?? '',
      studentId: data.studentId ?? '',
      studentName: data.studentName ?? '',
      answers: Array.isArray(data.answers) ? data.answers : [],
      totalScore: Number(data.totalScore) || 0,
      maxScore: Number(data.maxScore) || 0,
      status: (data.status as SubmissionStatus) ?? 'submitted',
      submittedAt: data.submittedAt?.toDate?.()?.toISOString?.() ?? data.submittedAt ?? '',
      gradedAt: data.gradedAt?.toDate?.()?.toISOString?.() ?? data.gradedAt,
      gradedByTeacherId:
        typeof data.gradedByTeacherId === 'string' ? data.gradedByTeacherId : undefined,
      attemptIndex: typeof data.attemptIndex === 'number' ? data.attemptIndex : undefined,
    };
  }

  private filterRealSubmissions(submissions: QuizSubmission[]): QuizSubmission[] {
    return submissions.filter((s) => !isDemoStudentId(s.studentId));
  }

  private async listAllByQuizId(quizId: string): Promise<QuizSubmission[]> {
    const quizSnap = await submissionsCollection('quiz').where('quizId', '==', quizId).get();
    let docs = quizSnap.docs;

    if (isQuizDbSeparated()) {
      const coreSnap = await submissionsCollection('core').where('quizId', '==', quizId).get();
      docs = mergeDocsById(quizSnap.docs, coreSnap.docs);
    }

    return this.filterRealSubmissions(
      docs
        .map((doc) => this.serialize(doc.id, doc.data()))
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    );
  }

  private async findSubmissionDoc(submissionId: string) {
    const quizDoc = await submissionsCollection('quiz').doc(submissionId).get();
    if (quizDoc.exists) return quizDoc;

    if (isQuizDbSeparated()) {
      const coreDoc = await submissionsCollection('core').doc(submissionId).get();
      if (coreDoc.exists) return coreDoc;
    }

    return null;
  }

  private async resolveScopedData(
    quizId: string,
    teacherId: string,
    courseScope: QuizCourseScope = 'all'
  ) {
    const quiz = await quizService.getById(quizId);
    if (!quiz) return null;

    const access = await buildQuizAccessContext(quiz, teacherId);
    if (!access) return null;

    const courseScopes = buildQuizCourseScopeOptions(access.accessibleCourses, access.isCreator);
    const activeCourseScope = courseScopes.some((scope) => scope.id === courseScope)
      ? courseScope
      : (courseScopes[0]?.id ?? 'all');
    const scopeCourseIds = resolveScopeCourseIds(access.accessibleCourses, activeCourseScope);
    const fullRoster = await getQuizCourseRoster(quiz);
    const roster = filterRosterByCourseScope(fullRoster, scopeCourseIds, access.teacherCourses);
    const rosterStudentIds = new Set(roster.map((student) => student.studentId));
    const submissions = (await this.listAllByQuizId(quizId)).filter((submission) =>
      rosterStudentIds.has(submission.studentId)
    );

    return {
      quiz,
      access,
      courseScopes,
      activeCourseScope,
      roster,
      submissions,
    };
  }

  private enrichSubmissionsWithGraderNames(
    submissions: QuizSubmission[],
    teacherNameById: Map<string, string>
  ): QuizSubmission[] {
    return submissions.map((submission) => ({
      ...submission,
      gradedByTeacherName: submission.gradedByTeacherId
        ? teacherNameById.get(submission.gradedByTeacherId)
        : undefined,
    }));
  }

  private async enrichOverviewSubmissions(
    quiz: Quiz,
    submissions: QuizSubmission[]
  ): Promise<{ submissions: QuizSubmission[]; quizCreatorName?: string }> {
    const graderIds = submissions
      .map((submission) => submission.gradedByTeacherId)
      .filter((id): id is string => !!id);
    const teacherNameById = await resolveTeacherNamesByIds([quiz.teacherId, ...graderIds]);
    return {
      submissions: this.enrichSubmissionsWithGraderNames(submissions, teacherNameById),
      quizCreatorName: teacherNameById.get(quiz.teacherId),
    };
  }

  private async assertCanGradeSubmission(
    submission: QuizSubmission,
    gradingTeacherId: string
  ): Promise<Quiz> {
    const quiz = await quizService.getById(submission.quizId);
    if (!quiz) throw new Error('Quiz not found');

    const access = await buildQuizAccessContext(quiz, gradingTeacherId);
    if (!access) throw new Error('Unauthorized');

    const scopeCourseIds = resolveScopeCourseIds(access.accessibleCourses, 'all');
    const fullRoster = await getQuizCourseRoster(quiz);
    const accessibleStudentIds = new Set(
      filterRosterByCourseScope(fullRoster, scopeCourseIds, access.teacherCourses).map(
        (student) => student.studentId
      )
    );
    if (!accessibleStudentIds.has(submission.studentId)) {
      throw new Error('Unauthorized');
    }

    return quiz;
  }

  async listByQuiz(
    quizId: string,
    teacherId: string,
    courseScope: QuizCourseScope = 'all'
  ): Promise<QuizSubmission[]> {
    const scoped = await this.resolveScopedData(quizId, teacherId, courseScope);
    return scoped?.submissions ?? [];
  }

  /** 輕量查詢：僅作答紀錄（不含名冊），供儀表板待批改公告使用 */
  async listSubmissionsForFeed(quizId: string): Promise<QuizSubmission[]> {
    return this.filterRealSubmissions(await this.listAllByQuizId(quizId));
  }

  async getGradingOverview(
    quizId: string,
    teacherId: string,
    courseScope: QuizCourseScope = 'all'
  ): Promise<QuizGradingOverview | null> {
    const scoped = await this.resolveScopedData(quizId, teacherId, courseScope);
    if (!scoped) return null;

    const { roster, submissions, courseScopes, activeCourseScope, access, quiz } = scoped;
    const enriched = await this.enrichOverviewSubmissions(quiz, submissions);
    const rosterSubmissions = enriched.submissions;
    const submittedIds = new Set(rosterSubmissions.map((submission) => submission.studentId));
    const submittedStudentCount = roster.filter((student) => submittedIds.has(student.studentId)).length;

    return {
      roster,
      submissions: rosterSubmissions,
      enrolledCount: roster.length,
      submittedStudentCount,
      notSubmittedStudentCount: Math.max(0, roster.length - submittedStudentCount),
      courseScopes,
      activeCourseScope,
      isCreator: access.isCreator,
      quizCreatorName: enriched.quizCreatorName,
    };
  }

  async getById(submissionId: string): Promise<QuizSubmission | null> {
    const doc = await this.findSubmissionDoc(submissionId);
    if (!doc) return null;
    return this.serialize(doc.id, doc.data()!);
  }

  async updateGrades(
    submissionId: string,
    teacherId: string,
    updates: { questionId: string; score: number; teacherComment?: string }[]
  ): Promise<QuizSubmission> {
    const doc = await this.findSubmissionDoc(submissionId);
    if (!doc) throw new Error('Submission not found');
    const docRef = doc.ref;
    const data = doc.data()!;
    const submission = this.serialize(doc.id, data);
    await this.assertCanGradeSubmission(submission, teacherId);

    const answers = (data.answers as QuestionAnswerRecord[]).map((a) => {
      const upd = updates.find((u) => u.questionId === a.questionId);
      if (!upd) return a;
      if (a.questionType !== 'short_answer') return a;

      const score = clampManualAnswerScore(upd.score, a.maxScore);
      return {
        ...a,
        score,
        teacherComment: upd.teacherComment ?? a.teacherComment,
        gradingStatus: 'manual' as const,
        isCorrect: isShortAnswerFullCredit(score, a.maxScore),
      };
    });

    const totals = calculateSubmissionTotal(answers);
    const allGraded = answers.every((a) => a.gradingStatus !== 'pending');

    await docRef.update({
      answers,
      totalScore: totals.total,
      maxScore: totals.max,
      status: allGraded ? 'graded' : 'grading',
      gradedAt: allGraded ? FieldValue.serverTimestamp() : data.gradedAt ?? null,
      gradedByTeacherId: teacherId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await docRef.get();
    const serialized = this.serialize(updated.id, updated.data()!);
    if (serialized.gradedByTeacherId) {
      const names = await resolveTeacherNamesByIds([serialized.gradedByTeacherId]);
      serialized.gradedByTeacherName = names.get(serialized.gradedByTeacherId);
    }
    return serialized;
  }

  async regradeSubmission(submissionId: string, teacherId: string): Promise<QuizSubmission> {
    const submission = await this.getById(submissionId);
    if (!submission) throw new Error('Not found');
    const quiz = await this.assertCanGradeSubmission(submission, teacherId);

    const graded = gradeSubmission(quiz, submission.answers);
    const totals = calculateSubmissionTotal(graded);
    const hasPending = graded.some((a) => a.gradingStatus === 'pending');

    const doc = await this.findSubmissionDoc(submissionId);
    if (!doc) throw new Error('Not found');

    await doc.ref.update({
      answers: graded,
      totalScore: totals.total,
      maxScore: totals.max,
      status: hasPending ? 'grading' : 'graded',
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await this.getById(submissionId);
    return updated!;
  }

  /**
   * 老師變更選填等客觀題答案後，依目前考卷重批所有已繳交作答。
   * 選填格以數字編號對應；簡答題手動分數保留。
   */
  async regradeAllForQuiz(
    quizId: string,
    teacherId: string,
    options?: { previousQuiz?: Quiz }
  ): Promise<number> {
    const quiz = await quizService.getById(quizId);
    if (!quiz) throw new Error('Quiz not found');

    const access = await buildQuizAccessContext(quiz, teacherId);
    if (!access) throw new Error('Unauthorized');

    const submissions = await this.listAllByQuizId(quizId);
    let updatedCount = 0;

    for (const submission of submissions) {
      const remapped = remapSubmissionFillInResponses(
        submission.answers,
        options?.previousQuiz,
        quiz
      );
      const graded = gradeSubmission(quiz, remapped);
      const totals = calculateSubmissionTotal(graded);
      const hasPending = graded.some((a) => a.gradingStatus === 'pending');

      const doc = await this.findSubmissionDoc(submission.id);
      if (!doc) continue;

      await doc.ref.update({
        answers: graded,
        totalScore: totals.total,
        maxScore: totals.max,
        status: hasPending ? 'grading' : 'graded',
        updatedAt: FieldValue.serverTimestamp(),
      });
      updatedCount += 1;
    }

    return updatedCount;
  }

  async getAnalytics(
    quizId: string,
    teacherId: string,
    courseScope: QuizCourseScope = 'all'
  ): Promise<QuizAnalytics | null> {
    const scoped = await this.resolveScopedData(quizId, teacherId, courseScope);
    if (!scoped) return null;

    const { quiz, roster, submissions, courseScopes, activeCourseScope } = scoped;
    const submittedIds = new Set(submissions.map((submission) => submission.studentId));
    const submittedStudentCount = roster.filter((student) => submittedIds.has(student.studentId)).length;
    const analytics = buildAnalytics(quiz, submissions, {
      enrolledCount: roster.length,
      submittedStudentCount,
      notSubmittedStudentCount: Math.max(0, roster.length - submittedStudentCount),
    });

    return {
      ...analytics,
      courseScopes,
      activeCourseScope,
    };
  }

  async getByStudentAndQuiz(quizId: string, studentId: string): Promise<QuizSubmission | null> {
    return this.getLatestByStudentAndQuiz(quizId, studentId);
  }

  async getLatestByStudentAndQuiz(quizId: string, studentId: string): Promise<QuizSubmission | null> {
    const list = await this.listByStudentAndQuiz(quizId, studentId);
    return list[0] ?? null;
  }

  async listByStudentAndQuiz(quizId: string, studentId: string): Promise<QuizSubmission[]> {
    const quizSnap = await submissionsCollection('quiz')
      .where('quizId', '==', quizId)
      .where('studentId', '==', studentId)
      .get();
    let docs = quizSnap.docs;

    if (isQuizDbSeparated()) {
      const coreSnap = await submissionsCollection('core')
        .where('quizId', '==', quizId)
        .where('studentId', '==', studentId)
        .get();
      docs = mergeDocsById(quizSnap.docs, coreSnap.docs);
    }

    if (docs.length === 0) return [];
    return this.filterRealSubmissions(
      docs
        .map((doc) => this.serialize(doc.id, doc.data()))
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    );
  }

  /** 一次查出該生所有作答，依 quizId 分組（避免 exams list N+1） */
  async listGroupedByStudent(studentId: string): Promise<Map<string, QuizSubmission[]>> {
    const quizSnap = await submissionsCollection('quiz').where('studentId', '==', studentId).get();
    let docs = quizSnap.docs;

    if (isQuizDbSeparated()) {
      const coreSnap = await submissionsCollection('core').where('studentId', '==', studentId).get();
      docs = mergeDocsById(quizSnap.docs, coreSnap.docs);
    }

    const grouped = new Map<string, QuizSubmission[]>();
    const serialized = this.filterRealSubmissions(
      docs.map((doc) => this.serialize(doc.id, doc.data()))
    );
    for (const sub of serialized) {
      if (!sub.quizId) continue;
      const list = grouped.get(sub.quizId) ?? [];
      list.push(sub);
      grouped.set(sub.quizId, list);
    }
    for (const [quizId, list] of grouped) {
      grouped.set(
        quizId,
        list.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      );
    }
    return grouped;
  }

  async countByStudentAndQuiz(quizId: string, studentId: string): Promise<number> {
    const list = await this.listByStudentAndQuiz(quizId, studentId);
    return list.length;
  }

  async hasStudentSubmitted(quizId: string, studentId: string): Promise<boolean> {
    const count = await this.countByStudentAndQuiz(quizId, studentId);
    return count > 0;
  }

  async submitStudentExam(params: {
    quiz: Quiz;
    studentId: string;
    studentName: string;
    answers: QuestionAnswerRecord[];
    totalScore: number;
    maxScore: number;
    status: SubmissionStatus;
  }): Promise<QuizSubmission> {
    const maxAttempts = getQuizMaxAttempts(params.quiz);
    let attemptIndex = 1;
    if (maxAttempts !== null) {
      const count = await this.countByStudentAndQuiz(params.quiz.id, params.studentId);
      if (count >= maxAttempts) {
        throw new Error('ATTEMPT_LIMIT_REACHED');
      }
      attemptIndex = count + 1;
    } else {
      const count = await this.countByStudentAndQuiz(params.quiz.id, params.studentId);
      attemptIndex = count + 1;
    }

    // 測驗仍在舊庫時，作答也寫舊庫；遷移後才寫新庫
    const location = await resolveSubmissionLocation(params.quiz.id);
    const docRef = await submissionsCollection(location).add({
      quizId: params.quiz.id,
      teacherId: params.quiz.teacherId,
      studentId: params.studentId,
      studentName: params.studentName,
      answers: params.answers,
      totalScore: params.totalScore,
      maxScore: params.maxScore,
      status: params.status,
      attemptIndex,
      submittedAt: FieldValue.serverTimestamp(),
      gradedAt: params.status === 'graded' ? FieldValue.serverTimestamp() : null,
    });

    const created = await docRef.get();
    return this.serialize(created.id, created.data()!);
  }
}

export const quizSubmissionService = new QuizSubmissionService();
