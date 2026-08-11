'use client';

import { usePathname } from 'next/navigation';
import BackPanelPage from './BackPanelPage';

/** 預覽／上課互動／文章編輯頁需渲染對應 page.tsx，不可被 BackPanelPage 吃掉 children */
const PREVIEW_PATHS = new Set([
  '/back-panel/teacher-exams/preview',
  '/back-panel/teacher-surveys/preview',
  '/back-panel/teacher-courses/preview',
  '/back-panel/teacher-courses/preview/lesson',
  '/back-panel/teacher-courses/interact',
  '/back-panel/blog/edit',
]);

function isChromeFreeBackPanelPath(pathname: string) {
  return (
    PREVIEW_PATHS.has(pathname) || pathname.startsWith('/back-panel/blog/edit/')
  );
}

export default function BackPanelLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  if (isChromeFreeBackPanelPath(pathname)) {
    return <>{children}</>;
  }
  return <BackPanelPage />;
}
