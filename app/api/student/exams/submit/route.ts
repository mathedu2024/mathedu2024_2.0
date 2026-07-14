import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { quizService } from '@/services/quizService';
import { quizSubmissionService } from '@/services/quizSubmissionService';
import { isQuizAccessibleToStudent } from '@/services/quizStudentView';
import { canStudentRetakeQuiz, getQuizMaxAttempts, isQuizResultsPublished, isValidQuizCode } from '@/services/quizTypes';
import {
  gradeStudentSubmission,
  type StudentAnswers,
} from '@/services/quizSubmissionTypes';
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

    const { quizCode, answers } = (await req.json()) as {
      quizCode: string;
      answers: StudentAnswers;
    };

    if (!quizCode || !isValidQuizCode(String(quizCode))) {
      return NextResponse.json({ error: 'Invalid quiz code' }, { status: 400 });
    }

    const quiz = await quizService.getByCode(String(quizCode));
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const enrolledCourseIds = await getStudentEnrolledCourseIds(session.id);
    const access = isQuizAccessibleToStudent(quiz, enrolledCourseIds);
    if (!access.ok) {
      return NextResponse.json({ error: access.reason ?? '無法提交' }, { status: 403 });
    }

    const maxAttempts = getQuizMaxAttempts(quiz);
    if (maxAttempts !== null) {
      const count = await quizSubmissionService.countByStudentAndQuiz(quiz.id, session.id);
      if (count >= maxAttempts) {
        const latest = await quizSubmissionService.getLatestByStudentAndQuiz(quiz.id, session.id);
        return NextResponse.json(
          { error: `您已達此測驗的作答次數上限（${maxAttempts} 次）`, submission: latest },
          { status: 409 }
        );
      }
    }

    const gradeResult = gradeStudentSubmission(quiz, answers ?? {});

    const submission = await quizSubmissionService.submitStudentExam({
      quiz,
      studentId: session.id,
      studentName: session.name || session.account,
      answers: gradeResult.answers,
      totalScore: gradeResult.totalScore,
      maxScore: gradeResult.maxScore,
      status: gradeResult.status,
    });

    const resultsPublished = isQuizResultsPublished(quiz);

    return NextResponse.json({
      submission,
      resultsPublished,
      gradeResult: {
        totalScore: gradeResult.totalScore,
        maxScore: gradeResult.maxScore,
        objectiveScore: gradeResult.objectiveScore,
        hasPendingManual: gradeResult.hasPendingManual,
        status: gradeResult.status,
      },
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    if (error instanceof Error && error.message === 'ATTEMPT_LIMIT_REACHED') {
      return NextResponse.json({ error: '您已達此測驗的作答次數上限' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'ALREADY_SUBMITTED') {
      return NextResponse.json({ error: '您已提交過此測驗' }, { status: 409 });
    }
    console.error('Error submitting exam:', error);
    return NextResponse.json({ error: 'Failed to submit exam' }, { status: 500 });
  }
}
