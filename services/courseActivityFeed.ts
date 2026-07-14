import { adminDb } from '@/services/firebase-admin';
import { isCourseArchived } from '@/services/courseArchive';
import { getCourseCompositeKey } from '@/services/courseId';
import { quizService } from '@/services/quizService';
import { surveyService } from '@/services/surveyService';
import { quizSubmissionService } from '@/services/quizSubmissionService';
import {
  getQuizAnswerWindowPhase,
  normalizeAssignedCourses,
  type Quiz,
} from '@/services/quizTypes';
import {
  getSurveyAnswerWindowPhase,
  normalizeSingleAssignedCourse,
  type Survey,
} from '@/services/surveyTypes';
import {
  isQuizAssignedToCourse,
  isStudentEnrolledInQuiz,
} from '@/services/quizStudentView';
import { isStudentEnrolledInSurvey } from '@/services/surveyStudentView';
import { examDetailPath } from '@/utils/examRoutes';
import { teacherCourseHubPath } from '@/utils/teacherCourseHub';
import type { CourseActivityItem, CourseActivityType } from '@/services/courseActivityTypes';

export type { CourseActivityItem, CourseActivityType } from '@/services/courseActivityTypes';
export { formatActivityDateTime } from '@/services/courseActivityTypes';

export interface CourseActivityCourseRef {
  id: string;
  name: string;
  code: string;
  archived?: boolean;
  status?: string;
}

const FEED_LIMIT = 40;

function isVisibleToStudents(value: boolean | undefined | null): boolean {
  return value !== false;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') {
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      const d = (value as { toDate: () => Date }).toDate();
      return d.toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

function pickActivityAt(...candidates: Array<string | null | undefined>): string | null {
  for (const c of candidates) {
    if (!c) continue;
    const t = new Date(c).getTime();
    if (!Number.isNaN(t)) return new Date(t).toISOString();
  }
  return null;
}

/** 測驗／問卷：有作答期間則以開始時間為公告時間；尚未開始不進公告 */
function timedPublishAt(
  status: string,
  opts: {
    answerWindowEnabled?: boolean;
    answerStartAt?: string;
    publishedAt?: string;
    updatedAt?: string;
    createdAt?: string;
  },
  phase: 'open' | 'upcoming' | 'ended' | 'unlimited'
): string | null {
  if (status !== 'published') return null;
  if (phase === 'upcoming') return null;
  if (opts.answerWindowEnabled && opts.answerStartAt) {
    return pickActivityAt(opts.answerStartAt);
  }
  return pickActivityAt(opts.publishedAt, opts.updatedAt, opts.createdAt);
}

function studentLessonHref(courseCode: string): string {
  return `/student/courses/${encodeURIComponent(courseCode)}?tab=lessons`;
}

function studentAnnouncementHref(courseCode: string, annId: string): string {
  return `/student/courses/${encodeURIComponent(courseCode)}?tab=announcements&ann=${encodeURIComponent(annId)}`;
}

function studentExamHref(courseCode: string, examId: string): string {
  return `/student/courses/${encodeURIComponent(courseCode)}?tab=exams&exam=${encodeURIComponent(examId)}`;
}

function studentSurveyHref(courseCode: string, surveyId: string): string {
  return `/student/courses/${encodeURIComponent(courseCode)}?tab=surveys&survey=${encodeURIComponent(surveyId)}`;
}

function teacherLessonHref(courseCode: string): string {
  return teacherCourseHubPath(courseCode, 'lessons');
}

function teacherAnnouncementHref(courseCode: string, annId: string): string {
  const base = teacherCourseHubPath(courseCode, 'announcements');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}ann=${encodeURIComponent(annId)}`;
}

function teacherExamHref(courseCode: string, examId: string): string {
  const base = teacherCourseHubPath(courseCode, 'exams');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}exam=${encodeURIComponent(examId)}`;
}

