import { NextRequest, NextResponse } from 'next/server';
import { tutoringService } from '@/services/tutoringService';
import { adminDb } from '@/services/firebase-admin';

export async function GET(_req: NextRequest) {
  try {
    // Fetch all slots
    const slots = await tutoringService.getAllTimeSlots();
    console.log(`[API /api/tutoring/list-all-slots] Fetched ${slots.length} slots from the database.`);

    // For each slot, fetch the booked count and teacher name
    const slotsWithDetails = await Promise.all(slots.map(async (slot) => {
      // Fetch teacher name
      const teacherRef = adminDb.collection('users').doc(slot.teacherId);
      const teacherDoc = await teacherRef.get();
      const teacherName = teacherDoc.data()?.name || '未知老師';

      // Fetch booked count
      const appointmentsSnapshot = await adminDb.collection('appointments')
        .where('slotId', '==', slot.id)
        .where('status', '==', 'confirmed')
        .get();
      const bookedCount = appointmentsSnapshot.size;

      return { ...slot, teacherName, bookedCount, isFull: bookedCount >= slot.participantLimit };
    }));

    return NextResponse.json({ slots: slotsWithDetails }, { status: 200 });
  } catch (error) {
    console.error('Error listing all tutoring slots:', error);
    return NextResponse.json({ error: 'Failed to list all tutoring slots' }, { status: 500 });
  }
}
