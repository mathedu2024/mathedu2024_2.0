import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { contentWriteCollection } from '@/services/contentDbSplit';
import { requireAuthFromRequest, authGuard } from '@/services/apiAuth';

export async function POST(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin'));
  if (denied) return denied;

  try {
    const { id, ...data } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    await contentWriteCollection('announcements').doc(id).update({
      ...data,
      updatedAt: new Date(),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error updating announcement:', error);
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
}
