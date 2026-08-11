import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { surveyService } from '@/services/surveyService';
import { surveyResponseService } from '@/services/surveyResponseService';
import {
  isSurveyAccessibleToStudent,
  isSurveyAssignedToCourseRef,
  isStudentEnrolledInSurvey,
} from '@/services/surveyStudentView';
import {
  formatSurveyAnswerWindow,
  formatSurveyResponseMode,
  getSurveyAnswerWindowPhase,
  getSurveyMaxAttempts,
  isSurveyResponsesVisibleToStudents,
  normalizeAssignedCourses,
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

    const body = await req.json().catch(() => ({}));
    const filterCourseId =
      typeof body?.courseId === 'string' && body.courseId.trim() ? body.courseId.trim() : '';
    const filterCourseName = typeof body?.courseName === 'string' ? body.courseName : '';
    const filterCourseCode = typeof body?.courseCode === 'string' ? body.courseCode : '';

    const enrolledCourseIds = await getStudentEnrolledCourseIds(session.id);
    const published = await surveyService.listPublished();

    const scoped =
      filterCourseId || filterCourseCode
        ? published.filter((survey) =>
            isSurveyAssignedToCourseRef(survey, {
              id: filterCourseId || filterCourseCode,
              name: filterCourseName,
              code: filterCourseCode,
            })
          )
        : published;

    const surveys = await Promise.all(
      scoped.map(async (survey) => {
        const enrolled = isStudentEnrolledInSurvey(survey, enrolledCourseIds);
        const access = isSurveyAccessibleToStudent(survey, enrolledCourseIds);
        const submissions = await surveyResponseService.listByStudentAndSurvey(survey.id, session.id);
        const submissionCount = submissions.length;
        const maxAttempts = getSurveyMaxAttempts(survey);
        const hasAttemptsLeft = submissionCount < maxAttempts;
        const windowPhase = getSurveyAnswerWindowPhase(survey);
        const attempts =
          submissionCount > 0
            ? [...submissions]
                .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
                .map((sub, index) => ({
                  id: sub.id,
                  attemptIndex: sub.attemptIndex ?? index + 1,
                  submittedAt: sub.submittedAt,
                }))
            : [];

        return {
          id: survey.id,
          surveyCode: survey.surveyCode,
          title: survey.title,
          description: survey.description,
          responseMode: survey.responseMode,
          responseModeLabel: formatSurveyResponseMode(survey.responseMode),
          answerWindowLabel: formatSurveyAnswerWindow(survey),
          maxAttempts,
          submissionCount,
          enrolled,
          accessible: access.ok,
          inaccessibleReason: access.reason,
          submitted: submissionCount > 0,
          canRetake: access.ok && hasAttemptsLeft && submissionCount > 0,
          canViewResponse:
            submissionCount > 0 && isSurveyResponsesVisibleToStudents(survey),
          responsesVisibleToStudents: isSurveyResponsesVisibleToStudents(survey),
          windowPhase,
          windowEnded: windowPhase === 'ended',
          attempts,
          assignedCourses: normalizeAssignedCourses(survey),
          order: typeof survey.order === 'number' ? survey.order : undefined,
          createdAt: survey.createdAt,
        };
      })
    );

    return NextResponse.json({
      surveys: surveys.filter((s) => s.enrolled),
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('Error listing student surveys:', error);
    return NextResponse.json({ error: 'Failed to list surveys' }, { status: 500 });
  }
}
