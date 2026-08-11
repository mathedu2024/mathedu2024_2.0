import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { requireAuthFromRequest } from '@/services/apiAuth';

const MAX_LENGTH = 500;

export async function POST(req: NextRequest) {
  const auth = requireAuthFromRequest(req, 'author');
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const introduction = typeof body.introduction === 'string' ? body.introduction.trim() : '';

    if (introduction.length > MAX_LENGTH) {
      return NextResponse.json(
        { error: `自我介紹最多 ${MAX_LENGTH} 字` },
        { status: 400 }
      );
    }

    const userRef = adminDb.collection('users').doc(auth.session.id);
    const snap = await userRef.get();
    if (!snap.exists) {
      return NextResponse.json({ error: '找不到使用者' }, { status: 404 });
    }

    await userRef.set(
      {
        introduction,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, introduction });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('update-introduction error:', error);
    return NextResponse.json({ error: '更新自我介紹失敗' }, { status: 500 });
  }
}
