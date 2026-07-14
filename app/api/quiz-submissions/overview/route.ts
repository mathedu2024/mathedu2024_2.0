import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { quizSubmissionService } from '@/services/quizSubmissionService';

export async function POST(req: NextRequest) {
  try {
    const { quizId, teacherId, courseScope } = await req.json();
    if (!quizId || !teacherId) {
      return NextResponse.json({ error: 'Missing quizId or teacherId' }, { status: 400 });
    }

    const overview = await quizSubmissionService.getGradingOverview(
      quizId,
      teacherId,
      courseScope ?? 'all'
    );
    if (!overview) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    return NextResponse.json({ overview }, { status: 200 });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error fetching grading overview:', error);
    return NextResponse.json({ error: 'Failed to fetch grading overview' }, { status: 500 });
  }
}
