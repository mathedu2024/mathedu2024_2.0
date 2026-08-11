import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { settingsToTotalSetting } from '@/services/gradeShape';
import { requireAuthFromRequest, authGuard } from '@/services/apiAuth';

/**
 * ?? `courses/{??DocId}/grades/data`
 */
export async function POST(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin', 'teacher'));
  if (denied) return denied;

  try {
    const body = await req.json();
    const courseDocId =
      body.courseId ||
      (body.courseName && body.courseCode
        ? `${body.courseName}(${body.courseCode})`
        : null);

    const gradeData =
      body.gradeData ??
      (body.students !== undefined
        ? {
            students: body.students,
            columnDetails: body.columnDetails,
            regularColumns: body.regularColumns,
            settings: body.settings,
            periodicColumnDetails: body.periodicColumnDetails,
          }
        : null);

    if (!courseDocId || !gradeData) {
      return NextResponse.json(
        { error: '???????courseId ? courseName?courseCode??????' },
        { status: 400 }
      );
    }

    let grades: Record<string, unknown> = {};
    if (Array.isArray(gradeData.students)) {
      grades = gradeData.students.reduce(
        (acc: Record<string, unknown>, stu: Record<string, unknown>) => {
          if (stu.studentId) acc[String(stu.studentId)] = stu;
          return acc;
        },
        {}
      );
    }

    const payload: Record<string, unknown> = { ...gradeData, grades };

    if (!gradeData.columns && gradeData.columnDetails) {
      payload.columns = gradeData.columnDetails;
    }
    if (!gradeData.totalSetting && gradeData.settings) {
      payload.totalSetting = settingsToTotalSetting(gradeData.settings);
    }

    await adminDb
      .collection('courses')
      .doc(courseDocId)
      .collection('grades')
      .doc('data')
      .set(payload, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    const message = error instanceof Error ? error.message : '????';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
