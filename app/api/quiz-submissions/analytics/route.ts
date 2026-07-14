import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { quizSubmissionService } from '@/services/quizSubmissionService';

export async function POST(req: NextRequest) {
  try {
    const { quizId, teacherId, courseScope } = await req.json();
    if (!quizId || !teacherId) {
      return NextResponse.json({ error: 'Missing quizId or teacherId' }, { status: 400 });
    }

    const analytics = await quizSubmissionService.getAnalytics(
      quizId,
      teacherId,
      courseScope ?? 'all'
    );
    if (!analytics) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    return NextResponse.json({ analytics }, { status: 200 });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
