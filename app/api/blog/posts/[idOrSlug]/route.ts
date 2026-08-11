import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import {
  deleteBlogPost,
  getBlogPostById,
  getBlogPostBySlug,
  incrementPostViews,
  listRelatedPosts,
  upsertBlogPost,
  ensureTagIds,
  listBlogCategories,
} from '@/services/blogService';
import {
  getSessionFromRequest,
  isBlogEditorSession,
  requireAuthFromRequest,
} from '@/services/apiAuth';

type Ctx = { params: Promise<{ idOrSlug: string }> };

export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { idOrSlug } = await ctx.params;
    const session = getSessionFromRequest(req);
    const isEditor = session ? isBlogEditorSession(session) : false;

    let post = await getBlogPostById(idOrSlug);
    if (!post) post = await getBlogPostBySlug(idOrSlug);
    if (!post) {
      return NextResponse.json({ error: '找不到文章' }, { status: 404 });
    }

    const isPublic =
      post.status === 'published' ||
      (post.status === 'scheduled' &&
        post.scheduledAt &&
        new Date(post.scheduledAt).getTime() <= Date.now());

    const canViewDraft = isEditor && post.authorId === session!.id;

    if (!isPublic && post.status !== 'unlisted' && !canViewDraft) {
      return NextResponse.json({ error: '找不到文章' }, { status: 404 });
    }

    const countView = new URL(req.url).searchParams.get('view') !== '0';
    if (countView && (isPublic || post.status === 'unlisted')) {
      void incrementPostViews(post.id).catch(() => undefined);
      post = { ...post, viewsCount: (post.viewsCount || 0) + 1 };
    }

    const related = isPublic || post.status === 'unlisted' ? await listRelatedPosts(post, 5) : [];
    return NextResponse.json({
      post,
      related,
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('blog post get error:', error);
    return NextResponse.json({ error: '讀取文章失敗' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const auth = requireAuthFromRequest(req, 'author');
  if (auth.ok === false) return auth.response;

  try {
    const { idOrSlug } = await ctx.params;
    const existing = (await getBlogPostById(idOrSlug)) || (await getBlogPostBySlug(idOrSlug));
    if (!existing) {
      return NextResponse.json({ error: '找不到文章' }, { status: 404 });
    }
    if (existing.authorId !== auth.session.id) {
      return NextResponse.json({ error: '只能編輯自己的文章' }, { status: 403 });
    }

    const body = await req.json();
    const categories = await listBlogCategories();
    const category = categories.find((c) => c.id === (body.categoryId || existing.categoryId));
    const tagInput: string[] = Array.isArray(body.tags)
      ? body.tags
      : typeof body.tags === 'string'
        ? body.tags.split(/[,，]/)
        : body.tagNames || existing.tagNames || [];
    const tags = await ensureTagIds(tagInput);

    const post = await upsertBlogPost({
      ...existing,
      ...body,
      id: existing.id,
      title: String(body.title ?? existing.title).trim(),
      categoryId: category?.id || body.categoryId || existing.categoryId,
      categorySlug: category?.slug || body.categorySlug || existing.categorySlug,
      categoryName: category?.name || body.categoryName || existing.categoryName,
      tagIds: tags.ids,
      tagNames: tags.names,
      authorId: existing.authorId,
      authorName: existing.authorName,
      viewsCount: existing.viewsCount,
      commentsCount: existing.commentsCount,
    });

    return NextResponse.json(post);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('blog post update error:', error);
    return NextResponse.json({ error: '更新文章失敗' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const auth = requireAuthFromRequest(req, 'author');
  if (auth.ok === false) return auth.response;

  try {
    const { idOrSlug } = await ctx.params;
    const existing = (await getBlogPostById(idOrSlug)) || (await getBlogPostBySlug(idOrSlug));
    if (!existing) {
      return NextResponse.json({ error: '找不到文章' }, { status: 404 });
    }
    if (existing.authorId !== auth.session.id) {
      return NextResponse.json({ error: '只能刪除自己的文章' }, { status: 403 });
    }
    await deleteBlogPost(existing.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('blog post delete error:', error);
    return NextResponse.json({ error: '刪除文章失敗' }, { status: 500 });
  }
}
