import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { getSessionFromCookie } from '@/utils/session';
import { syncAttendanceLifecycle } from '@/services/attendanceLifecycle';
import { isCourseArchived } from '@/services/courseArchive';
import { getTeacherCourseRecords } from '@/services/quizTeacherAccess';

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
  if (
    typeof value === 'object' &&
    value !== null &&
    'seconds' in value &&
    typeof (value as { seconds: number }).seconds === 'number'
  ) {
    return new Date((value as { seconds: number }).seconds * 1000);
  }
  const parsed = new Date(value as string | number);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isTeacherOrAdmin(session: {
  role?: string | string[];
  currentRole?: string;
} | null): boolean {
  if (!session) return false;
  if (session.currentRole === 'teacher' || session.currentRole === 'admin') return true;
  const role = session.role;
  if (typeof role === 'string') {
    const lower = role.toLowerCase();
    return (
      role === '老師' ||
      role === '管理員' ||
      lower === 'teacher' ||
      lower === 'admin'
    );
  }
  if (Array.isArray(role)) {
    return role.some((r) => {
      const lower = String(r).toLowerCase();
      return r === '老師' || r === '管理員' || lower === 'teacher' || lower === 'admin';
    });
  }
  return false;
}

export async function GET(req: NextRequest) {
  const session = getSessionFromCookie(req.headers.get('cookie') || '');
  if (!session?.id || !isTeacherOrAdmin(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const teacherId = session.id;
    let courseList = (await getTeacherCourseRecords(teacherId)).map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
    }));

    if (courseList.length === 0) {
      const snap = await adminDb
        .collection('courses')
        .where('teachers', 'array-contains', teacherId)
        .get();
      courseList = snap.docs
        .map((doc) => {
          const d = doc.data();
          if (
            isCourseArchived({
              archived: d.archived,
              status: d.status,
              name: d.name,
            })
          ) {
            return null;
          }
          return {
            id: doc.id,
            name: String(d.name || ''),
            code: String(d.code || ''),
          };
        })
        .filter((c): c is { id: string; name: string; code: string } => !!c && !!c.code);
    }

    const now = new Date();

    const batches = await Promise.all(
      courseList.map(async (course) => {
        const attSnap = await adminDb
          .collection('courses')
          .doc(course.id)
          .collection('attendance')
          .get();
        if (attSnap.empty) return [];

        const candidates = attSnap.docs.filter((doc) => {
          const d = doc.data();
          const firestoreStatus = String(d.status || '');
          if (firestoreStatus === 'completed') return false;
          const start = toDate(d.startTime);
          const end = toDate(d.endTime);
          if (!start || !end) return false;
          if (now < start || now > end) return false;
          return true;
        });

        const results = await Promise.all(
          candidates.map(async (doc) => {
            const lifecycle = await syncAttendanceLifecycle(course.id, doc.id).catch(() => ({
              status: String(doc.data().status || ''),
            }));
            if (lifecycle.status === 'completed') return null;

            const d = doc.data();
            const methodRaw = String(d.checkInMethod || 'manual');
            const method =
              methodRaw === 'qr' || methodRaw === 'numeric' || methodRaw === 'manual'
                ? methodRaw
                : 'manual';
            const start = toDate(d.startTime);
            const end = toDate(d.endTime);
            if (!start || !end || now < start || now > end) return null;

            const checkInCode =
              typeof d.checkInCode === 'string' && d.checkInCode.trim()
                ? d.checkInCode.trim()
                : '';

            return {
              id: doc.id,
              courseId: course.id,
              courseName: course.name,
              courseCode: course.code,
              title: String(d.title || '線上點名'),
              checkInMethod: method as 'qr' | 'numeric' | 'manual',
              checkInCode,
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

    console.error('Error fetching teacher live attendance:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load live attendance' },
      { status: 500 }
    );
  }
}
