import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { settingsToTotalSetting } from '@/services/gradeShape';

/**
 * 寫入 `courses/{課程DocId}/grades/data`
 * 支援舊版 body：{ courseName, courseCode, gradeData }
 * 與老師端 GradeManager：{ courseId, students, columnDetails, regularColumns, settings }
 */
export async function POST(req: NextRequest) {
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
        { error: '缺少必要參數（courseId 或 courseName／courseCode、成績資料）' },
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
    let message = '儲存失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
