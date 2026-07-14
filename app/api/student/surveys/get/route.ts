import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { surveyService } from '@/services/surveyService';
import { surveyResponseService } from '@/services/surveyResponseService';
import { isSurveyAccessibleToStudent } from '@/services/surveyStudentView';
import {
  getSurveyMaxAttempts,
  isSurveyResponsesVisibleToStudents,
  isValidSurveyCode,
} from '@/services/surveyTypes';
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

    const body = await req.json();
    const surveyCode = body?.surveyCode;
    const review = body?.review === true;

    if (!surveyCode || !isValidSurveyCode(String(surveyCode))) {
      return NextResponse.json({ error: 'Invalid survey code' }, { status: 400 });
    }

    const survey = await surveyService.getByCode(String(surveyCode));
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    const enrolledCourseIds = await getStudentEnrolledCourseIds(session.id);
    const access = isSurveyAccessibleToStudent(survey, enrolledCourseIds);
    const submissions = await surveyResponseService.listByStudentAndSurvey(survey.id, session.id);
    const maxAttempts = getSurveyMaxAttempts(survey);
    const canSubmit = access.ok && submissions.length < maxAttempts;
    const responsesVisible = isSurveyResponsesVisibleToStudents(survey);
    const canViewResponse = submissions.length > 0 && responsesVisible;

    if (review) {
      if (!canViewResponse) {
        return NextResponse.json(
          { error: '無法查看填答內容（尚未填寫或教師未開放查看）' },
          { status: 403 }
        );
      }
      const latest = submissions[0];
      return NextResponse.json({
        survey,
        access,
        canSubmit: false,
        readOnly: true,
        canViewResponse: true,
        submissionCount: submissions.length,
        maxAttempts,
        latestResponse: {
          id: latest.id,
          submittedAt: latest.submittedAt,
          attemptIndex: latest.attemptIndex,
          answers: latest.answers,
        },
      });
    }

    // 時間未到／已截止且尚未填寫：不回傳題目內容
    // 已填寫且允許查看：仍回傳題目（供後續導向查看）
    const surveyForStudent =
      !canSubmit && submissions.length === 0
        ? {
            ...survey,
            sections: (survey.sections ?? []).map((section) => ({
              ...section,
              questions: [],
            })),
          }
        : survey;

    return NextResponse.json({
      survey: surveyForStudent,
      access,
      canSubmit,
      readOnly: false,
      canViewResponse,
      submissionCount: submissions.length,
      maxAttempts,
      latestResponse: submissions[0]
        ? {
            id: submissions[0].id,
            submittedAt: submissions[0].submittedAt,
            attemptIndex: submissions[0].attemptIndex,
            ...(canViewResponse ? { answers: submissions[0].answers } : {}),
          }
        : null,
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('Error getting student survey:', error);
    return NextResponse.json({ error: 'Failed to get survey' }, { status: 500 });
  }
}
