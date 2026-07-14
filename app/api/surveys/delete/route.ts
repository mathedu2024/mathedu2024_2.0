import { NextRequest, NextResponse } from 'next/server';
import { surveyService } from '@/services/surveyService';

export async function POST(req: NextRequest) {
  try {
    const { surveyId, teacherId } = await req.json();
    if (!surveyId || !teacherId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    await surveyService.delete(surveyId, teacherId);
    return NextResponse.json({ message: 'Survey deleted' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'Survey not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('Error deleting survey:', error);
    return NextResponse.json({ error: 'Failed to delete survey' }, { status: 500 });
  }
}
