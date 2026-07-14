import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { surveyService } from '@/services/surveyService';
import { isValidSurveyCode } from '@/services/surveyTypes';

export async function POST(req: NextRequest) {
  try {
    const { surveyCode, surveyId } = await req.json();
    const survey = surveyId
      ? await surveyService.getById(String(surveyId))
      : surveyCode && isValidSurveyCode(String(surveyCode))
        ? await surveyService.getByCode(String(surveyCode))
        : null;

    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }
    return NextResponse.json({ survey });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('Error getting survey:', error);
    return NextResponse.json({ error: 'Failed to get survey' }, { status: 500 });
  }
}
