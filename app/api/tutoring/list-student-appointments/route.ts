import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { tutoringService } from '@/services/tutoringService';

export async function POST(req: NextRequest) {
  try {
    const { studentId, dateRange } = await req.json();

    if (!studentId) {
      return NextResponse.json({ error: 'Missing studentId' }, { status: 400 });
    }

    const appointments = await tutoringService.getStudentAppointments(studentId, dateRange);

    return NextResponse.json({ appointments }, { status: 200 });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error listing student appointments:', error);
    return NextResponse.json({ error: 'Failed to list student appointments' }, { status: 500 });
  }
}