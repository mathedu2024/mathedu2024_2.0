export type ArchivableCourse = {
  name?: string;
  status?: string;
  archived?: boolean | string;
};

export function isCourseArchived(course: ArchivableCourse): boolean {
  return (
    course.archived === true ||
    String(course.archived) === 'true' ||
    !!(course.status && String(course.status).includes('已封存')) ||
    !!(course.name && course.name.includes('已封存'))
  );
}
