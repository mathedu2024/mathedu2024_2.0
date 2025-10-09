import { NextRequest, NextResponse } from 'next/server';
import { tutoringService } from '@/services/tutoringService';

export async function POST(req: NextRequest) {
  try {
    const { slotId } = await req.json();

    if (!slotId) {
      return NextResponse.json({ error: 'Missing required field: slotId' }, { status: 400 });
    }

    await tutoringService.deleteTimeSlot(slotId);

    return NextResponse.json({ message: 'Time slot deleted successfully' }, { status: 200 });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Time slot not found' || error.message === 'Cannot delete a time slot with active appointments')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('Error deleting time slot:', error);
    return NextResponse.json({ error: 'Failed to delete time slot' }, { status: 500 });
  }
}