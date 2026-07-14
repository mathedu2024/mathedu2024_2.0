import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { quizService } from '@/services/quizService';
import { quizSubmissionService } from '@/services/quizSubmissionService';
import { isQuizAccessibleToStudent, getQuizForStudentExam, extractQuizAnswerKey, sanitizeSubmissionForStudent, buildStudentAttemptSummaries } from '@/services/quizStudentView';
import { canStudentRetakeQuiz, getQuizMaxAttempts, isQuizResultsPublished, isValidQuizCode } from '@/services/quizTypes';
import {
  getStudentEnrolledCourseIds,
  getStudentSessionFromRequest,
} from '@/utils/studentSessionServer';

export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quizCode, submissionId, review, take } = await req.json();
    if (!quizCode || !isValidQuizCode(String(quizCode))) {
      return NextResponse.json({ error: 'Invalid quiz code' }, { status: 400 });
    }

    const quiz = await quizService.getByCode(String(quizCode));
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const enrolledCourseIds = await getStudentEnrolledCourseIds(session.id);
    const latestSubmission = await quizSubmissionService.getLatestByStudentAndQuiz(quiz.id, session.id);
    const submissionCount = await quizSubmissionService.countByStudentAndQuiz(quiz.id, session.id);
    const maxAttempts = getQuizMaxAttempts(quiz);
    const hasAttemptsLeft = canStudentRetakeQuiz(quiz, submissionCount);
    const access = isQuizAccessibleToStudent(quiz, enrolledCourseIds);

    const resultsPublished = isQuizResultsPublished(quiz);
    const quizForStudent = (reviewMode: boolean) =>
      getQuizForStudentExam(quiz, { reviewMode, resultsPublished });
    const answerKeyForReview =
      resultsPublished ? extractQuizAnswerKey(quiz) : undefined;
    const withAnswerKey = (reviewMode: boolean, payload: Record<string, unknown>) => ({
      ...payload,
      ...(reviewMode && answerKeyForReview ? { answerKey: answerKeyForReview } : {}),
    });
    const safeSubmission = (sub: typeof latestSubmission) =>
      sub ? sanitizeSubmissionForStudent(sub, quiz) : null;

    let attemptSummariesCache: Awaited<ReturnType<typeof buildStudentAttemptSummaries>> | null = null;
    const getAttemptSummaries = async () => {
      if (attemptSummariesCache) return attemptSummariesCache;
      const submissions = await quizSubmissionService.listByStudentAndQuiz(quiz.id, session.id);
      attemptSummariesCache = buildStudentAttemptSummaries(quiz, submissions);
      return attemptSummariesCache;
    };

    const readOnlyPayload = async (payload: Record<string, unknown>) =>
      withAnswerKey(true, { ...payload, attempts: await getAttemptSummaries() });

    if (take === true) {
      if (!access.ok) {
        if (latestSubmission) {
          return NextResponse.json(await readOnlyPayload({
            quiz: quizForStudent(true),
            submission: safeSubmission(latestSubmission),
            readOnly: true,
            canRetake: false,
            submissionCount,
            maxAttempts,
            inaccessibleReason: access.reason,
            resultsPublished,
            viewingSubmissionId: latestSubmission.id,
          }));
        }
        return NextResponse.json({ error: access.reason ?? '無法作答' }, { status: 403 });
      }

      if (!hasAttemptsLeft) {
        return NextResponse.json(await readOnlyPayload({
          quiz: quizForStudent(true),
          submission: safeSubmission(latestSubmission),
          readOnly: true,
          canRetake: false,
          submissionCount,
          maxAttempts,
          resultsPublished,
          viewingSubmissionId: latestSubmission?.id,
        }));
      }

      return NextResponse.json({
        quiz: quizForStudent(false),
        submission: null,
        readOnly: false,
        canRetake: submissionCount > 0,
        submissionCount,
        maxAttempts,
        resultsPublished,
      });
    }

    if (submissionId) {
      const target = await quizSubmissionService.getById(String(submissionId));
      if (!target || target.quizId !== quiz.id || target.studentId !== session.id) {
        return NextResponse.json({ error: 'Submission not found' }, { status: 404 });
      }
      return NextResponse.json(await readOnlyPayload({
        quiz: quizForStudent(true),
        submission: safeSubmission(target),
        readOnly: true,
        canRetake: access.ok && hasAttemptsLeft,
        submissionCount,
        maxAttempts,
        resultsPublished,
        viewingSubmissionId: target.id,
      }));
    }

    if (review) {
      if (!latestSubmission) {
        return NextResponse.json({ error: '尚無作答紀錄' }, { status: 404 });
      }
      return NextResponse.json(await readOnlyPayload({
        quiz: quizForStudent(true),
        submission: safeSubmission(latestSubmission),
        readOnly: true,
        canRetake: access.ok && hasAttemptsLeft,
        submissionCount,
        maxAttempts,
        resultsPublished,
        viewingSubmissionId: latestSubmission.id,
      }));
    }

    if (latestSubmission && !hasAttemptsLeft) {
      return NextResponse.json(await readOnlyPayload({
        quiz: quizForStudent(true),
        submission: safeSubmission(latestSubmission),
        readOnly: true,
        canRetake: false,
        submissionCount,
        maxAttempts,
        resultsPublished,
      }));
    }

    if (!access.ok) {
      if (latestSubmission) {
        return NextResponse.json(await readOnlyPayload({
          quiz: quizForStudent(true),
          submission: safeSubmission(latestSubmission),
          readOnly: true,
          canRetake: false,
          submissionCount,
          maxAttempts,
          inaccessibleReason: access.reason,
          resultsPublished,
        }));
      }
      return NextResponse.json({ error: access.reason ?? '無法作答' }, { status: 403 });
    }

    return NextResponse.json({
      quiz: quizForStudent(false),
      submission: null,
      readOnly: false,
      canRetake: hasAttemptsLeft && submissionCount > 0,
      submissionCount,
      maxAttempts,
      resultsPublished,
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error fetching student exam:', error);
    return NextResponse.json({ error: 'Failed to fetch exam' }, { status: 500 });
  }
}
