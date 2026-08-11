import { NextRequest, NextResponse } from 'next/server';
import { trySiteErrorResponse } from '@/utils/apiErrorResponse';
import { quizService } from '@/services/quizService';
import type { QuizInput } from '@/services/quizTypes';
import { requireAuthFromRequest } from '@/services/apiAuth';

export async function POST(req: NextRequest) {
  const auth = requireAuthFromRequest(req, 'admin', 'teacher');
  if (auth.ok === false) return auth.response;

  try {
    const { quizId, ...rest } = (await req.json()) as QuizInput & { quizId: string; teacherId?: string };

    if (!quizId) {
      return NextResponse.json({ error: 'Missing quizId' }, { status: 400 });
    }

    const teacherId = auth.session.id;
    await quizService.update(quizId, teacherId, rest);
    return NextResponse.json({ message: 'Quiz updated' }, { status: 200 });
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
      if (error.message.includes('圖片')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    console.error('Error updating quiz:', error);
    return NextResponse.json({ error: 'Failed to update quiz' }, { status: 500 });
  }
}
