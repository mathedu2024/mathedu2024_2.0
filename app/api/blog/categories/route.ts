import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import {
  deleteBlogCategory,
  listBlogCategories,
  upsertBlogCategory,
} from '@/services/blogService';
import { authGuard, requireAuthFromRequest } from '@/services/apiAuth';

export async function GET(req: NextRequest) {
  try {
    const categories = await listBlogCategories();
    return NextResponse.json(categories);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('blog categories list error:', error);
    return NextResponse.json({ error: '讀取分類失敗' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'author'));
  if (denied) return denied;

  try {
    const body = await req.json();
    if (!body.name?.trim()) {
      return NextResponse.json({ error: '分類名稱不可為空' }, { status: 400 });
    }
    const category = await upsertBlogCategory(body);
    return NextResponse.json(category);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('blog category upsert error:', error);
    return NextResponse.json({ error: '儲存分類失敗' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'author'));
  if (denied) return denied;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    await deleteBlogCategory(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('blog category delete error:', error);
    return NextResponse.json({ error: '刪除分類失敗' }, { status: 500 });
  }
}
