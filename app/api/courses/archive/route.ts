import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '../../../../services/firebase-admin';
import { requireAuthFromRequest, sessionHasRole } from '@/services/apiAuth';

export async function POST(req: NextRequest) {
  const auth = requireAuthFromRequest(req, 'admin', 'teacher');
  if (auth.ok === false) return auth.response;

  // 封存／取消封存僅管理員
  if (!sessionHasRole(auth.session, 'admin')) {
    return NextResponse.json({ error: '僅管理員可封存或取消封存課程' }, { status: 403 });
  }

  try {
    const { id, archived } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const updateData: Record<string, unknown> = { archived };
    if (archived) {
      updateData.status = '已封存';
    } else {
      updateData.status = '未開課';
    }

    await adminDb.collection('courses').doc(id).update(updateData);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    let message = '操作失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
