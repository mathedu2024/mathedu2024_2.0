/** 老師端：以新分頁開啟學生端課程預覽 */

export function buildTeacherCoursePreviewPath(courseCode: string, tab?: string): string {
  const base = `/back-panel/teacher-courses/preview?code=${encodeURIComponent(courseCode)}`;
  if (tab && tab !== 'info') {
    return `${base}&tab=${encodeURIComponent(tab)}`;
  }
  return base;
}

/** 與學生端相同：以新分頁開啟學生端課程畫面 */
export function openTeacherCoursePreviewInNewTab(courseCode: string): void {
  const url = buildTeacherCoursePreviewPath(courseCode);
  const win = window.open(url, '_blank');
  if (!win) {
    throw new Error('瀏覽器封鎖了新分頁，請允許此網站開啟彈出式視窗');
  }
}
