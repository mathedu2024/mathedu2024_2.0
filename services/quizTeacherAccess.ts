import { adminDb } from './firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';
import { enrolledKeyMatchesCourse, type CourseRefTarget } from './courseId';
import { normalizeAssignedCourses, type Quiz, type QuizCourseRef } from './quizTypes';
import type { QuizRosterStudent } from './quizRosterService';

export interface TeacherCourseRecord extends CourseRefTarget {}

export interface QuizAccessContext {
  quiz: Quiz;
  isCreator: boolean;
  accessibleCourses: QuizCourseRef[];
  teacherCourses: TeacherCourseRecord[];
}

export type QuizCourseScope = 'all' | string;

export interface QuizCourseScopeOption {
  id: QuizCourseScope;
  label: string;
}

const teacherCoursesCache = new Map<string, { at: number; courses: TeacherCourseRecord[] }>();
const CACHE_TTL_MS = 30_000;

export async function getTeacherCourseRecords(teacherId: string): Promise<TeacherCourseRecord[]> {
  const cached = teacherCoursesCache.get(teacherId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return cached.courses;
  }

  const snapshot = await adminDb.collection('courses').get();
  const courses: TeacherCourseRecord[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const teachers = Array.isArray(data.teachers) ? (data.teachers as string[]) : [];
    if (!teachers.includes(teacherId)) continue;
    courses.push({
      id: doc.id,
      name: String(data.name ?? ''),
      code: String(data.code ?? ''),
    });
  }

  teacherCoursesCache.set(teacherId, { at: Date.now(), courses });
  return courses;
}

export function assignedCourseMatchesTeacher(
  assignedCourseId: string,
  teacherCourses: TeacherCourseRecord[]
): TeacherCourseRecord | null {
  for (const course of teacherCourses) {
    if (enrolledKeyMatchesCourse(assignedCourseId, course)) return course;
  }
  return null;
}

export function getAccessibleAssignedCourses(
  quiz: Quiz,
  teacherId: string,
  teacherCourses: TeacherCourseRecord[]
): QuizCourseRef[] {
  const assigned = normalizeAssignedCourses(quiz);
  if (quiz.teacherId === teacherId) return assigned;
  return assigned.filter((ref) => assignedCourseMatchesTeacher(ref.courseId, teacherCourses));
}

export function canTeacherAccessQuiz(
  quiz: Quiz,
  teacherId: string,
  teacherCourses: TeacherCourseRecord[]
): boolean {
  if (quiz.teacherId === teacherId) return true;
  return getAccessibleAssignedCourses(quiz, teacherId, teacherCourses).length > 0;
}

export function canTeacherManageQuiz(
  quiz: Quiz,
  teacherId: string,
  teacherCourses: TeacherCourseRecord[]
): boolean {
  return canTeacherAccessQuiz(quiz, teacherId, teacherCourses);
}

/** 僅建立者可編輯題目與測驗設定 */
export function canTeacherEditQuiz(quiz: Quiz, teacherId: string): boolean {
  return quiz.teacherId === teacherId;
}

export function canTeacherDeleteQuiz(quiz: Quiz, teacherId: string): boolean {
  return quiz.teacherId === teacherId;
}

export async function resolveTeacherNamesByIds(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const batchSize = 10;
  for (let i = 0; i < unique.length; i += batchSize) {
    const batch = unique.slice(i, i + batchSize);
    const snap = await adminDb.collection('users').where(FieldPath.documentId(), 'in', batch).get();
    for (const doc of snap.docs) {
      map.set(doc.id, String(doc.data().name ?? doc.id));
    }
  }
  return map;
}

export function buildQuizCourseScopeOptions(
  accessibleCourses: QuizCourseRef[],
  isCreator: boolean
): QuizCourseScopeOption[] {
  const options: QuizCourseScopeOption[] = accessibleCourses.map((course) => ({
    id: course.courseId,
    label: course.courseName || course.courseId,
  }));
  if (isCreator && accessibleCourses.length > 1) {
    return [{ id: 'all', label: '全部學生' }, ...options];
  }
  return options;
}

export function resolveScopeCourseIds(
  accessibleCourses: QuizCourseRef[],
  courseScope: QuizCourseScope
): string[] {
  if (courseScope === 'all') {
    return accessibleCourses.map((c) => c.courseId);
  }
  const match = accessibleCourses.find((c) => c.courseId === courseScope);
  return match ? [match.courseId] : [];
}

export function rosterStudentMatchesCourseScope(
  student: QuizRosterStudent,
  scopeCourseIds: string[],
  teacherCourses: TeacherCourseRecord[]
): boolean {
  if (scopeCourseIds.length === 0) return false;
  return student.courseIds.some((studentCourseId) =>
    scopeCourseIds.some((scopeId) => {
      if (studentCourseId === scopeId) return true;
      const scopeCourse = teacherCourses.find(
        (c) => c.id === scopeId || enrolledKeyMatchesCourse(scopeId, c)
      );
      if (!scopeCourse) return false;
      return enrolledKeyMatchesCourse(studentCourseId, scopeCourse);
    })
  );
}

export function filterRosterByCourseScope(
  roster: QuizRosterStudent[],
  scopeCourseIds: string[],
  teacherCourses: TeacherCourseRecord[]
): QuizRosterStudent[] {
  return roster.filter((student) =>
    rosterStudentMatchesCourseScope(student, scopeCourseIds, teacherCourses)
  );
}

export function extractAssignedCourseIds(quiz: Pick<Quiz, 'assignedCourses' | 'courseId'>): string[] {
  return normalizeAssignedCourses(quiz).map((c) => c.courseId);
}

export async function buildQuizAccessContext(
  quiz: Quiz,
  teacherId: string
): Promise<QuizAccessContext | null> {
  const teacherCourses = await getTeacherCourseRecords(teacherId);
  if (!canTeacherAccessQuiz(quiz, teacherId, teacherCourses)) return null;
  return {
    quiz,
    isCreator: quiz.teacherId === teacherId,
    accessibleCourses: getAccessibleAssignedCourses(quiz, teacherId, teacherCourses),
    teacherCourses,
  };
}
