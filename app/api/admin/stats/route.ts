import { NextRequest, NextResponse } from 'next/server';
import { getDbReadGuardStats } from '@/services/dbReadGuard';
import { getDbWriteGuardStats } from '@/services/dbWriteGuard';
import { adminDb } from '../../../../services/firebase-admin';
import { trySiteDbErrorResponse } from '@/utils/apiErrorResponse';
import { requireAuthFromRequest, authGuard } from '@/services/apiAuth';

export async function GET(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin'));
  if (denied) return denied;

  try {
    const [studentCountSnap, courseCountSnap, usersSnap] = await Promise.all([
      adminDb.collection('student_data').count().get(),
      adminDb.collection('courses').count().get(),
      adminDb.collection('users').get(),
    ]);

    let teacherCount = 0;
    usersSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (
        (Array.isArray(data.role) && data.role.includes('teacher')) ||
        data.role === 'teacher' ||
        (Array.isArray(data.roles) && data.roles.includes('teacher')) ||
        data.roles === 'teacher'
      ) {
        teacherCount++;
      }
    });

    return NextResponse.json({
      studentCount: studentCountSnap.data().count,
      teacherCount,
      courseCount: courseCountSnap.data().count,
      dbReadGuard: getDbReadGuardStats(),
      dbWriteGuard: getDbWriteGuardStats(),
    });
  } catch (error) {
    const siteErrorResponse = trySiteDbErrorResponse(error, req);
    if (siteErrorResponse) return siteErrorResponse;
    throw error;
  }
}
