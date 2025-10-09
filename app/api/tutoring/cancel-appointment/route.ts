import { NextRequest, NextResponse } from 'next/server';
import { tutoringService } from '@/services/tutoringService';

export async function POST(req: NextRequest) {
  try {
    const { slotId, studentId } = await req.json();

    if (!slotId || !studentId) {
      return NextResponse.json({ error: 'Missing required fields: slotId or studentId' }, { status: 400 });
    }

    await tutoringService.cancelAppointment(slotId, studentId);

    return NextResponse.json({ message: 'Appointment cancelled successfully' }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Time slot not found' || error.message === 'Student not found in this time slot')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('Error cancelling appointment:', error);
    return NextResponse.json({ error: 'Failed to cancel appointment' }, { status: 500 });
  }
}