import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { listBlogTags } from '@/services/blogService';

export async function GET(req: NextRequest) {
  try {
    const limit = Number(new URL(req.url).searchParams.get('limit') || '50');
    const tags = await listBlogTags({
      publicOnly: true,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return NextResponse.json(tags);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('blog tags list error:', error);
    return NextResponse.json({ error: '讀取標籤失敗' }, { status: 500 });
  }
}
