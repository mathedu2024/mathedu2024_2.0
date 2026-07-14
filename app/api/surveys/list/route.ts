import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { surveyService } from '@/services/surveyService';

export async function POST(req: NextRequest) {
  try {
    const { teacherId } = await req.json();
    if (!teacherId) {
      return NextResponse.json({ error: 'Missing teacherId' }, { status: 400 });
    }
    const surveys = await surveyService.listAccessibleByTeacher(teacherId);
    return NextResponse.json({ surveys });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('Error listing surveys:', error);
    return NextResponse.json({ error: 'Failed to list surveys' }, { status: 500 });
  }
}
