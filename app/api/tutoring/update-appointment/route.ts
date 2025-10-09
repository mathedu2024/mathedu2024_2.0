import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { TutoringSlot } from '@/services/interfaces'; // Import TutoringSlot interface


export async function POST(req: NextRequest) {
  try {
    const appointmentData = await req.json();
    console.log('Received appointmentData for update:', appointmentData);
    const { slotId, studentId, status, problemDescription } = appointmentData;

    if (!slotId || !studentId || !status) {
      return NextResponse.json({ error: 'Missing required fields: slotId, studentId, and status' }, { status: 400 });
    }

    const slotRef = adminDb.collection('tutoringSlots').doc(slotId);
    const slotDoc = await slotRef.get();

    if (!slotDoc.exists) {
      return NextResponse.json({ error: 'Tutoring slot not found' }, { status: 404 });
    }

    const slotData = slotDoc.data() as TutoringSlot;
    let bookedStudents = slotData.bookedStudents || [];

    const studentBookingIndex = bookedStudents.findIndex(booking => booking.studentId === studentId);

    if (studentBookingIndex === -1) {
      return NextResponse.json({ error: 'Student booking not found in this slot' }, { status: 404 });
    }

    const updatedBooking = { ...bookedStudents[studentBookingIndex] };

    // Update status
    updatedBooking.status = status;
    if (problemDescription !== undefined) {
      updatedBooking.problemDescription = problemDescription;
    }

    const updateData: { [key: string]: unknown } = {
      updatedAt: Timestamp.now(),
    };

    if (status === 'cancelled') {
      // Remove the booking from the array
      bookedStudents = bookedStudents.filter((_, index) => index !== studentBookingIndex);
      updateData.bookedCount = FieldValue.increment(-1);
      updateData.available = true; // Make slot available again if cancelled
    } else {
      // Update the existing booking in the array
      bookedStudents[studentBookingIndex] = updatedBooking;
    }

    updateData.bookedStudents = bookedStudents; // Always update bookedStudents array

    await slotRef.update(updateData);

    return NextResponse.json({ message: 'Appointment updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating appointment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update appointment';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
