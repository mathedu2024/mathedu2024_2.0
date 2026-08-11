import { teacherCourseHubPath, withReturnTo } from './teacherCourseHub';

/** 老師端課程公告編輯／新增路徑（掛在課程 Hub 下） */
export function teacherAnnouncementEditPath(
  courseCode: string,
  announcementId: string,
  returnTo?: string | null
): string {
  const base = `/back-panel/teacher-courses/${encodeURIComponent(courseCode)}/announcements/${encodeURIComponent(announcementId)}`;
  return withReturnTo(base, returnTo);
}

export function teacherAnnouncementCreatePath(
  courseCode: string,
  returnTo?: string | null
): string {
  return teacherAnnouncementEditPath(
    courseCode,
    'new',
    returnTo ?? teacherCourseHubPath(courseCode, 'announcements')
  );
}
