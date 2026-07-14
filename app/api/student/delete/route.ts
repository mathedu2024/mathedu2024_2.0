import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { requireAuthFromRequest, authGuard } from '@/services/apiAuth';

export async function POST(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin'));
  if (denied) return denied;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    await adminDb.collection('student_data').doc(id).delete();
    const courseLists = await adminDb.collection('course-student-list').get();
    const batch = adminDb.batch();
    courseLists.forEach((docSnap) => {
      const data = docSnap.data();
      if (Array.isArray(data.students)) {
        const newStudents = data.students.filter((s: { studentId?: string }) => s.studentId !== id);
        if (newStudents.length !== data.students.length) {
          batch.update(docSnap.ref, { students: newStudents });
        }
      }
    });
    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    const message = error instanceof Error ? error.message : '????';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
