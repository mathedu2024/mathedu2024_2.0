import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { quizSubmissionService } from '@/services/quizSubmissionService';

export async function POST(req: NextRequest) {
  try {
    const { quizId, teacherId, courseScope } = await req.json();
    if (!quizId || !teacherId) {
      return NextResponse.json({ error: 'Missing quizId or teacherId' }, { status: 400 });
    }

    const submissions = await quizSubmissionService.listByQuiz(
      quizId,
      teacherId,
      courseScope ?? 'all'
    );
    return NextResponse.json({ submissions }, { status: 200 });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error listing submissions:', error);
    return NextResponse.json({ error: 'Failed to list submissions' }, { status: 500 });
  }
}
