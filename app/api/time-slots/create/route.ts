import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const docRef = await adminDb.collection('time-slots').add({
      ...data,
      createdAt: new Date(),
      status: 'available',
      currentStudents: 0
    });
    const doc = await docRef.get();
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    let message = '新增失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 