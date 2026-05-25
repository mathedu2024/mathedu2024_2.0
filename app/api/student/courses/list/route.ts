import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { resolveCourseDocsByEnrolledIds } from '@/services/courseId';
import { isCourseArchived } from '@/services/courseArchive';
import { parse as parseCookie } from 'cookie';

export async function GET(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie');
  if (!cookieHeader) {
    return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
  }

  const cookies = parseCookie(cookieHeader);
  const sessionCookie = cookies.session;
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
  }

  const session = JSON.parse(decodeURIComponent(sessionCookie));
  const userId = session?.id;
  const userRole = session?.role;

  if (!userId || !userRole.includes('student')) {
    return NextResponse.json({ error: 'Forbidden: Invalid role or missing user ID' }, { status: 403 });
  }

  try {
    const studentProfileDoc = await adminDb.collection('student_data').doc(userId).get();
    let enrolledCourses: string[] = [];

    if (studentProfileDoc.exists) {
      enrolledCourses = studentProfileDoc.data()?.enrolledCourses || [];
    } else {
      const studentQuery = await adminDb.collection('student_data').where('studentId', '==', userId).limit(1).get();
      if (studentQuery.empty) {
        console.error(`[API/student/courses/list] Student profile not found for userId: ${userId}`);
        return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
      }
      enrolledCourses = studentQuery.docs[0].data()?.enrolledCourses || [];
    }


    if (enrolledCourses.length === 0) {
      console.log(`[API/student/courses/list] No enrolled courses found for student: ${userId}`);
      return NextResponse.json([]);
    }

    const resolvedMap = await resolveCourseDocsByEnrolledIds(adminDb, enrolledCourses);
    const seenDocIds = new Set<string>();
    const courses: Array<{ id: string; name: string; code: string; status: string; archived: boolean }> = [];

    for (const enrolledId of enrolledCourses) {
      const doc = resolvedMap.get(enrolledId);
      if (!doc || seenDocIds.has(doc.id)) continue;
      seenDocIds.add(doc.id);
      const row = {
        id: doc.id,
        name: doc.data().name || '未知課程',
        code: doc.data().code || '',
        status: doc.data().status || '',
        archived: doc.data().archived ?? false,
      };
      if (!isCourseArchived(row)) {
        courses.push(row);
      }
    }

    return NextResponse.json(courses);
  } catch (error) {
    console.error('Error fetching student courses:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch student courses.', details: errorMessage }, { status: 500 });
  }
}
