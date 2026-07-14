import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { requireAuthFromRequest, authGuard } from '@/services/apiAuth';

export async function POST(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin', 'teacher'));
  if (denied) return denied;

  try {
    const { courseKeys } = await req.json();
    if (!Array.isArray(courseKeys) || courseKeys.length === 0) {
      return NextResponse.json({ error: 'Missing courseKeys' }, { status: 400 });
    }
    const results: Record<string, unknown> = {};
    for (const key of courseKeys) {
      const doc = await adminDb.collection('grades').doc(key).get();
      if (doc.exists) {
        const data = doc.data();
        if (data) {
          let teacherIds = data.teacherIds || data.teachers || [];
          if (typeof teacherIds === 'string') teacherIds = [teacherIds];
          if (!Array.isArray(teacherIds)) teacherIds = [];
          let teacherNames: string[] = [];
          if (teacherIds.length > 0) {
            const userDocs = await Promise.all(
              teacherIds.map((id: string) => adminDb.collection('users').doc(id).get())
            );
            teacherNames = userDocs
              .filter((userDoc) => userDoc.exists)
              .map((userDoc) => userDoc.get('name') || userDoc.get('account') || userDoc.id);
          }
          results[key] = { ...data, teacherNames };
        } else {
          results[key] = null;
        }
      } else {
        results[key] = null;
      }
    }
    return NextResponse.json(results);
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    const message = error instanceof Error ? error.message : '????';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
