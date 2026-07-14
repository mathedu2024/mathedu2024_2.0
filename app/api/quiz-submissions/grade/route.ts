import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { quizSubmissionService } from '@/services/quizSubmissionService';

export async function POST(req: NextRequest) {
  try {
    const { submissionId, teacherId, updates } = await req.json();
    if (!submissionId || !teacherId || !Array.isArray(updates)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const submission = await quizSubmissionService.updateGrades(submissionId, teacherId, updates);
    return NextResponse.json({ submission }, { status: 200 });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error grading submission:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to grade submission' },
      { status: 500 }
    );
  }
}
