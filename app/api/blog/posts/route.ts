import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { listBlogPosts } from '@/services/blogService';
import {
  authGuard,
  getSessionFromRequest,
  isBlogEditorSession,
  requireAuthFromRequest,
} from '@/services/apiAuth';
import type { BlogPostStatus } from '@/services/blogTypes';
import { ensureTagIds, upsertBlogPost } from '@/services/blogService';
import { listBlogCategories } from '@/services/blogService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('q') || undefined;
    const categorySlug = searchParams.get('category') || undefined;
    const tag = searchParams.get('tag') || undefined;
    const featured = searchParams.get('featured');
    const status = searchParams.get('status') as BlogPostStatus | null;
    const limit = Number(searchParams.get('limit') || '50');
    const mine = searchParams.get('mine') === '1';

    const session = getSessionFromRequest(req);
    const isEditor = session ? isBlogEditorSession(session) : false;

    if (mine || status) {
      const denied = authGuard(requireAuthFromRequest(req, 'author'));
      if (denied) return denied;
    }

    const posts = await listBlogPosts({
      search,
      categorySlug,
      tagName: tag || undefined,
      featured: featured === '1' ? true : featured === '0' ? false : undefined,
      status: status || undefined,
      authorId: mine && session ? session.id : undefined,
      publicOnly: !isEditor || (!mine && !status),
      limit: Number.isFinite(limit) ? limit : 50,
    });

    return NextResponse.json(posts);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('blog posts list error:', error);
    return NextResponse.json({ error: '讀取文章失敗' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = requireAuthFromRequest(req, 'author');
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    if (!String(body.title || '').trim()) {
      return NextResponse.json({ error: '標題不可為空' }, { status: 400 });
    }

    const categories = await listBlogCategories();
    const category = categories.find((c) => c.id === body.categoryId);

    const tagInput: string[] = Array.isArray(body.tags)
      ? body.tags
      : typeof body.tags === 'string'
        ? body.tags.split(/[,，]/)
        : body.tagNames || [];
    const tags = await ensureTagIds(tagInput);

    const post = await upsertBlogPost({
      id: body.id,
      title: String(body.title || '').trim(),
      slug: body.slug,
      excerpt: body.excerpt || '',
      content: body.content || '',
      contentFormat: body.contentFormat === 'markdown' ? 'markdown' : 'html',
      coverImage: body.coverImage || '',
      categoryId: category?.id || body.categoryId || '',
      categorySlug: category?.slug || body.categorySlug || '',
      categoryName: category?.name || body.categoryName || '',
      tagIds: tags.ids,
      tagNames: tags.names,
      status: body.status || 'draft',
      publishedAt: body.publishedAt,
      scheduledAt: body.scheduledAt,
      seoTitle: body.seoTitle,
      seoDescription: body.seoDescription,
      ogImage: body.ogImage,
      relatedCourseIds: body.relatedCourseIds || [],
      relatedResourceIds: body.relatedResourceIds || [],
      featured: Boolean(body.featured),
      authorId: auth.session.id,
      authorName: auth.session.name || auth.session.account,
      viewsCount: body.viewsCount,
      commentsCount: body.commentsCount,
    });

    return NextResponse.json(post);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('blog post create error:', error);
    return NextResponse.json({ error: '儲存文章失敗' }, { status: 500 });
  }
}
