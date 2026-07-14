import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { surveyService } from '@/services/surveyService';
import { surveyResponseService } from '@/services/surveyResponseService';
import { isSurveyAccessibleToStudent } from '@/services/surveyStudentView';
import { isValidSurveyCode, type SurveyAnswers } from '@/services/surveyTypes';
import {
  getStudentEnrolledCourseIds,
  getStudentSessionFromRequest,
} from '@/utils/studentSessionServer';

export async function POST(req: NextRequest) {
  try {
    const session = await getStudentSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { surveyCode, answers } = (await req.json()) as {
      surveyCode: string;
      answers: SurveyAnswers;
    };

    if (!surveyCode || !isValidSurveyCode(String(surveyCode))) {
      return NextResponse.json({ error: 'Invalid survey code' }, { status: 400 });
    }

    const survey = await surveyService.getByCode(String(surveyCode));
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    const enrolledCourseIds = await getStudentEnrolledCourseIds(session.id);
    const access = isSurveyAccessibleToStudent(survey, enrolledCourseIds);
    if (!access.ok) {
      return NextResponse.json({ error: access.reason ?? '無法提交' }, { status: 403 });
    }

    const response = await surveyResponseService.submit({
      survey,
      studentId: session.id,
      studentName: session.name || session.account,
      answers: answers ?? {},
    });

    return NextResponse.json({
      response: {
        id: response.id,
        submittedAt: response.submittedAt,
        attemptIndex: response.attemptIndex,
        responseMode: response.responseMode,
      },
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    if (error instanceof Error && error.message === 'ATTEMPT_LIMIT_REACHED') {
      return NextResponse.json({ error: '您已填寫過此問卷' }, { status: 409 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error submitting survey:', error);
    return NextResponse.json({ error: 'Failed to submit survey' }, { status: 500 });
  }
}
