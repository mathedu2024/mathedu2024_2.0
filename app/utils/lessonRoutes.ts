import { teacherCourseHubPath, withReturnTo } from './teacherCourseHub';

export type LessonContentType = 'video' | 'material' | 'quiz' | 'homework' | 'examScope' | 'notes';

/** 老師端課堂編輯／新增路徑（掛在課程 Hub 下） */
export function teacherLessonEditPath(
  courseCode: string,
  lessonId: string,
  returnTo?: string | null,
  options?: { contentType?: LessonContentType }
): string {
  const base = `/back-panel/teacher-courses/${encodeURIComponent(courseCode)}/lessons/${encodeURIComponent(lessonId)}`;
  let path = withReturnTo(base, returnTo);
  if (options?.contentType) {
    const sep = path.includes('?') ? '&' : '?';
    path = `${path}${sep}contentType=${encodeURIComponent(options.contentType)}`;
  }
  return path;
}

export function teacherLessonCreatePath(
  courseCode: string,
  returnTo?: string | null,
  options?: { contentType?: LessonContentType }
): string {
  return teacherLessonEditPath(
    courseCode,
    'new',
    returnTo ?? teacherCourseHubPath(courseCode, 'lessons'),
    options
  );
}
