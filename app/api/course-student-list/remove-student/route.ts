import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '../../../../services/firebase-admin';
import { removeCoursesFromEnrolledList } from '@/services/courseId';
import { syncStudentCourseEnrollments } from '@/services/courseEnrollmentSync';

/** @deprecated 請改用 /api/course-student-list/save */
export async function POST(req: NextRequest) {
  try {
    const { courseName, courseCode, studentId } = await req.json();
    if (!courseName || !courseCode || !studentId) {
      return NextResponse.json({ error: 'Missing courseName, courseCode, or studentId' }, { status: 400 });
    }

    const studentDoc = await adminDb.collection('student_data').doc(studentId).get();
    if (!studentDoc.exists) {
      return NextResponse.json({ error: 'Student not found' }, { status: 404 });
    }

    const studentData = studentDoc.data() || {};
    const oldCourses = (studentData.enrolledCourses as string[] | undefined) || [];
    const courseTarget = { id: `${courseName}(${courseCode})`, name: courseName, code: courseCode };
    const newCourses = removeCoursesFromEnrolledList(oldCourses, [courseTarget]);

    await syncStudentCourseEnrollments(studentId, oldCourses, newCourses, studentData);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    const message = error instanceof Error ? error.message : '移除失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
