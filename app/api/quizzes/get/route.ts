import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { quizService } from '@/services/quizService';
import { isValidQuizCode } from '@/services/quizTypes';

export async function POST(req: NextRequest) {
  try {
    const { quizId, quizCode } = await req.json();

    if (quizCode && isValidQuizCode(String(quizCode))) {
      const quiz = await quizService.getByCode(String(quizCode));
      if (!quiz) {
        return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
      }
      return NextResponse.json({ quiz }, { status: 200 });
    }

    if (!quizId) {
      return NextResponse.json({ error: 'Missing quizId or quizCode' }, { status: 400 });
    }

    const quiz = await quizService.getById(quizId);
    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    return NextResponse.json({ quiz }, { status: 200 });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error fetching quiz:', error);
    return NextResponse.json({ error: 'Failed to fetch quiz' }, { status: 500 });
  }
}
