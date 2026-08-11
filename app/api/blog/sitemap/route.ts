import { NextResponse } from 'next/server';
import { listBlogPosts } from '@/services/blogService';

/** 公開部落格 sitemap（簡易 XML） */
export async function GET() {
  try {
    const posts = await listBlogPosts({ publicOnly: true, limit: 500 });
    const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://localhost:3000';
    const urls = [
      `<url><loc>${base}/blog</loc><changefreq>daily</changefreq><priority>0.8</priority></url>`,
      ...posts.map(
        (p) =>
          `<url><loc>${base}/blog/${encodeURIComponent(p.slug)}</loc>` +
          `<lastmod>${(p.publishedAt || new Date().toISOString()).slice(0, 10)}</lastmod>` +
          `<changefreq>weekly</changefreq><priority>0.6</priority></url>`
      ),
    ];

    const xml =
      `<?xml version="1.0" encoding="UTF-8"?>` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;

    return new NextResponse(xml, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8' },
    });
  } catch (error) {
    console.error('blog sitemap error:', error);
    return NextResponse.json({ error: 'sitemap error' }, { status: 500 });
  }
}
