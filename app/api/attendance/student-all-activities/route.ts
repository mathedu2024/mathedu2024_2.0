import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { resolveCourseDocsByEnrolledIds } from '@/services/courseId';
import { getSessionFromCookie } from '@/utils/session';


export async function GET(req: NextRequest) {
  const session = getSessionFromCookie(req.headers.get('cookie') || '');
  if (!session || (Array.isArray(session.role) ? !session.role.includes('student') : session.role !== 'student')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const studentId = session.id;
    const filterCourseId = req.nextUrl.searchParams.get('courseId')?.trim() || '';

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

    const resolvedMap = await resolveCourseDocsByEnrolledIds(adminDb, enrolledCourses);
    const seenDocIds = new Set<string>();
    const courseTargets: { courseId: string; courseName: string }[] = [];

    for (const enrolledId of enrolledCourses) {
      const courseDoc = resolvedMap.get(enrolledId);
      if (!courseDoc || seenDocIds.has(courseDoc.id)) continue;
      if (filterCourseId && courseDoc.id !== filterCourseId) continue;
      seenDocIds.add(courseDoc.id);
      courseTargets.push({
        courseId: courseDoc.id,
        courseName: courseDoc.data().name || '未知課程',
      });
      if (filterCourseId) break;
    }

    const courseActivityBatches = await Promise.all(
      courseTargets.map(async ({ courseId, courseName }) => {
        const activitiesSnapshot = await adminDb
          .collection('courses')
          .doc(courseId)
          .collection('attendance')
          .get();
        if (activitiesSnapshot.empty) return [];

        const visibleDocs = activitiesSnapshot.docs.filter(
          (doc) => doc.data().visibleToStudents !== false
        );

        return Promise.all(
          visibleDocs.map(async (activityDoc) => {
            const activityData = activityDoc.data();
            let studentStatus = '';
            let studentLeaveType: string | undefined;

            const rosterDoc = await adminDb
              .collection('courses')
              .doc(courseId)
              .collection('attendance')
              .doc(activityDoc.id)
              .collection('roster')
              .doc(studentId)
              .get();
            if (rosterDoc.exists) {
              const rosterData = rosterDoc.data();
              studentStatus = rosterData?.status || '';
              if (studentStatus === 'leave' && rosterData?.leaveType) {
                studentLeaveType = String(rosterData.leaveType);
              }
            }

            return {
              id: activityDoc.id,
              courseId,
              firestoreCourseId: courseId,
              title: activityData.title,
              courseName,
              startTime: activityData.startTime.toDate(),
              endTime: activityData.endTime.toDate(),
              status:
                activityData.startTime.toDate() > new Date()
                  ? 'upcoming'
                  : activityData.endTime.toDate() < new Date()
                    ? 'past'
                    : 'active',
              studentStatus,
              studentLeaveType,
            };
          })
        );
      })
    );

    const allActivities = courseActivityBatches.flat();

    allActivities.sort((a, b) => {
      if (a.status === 'upcoming' && b.status !== 'upcoming') return -1;
      if (a.status !== 'upcoming' && b.status === 'upcoming') return 1;
      if (a.status === 'active' && b.status === 'past') return -1;
      if (a.status === 'past' && b.status === 'active') return 1;
      return a.startTime.getTime() - b.startTime.getTime();
    });

    return NextResponse.json(allActivities);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error fetching all student activities:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch all attendance activities.', details: errorMessage }, { status: 500 });
  }
}
