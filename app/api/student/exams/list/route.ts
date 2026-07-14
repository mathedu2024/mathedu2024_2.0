import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { quizService } from '@/services/quizService';
import { quizSubmissionService } from '@/services/quizSubmissionService';
import {
  isQuizAccessibleToStudent,
  isQuizAssignedToCourse,
  isStudentEnrolledInQuiz,
} from '@/services/quizStudentView';
import { resolveEffectiveScore } from '@/services/quizSubmissionTypes';
import {
  canStudentRetakeQuiz,
  formatQuizAnswerWindow,
  formatQuizAttemptLimit,
  formatQuizTimeLimit,
  getQuizAnswerWindowPhase,
  getQuizAttemptScorePolicy,
  getQuizMaxAttempts,
  isQuizMultipleAttemptsAllowed,
  isQuizResultsPublished,
  isQuizExamLockEnabled,
  isQuizRequireFullscreen,
  normalizeAssignedCourses,
} from '@/services/quizTypes';
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

    const body = await req.json().catch(() => ({}));
    const filterCourseId =
      typeof body?.courseId === 'string' && body.courseId.trim() ? body.courseId.trim() : '';
    const filterCourseName =
      typeof body?.courseName === 'string' ? body.courseName : '';
    const filterCourseCode =
      typeof body?.courseCode === 'string' ? body.courseCode : '';

    const enrolledCourseIds = await getStudentEnrolledCourseIds(session.id);
    const [published, submissionsByQuiz] = await Promise.all([
      quizService.listPublished(),
      quizSubmissionService.listGroupedByStudent(session.id),
    ]);

    const scopedPublished =
      filterCourseId || filterCourseCode
        ? published.filter((quiz) =>
            isQuizAssignedToCourse(normalizeAssignedCourses(quiz), {
              id: filterCourseId || filterCourseCode,
              name: filterCourseName,
              code: filterCourseCode,
            })
          )
        : published;

    const exams = scopedPublished.map((quiz) => {
        const enrolled = isStudentEnrolledInQuiz(quiz, enrolledCourseIds);
        const access = isQuizAccessibleToStudent(quiz, enrolledCourseIds);
        const allSubmissions = submissionsByQuiz.get(quiz.id) ?? [];
        const submission = allSubmissions[0] ?? null;
        const submissionCount = allSubmissions.length;
        const maxAttempts = getQuizMaxAttempts(quiz);
        const hasAttemptsLeft = canStudentRetakeQuiz(quiz, submissionCount);
        const canRetake = access.ok && hasAttemptsLeft && submissionCount > 0;
        const resultsPublished = isQuizResultsPublished(quiz);
        const scorePolicy = getQuizAttemptScorePolicy(quiz);
        const windowPhase = getQuizAnswerWindowPhase(quiz);
        const effectiveScore =
          submissionCount > 0
            ? resolveEffectiveScore(allSubmissions, scorePolicy)
            : null;

        const attempts =
          submissionCount > 0
            ? [...allSubmissions]
                .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
                .map((sub, index) => ({
                  id: sub.id,
                  attemptIndex: sub.attemptIndex ?? index + 1,
                  submittedAt: sub.submittedAt,
                  totalScore: sub.totalScore,
                  status: sub.status,
                }))
            : [];

        return {
          id: quiz.id,
          quizCode: quiz.quizCode,
          title: quiz.title,
          totalPoints: quiz.totalPoints,
          timeLimitLabel: formatQuizTimeLimit(quiz),
          answerWindowLabel: formatQuizAnswerWindow(quiz),
          attemptLimitLabel: formatQuizAttemptLimit(quiz),
          attemptUnlimited: maxAttempts === null,
          maxAttempts,
          submissionCount,
          enrolled,
          accessible: access.ok,
          inaccessibleReason: access.reason,
          submitted: submissionCount > 0,
          canRetake,
          resultsPublished,
          submissionStatus: submission?.status ?? null,
          submissionScore: effectiveScore,
          scorePolicy,
          multipleAttempts: isQuizMultipleAttemptsAllowed(quiz),
          latestSubmissionId: submission?.id ?? null,
          windowPhase,
          windowEnded: windowPhase === 'ended',
          attempts,
          examLockEnabled: isQuizExamLockEnabled(quiz),
          requireFullscreen: isQuizRequireFullscreen(quiz),
          assignedCourses: normalizeAssignedCourses(quiz),
          order: typeof quiz.order === 'number' ? quiz.order : undefined,
          createdAt: quiz.createdAt,
        };
      });

    const visible = exams.filter((e) => e.enrolled || e.submitted);
    return NextResponse.json({ exams: visible }, { status: 200 });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error listing student exams:', error);
    return NextResponse.json({ error: 'Failed to list exams' }, { status: 500 });
  }
}
