import { NextRequest, NextResponse } from 'next/server';
import { trySiteErrorResponse } from '@/utils/apiErrorResponse';
import { quizService } from '@/services/quizService';

export async function POST(req: NextRequest) {
  try {
    const { teacherId, courseId, order } = await req.json();
    if (!teacherId || !courseId || !Array.isArray(order)) {
      return NextResponse.json({ error: '缺少 teacherId、courseId 或 order' }, { status: 400 });
    }

    await quizService.reorderForCourse(teacherId, courseId, order.map(String));
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const siteErrorResponse = trySiteErrorResponse(error, req);
    if (siteErrorResponse) return siteErrorResponse;

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      if (error.message.startsWith('Quiz not found') || error.message.startsWith('Quiz not assigned')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message === 'Missing required fields') {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    console.error('Error reordering quizzes:', error);
    return NextResponse.json({ error: 'Failed to reorder quizzes' }, { status: 500 });
  }
}
