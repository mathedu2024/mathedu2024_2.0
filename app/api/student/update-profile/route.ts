import { NextResponse } from 'next/server';
import { db } from '@/utils/firebase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { studentId, email, address, phone } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'Missing studentId' }, { status: 400 });
    }

    const updateData: { [key: string]: string | undefined } = {};
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;

    await db.collection('student_data').doc(studentId).update(updateData);

    return NextResponse.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Error updating student profile:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: (error as Error)?.message }, { status: 500 });
  }
}