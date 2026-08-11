import { usePathname } from 'next/navigation';

/** 測驗／問卷作答或預覽、課程互動投影、線上文章編輯時：隱藏頂部 navbar（與側邊選單） */
export function useExamFocusMode(): boolean {
  const pathname = usePathname() ?? '';
  return (
    /^\/student\/exam\/[^/]+$/.test(pathname) ||
    /^\/student\/survey\/[^/]+$/.test(pathname) ||
    pathname === '/back-panel/teacher-exams/preview' ||
    pathname === '/back-panel/teacher-surveys/preview' ||
    pathname === '/back-panel/teacher-courses/preview' ||
    pathname.startsWith('/back-panel/teacher-courses/preview/') ||
    pathname === '/back-panel/teacher-courses/interact' ||
    pathname === '/back-panel/blog/edit' ||
    pathname.startsWith('/back-panel/blog/edit/')
  );
}
