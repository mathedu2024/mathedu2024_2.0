import { FieldValue } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';
import { contentWriteCollection, getContentDoc, listContentDocs } from './contentDbSplit';
import {
  estimateReadingMinutes,
  slugify,
  titleToBlogSlug,
  type BlogComment,
  type BlogCategory,
  type BlogTag,
  type BlogPost,
  type BlogPostStatus,
  type BlogContentFormat,
} from './blogTypes';

/** Firestore collection names（僅宣告一次） */
const POSTS = 'blog_posts';
const CATEGORIES = 'blog_categories';
const TAGS = 'blog_tags';
const COMMENTS = 'blog_comments';
const FAVORITES = 'blog_favorites';

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

function mapPost(id: string, data: FirebaseFirestore.DocumentData): BlogPost {
  return {
    id,
    title: String(data.title || ''),
    slug: String(data.slug || id),
    excerpt: String(data.excerpt || ''),
    content: String(data.content || ''),
    contentFormat: (data.contentFormat === 'markdown' ? 'markdown' : 'html') as BlogContentFormat,
    coverImage: data.coverImage ? String(data.coverImage) : undefined,
    categoryId: data.categoryId ? String(data.categoryId) : undefined,
    categorySlug: data.categorySlug ? String(data.categorySlug) : undefined,
    categoryName: data.categoryName ? String(data.categoryName) : undefined,
    topicNumber:
      data.topicNumber != null && Number.isFinite(Number(data.topicNumber))
        ? Number(data.topicNumber)
        : null,
    tagIds: Array.isArray(data.tagIds) ? data.tagIds.map(String) : [],
    tagNames: Array.isArray(data.tagNames) ? data.tagNames.map(String) : [],
    status: (data.status || 'draft') as BlogPostStatus,
    publishedAt: toIso(data.publishedAt),
    scheduledAt: toIso(data.scheduledAt),
    viewsCount: Number(data.viewsCount || 0),
    commentsCount: Number(data.commentsCount || 0),
    readingMinutes: Number(data.readingMinutes || estimateReadingMinutes(String(data.content || ''))),
    seoTitle: data.seoTitle ? String(data.seoTitle) : undefined,
    seoDescription: data.seoDescription ? String(data.seoDescription) : undefined,
    ogImage: data.ogImage ? String(data.ogImage) : undefined,
    relatedCourseIds: Array.isArray(data.relatedCourseIds) ? data.relatedCourseIds.map(String) : [],
    relatedResourceIds: Array.isArray(data.relatedResourceIds) ? data.relatedResourceIds.map(String) : [],
    authorId: String(data.authorId || ''),
    authorName: String(data.authorName || ''),
    featured: Boolean(data.featured),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

/** 早期 ensureDefault 寫入的罐頭主題；列出時一併清除 */
const SEEDED_CATEGORY_SLUGS = new Set([
  'study-mindset',
  'concept-guide',
  'exam-trends',
  'platform-news',
]);

const SEEDED_CATEGORY_NAMES = new Set(['學習心法', '觀念解析', '大考趨勢', '平台公告']);

let seedPurgePromise: Promise<number> | null = null;

function isSeedBlogCategory(slug: string, name: string): boolean {
  return SEEDED_CATEGORY_SLUGS.has(slug) || SEEDED_CATEGORY_NAMES.has(name.trim());
}

/** 清除早期自動建立的罐頭主題（冪等） */
export async function purgeSeedBlogCategories(): Promise<number> {
  if (!seedPurgePromise) {
    seedPurgePromise = (async () => {
      const existing = await listContentDocs(CATEGORIES);
      let deleted = 0;
      for (const doc of existing) {
        const slug = String(doc.slug || '');
        const name = String(doc.name || '');
        if (!isSeedBlogCategory(slug, name)) continue;
        await contentWriteCollection(CATEGORIES).doc(doc.id).delete();
        deleted += 1;
      }
      return deleted;
    })().catch((err) => {
      seedPurgePromise = null;
      throw err;
    });
  }
  return seedPurgePromise;
}

export async function listBlogCategories(): Promise<BlogCategory[]> {
  try {
    await purgeSeedBlogCategories();
  } catch (err) {
    console.warn('purgeSeedBlogCategories failed:', err);
  }

  const existing = await listContentDocs(CATEGORIES);
  return existing
    .map((doc) => ({
      id: doc.id,
      name: String(doc.name || ''),
      slug: String(doc.slug || doc.id),
      description: doc.description ? String(doc.description) : undefined,
      parentId: doc.parentId ? String(doc.parentId) : null,
      order: Number(doc.order || 0),
      nextTopicNumber: Number(doc.nextTopicNumber || 1),
    }))
    .filter((cat) => !isSeedBlogCategory(cat.slug, cat.name))
    .sort((a, b) => (a.order || 0) - (b.order || 0) || a.name.localeCompare(b.name, 'zh-Hant'));
}

export async function upsertBlogCategory(input: {
  id?: string;
  name: string;
  slug?: string;
  description?: string;
  parentId?: string | null;
  order?: number;
}): Promise<BlogCategory> {
  const id = input.id || contentWriteCollection(CATEGORIES).doc().id;
  const slug = slugify(input.slug || input.name);
  const existing = input.id ? await getContentDoc(CATEGORIES, id) : null;
  const payload = {
    name: input.name.trim(),
    slug,
    description: input.description?.trim() || '',
    parentId: input.parentId || null,
    order: input.order ?? 0,
    nextTopicNumber: Number(existing?.data?.nextTopicNumber || 1),
    updatedAt: FieldValue.serverTimestamp(),
    ...(input.id ? {} : { createdAt: FieldValue.serverTimestamp(), nextTopicNumber: 1 }),
  };
  await contentWriteCollection(CATEGORIES).doc(id).set(payload, { merge: true });
  return {
    id,
    name: payload.name,
    slug: payload.slug,
    description: payload.description,
    parentId: payload.parentId,
    order: payload.order,
    nextTopicNumber: payload.nextTopicNumber,
  };
}

export async function deleteBlogCategory(id: string): Promise<void> {
  await contentWriteCollection(CATEGORIES).doc(id).delete();
}

/** 從主題流水號配置下一個編號（交易） */
export async function allocateTopicNumber(categoryId: string): Promise<number> {
  const ref = contentWriteCollection(CATEGORIES).doc(categoryId);
  const db = adminDb;
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new Error('主題不存在');
    }
    const current = Number(snap.data()?.nextTopicNumber || 1);
    const next = Number.isFinite(current) && current > 0 ? current : 1;
    tx.set(
      ref,
      {
        nextTopicNumber: next + 1,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    return next;
  });
}

/** 文章網址：由標題轉成英文亂碼（base64url）；碰撞時加後綴，刪除不重用既有 slug。 */
export async function allocateTitlePostSlug(title: string, excludeId?: string): Promise<string> {
  const base = titleToBlogSlug(title);
  if (!(await isSlugTaken(base, excludeId))) return base;
  for (let i = 2; i < 100; i += 1) {
    const candidate = `${base}-${i}`;
    if (!(await isSlugTaken(candidate, excludeId))) return candidate;
  }
  const fallback = `${base}-${Date.now().toString(36)}`;
  if (!(await isSlugTaken(fallback, excludeId))) return fallback;
  throw new Error('無法配置文章網址');
}

export async function listBlogPosts(options?: {
  status?: BlogPostStatus | BlogPostStatus[];
  categorySlug?: string;
  tagSlug?: string;
  tagName?: string;
  authorId?: string;
  featured?: boolean;
  search?: string;
  limit?: number;
  publicOnly?: boolean;
}): Promise<BlogPost[]> {
  const docs = await listContentDocs(POSTS, {
    orderBy: { field: 'updatedAt', direction: 'desc' },
    limit: options?.limit ? Math.min(options.limit * 3, 300) : 200,
  });

  let posts = docs.map((doc) => mapPost(doc.id, doc));

  if (options?.publicOnly) {
    const now = Date.now();
    posts = posts.filter((p) => {
      if (p.status === 'published') return true;
      if (p.status === 'unlisted') return false;
      if (p.status === 'scheduled' && p.scheduledAt) {
        return new Date(p.scheduledAt).getTime() <= now;
      }
      return false;
    });
  }

  if (options?.status) {
    const statuses = Array.isArray(options.status) ? options.status : [options.status];
    posts = posts.filter((p) => statuses.includes(p.status));
  }
  if (options?.categorySlug) {
    posts = posts.filter((p) => p.categorySlug === options.categorySlug);
  }
  if (options?.tagSlug) {
    const slug = options.tagSlug.toLowerCase();
    posts = posts.filter((p) =>
      (p.tagNames || []).some((n) => slugify(n) === slug) ||
      (p.tagIds || []).includes(options.tagSlug!)
    );
  }
  if (options?.tagName) {
    const name = options.tagName.trim().toLowerCase();
    posts = posts.filter((p) =>
      (p.tagNames || []).some((n) => n.trim().toLowerCase() === name)
    );
  }
  if (options?.authorId) {
    posts = posts.filter((p) => p.authorId === options.authorId);
  }
  if (typeof options?.featured === 'boolean') {
    posts = posts.filter((p) => Boolean(p.featured) === options.featured);
  }
  if (options?.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    posts = posts.filter((p) => {
      const hay = `${p.title} ${p.excerpt} ${p.content} ${p.tagNames?.join(' ') || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }

  posts.sort((a, b) => {
    const aTime = a.publishedAt || toIso(a.updatedAt) || '';
    const bTime = b.publishedAt || toIso(b.updatedAt) || '';
    return bTime.localeCompare(aTime);
  });

  if (options?.limit) {
    posts = posts.slice(0, options.limit);
  }

  return posts;
}

export async function getBlogPostById(id: string): Promise<BlogPost | null> {
  const found = await getContentDoc(POSTS, id);
  if (!found) return null;
  return mapPost(found.id, found.data);
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const snap = await contentWriteCollection(POSTS).where('slug', '==', slug).limit(1).get();
  if (!snap.empty) {
    const doc = snap.docs[0];
    return mapPost(doc.id, doc.data());
  }

  // 分離後相容：舊版可能查 core；目前內容固定在 core，無需再查
  return null;
}

export async function isSlugTaken(slug: string, excludeId?: string): Promise<boolean> {
  const snap = await contentWriteCollection(POSTS).where('slug', '==', slug).limit(5).get();
  return snap.docs.some((doc) => doc.id !== excludeId);
}

export async function upsertBlogPost(input: Partial<BlogPost> & {
  title: string;
  authorId: string;
  authorName: string;
  id?: string;
}): Promise<BlogPost> {
  const isCreate = !input.id;
  const id = input.id || contentWriteCollection(POSTS).doc().id;

  const existing = input.id ? await getBlogPostById(id) : null;

  let slug: string;
  if (isCreate || !existing?.slug) {
    slug = await allocateTitlePostSlug(input.title, id);
  } else if ((existing.title || '').trim() !== input.title.trim()) {
    // 標題變更時同步更新網址
    slug = await allocateTitlePostSlug(input.title, id);
  } else {
    slug = existing.slug;
  }

  const status: BlogPostStatus = input.status || 'draft';
  const content = input.content || '';
  const nowIso = new Date().toISOString();

  let publishedAt = input.publishedAt ?? null;
  if (status === 'published' && !publishedAt) {
    publishedAt = nowIso;
  }
  if (status === 'draft') {
    publishedAt = publishedAt || null;
  }

  const categoryId = (input.categoryId || '').trim();
  let topicNumber: number | null =
    input.topicNumber != null && Number.isFinite(Number(input.topicNumber))
      ? Number(input.topicNumber)
      : null;

  if (categoryId) {
    const sameTopic =
      existing &&
      existing.categoryId === categoryId &&
      existing.topicNumber != null &&
      Number(existing.topicNumber) > 0;
    if (sameTopic) {
      topicNumber = Number(existing!.topicNumber);
    } else {
      topicNumber = await allocateTopicNumber(categoryId);
    }
  } else {
    topicNumber = null;
  }

  const payload = {
    title: input.title.trim(),
    slug,
    excerpt: (input.excerpt || '').trim(),
    content,
    contentFormat: (input.contentFormat || 'html') as BlogContentFormat,
    coverImage: input.coverImage || '',
    categoryId,
    categorySlug: input.categorySlug || '',
    categoryName: input.categoryName || '',
    topicNumber,
    tagIds: input.tagIds || [],
    tagNames: input.tagNames || [],
    status,
    publishedAt: publishedAt ? new Date(publishedAt) : null,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    viewsCount: input.viewsCount ?? 0,
    commentsCount: input.commentsCount ?? 0,
    readingMinutes: input.readingMinutes ?? estimateReadingMinutes(content),
    seoTitle: input.seoTitle || input.title.trim(),
    seoDescription: input.seoDescription || (input.excerpt || '').trim().slice(0, 160),
    ogImage: input.ogImage || input.coverImage || '',
    relatedCourseIds: input.relatedCourseIds || [],
    relatedResourceIds: input.relatedResourceIds || [],
    authorId: input.authorId,
    authorName: input.authorName,
    featured: Boolean(input.featured),
    updatedAt: FieldValue.serverTimestamp(),
    ...(input.id ? {} : { createdAt: FieldValue.serverTimestamp() }),
  };

  await contentWriteCollection(POSTS).doc(id).set(payload, { merge: true });
  return mapPost(id, { ...payload, publishedAt, scheduledAt: input.scheduledAt || null });
}

export async function deleteBlogPost(id: string): Promise<void> {
  await contentWriteCollection(POSTS).doc(id).delete();
}

export async function incrementPostViews(id: string): Promise<void> {
  await contentWriteCollection(POSTS).doc(id).set(
    { viewsCount: FieldValue.increment(1) },
    { merge: true }
  );
}

export async function listRelatedPosts(post: BlogPost, limit = 5): Promise<BlogPost[]> {
  const all = await listBlogPosts({ publicOnly: true, limit: 40 });
  const others = all.filter((p) => p.id !== post.id);
  const tagSet = new Set(post.tagIds || []);

  const scored = others
    .map((p) => ({
      post: p,
      score:
        (p.categoryId && p.categoryId === post.categoryId ? 3 : 0) +
        (p.tagIds || []).filter((t) => tagSet.has(t)).length +
        (p.featured ? 1 : 0),
    }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.post.viewsCount || 0) - (a.post.viewsCount || 0)
    );

  const picked: BlogPost[] = [];
  const seen = new Set<string>();

  for (const item of scored) {
    if (item.score <= 0) continue;
    picked.push(item.post);
    seen.add(item.post.id);
    if (picked.length >= limit) return picked;
  }

  // 不足則以瀏覽數補滿，確保右欄可到指定篇數
  const byViews = [...others].sort((a, b) => (b.viewsCount || 0) - (a.viewsCount || 0));
  for (const p of byViews) {
    if (seen.has(p.id)) continue;
    picked.push(p);
    if (picked.length >= limit) break;
  }
  return picked;
}

function mapComment(id: string, data: FirebaseFirestore.DocumentData): BlogComment {
  return {
    id,
    postId: String(data.postId || ''),
    postTitle: data.postTitle ? String(data.postTitle) : undefined,
    userId: String(data.userId || ''),
    userName: String(data.userName || ''),
    content: String(data.content || ''),
    parentId: data.parentId ? String(data.parentId) : null,
    isApproved: Boolean(data.isApproved),
    isPinned: Boolean(data.isPinned),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function listComments(options?: {
  postId?: string;
  approvedOnly?: boolean;
  limit?: number;
}): Promise<BlogComment[]> {
  const docs = await listContentDocs(COMMENTS, {
    orderBy: { field: 'createdAt', direction: 'desc' },
    limit: options?.limit || 200,
  });
  let comments = docs.map((doc) => mapComment(doc.id, doc));
  if (options?.postId) {
    comments = comments.filter((c) => c.postId === options.postId);
  }
  if (options?.approvedOnly) {
    comments = comments.filter((c) => c.isApproved);
  }
  return comments;
}

export async function createComment(input: {
  postId: string;
  postTitle?: string;
  userId: string;
  userName: string;
  content: string;
  parentId?: string | null;
  autoApprove?: boolean;
}): Promise<BlogComment> {
  const id = contentWriteCollection(COMMENTS).doc().id;
  const payload = {
    postId: input.postId,
    postTitle: input.postTitle || '',
    userId: input.userId,
    userName: input.userName,
    content: input.content.trim(),
    parentId: input.parentId || null,
    isApproved: Boolean(input.autoApprove),
    isPinned: false,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await contentWriteCollection(COMMENTS).doc(id).set(payload);
  if (payload.isApproved) {
    await contentWriteCollection(POSTS).doc(input.postId).set(
      { commentsCount: FieldValue.increment(1) },
      { merge: true }
    );
  }
  return mapComment(id, payload);
}

export async function moderateComment(
  id: string,
  patch: { isApproved?: boolean; isPinned?: boolean; content?: string }
): Promise<void> {
  const found = await getContentDoc(COMMENTS, id);
  if (!found) throw new Error('Comment not found');

  const prevApproved = Boolean(found.data.isApproved);
  const nextApproved = typeof patch.isApproved === 'boolean' ? patch.isApproved : prevApproved;

  await contentWriteCollection(COMMENTS).doc(id).set(
    {
      ...patch,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (prevApproved !== nextApproved) {
    const delta = nextApproved ? 1 : -1;
    await contentWriteCollection(POSTS).doc(String(found.data.postId)).set(
      { commentsCount: FieldValue.increment(delta) },
      { merge: true }
    );
  }
}

export async function deleteComment(id: string): Promise<void> {
  const found = await getContentDoc(COMMENTS, id);
  if (!found) return;
  await contentWriteCollection(COMMENTS).doc(id).delete();
  if (found.data.isApproved) {
    await contentWriteCollection(POSTS).doc(String(found.data.postId)).set(
      { commentsCount: FieldValue.increment(-1) },
      { merge: true }
    );
  }
}

export async function toggleFavorite(userId: string, postId: string): Promise<{ favorited: boolean }> {
  const favId = `${userId}_${postId}`;
  const existing = await getContentDoc(FAVORITES, favId);
  if (existing) {
    await contentWriteCollection(FAVORITES).doc(favId).delete();
    return { favorited: false };
  }
  await contentWriteCollection(FAVORITES).doc(favId).set({
    userId,
    postId,
    createdAt: FieldValue.serverTimestamp(),
  });
  return { favorited: true };
}

export async function listUserFavorites(userId: string): Promise<string[]> {
  const snap = await contentWriteCollection(FAVORITES).where('userId', '==', userId).get();
  return snap.docs.map((doc) => String(doc.data().postId));
}

export async function ensureTagIds(names: string[]): Promise<{ ids: string[]; names: string[] }> {
  const cleaned = Array.from(
    new Set(names.map((n) => n.trim()).filter(Boolean))
  ).slice(0, 12);

  const ids: string[] = [];
  const outNames: string[] = [];

  for (const name of cleaned) {
    const slug = slugify(name);
    const existing = await contentWriteCollection(TAGS).where('slug', '==', slug).limit(1).get();
    if (!existing.empty) {
      ids.push(existing.docs[0].id);
      outNames.push(String(existing.docs[0].data().name || name));
      continue;
    }
    const ref = contentWriteCollection(TAGS).doc();
    await ref.set({
      name,
      slug,
      createdAt: FieldValue.serverTimestamp(),
    });
    ids.push(ref.id);
    outNames.push(name);
  }

  return { ids, names: outNames };
}

/** 公開標籤列表（依使用文章彙整；也可直接讀 blog_tags） */
export async function listBlogTags(options?: {
  publicOnly?: boolean;
  limit?: number;
}): Promise<BlogTag[]> {
  const fromCollection = await listContentDocs(TAGS, { limit: 200 });
  const bySlug = new Map<string, BlogTag>();

  for (const doc of fromCollection) {
    const name = String(doc.name || '').trim();
    const slug = String(doc.slug || slugify(name));
    if (!name || !slug) continue;
    bySlug.set(slug, { id: doc.id, name, slug });
  }

  // 從已發佈文章補齊標籤（即使尚未寫入 blog_tags）
  const posts = await listBlogPosts({
    publicOnly: options?.publicOnly !== false,
    limit: 200,
  });
  for (const post of posts) {
    (post.tagNames || []).forEach((name, idx) => {
      const cleaned = name.trim();
      if (!cleaned) return;
      const slug = slugify(cleaned);
      if (!bySlug.has(slug)) {
        bySlug.set(slug, {
          id: post.tagIds?.[idx] || slug,
          name: cleaned,
          slug,
        });
      }
    });
  }

  const tags = Array.from(bySlug.values());
  const limit = options?.limit && Number.isFinite(options.limit) ? options.limit : tags.length;
  return tags.slice(0, Math.max(0, limit));
}
