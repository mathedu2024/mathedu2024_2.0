import { NextRequest, NextResponse } from 'next/server';
import { trySiteErrorResponse } from '@/utils/apiErrorResponse';
import { surveyService } from '@/services/surveyService';
import {
  requireAuthFromRequest,
  requireCourseStaffAccess,
  authGuard,
} from '@/services/apiAuth';

export async function POST(req: NextRequest) {
  const auth = requireAuthFromRequest(req, 'admin', 'teacher');
  if (auth.ok === false) return auth.response;

  try {
    const body = (await req.json()) as {
      teacherId?: string;
      sourceSurveyCode?: string;
      surveyId?: string;
      courseId?: string;
      courseName?: string;
      title?: string;
      /** @deprecated 舊版課程中心複製參數，改用 courseId / courseName */
      targetCourse?: { courseId?: string; courseName?: string };
    };

    const courseId = body.courseId?.trim() || body.targetCourse?.courseId?.trim() || undefined;
    const courseName = body.courseName?.trim() || body.targetCourse?.courseName?.trim() || undefined;
    const teacherId = auth.session.id;

    if (courseId) {
      const courseDenied = authGuard(await requireCourseStaffAccess(auth.session, courseId));
      if (courseDenied) return courseDenied;
    }

    const result = await surveyService.duplicate({
      teacherId,
      sourceSurveyCode: body.sourceSurveyCode?.trim() || undefined,
      surveyId: body.surveyId?.trim() || undefined,
      courseId,
      courseName,
      title: body.title?.trim() || undefined,
    });

    return NextResponse.json({ message: 'Survey duplicated', ...result }, { status: 201 });
  } catch (error) {
    const siteErrorResponse = trySiteErrorResponse(error, req);
    if (siteErrorResponse) return siteErrorResponse;

    if (error instanceof Error) {
      if (error.message === 'Survey not found') {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Error duplicating survey:', error);
    return NextResponse.json({ error: 'Failed to duplicate survey' }, { status: 500 });
  }
}
