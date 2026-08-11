import { NextRequest, NextResponse } from 'next/server';
import { trySiteErrorResponse } from '@/utils/apiErrorResponse';
import { quizService } from '@/services/quizService';
import type { QuizInput } from '@/services/quizTypes';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as QuizInput;

    if (!body.teacherId || !body.title?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { quizId, quizCode } = await quizService.create(body);
    return NextResponse.json({ message: 'Quiz created', quizId, quizCode }, { status: 201 });
  } catch (error) {
    const siteErrorResponse = trySiteErrorResponse(error, req);
    if (siteErrorResponse) return siteErrorResponse;

    if (error instanceof Error && error.message === 'Missing required fields') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error creating quiz:', error);
    return NextResponse.json({ error: 'Failed to create quiz' }, { status: 500 });
  }
}
