import { NextRequest, NextResponse } from 'next/server';
import { tutoringService } from '@/services/tutoringService'; // Import tutoringService instance
import { Appointment } from '@/services/interfaces'; // Import Appointment interface

export async function POST(req: NextRequest) {
  try {
    const appointmentData = await req.json();
    console.log('[API /api/tutoring/book-appointment] Received data:', appointmentData);

    const { slotId, studentId, studentName } = appointmentData;
    
    if (!slotId) return NextResponse.json({ error: 'Missing required field: slotId' }, { status: 400 });
    if (!studentId) return NextResponse.json({ error: 'Missing required field: studentId' }, { status: 400 });
    if (!studentName) return NextResponse.json({ error: 'Missing required field: studentName' }, { status: 400 });

    const appointmentId = await tutoringService.bookAppointment({ ...appointmentData, studentDisplayId: studentId } as Appointment);

    return NextResponse.json({ message: 'Appointment booked successfully', appointmentId }, { status: 201 });
  } catch (error) {
    console.error('Error booking appointment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to book appointment';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
