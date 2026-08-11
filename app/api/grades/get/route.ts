import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import {
  defaultGradeSettings,
  inferRegularColumns,
  mergeGradeStudentsWithRoster,
  mergeLoadedSettings,
  mergePeriodicColumnDetails,
  normalizeGradeDocStudents,
} from '@/services/gradeShape';
import { requireAuthFromRequest, authGuard } from '@/services/apiAuth';

async function resolveExistingCourseDocId(ids: string[]): Promise<string | null> {
  for (const docId of ids) {
    const snap = await adminDb.collection('courses').doc(docId).get();
    if (snap.exists) return docId;
  }
  return null;
}

async function fetchCourseRoster(courseDocId: string): Promise<Record<string, unknown>[]> {
  const studentsSnapshot = await adminDb
    .collection('courses')
    .doc(courseDocId)
    .collection('students')
    .get();

  if (studentsSnapshot.empty) return [];

  return studentsSnapshot.docs.map((doc) => ({
    id: doc.id,
    studentId: String((doc.data().studentId as string | undefined) || doc.id),
    ...doc.data(),
  }));
}

/**
 * 讀取 Firestore 路徑 `courses/{課程DocId}/grades/data`，並與課程選修名單合併
 */
export async function POST(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin', 'teacher'));
  if (denied) return denied;

  try {
    const { courseId, courseName, courseCode } = await req.json();
    const derivedId =
      courseName != null && courseCode != null
        ? `${String(courseName)}(${String(courseCode)})`
        : null;
    const idsToTry = [courseId, derivedId].filter(Boolean) as string[];

    if (idsToTry.length === 0) {
      return NextResponse.json(
        { error: '缺少 courseId 或 courseName、courseCode' },
        { status: 400 }
      );
    }

    const resolvedCourseDocId = await resolveExistingCourseDocId(idsToTry);
    const roster = resolvedCourseDocId ? await fetchCourseRoster(resolvedCourseDocId) : [];

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
        students: mergeGradeStudentsWithRoster([], roster),
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
    const gradeStudents = normalizeGradeDocStudents(data);

    return NextResponse.json({
      students: mergeGradeStudentsWithRoster(gradeStudents, roster),
      columnDetails,
      regularColumns,
      settings,
      periodicColumnDetails,
    });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    const message = error instanceof Error ? error.message : '讀取失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
