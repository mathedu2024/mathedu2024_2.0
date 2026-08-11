import { NextRequest, NextResponse } from 'next/server';
import { contentWriteCollection } from '@/services/contentDbSplit';
import { requireAuthFromRequest, authGuard } from '@/services/apiAuth';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';

export async function POST(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin', 'teacher'));
  if (denied) return denied;

  try {
    const { id, ...data } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    await contentWriteCollection('exam_dates').doc(id).set(data, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('Error creating exam date:', error);
    return NextResponse.json({ error: '建立考試日期失敗' }, { status: 500 });
  }
}
