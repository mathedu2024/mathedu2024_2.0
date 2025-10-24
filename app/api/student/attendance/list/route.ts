
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

import { getSessionFromCookie } from '@/utils/session';

// Helper to get session from cookies (REMOVED)

async function getStudentCourses(studentId: string) {
  const coursesSnapshot = await adminDb.collection('courses')
    .where('students', 'array-contains', studentId)
    .get();
  
  if (coursesSnapshot.empty) {
    return [];
  }

  return coursesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as { id: string; name?: string; [key: string]: unknown }));
}

async function getAttendanceForStudent(studentId: string) {
  const courses = await getStudentCourses(studentId);
  if (courses.length === 0) {
    return [];
  }

  const attendanceRecords = [];

  for (const course of courses) {
    const courseId = course.id;
    const activitiesSnapshot = await adminDb.collection('attendanceActivities').doc(courseId).collection('activities').get();

    if (activitiesSnapshot.empty) {
      continue;
    }

    for (const activityDoc of activitiesSnapshot.docs) {
      const activityData = activityDoc.data();
      const activityRef = adminDb.collection('attendanceActivities').doc(courseId).collection('activities').doc(activityDoc.id);
      const attendeeDoc = await activityRef.collection('attendees').doc(studentId).get();

      if (attendeeDoc.exists) {
        const attendeeData = attendeeDoc.data();
        attendanceRecords.push({
          activityId: activityDoc.id,
          courseId: activityData.courseId, // Human-readable courseId from activity doc
          firestoreCourseId: courseId, // Actual Firestore document ID
          courseName: course.name,
          activityTitle: activityData.title,
          status: attendeeData?.status || 'present',
          checkInTime: attendeeData?.timestamp.toDate(),
          activityTime: activityData.startTime.toDate(),
        });
      } else {
        const leaveDoc = await activityRef.collection('leave_requests').doc(studentId).get();
        if (leaveDoc.exists) {
          const leaveData = leaveDoc.data();
          attendanceRecords.push({
            activityId: activityDoc.id,
            courseId: activityData.courseId, // Human-readable courseId from activity doc
            firestoreCourseId: courseId, // Actual Firestore document ID
            courseName: course.name,
            activityTitle: activityData.title,
            status: 'leave',
            leaveType: leaveData?.leaveType || '其他',
            checkInTime: null,
            activityTime: activityData.startTime.toDate(),
          });
        } else {
          attendanceRecords.push({
            activityId: activityDoc.id,
            courseId: activityData.courseId, // Human-readable courseId from activity doc
            firestoreCourseId: courseId, // Actual Firestore document ID
            courseName: course.name,
            activityTitle: activityData.title,
            status: 'absent',
            checkInTime: null,
            activityTime: activityData.startTime.toDate(),
          });
        }
      }
    }
  }

  // Sort by activity time descending
  return attendanceRecords.sort((a, b) => b.activityTime.getTime() - a.activityTime.getTime());
}


export async function GET(req: NextRequest) {
  const session = getSessionFromCookie(req.headers.get('cookie') || '');

  if (!session || (Array.isArray(session.role) ? !session.role.includes('student') : session.role !== 'student')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // The student's ID might be in `id` or `account`
  const studentId = session.id || session.account;

  if (!studentId) {
    return NextResponse.json({ error: 'Student ID not found in session' }, { status: 400 });
  }

  try {
    const attendance = await getAttendanceForStudent(studentId);
    return NextResponse.json(attendance);
  } catch (error) {
    console.error('Error fetching student attendance:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch attendance data.', details: errorMessage }, { status: 500 });
  }
}
