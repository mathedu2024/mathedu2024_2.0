
import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { tutoringService } from '@/services/tutoringService';
import { TutoringSlot as TimeSlot } from '@/services/interfaces'; // Import TimeSlot interface

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');

    const slots = await tutoringService.getAllTimeSlots();

    const enrichedSlots = slots.map((slot: TimeSlot) => {
      const isBookedByCurrentUser = studentId ? slot.bookedStudents?.some(booking => booking.studentId === studentId) : false;
      return {
        ...slot,
        isBookedByCurrentUser: isBookedByCurrentUser,
      };
    });

    return NextResponse.json({ slots: enrichedSlots }, { status: 200 });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error listing all slots:', error);
    return NextResponse.json({ error: 'Failed to list all slots' }, { status: 500 });
  }
}
