import { NextRequest, NextResponse } from 'next/server';
import { tutoringService } from '@/services/tutoringService';

export async function POST(req: NextRequest) {
  try {
    const slot = await req.json();
    console.log('Incoming slot for create-slot:', slot);

    if (!slot.teacherId || !slot.date || !slot.startTime || !slot.endTime || !slot.participantLimit || !slot.method) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const slotId = await tutoringService.createTimeSlot(slot);

    return NextResponse.json({ message: 'Tutoring slot created successfully', slotId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === 'Invalid teacherId') {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error creating tutoring slot:', error);
    return NextResponse.json({ error: 'Failed to create tutoring slot' }, { status: 500 });
  }
}