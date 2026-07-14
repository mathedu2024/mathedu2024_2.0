
import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { tutoringService } from '@/services/tutoringService';

export async function POST(req: NextRequest) {
  try {
    const { teacherId } = await req.json();

    if (!teacherId) {
      return NextResponse.json({ error: 'Missing required field: teacherId' }, { status: 400 });
    }

    const appointments = await tutoringService.getTeacherAppointments(teacherId);

    return NextResponse.json({ appointments }, { status: 200 });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error listing teacher appointments:', error);
    return NextResponse.json({ error: 'Failed to list teacher appointments' }, { status: 500 });
  }
}
