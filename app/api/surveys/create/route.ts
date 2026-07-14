import { NextRequest, NextResponse } from 'next/server';
import { surveyService } from '@/services/surveyService';
import type { SurveyInput } from '@/services/surveyTypes';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SurveyInput;
    if (!body.teacherId || !body.title?.trim()) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    const { surveyId, surveyCode } = await surveyService.create(body);
    return NextResponse.json({ message: 'Survey created', surveyId, surveyCode }, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error creating survey:', error);
    return NextResponse.json({ error: 'Failed to create survey' }, { status: 500 });
  }
}
