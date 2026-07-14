import { NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '../../../../services/firebase-admin';

const ANNOUNCEMENT_LIST_LIMIT = 50;

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection('announcements')
      .orderBy('createdAt', 'desc')
      .limit(ANNOUNCEMENT_LIST_LIMIT)
      .get();
    const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(data);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    throw error;
  }
}
