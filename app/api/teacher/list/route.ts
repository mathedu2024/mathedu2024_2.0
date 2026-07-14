import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { getSessionFromRequest, isStaffSession } from '@/services/apiAuth';

/**
 * 老師列表 API
 * - 公開存取僅回傳 id、name（供課程介紹頁）
 * - 老師/管理員登入後回傳完整欄位（不含密碼）
 */
export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const isStaff = session ? isStaffSession(session) : false;

    const usersSnapshot = await adminDb.collection('users').get();
    const teacherMap = new Map<string, { id: string; name: string; [key: string]: unknown }>();

    usersSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      const entry = isStaff
        ? (() => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { password, ...safe } = data;
            return { id: doc.id, name: (safe as { name?: string }).name ?? '', ...safe };
          })()
        : { id: doc.id, name: (data as { name?: string }).name ?? '' };
      teacherMap.set(doc.id, entry);
    });

    if (isStaff) {
      try {
        const legacySnapshot = await adminDb.collection('teachers').get();
        legacySnapshot.docs.forEach((doc) => {
          if (teacherMap.has(doc.id)) return;
          const data = doc.data();
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { password, ...safe } = data;
          teacherMap.set(doc.id, {
            id: doc.id,
            name: (safe as { name?: string }).name ?? '',
            ...safe,
          });
        });
      } catch (e) {
        const siteReadErrorResponse = trySiteDbReadErrorResponse(e);
        if (siteReadErrorResponse) return siteReadErrorResponse;
      }
    }

    return NextResponse.json(Array.from(teacherMap.values()));
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error fetching teachers:', error);
    return NextResponse.json({ error: 'Failed to fetch teachers' }, { status: 500 });
  }
}
