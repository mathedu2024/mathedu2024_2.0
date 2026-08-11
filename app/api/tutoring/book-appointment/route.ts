import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { tutoringService } from '@/services/tutoringService';
import { Appointment } from '@/services/interfaces';
import { adminDb } from '@/services/firebase-admin';
import { isStudentEmailVerified } from '@/utils/emailVerification';

export async function POST(req: NextRequest) {
  try {
    const appointmentData = await req.json();
    console.log('[API /api/tutoring/book-appointment] Received data:', appointmentData);

    const { slotId, studentId, studentName } = appointmentData;

    if (!slotId) return NextResponse.json({ error: 'Missing required field: slotId' }, { status: 400 });
    if (!studentId) return NextResponse.json({ error: 'Missing required field: studentId' }, { status: 400 });
    if (!studentName) return NextResponse.json({ error: 'Missing required field: studentName' }, { status: 400 });

    let studentSnap = await adminDb.collection('student_data').doc(String(studentId)).get();
    if (!studentSnap.exists) {
      const byField = await adminDb
        .collection('student_data')
        .where('studentId', '==', String(studentId))
        .limit(1)
        .get();
      if (!byField.empty) studentSnap = byField.docs[0];
    }
    if (studentSnap.exists && !isStudentEmailVerified(studentSnap.data() || {})) {
      return NextResponse.json(
        { error: '請先完成電子郵件驗證後再預約輔導' },
        { status: 403 }
      );
    }

    const appointmentId = await tutoringService.bookAppointment({
      ...appointmentData,
      studentDisplayId: studentId,
    } as Appointment);

    let teacherEmail = '';
    let teacherName = '';
    try {
      const slotDoc = await adminDb.collection('tutoringSlots').doc(slotId).get();
      const teacherId = slotDoc.exists ? String(slotDoc.data()?.teacherId || '') : '';
      teacherName = slotDoc.exists ? String(slotDoc.data()?.teacherName || '') : '';
      if (teacherId) {
        const teacherDoc = await adminDb.collection('users').doc(teacherId).get();
        if (teacherDoc.exists) {
          const t = teacherDoc.data() || {};
          teacherEmail = String(t.email || '').trim();
          if (!teacherName) teacherName = String(t.name || '');
        }
      }
    } catch (lookupErr) {
      console.warn('Teacher email lookup failed:', lookupErr);
    }

    return NextResponse.json(
      { message: 'Appointment booked successfully', appointmentId, teacherEmail, teacherName },
      { status: 201 }
    );
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error booking appointment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to book appointment';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
