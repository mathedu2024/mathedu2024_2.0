
import { NextRequest, NextResponse } from 'next/server';
import { tutoringService } from '@/services/tutoringService';

export async function POST(req: NextRequest) {
  try {
    const { studentId } = await req.json();

    if (!studentId) {
      return NextResponse.json({ error: 'Missing required field: studentId' }, { status: 400 });
    }

    const appointments = await tutoringService.getStudentAppointments(studentId);

    return NextResponse.json({ appointments }, { status: 200 });
  } catch (error) {
    console.error('Error listing student appointments:', error);
    return NextResponse.json({ error: 'Failed to list student appointments' }, { status: 500 });
  }
}
