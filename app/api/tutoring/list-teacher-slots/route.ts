import { NextRequest, NextResponse } from 'next/server';
import { tutoringService } from '@/services/tutoringService';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { teacherId } = await req.json();

    if (!teacherId) {
      return NextResponse.json({ error: 'Missing teacherId' }, { status: 400 });
    }

    const slots = await tutoringService.getTimeSlots(teacherId);

    const enrichedSlots = await Promise.all(
      slots.map(async (slot) => {
        if (slot.bookedStudents && slot.bookedStudents.length > 0) {
          const enrichedBookedStudents = await Promise.all(
            slot.bookedStudents.map(async (booking) => {
              const studentRef = adminDb.collection('student_data').doc(booking.studentId);
              const studentDoc = await studentRef.get();
              if (studentDoc.exists) {
                const studentData = studentDoc.data();
                return {
                  ...booking,
                  studentName: studentData.name,
                  studentGrade: studentData.grade,
                  studentAccount: studentData.account,
                  appointmentId: booking.studentId, // Using studentId as a unique key for the list
                };
              }
              return booking;
            })
          );
          return { ...slot, bookedStudents: enrichedBookedStudents };
        }
        return slot;
      })
    );

    return NextResponse.json({ slots: enrichedSlots }, { status: 200 });
  } catch (error) {
    console.error('Error listing teacher slots:', error);
    return NextResponse.json({ error: 'Failed to list teacher slots' }, { status: 500 });
  }
}
