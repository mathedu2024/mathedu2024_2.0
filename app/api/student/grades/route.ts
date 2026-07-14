import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { resolveSingleCourseDoc, getCourseCompositeKey } from '@/services/courseId';
import type { GradeSettingsShape } from '@/services/gradeShape';
import { settingsToTotalSetting } from '@/services/gradeShape';
import { getSessionFromCookie } from '@/utils/session';

export const dynamic = 'force-dynamic';

type StudentGradeRow = {
  studentId: string;
  regularScores?: Record<string, number>;
  periodicScores?: Record<string, number>;
  manualAdjust?: number;
};

async function resolveStudentId(sessionUserId: string): Promise<string> {
  const studentProfileDoc = await adminDb.collection('student_data').doc(sessionUserId).get();
  if (studentProfileDoc.exists) {
    return studentProfileDoc.data()?.studentId || sessionUserId;
  }

  const studentQuery = await adminDb
    .collection('student_data')
    .where('studentId', '==', sessionUserId)
    .limit(1)
    .get();
  if (!studentQuery.empty) {
    return studentQuery.docs[0].data()?.studentId || sessionUserId;
  }

  return sessionUserId;
}

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromCookie(req.headers.get('cookie') || '');
    if (
      !session ||
      (Array.isArray(session.role) ? !session.role.includes('student') : session.role !== 'student')
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const courseKey = req.nextUrl.searchParams.get('courseKey');
    const courseCode = req.nextUrl.searchParams.get('courseCode');
    if (!courseKey && !courseCode) {
      return NextResponse.json({ error: '缺少 courseKey 或 courseCode 參數' }, { status: 400 });
    }

    const studentId = await resolveStudentId(session.id || session.account);

    let courseDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    if (courseKey) {
      courseDoc = await resolveSingleCourseDoc(adminDb, courseKey);
    } else if (courseCode) {
      const byCode = await adminDb.collection('courses').where('code', '==', courseCode).get();
      if (byCode.size === 1) {
        courseDoc = byCode.docs[0];
      } else if (byCode.size > 1) {
        const studentProfileDoc = await adminDb.collection('student_data').doc(session.id || '').get();
        const enrolledCourses: string[] = studentProfileDoc.exists
          ? studentProfileDoc.data()?.enrolledCourses || []
          : [];
        const enrolledMatch = byCode.docs.find((doc) => {
          const data = doc.data();
          const composite = getCourseCompositeKey(data.name, data.code);
          return enrolledCourses.some(
            (key) => key === doc.id || key === composite || key === data.code
          );
        });
        courseDoc = enrolledMatch ?? null;
      }
    }

    if (!courseDoc) {
      return NextResponse.json({
        courseId: courseKey || courseCode,
        courseKey: courseKey || null,
        columns: {},
        student: null,
        totalSetting: {},
        periodicScores: [],
      });
    }

    const courseData = courseDoc.data();
    const resolvedCourseKey = getCourseCompositeKey(courseData.name, courseData.code);

    const gradeDoc = await adminDb
      .collection('courses')
      .doc(courseDoc.id)
      .collection('grades')
      .doc('data')
      .get();

    if (!gradeDoc.exists) {
      return NextResponse.json({
        courseId: courseDoc.id,
        courseKey: resolvedCourseKey,
        columns: {},
        student: null,
        totalSetting: {},
        periodicScores: [],
      });
    }

    const gradeData = gradeDoc.data()!;
    const students = Array.isArray(gradeData.students)
      ? (gradeData.students as StudentGradeRow[])
      : [];
    const studentGrade = students.find((s) => s.studentId === studentId) || null;

    return NextResponse.json({
      courseId: courseDoc.id,
      courseKey: resolvedCourseKey,
      columns: gradeData.columns || gradeData.columnDetails || {},
      student: studentGrade,
      totalSetting:
        gradeData.totalSetting ||
        (gradeData.settings
          ? settingsToTotalSetting(gradeData.settings as GradeSettingsShape)
          : {}),
      periodicScores: gradeData.periodicScores || [],
      periodicColumnDetails: gradeData.periodicColumnDetails || {},
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error fetching single course grade data:', error);
    return NextResponse.json({ error: '讀取課程成績資料時發生伺服器錯誤' }, { status: 500 });
  }
}
