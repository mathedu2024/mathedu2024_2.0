import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { getSessionFromCookie } from '@/utils/session';


export async function GET(req: NextRequest) {
  const session = getSessionFromCookie(req.headers.get('cookie') || '');
  if (!session || (Array.isArray(session.role) ? !session.role.includes('student') : session.role !== 'student')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const studentId = session.id; // Assuming session.id is the student's ID

    const studentProfileDoc = await adminDb.collection('student_data').doc(studentId).get();

    if (!studentProfileDoc.exists) {
        console.error(`[API/attendance/student-all-activities] Student profile not found for studentId: ${studentId}`);
        return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
    }

    const enrolledCoursesData = studentProfileDoc.data()?.enrolledCourses;
    const enrolledCourses: string[] = enrolledCoursesData || [];

    if (enrolledCourses.length === 0) {
      console.log(`[API/attendance/student-all-activities] No enrolled courses found for student: ${studentId}`);
      return NextResponse.json([]);
    }

    // 2. Get courses using the enrolled course IDs
    const enrolledCoursesSnapshot = await adminDb.collection('courses')
      .where('__name__', 'in', enrolledCourses)
      .get();

    const enrolledCourseIds = enrolledCoursesSnapshot.docs.map(doc => doc.id);

    if (enrolledCourseIds.length === 0) {
      return NextResponse.json([]); // Student is not enrolled in any courses
    }

    const allActivities = [];

    for (const courseId of enrolledCourses) {
      const courseDoc = enrolledCoursesSnapshot.docs.find(doc => doc.id === courseId);
      if (!courseDoc) continue;

      const courseName = courseDoc.data().name || '未知課程';

      const activitiesSnapshot = await adminDb.collection('courses').doc(courseId).collection('attendance').get();
      if (activitiesSnapshot.empty) continue;

      for (const activityDoc of activitiesSnapshot.docs) {
        const activityData = activityDoc.data();
        let studentStatus = ''; // Default to empty string

        const rosterDoc = await adminDb.collection('courses').doc(courseId).collection('attendance').doc(activityDoc.id).collection('roster').doc(studentId).get();
        if (rosterDoc.exists) {
          studentStatus = rosterDoc.data()?.status || ''; // Default to empty string
        }

        allActivities.push({
          id: activityDoc.id,
          courseId: courseId,
          firestoreCourseId: courseId,
          title: activityData.title,
          courseName: courseName,
          startTime: activityData.startTime.toDate(),
          endTime: activityData.endTime.toDate(),
          status: activityData.startTime.toDate() > new Date() ? 'upcoming' : (activityData.endTime.toDate() < new Date() ? 'past' : 'active'),
          studentStatus: studentStatus,
        });
      }
    }

    // Sort by startTime, upcoming first, then active, then past
    allActivities.sort((a, b) => {
      if (a.status === 'upcoming' && b.status !== 'upcoming') return -1;
      if (a.status !== 'upcoming' && b.status === 'upcoming') return 1;
      if (a.status === 'active' && b.status === 'past') return -1;
      if (a.status === 'past' && b.status === 'active') return 1;
      return a.startTime.getTime() - b.startTime.getTime();
    });

    return NextResponse.json(allActivities);
  } catch (error) {
    console.error('Error fetching all student activities:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch all attendance activities.', details: errorMessage }, { status: 500 });
  }
}
