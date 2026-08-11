import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import {
  createComment,
  deleteComment,
  getBlogPostById,
  listComments,
  moderateComment,
} from '@/services/blogService';
import {
  authGuard,
  getSessionFromRequest,
  isBlogEditorSession,
  requireAuthFromRequest,
} from '@/services/apiAuth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const postId = searchParams.get('postId') || undefined;
    const session = getSessionFromRequest(req);
    const isEditor = session ? isBlogEditorSession(session) : false;
    const moderate = searchParams.get('moderate') === '1';

    if (moderate) {
      const denied = authGuard(requireAuthFromRequest(req, 'author'));
      if (denied) return denied;
    }

    const comments = await listComments({
      postId,
      approvedOnly: !moderate || !isEditor,
      limit: Number(searchParams.get('limit') || '100'),
    });
    return NextResponse.json(comments);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('blog comments list error:', error);
    return NextResponse.json({ error: '讀取留言失敗' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session?.id) {
    return NextResponse.json({ error: '請先登入後再留言' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const postId = String(body.postId || '');
    const content = String(body.content || '').trim();
    if (!postId || !content) {
      return NextResponse.json({ error: '留言內容不可為空' }, { status: 400 });
    }

    const post = await getBlogPostById(postId);
    if (!post) {
      return NextResponse.json({ error: '找不到文章' }, { status: 404 });
    }

    const isEditor = isBlogEditorSession(session);
    const comment = await createComment({
      postId,
      postTitle: post.title,
      userId: session.id,
      userName: session.name || session.account,
      content,
      parentId: body.parentId || null,
      // 作者／管理員回覆直接通過；學生留言需審核
      autoApprove: isEditor,
    });

    return NextResponse.json(comment);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('blog comment create error:', error);
    return NextResponse.json({ error: '送出留言失敗' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = requireAuthFromRequest(req, 'author');
  const denied = authGuard(auth);
  if (denied) return denied;

  try {
    const body = await req.json();
    if (!body.id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    await moderateComment(body.id, {
      isApproved: body.isApproved,
      isPinned: body.isPinned,
      content: body.content,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('blog comment moderate error:', error);
    return NextResponse.json({ error: '審核留言失敗' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = requireAuthFromRequest(req, 'author');
  const denied = authGuard(auth);
  if (denied) return denied;

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 });
    await deleteComment(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('blog comment delete error:', error);
    return NextResponse.json({ error: '刪除留言失敗' }, { status: 500 });
  }
}
