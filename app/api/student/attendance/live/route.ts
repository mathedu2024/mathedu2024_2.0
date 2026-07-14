import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { resolveCourseDocsByEnrolledIds } from '@/services/courseId';
import { getSessionFromCookie } from '@/utils/session';
import { syncAttendanceLifecycle } from '@/services/attendanceLifecycle';

export const dynamic = 'force-dynamic';

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function GET(req: NextRequest) {
  const session = getSessionFromCookie(req.headers.get('cookie') || '');
  const isStudent =
    session &&
    (Array.isArray(session.role)
      ? session.role.includes('student')
      : session.role === 'student');

  if (!session || !isStudent) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const studentId = session.id;
    const studentProfileDoc = await adminDb.collection('student_data').doc(studentId).get();
    if (!studentProfileDoc.exists) {
      return NextResponse.json({ activities: [] });
    }

    const enrolledCourses: string[] = studentProfileDoc.data()?.enrolledCourses || [];
    if (enrolledCourses.length === 0) {
      return NextResponse.json({ activities: [] });
    }

    const resolvedMap = await resolveCourseDocsByEnrolledIds(adminDb, enrolledCourses);
    const seenDocIds = new Set<string>();
    const courseTargets: { courseId: string; courseName: string; courseCode: string }[] = [];

    for (const enrolledId of enrolledCourses) {
      const courseDoc = resolvedMap.get(enrolledId);
      if (!courseDoc || seenDocIds.has(courseDoc.id)) continue;
      seenDocIds.add(courseDoc.id);
      const data = courseDoc.data();
      courseTargets.push({
        courseId: courseDoc.id,
        courseName: data.name || '未知課程',
        courseCode: data.code || '',
      });
    }

    const now = new Date();

    const batches = await Promise.all(
      courseTargets.map(async ({ courseId, courseName, courseCode }) => {
        const snap = await adminDb
          .collection('courses')
          .doc(courseId)
          .collection('attendance')
          .get();
        if (snap.empty) return [];

        const candidates = snap.docs.filter((doc) => {
          const d = doc.data();
          if (d.visibleToStudents === false) return false;
          const method = String(d.checkInMethod || 'manual');
          if (method !== 'qr' && method !== 'numeric') return false;
          const firestoreStatus = String(d.status || '');
          if (firestoreStatus === 'completed') return false;
          const start = toDate(d.startTime);
          const end = toDate(d.endTime);
          if (!start || !end) return false;
          // 預約：開始前不顯示；結束後不顯示
          if (now < start || now > end) return false;
          return true;
        });

        const results = await Promise.all(
          candidates.map(async (doc) => {
            const lifecycle = await syncAttendanceLifecycle(courseId, doc.id).catch(() => ({
              status: String(doc.data().status || ''),
            }));
            if (lifecycle.status === 'completed') return null;

            const d = doc.data();
            const method = String(d.checkInMethod || '');
            if (method !== 'qr' && method !== 'numeric') return null;
            const start = toDate(d.startTime);
            const end = toDate(d.endTime);
            if (!start || !end || now < start || now > end) return null;

            return {
              id: doc.id,
              courseId,
              courseName,
              courseCode,
              title: String(d.title || '線上點名'),
              checkInMethod: method as 'qr' | 'numeric',
              startTime: start.toISOString(),
              endTime: end.toISOString(),
            };
          })
        );

        return results.filter((x): x is NonNullable<typeof x> => x !== null);
      })
    );

    const activities = batches.flat().sort((a, b) => {
      return new Date(a.endTime).getTime() - new Date(b.endTime).getTime();
    });

    return NextResponse.json({ activities });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error fetching live attendance:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load live attendance' },
      { status: 500 }
    );
  }
}
