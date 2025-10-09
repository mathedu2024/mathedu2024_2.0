import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const { id, teacherId, title, date, startTime, endTime, method, locationType, locationDetails, mode, participantLimit, qualifications, remarks, status } = await req.json();

    if (!id || !teacherId) {
      return NextResponse.json({ error: 'Missing required fields: id and teacherId' }, { status: 400 });
    }

    const slotRef = adminDb.collection('tutoringSlots').doc(id);
    const slotDoc = await slotRef.get();

    if (!slotDoc.exists) {
      return NextResponse.json({ error: 'Tutoring slot not found' }, { status: 404 });
    }

    const updateData: { [key: string]: unknown } = {
      updatedAt: Timestamp.now(),
    };

    if (title !== undefined) updateData.title = title;
    if (date !== undefined) updateData.date = date;
    if (startTime !== undefined) updateData.startTime = startTime;
    if (endTime !== undefined) updateData.endTime = endTime;
    if (method !== undefined) updateData.method = method;
    if (locationType !== undefined) updateData.locationType = locationType;
    if (locationDetails !== undefined) updateData.locationDetails = locationDetails;
    if (mode !== undefined) updateData.mode = mode;
    if (participantLimit !== undefined) updateData.participantLimit = Number(participantLimit);
    if (qualifications !== undefined) updateData.qualifications = qualifications;
    if (remarks !== undefined) updateData.remarks = remarks;
    if (status !== undefined) updateData.status = status;

    await slotRef.update(updateData);

    return NextResponse.json({ message: 'Tutoring slot updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating tutoring slot:', error);
    return NextResponse.json({ error: 'Failed to update tutoring slot' }, { status: 500 });
  }
}
