'use client';

import GradesContent from './GradesContent';

export default function GradesPage() {
  // 這個頁面處理 /student/grades 基礎路徑
  // 我們不傳遞 courseCodeFromUrl，讓 StudentGradeViewer 顯示預設的課程選擇畫面
  return <GradesContent />;
}