'use client';

import { use } from 'react';
import BlogPostEditor from '@/components/BlogPostEditor';

export default function BlogPostEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <BlogPostEditor postId={id} />;
}
