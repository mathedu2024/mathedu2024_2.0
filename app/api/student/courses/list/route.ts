import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import {
  resolveCourseDocsByEnrolledIds,
  resolveSingleCourseDoc,
  getCourseCompositeKey,
} from '@/services/courseId';
import { isCourseArchived } from '@/services/courseArchive';
import { getStudentSessionFromRequest } from '@/utils/studentSession';

type CourseListRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  archived: boolean;
};

export async function GET(req: NextRequest) {
  const session = getStudentSessionFromRequest(req.headers.get('cookie'));
  if (!session?.id) {
    return NextResponse.json({ error: 'Unauthorized: Student session required' }, { status: 401 });
  }

  const userId = session.id;

  try {
    const studentProfileDoc = await adminDb.collection('student_data').doc(userId).get();
    let enrolledCourses: string[] = [];

    if (studentProfileDoc.exists) {
      enrolledCourses = studentProfileDoc.data()?.enrolledCourses || [];
    } else {
      const studentQuery = await adminDb
        .collection('student_data')
        .where('studentId', '==', userId)
        .limit(1)
        .get();
      if (studentQuery.empty) {
        console.error(`[API/student/courses/list] Student profile not found for userId: ${userId}`);
        return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
      }
      enrolledCourses = studentQuery.docs[0].data()?.enrolledCourses || [];
    }

    if (enrolledCourses.length === 0) {
      return NextResponse.json([]);
    }

    const resolvedMap = await resolveCourseDocsByEnrolledIds(adminDb, enrolledCourses);
    const seenDocIds = new Set<string>();
    const courses: CourseListRow[] = [];
    const coveredKeys = new Set<string>();

    for (const enrolledId of enrolledCourses) {
      let doc = resolvedMap.get(enrolledId);
      if (!doc) {
        doc = await resolveSingleCourseDoc(adminDb, enrolledId);
      }
      if (!doc || seenDocIds.has(doc.id)) continue;
      seenDocIds.add(doc.id);

      const data = doc.data();
      const archivedFlag = isCourseArchived({
        archived: data.archived,
        status: data.status,
        name: data.name,
      });
      courses.push({
        id: doc.id,
        name: data.name || '未知課程',
        code: data.code || '',
        status: archivedFlag ? '已封存' : (data.status || ''),
        archived: archivedFlag,
      });
      coveredKeys.add(doc.id);
      coveredKeys.add(getCourseCompositeKey(data.name || '', data.code || ''));
      coveredKeys.add(enrolledId);
    }

    for (const enrolledId of enrolledCourses) {
      if (!enrolledId || coveredKeys.has(enrolledId)) continue;
      const alreadyListed = courses.some(
        (course) =>
          course.id === enrolledId ||
          getCourseCompositeKey(course.name, course.code) === enrolledId
      );
      if (alreadyListed) continue;

      const doc = await resolveSingleCourseDoc(adminDb, enrolledId);
      if (doc && !seenDocIds.has(doc.id)) {
        const data = doc.data();
        const archivedFlag = isCourseArchived({
          archived: data.archived,
          status: data.status,
          name: data.name,
        });
        courses.push({
          id: doc.id,
          name: data.name || '未知課程',
          code: data.code || '',
          status: archivedFlag ? '已封存' : (data.status || ''),
          archived: archivedFlag,
        });
        coveredKeys.add(enrolledId);
        continue;
      }

      const match = enrolledId.match(/^(.+)\(([^()]+)\)$/) || enrolledId.match(/^(.+)[（]([^（）]+)[）]$/);
      courses.push({
        id: enrolledId,
        name: match ? match[1].trim() : enrolledId,
        code: match ? match[2].trim() : '',
        status: '已封存',
        archived: true,
      });
      coveredKeys.add(enrolledId);
    }

    return NextResponse.json(courses);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error fetching student courses:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch student courses.', details: errorMessage }, { status: 500 });
  }
}
