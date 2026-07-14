export type CourseActivityType =
  | 'lesson'
  | 'announcement'
  | 'quiz'
  | 'survey'
  | 'quiz_pending_grade';

export interface CourseActivityItem {
  id: string;
  type: CourseActivityType;
  courseId: string;
  courseName: string;
  courseCode: string;
  title: string;
  at: string;
  href: string;
  message: string;
}

export function formatActivityDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}
