/** 老師端：以新分頁開啟課程互動（上課投影用） */

export function buildTeacherCourseInteractPath(courseCode: string): string {
  return `/back-panel/teacher-courses/interact?code=${encodeURIComponent(courseCode)}`;
}

export function openTeacherCourseInteractInNewTab(courseCode: string): void {
  const url = buildTeacherCourseInteractPath(courseCode);
  const win = window.open(url, '_blank');
  if (!win) {
    throw new Error('瀏覽器封鎖了新分頁，請允許此網站開啟彈出式視窗');
  }
}
