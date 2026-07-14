import { NextRequest, NextResponse } from 'next/server';
import { surveyService } from '@/services/surveyService';

export async function POST(req: NextRequest) {
  try {
    const { teacherId, courseId, order } = await req.json();
    if (!teacherId || !courseId || !Array.isArray(order)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    await surveyService.reorder(teacherId, courseId, order.map(String));
    return NextResponse.json({ message: 'Order updated' });
  } catch (error) {
    console.error('Error reordering surveys:', error);
    return NextResponse.json({ error: 'Failed to reorder surveys' }, { status: 500 });
  }
}