function teacherSurveyHref(courseCode: string, surveyId: string): string {
  const base = teacherCourseHubPath(courseCode, 'surveys');
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}survey=${encodeURIComponent(surveyId)}`;
}

function formatMessage(
  type: CourseActivityType,
  courseName: string,
  title: string
): string {
  switch (type) {
    case 'lesson':
      return `${courseName}新增了一則課程內容「${title}」`;
    case 'announcement':
      return `${courseName}新增了一則課程公告「${title}」`;
    case 'quiz':
      return `${courseName}開始了線上測驗「${title}」`;
    case 'survey':
      return `${courseName}開始了課程問卷「${title}」`;
    case 'quiz_pending_grade':
      return `${courseName}的線上測驗「${title}」有簡答題待批改`;
    default:
      return `${courseName}「${title}」`;
  }
}

function resolveAssignedCourse(
  assigned: { courseId: string; courseName: string }[],
  coursesById: Map<string, CourseActivityCourseRef>
): CourseActivityCourseRef | null {
  for (const ref of assigned) {
    const byId = coursesById.get(ref.courseId);
    if (byId) return byId;
    for (const c of coursesById.values()) {
      if (
        isQuizAssignedToCourse([ref], { id: c.id, name: c.name, code: c.code })
      ) {
        return c;
      }
    }
  }
  return null;
}

async function loadCourseExtras(courses: CourseActivityCourseRef[]): Promise<{
  lessonsByCourse: Map<string, Array<{ id: string; title: string; at: string }>>;
  announcementsByCourse: Map<string, Array<{ id: string; title: string; at: string }>>;
}> {
  const lessonsByCourse = new Map<string, Array<{ id: string; title: string; at: string }>>();
  const announcementsByCourse = new Map<string, Array<{ id: string; title: string; at: string }>>();

  await Promise.all(
    courses.map(async (course) => {
      try {
        const [lessonsSnap, classDoc] = await Promise.all([
          adminDb.collection('courses').doc(course.id).collection('lessons').get(),
          adminDb.collection('courses').doc(course.id).collection('ClassData').doc('main').get(),
        ]);

        const lessons: Array<{ id: string; title: string; at: string }> = [];
        for (const doc of lessonsSnap.docs) {
          const data = doc.data();
          if (!isVisibleToStudents(data.visibleToStudents as boolean | undefined)) continue;
          const at = pickActivityAt(
            toIso(data.visiblePublishedAt),
            toIso(data.updatedAt),
            toIso(data.createdAt)
          );
          if (!at) continue;
          const title = String(data.title || data.name || '未命名內容');
          lessons.push({ id: doc.id, title, at });
        }
        lessonsByCourse.set(course.id, lessons);

        const classData = classDoc.exists ? classDoc.data() : null;
        const courseDoc = await adminDb.collection('courses').doc(course.id).get();
        const courseData = courseDoc.exists ? courseDoc.data() : null;
        const rawAnns = (classData?.announcements ?? courseData?.announcements ?? []) as Array<
          Record<string, unknown>
        >;
        const anns: Array<{ id: string; title: string; at: string }> = [];
        for (const ann of rawAnns) {
          if (!isVisibleToStudents(ann.visibleToStudents as boolean | undefined)) continue;
          const at = pickActivityAt(
            toIso(ann.visiblePublishedAt),
            toIso(ann.createdAt)
          );
          if (!at) continue;
          const id = String(ann.id ?? '');
          if (!id) continue;
          anns.push({ id, title: String(ann.title || '未命名公告'), at });
        }
        announcementsByCourse.set(course.id, anns);
      } catch {
        lessonsByCourse.set(course.id, []);
        announcementsByCourse.set(course.id, []);
      }
    })
  );

  return { lessonsByCourse, announcementsByCourse };
}

function buildContentItems(
  courses: CourseActivityCourseRef[],
  lessonsByCourse: Map<string, Array<{ id: string; title: string; at: string }>>,
  announcementsByCourse: Map<string, Array<{ id: string; title: string; at: string }>>,
  audience: 'student' | 'teacher'
): CourseActivityItem[] {
  const items: CourseActivityItem[] = [];

  for (const course of courses) {
    for (const lesson of lessonsByCourse.get(course.id) ?? []) {
      items.push({
        id: `lesson:${course.id}:${lesson.id}`,
        type: 'lesson',
        courseId: course.id,
        courseName: course.name,
        courseCode: course.code,
        title: lesson.title,
        at: lesson.at,
        href:
          audience === 'student'
            ? studentLessonHref(course.code)
            : teacherLessonHref(course.code),
        message: formatMessage('lesson', course.name, lesson.title),
      });
    }
    for (const ann of announcementsByCourse.get(course.id) ?? []) {
      items.push({
        id: `announcement:${course.id}:${ann.id}`,
        type: 'announcement',
        courseId: course.id,
        courseName: course.name,
        courseCode: course.code,
        title: ann.title,
        at: ann.at,
        href:
          audience === 'student'
            ? studentAnnouncementHref(course.code, ann.id)
            : teacherAnnouncementHref(course.code, ann.id),
        message: formatMessage('announcement', course.name, ann.title),
      });
    }
  }

  return items;
}

function buildQuizSurveyItems(
  courses: CourseActivityCourseRef[],
  quizzes: Quiz[],
  surveys: Survey[],
  audience: 'student' | 'teacher',
  enrolledKeys?: string[]
): CourseActivityItem[] {
  const coursesById = new Map(courses.map((c) => [c.id, c]));
  const items: CourseActivityItem[] = [];

  for (const quiz of quizzes) {
    if (quiz.status !== 'published') continue;
    if (audience === 'student' && enrolledKeys && !isStudentEnrolledInQuiz(quiz, enrolledKeys)) {
      continue;
    }
    const phase = getQuizAnswerWindowPhase(quiz);
    const at = timedPublishAt(quiz.status, quiz, phase);
    if (!at) continue;

    const assigned = normalizeAssignedCourses(quiz);
    const course = resolveAssignedCourse(assigned, coursesById);
    if (!course) continue;
    if (audience === 'student') {
      const matched = courses.some((c) =>
        isQuizAssignedToCourse(assigned, { id: c.id, name: c.name, code: c.code })
      );
      if (!matched) continue;
    }

    items.push({
      id: `quiz:${quiz.id}`,
      type: 'quiz',
      courseId: course.id,
      courseName: course.name,
      courseCode: course.code,
      title: quiz.title,
      at,
      href:
        audience === 'student'
          ? studentExamHref(course.code, quiz.id)
          : teacherExamHref(course.code, quiz.id),
      message: formatMessage('quiz', course.name, quiz.title),
    });
  }

  for (const survey of surveys) {
    if (survey.status !== 'published') continue;
    if (audience === 'student' && enrolledKeys && !isStudentEnrolledInSurvey(survey, enrolledKeys)) {
      continue;
    }
    const phase = getSurveyAnswerWindowPhase(survey);
    const at = timedPublishAt(survey.status, survey, phase);
    if (!at) continue;

    const assigned = normalizeSingleAssignedCourse(survey);
    const course = resolveAssignedCourse(assigned, coursesById);
    if (!course) continue;

    items.push({
      id: `survey:${survey.id}`,
      type: 'survey',
      courseId: course.id,
      courseName: course.name,
      courseCode: course.code,
      title: survey.title,
      at,
      href:
        audience === 'student'
          ? studentSurveyHref(course.code, survey.id)
          : teacherSurveyHref(course.code, survey.id),
      message: formatMessage('survey', course.name, survey.title),
    });
  }

  return items;
}

function sortAndLimit(items: CourseActivityItem[]): CourseActivityItem[] {
  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, FEED_LIMIT);
}

export async function buildStudentActivityFeed(
  _studentId: string,
  enrolledCourses: string[],
  courses: CourseActivityCourseRef[]
): Promise<CourseActivityItem[]> {
  const activeCourses = courses.filter(
    (c) =>
      !isCourseArchived({ archived: c.archived, status: c.status, name: c.name })
  );
  if (activeCourses.length === 0) return [];

  const enrolledKeys = [
    ...enrolledCourses,
    ...activeCourses.flatMap((c) => [
      c.id,
      c.code ? getCourseCompositeKey(c.name, c.code) : '',
    ]),
  ].filter(Boolean);

  const [{ lessonsByCourse, announcementsByCourse }, quizzes, surveys] = await Promise.all([
    loadCourseExtras(activeCourses),
    quizService.listPublished(),
    surveyService.listPublished(),
  ]);

  const items: CourseActivityItem[] = [
    ...buildContentItems(activeCourses, lessonsByCourse, announcementsByCourse, 'student'),
    ...buildQuizSurveyItems(activeCourses, quizzes, surveys, 'student', enrolledKeys),
  ];

  return sortAndLimit(items);
}

export async function buildTeacherActivityFeed(
  teacherId: string,
  courses: CourseActivityCourseRef[]
): Promise<CourseActivityItem[]> {
  const activeCourses = courses.filter(
    (c) =>
      !isCourseArchived({ archived: c.archived, status: c.status, name: c.name })
  );
  if (activeCourses.length === 0) return [];

  const [{ lessonsByCourse, announcementsByCourse }, quizzes, surveys] = await Promise.all([
    loadCourseExtras(activeCourses),
    quizService.listAccessibleByTeacher(teacherId),
    surveyService.listAccessibleByTeacher(teacherId),
  ]);

  const publishedQuizzes = quizzes.filter((q) => q.status === 'published');
  const publishedSurveys = surveys.filter((s) => s.status === 'published');

  const items: CourseActivityItem[] = [
    ...buildContentItems(activeCourses, lessonsByCourse, announcementsByCourse, 'teacher'),
    ...buildQuizSurveyItems(activeCourses, publishedQuizzes, publishedSurveys, 'teacher'),
  ];

  const coursesById = new Map(activeCourses.map((c) => [c.id, c]));
  const quizzesWithShortAnswer = publishedQuizzes.filter((quiz) =>
    quiz.sections.some((sec) =>
      sec.questions.some(
        (q) =>
          q.type === 'short_answer' ||
          (q.type === 'group' &&
            'subQuestions' in q &&
            q.subQuestions.some((sq) => sq.type === 'short_answer'))
      )
    )
  );

  await Promise.all(
    quizzesWithShortAnswer.map(async (quiz) => {
      try {
        const submissions = await quizSubmissionService.listSubmissionsForFeed(quiz.id);
        const pending = submissions.filter(
          (s) =>
            s.status === 'grading' ||
            s.answers.some((a) => a.gradingStatus === 'pending' && a.questionType === 'short_answer')
        );
        if (pending.length === 0) return;

        const latest = pending
          .map((s) => s.submittedAt)
          .filter(Boolean)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
        const at = pickActivityAt(latest, quiz.updatedAt, quiz.createdAt);
        if (!at) return;

        const assigned = normalizeAssignedCourses(quiz);
        const course = resolveAssignedCourse(assigned, coursesById);
        if (!course) return;

        const returnTo = teacherCourseHubPath(course.code, 'exams');
        items.push({
          id: `quiz_pending_grade:${quiz.id}`,
          type: 'quiz_pending_grade',
          courseId: course.id,
          courseName: course.name,
          courseCode: course.code,
          title: quiz.title,
          at,
          href: examDetailPath(quiz.quizCode, 'grading', returnTo),
          message: formatMessage('quiz_pending_grade', course.name, quiz.title),
        });
      } catch {
        // ignore per-quiz failures
      }
    })
  );

  return sortAndLimit(items);
}
