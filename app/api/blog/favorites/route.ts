import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { listUserFavorites, toggleFavorite } from '@/services/blogService';
import { requireAuthFromRequest } from '@/services/apiAuth';

export async function GET(req: NextRequest) {
  const auth = requireAuthFromRequest(req, 'admin', 'author', 'teacher', 'student');
  if (auth.ok === false) return auth.response;

  try {
    const ids = await listUserFavorites(auth.session.id);
    return NextResponse.json({ postIds: ids });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    return NextResponse.json({ error: '讀取收藏失敗' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAuthFromRequest(req, 'admin', 'author', 'teacher', 'student');
  if (auth.ok === false) return auth.response;

  try {
    const { postId } = await req.json();
    if (!postId) return NextResponse.json({ error: '缺少 postId' }, { status: 400 });
    const result = await toggleFavorite(auth.session.id, String(postId));
    return NextResponse.json(result);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    return NextResponse.json({ error: '收藏操作失敗' }, { status: 500 });
  }
}
