export const BLOG_POST_STATUSES = ['draft', 'published', 'scheduled', 'unlisted'] as const;
export type BlogPostStatus = (typeof BLOG_POST_STATUSES)[number];

export const BLOG_CONTENT_FORMATS = ['html', 'markdown'] as const;
export type BlogContentFormat = (typeof BLOG_CONTENT_FORMATS)[number];

export interface BlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string | null;
  order?: number;
  /** 下一個可分配給文章的主題內編號 */
  nextTopicNumber?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BlogTag {
  id: string;
  name: string;
  slug: string;
  createdAt?: unknown;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  contentFormat: BlogContentFormat;
  coverImage?: string;
  categoryId?: string;
  categorySlug?: string;
  categoryName?: string;
  /** 歸入主題後的主題內編號（例如 1、2、3） */
  topicNumber?: number | null;
  tagIds?: string[];
  tagNames?: string[];
  status: BlogPostStatus;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  viewsCount: number;
  commentsCount?: number;
  readingMinutes?: number;
  seoTitle?: string;
  seoDescription?: string;
  ogImage?: string;
  relatedCourseIds?: string[];
  relatedResourceIds?: string[];
  authorId: string;
  authorName: string;
  featured?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BlogComment {
  id: string;
  postId: string;
  postTitle?: string;
  userId: string;
  userName: string;
  content: string;
  parentId?: string | null;
  isApproved: boolean;
  isPinned?: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface BlogFavorite {
  id: string;
  userId: string;
  postId: string;
  createdAt?: unknown;
}

/** 輸入框用：可清空，不強制產生後備 slug */
export function sanitizeSlugInput(input: string): string {
  return input
    .replace(/[\s_]+/g, '-')
    .replace(/[^\u4e00-\u9fffA-Za-z0-9-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/[A-Z]/g, (c) => c.toLowerCase())
    .slice(0, 80);
}

/** 網址 slug：直接保留中文，空白改連字號；空值才產生後備 */
export function slugify(input: string): string {
  const s = sanitizeSlugInput(input).replace(/^-|-$/g, '');
  return s || `文章-${Date.now()}`;
}

/**
 * 文章網址：中文標題 → base64url（英文亂碼風格），供 /blog/{slug}
 * 例：三角函數觀念整理 → 5LiJ6KeS5Ye95pWw6KeE5b-15pW05a6a
 */
export function titleToBlogSlug(title: string): string {
  const raw = title.trim() || `post-${Date.now()}`;
  const encoded =
    typeof Buffer !== 'undefined'
      ? Buffer.from(raw, 'utf8').toString('base64url')
      : btoa(unescape(encodeURIComponent(raw)))
          .replace(/\+/g, '-')
          .replace(/\//g, '_')
          .replace(/=+$/g, '');
  return encoded.slice(0, 64) || `post-${Date.now()}`;
}

export function formatTopicNumber(n?: number | null): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return '—';
  return String(Math.floor(n)).padStart(3, '0');
}

/** public/線上文章封面 內兩張預設圖，依主題輪流固定使用 */
export const BLOG_DEFAULT_COVER_IMAGES = [
  encodeURI('/線上文章封面/1.png'),
  encodeURI('/線上文章封面/2.png'),
] as const;

/** 同一主題永遠對應同一張預設封面（兩張圖依 categoryId 輪流） */
export function defaultBlogCoverForCategory(categoryId?: string | null): string {
  const id = (categoryId || '').trim();
  if (!id) return BLOG_DEFAULT_COVER_IMAGES[0];
  let sum = 0;
  for (let i = 0; i < id.length; i += 1) sum += id.charCodeAt(i);
  return BLOG_DEFAULT_COVER_IMAGES[sum % BLOG_DEFAULT_COVER_IMAGES.length];
}

/** 有自訂封面用自訂；否則用該主題預設封面 */
export function resolveBlogCoverImage(post: {
  coverImage?: string | null;
  categoryId?: string | null;
}): string {
  const custom = (post.coverImage || '').trim();
  if (custom) return custom;
  return defaultBlogCoverForCategory(post.categoryId);
}

export function estimateReadingMinutes(content: string): number {
  const plain = content
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~\-\[\]\(\)!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const chars = plain.length;
  // 中文約 300 字／分鐘
  return Math.max(1, Math.ceil(chars / 300));
}

