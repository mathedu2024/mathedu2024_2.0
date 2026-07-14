import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { quizService } from '@/services/quizService';
import { quizSubmissionService } from '@/services/quizSubmissionService';
import { buildStudentAttemptSummaries } from '@/services/quizStudentView';
import { isQuizResultsPublished, isValidQuizCode } from '@/services/quizTypes';
import {
  getStudentSessionFromRequest,
} from '@/utils/studentSessionServer';

export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quizCode } = await req.json();
    if (!quizCode || !isValidQuizCode(String(quizCode))) {
      return NextResponse.json({ error: 'Invalid quiz code' }, { status: 400 });
    }

    const quiz = await quizService.getByCode(String(quizCode));
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const submissions = await quizSubmissionService.listByStudentAndQuiz(quiz.id, session.id);
    const resultsPublished = isQuizResultsPublished(quiz);
    const attempts = buildStudentAttemptSummaries(quiz, submissions);

    return NextResponse.json({ attempts, resultsPublished }, { status: 200 });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error listing student exam submissions:', error);
    return NextResponse.json({ error: 'Failed to list submissions' }, { status: 500 });
  }
}
