import { NextRequest, NextResponse } from 'next/server';
import { surveyService } from '@/services/surveyService';
import type { SurveyInput } from '@/services/surveyTypes';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { surveyId: string; teacherId: string } & Partial<SurveyInput>;
    if (!body.surveyId || !body.teacherId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const { surveyId, teacherId, ...input } = body;
    await surveyService.update(surveyId, teacherId, input);
    return NextResponse.json({ message: 'Survey updated' });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message === 'Survey not found') {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error updating survey:', error);
    return NextResponse.json({ error: 'Failed to update survey' }, { status: 500 });
  }
}
