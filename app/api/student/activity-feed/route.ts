import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { getStudentSessionFromRequest } from '@/utils/studentSession';
import { resolveCourseDocsByEnrolledIds } from '@/services/courseId';
import { isCourseArchived } from '@/services/courseArchive';
import {
  buildStudentActivityFeed,
  type CourseActivityCourseRef,
} from '@/services/courseActivityFeed';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = getStudentSessionFromRequest(req.headers.get('cookie'));
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let studentDoc = await adminDb.collection('student_data').doc(session.id).get();
    if (!studentDoc.exists) {
      const q = await adminDb
        .collection('student_data')
        .where('studentId', '==', session.id)
        .limit(1)
        .get();
      if (q.empty) {
        return NextResponse.json({ items: [] });
      }
      studentDoc = q.docs[0];
    }

    const data = studentDoc.data() || {};
    const studentId = String(data.studentId || studentDoc.id || session.id);
    const enrolledCourses: string[] = Array.isArray(data.enrolledCourses)
      ? data.enrolledCourses
      : [];

    if (enrolledCourses.length === 0) {
      return NextResponse.json({ items: [] });
    }

    const resolvedMap = await resolveCourseDocsByEnrolledIds(adminDb, enrolledCourses);
    const courses: CourseActivityCourseRef[] = [];
    const seen = new Set<string>();

    for (const enrolledId of enrolledCourses) {
      const doc = resolvedMap.get(enrolledId);
      if (!doc || seen.has(doc.id)) continue;
      seen.add(doc.id);
      const d = doc.data();
      courses.push({
        id: doc.id,
        name: d.name || '',
        code: d.code || '',
        status: d.status,
        archived: isCourseArchived({
          archived: d.archived,
          status: d.status,
          name: d.name,
        }),
      });
    }

    const items = await buildStudentActivityFeed(studentId, enrolledCourses, courses);
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error building student activity feed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load activity feed' },
      { status: 500 }
    );
  }
}
