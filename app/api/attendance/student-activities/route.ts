import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { getSessionFromCookie } from '@/utils/session';

type FirestoreTimestamp = {
  toDate: () => Date;
};

export async function GET(req: NextRequest) {
  const session = getSessionFromCookie(req.headers.get('cookie') || '');

  if (!session || (Array.isArray(session.role) ? !session.role.includes('student') : session.role !== 'student')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const studentId = session.id || session.account;
  console.log(`[API/attendance/student-activities] Student ID: ${studentId}`);
  if (!studentId) {
    return NextResponse.json({ error: 'Student ID not found in session' }, { status: 400 });
  }

  try {
    // Get student's enrolled courses from student_data collection (same logic as student courses list API)
    const studentProfileDoc = await adminDb.collection('student_data').doc(studentId).get();
    let enrolledCourses: string[] = [];

    if (studentProfileDoc.exists) {
      enrolledCourses = studentProfileDoc.data()?.enrolledCourses || [];
    } else {
      const studentQuery = await adminDb.collection('student_data').where('studentId', '==', studentId).limit(1).get();
      if (studentQuery.empty) {
        console.error(`[API/attendance/student-activities] Student profile not found for studentId: ${studentId}`);
        return NextResponse.json([]);
      }
      enrolledCourses = studentQuery.docs[0].data()?.enrolledCourses || [];
    }
    console.log(`[API/attendance/student-activities] Enrolled Courses:`, enrolledCourses);

    if (enrolledCourses.length === 0) {
      console.log(`[API/attendance/student-activities] No enrolled courses found for student: ${studentId}`);
      return NextResponse.json([]);
    }

    // Get courses using the enrolled course IDs
    const coursesSnapshot = await adminDb.collection('courses')
      .where('__name__', 'in', enrolledCourses)
      .get();
    console.log(`[API/attendance/student-activities] Fetched ${coursesSnapshot.docs.length} courses.`);

    if (coursesSnapshot.empty) {
      return NextResponse.json([]);
    }

    const courses = coursesSnapshot.docs.map((doc) => ({ id: doc.id, name: (doc.data().name as string) || '未知課程' }));
    console.log(`[API/attendance/student-activities] Mapped Courses:`, courses);
    const now = new Date();
    const results: Array<{
      id: string;
      title: string;
      courseId: string;
      courseName: string;
      endTime: Date;
      startTime: Date;
    }> = [];

    for (const course of courses) {
      const activitiesSnapshot = await adminDb
        .collection('courses').doc(course.id).collection('attendance')
        .where('startTime', '<=', now)
        .get();
      console.log(`[API/attendance/student-activities] Course ${course.id} - Fetched ${activitiesSnapshot.docs.length} activities.`);

      activitiesSnapshot.forEach((doc) => {
        const data = doc.data() as {
          title?: string;
          startTime?: FirestoreTimestamp;
          endTime?: FirestoreTimestamp;
        };

        const start = data.startTime?.toDate();
        const end = data.endTime?.toDate();
        if (!start || !end) return;

        if (end >= now) {
          results.push({
            id: doc.id,
            title: data.title || '未命名活動',
            courseId: course.id,
            courseName: course.name,
            startTime: start,
            endTime: end,
          });
        }
      });
    }

    console.log(`[API/attendance/student-activities] Filtered Results (before sort):`, results);
    results.sort((a, b) => a.endTime.getTime() - b.endTime.getTime());

    const payload = results.map((r) => ({
      id: r.id,
      title: r.title,
      courseId: r.courseId,
      courseName: r.courseName,
      endTime: r.endTime.toISOString(),
    }));
    console.log(`[API/attendance/student-activities] Final Payload:`, payload);

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Error fetching active student attendance activities:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch active attendance activities.', details: errorMessage }, { status: 500 });
  }
}


