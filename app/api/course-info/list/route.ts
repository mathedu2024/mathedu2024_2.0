import { NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '../../../../services/firebase-admin';
import { cookies } from 'next/headers';

export async function GET() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));
    if (sessionData.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(_error);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const snapshot = await adminDb.collection('course_info').get();
    const courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(courses);
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 