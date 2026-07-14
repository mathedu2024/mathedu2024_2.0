import { NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';

export async function GET() {
  try {
    const snapshot = await adminDb.collection('科目資料').get();
    const subjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(subjects);
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 