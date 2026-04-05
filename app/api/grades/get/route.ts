import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import {
  defaultGradeSettings,
  inferRegularColumns,
  mergeLoadedSettings,
  mergePeriodicColumnDetails,
  normalizeGradeDocStudents,
} from '@/services/gradeShape';

/**
 * 讀取課程成績：Firestore 路徑為 `courses/{課程DocId}/grades/data`
 */
export async function POST(req: NextRequest) {
  try {
    const { courseId, courseName, courseCode } = await req.json();
    const derivedId =
      courseName != null && courseCode != null
        ? `${String(courseName)}(${String(courseCode)})`
        : null;
    const idsToTry = [courseId, derivedId].filter(Boolean) as string[];

    if (idsToTry.length === 0) {
      return NextResponse.json(
        { error: '缺少 courseId 或 courseName／courseCode' },
        { status: 400 }
      );
    }

    let data: Record<string, unknown> | null = null;
    for (const docId of idsToTry) {
      const snap = await adminDb
        .collection('courses')
        .doc(docId)
        .collection('grades')
        .doc('data')
        .get();
      if (snap.exists) {
        data = snap.data() as Record<string, unknown>;
        break;
      }
    }

    if (!data) {
      return NextResponse.json({
        students: [],
        columnDetails: {},
        regularColumns: 0,
        settings: defaultGradeSettings,
        periodicColumnDetails: mergePeriodicColumnDetails(undefined),
      });
    }

    const columnDetails =
      (data.columnDetails as Record<string, unknown>) ||
      (data.columns as Record<string, unknown>) ||
      {};

    const settings = mergeLoadedSettings(
      data.settings as Record<string, unknown> | undefined,
      data.totalSetting as Record<string, unknown> | undefined
    );

    const regularColumns = inferRegularColumns(
      columnDetails,
      data.regularColumns as number | undefined
    );

    const periodicColumnDetails = mergePeriodicColumnDetails(data.periodicColumnDetails);

    return NextResponse.json({
      students: normalizeGradeDocStudents(data),
      columnDetails,
      regularColumns,
      settings,
      periodicColumnDetails,
    });
  } catch (error: unknown) {
    let message = '讀取成績失敗';
    if (error instanceof Error) message = error.message;
    console.error('grades/get:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
