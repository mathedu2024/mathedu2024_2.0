import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { surveyService } from '@/services/surveyService';
import { surveyResponseService } from '@/services/surveyResponseService';
import { getTeacherCourseRecords } from '@/services/quizTeacherAccess';
import { normalizeAssignedCourses } from '@/services/surveyTypes';

export async function POST(req: NextRequest) {
  try {
    const { surveyId, teacherId } = await req.json();
    if (!surveyId || !teacherId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const survey = await surveyService.getById(surveyId);
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    const teacherCourses = await getTeacherCourseRecords(teacherId);
    const teacherCourseIds = new Set(teacherCourses.map((c) => c.id));
    const canAccess =
      survey.teacherId === teacherId ||
      normalizeAssignedCourses(survey).some((c) => teacherCourseIds.has(c.courseId));
    if (!canAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const responses = await surveyResponseService.listBySurvey(surveyId);
    const analytics = surveyResponseService.buildAnalytics(survey, responses);
    return NextResponse.json({ analytics });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('Error building survey analytics:', error);
    return NextResponse.json({ error: 'Failed to load analytics' }, { status: 500 });
  }
}
