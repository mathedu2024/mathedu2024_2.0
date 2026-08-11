import { NextRequest, NextResponse } from 'next/server';
import { trySiteErrorResponse } from '@/utils/apiErrorResponse';
import { quizService } from '@/services/quizService';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      teacherId?: string;
      sourceQuizCode?: string;
      courseId?: string;
      courseName?: string;
      title?: string;
    };

    if (!body.teacherId || !body.sourceQuizCode?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { quizId, quizCode } = await quizService.duplicate(
      body.sourceQuizCode.trim(),
      body.teacherId,
      {
        courseId: body.courseId?.trim() || undefined,
        courseName: body.courseName?.trim() || undefined,
        title: body.title?.trim() || undefined,
      }
    );

    return NextResponse.json(
      { message: 'Quiz duplicated', quizId, quizCode },
      { status: 201 }
    );
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
      if (error.message === 'Missing required fields') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error duplicating quiz:', error);
    return NextResponse.json({ error: 'Failed to duplicate quiz' }, { status: 500 });
  }
}
