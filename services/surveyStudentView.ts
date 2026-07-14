import {
  extractAssignedCourseIds,
  getSurveyAnswerWindowPhase,
  normalizeAssignedCourses,
  type Survey,
} from './surveyTypes';

export function isSurveyAccessibleToStudent(
  survey: Survey,
  enrolledCourseIds: string[]
): { ok: boolean; reason?: string } {
  if (survey.status !== 'published') {
    return { ok: false, reason: '問卷尚未開放' };
  }

  const assignedIds = extractAssignedCourseIds(survey);
  const enrolled = assignedIds.some((id) => enrolledCourseIds.includes(id));
  if (!enrolled) {
    return { ok: false, reason: '您未修習此問卷所屬課程' };
  }

  const phase = getSurveyAnswerWindowPhase(survey);
  if (phase === 'upcoming') {
    return { ok: false, reason: '填答期間尚未開始' };
  }
  if (phase === 'ended') {
    return { ok: false, reason: '填答期間已截止' };
  }

  return { ok: true };
}

export function isStudentEnrolledInSurvey(survey: Survey, enrolledCourseIds: string[]): boolean {
  const assignedIds = extractAssignedCourseIds(survey);
  return assignedIds.some((id) => enrolledCourseIds.includes(id));
}

export function isSurveyAssignedToCourseRef(
  survey: Survey,
  course: { id?: string; code?: string; name?: string }
): boolean {
  const assigned = normalizeAssignedCourses(survey);
  return assigned.some(
    (c) =>
      (course.id && c.courseId === course.id) ||
      (course.code && (c.courseId === course.code || c.courseName.includes(course.code))) ||
      (course.name && c.courseName.includes(course.name))
  );
}
