import { NextRequest, NextResponse } from 'next/server';
import { trySiteErrorResponse } from '@/utils/apiErrorResponse';
import { quizService } from '@/services/quizService';

export async function POST(req: NextRequest) {
  try {
    const { quizId, teacherId } = await req.json();

    if (!quizId || !teacherId) {
      return NextResponse.json({ error: 'Missing quizId or teacherId' }, { status: 400 });
    }

    await quizService.delete(quizId, teacherId);
    return NextResponse.json({ message: 'Quiz deleted' }, { status: 200 });
  } catch (error) {
    const siteErrorResponse = trySiteErrorResponse(error, req);
    if (siteErrorResponse) return siteErrorResponse;

    if (error instanceof Error) {
      if (error.message === 'Quiz not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    console.error('Error deleting quiz:', error);
    return NextResponse.json({ error: 'Failed to delete quiz' }, { status: 500 });
  }
}
