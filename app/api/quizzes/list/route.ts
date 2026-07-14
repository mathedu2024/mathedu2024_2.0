import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { quizService } from '@/services/quizService';

export async function POST(req: NextRequest) {
  try {
    const { teacherId } = await req.json();
    if (!teacherId) {
      return NextResponse.json({ error: 'Missing teacherId' }, { status: 400 });
    }

    const quizzes = await quizService.listAccessibleByTeacher(teacherId);
    return NextResponse.json({ quizzes }, { status: 200 });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error listing quizzes:', error);
    return NextResponse.json({ error: 'Failed to list quizzes' }, { status: 500 });
  }
}
