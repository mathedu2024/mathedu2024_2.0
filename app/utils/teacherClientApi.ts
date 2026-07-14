import { fetchCached, invalidateFetchCache } from './clientFetchCache';
import type { Quiz } from '@/services/quizTypes';
import type { QuizGradingOverview } from '@/services/quizSubmissionService';
import type { QuizAnalytics } from '@/services/quizSubmissionTypes';
import type { Survey } from '@/services/surveyTypes';

export async function fetchTeacherProfile(account: string): Promise<Record<string, unknown>> {
  return fetchCached(`teacher-profile:${account}`, async () => {
    const res = await fetch('/api/teacher/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account }),
    });
    if (!res.ok) throw new Error('teacher profile fetch failed');
    return res.json();
  });
}

export async function fetchAdminStats(): Promise<{
  studentCount: number;
  teacherCount: number;
  courseCount: number;
}> {
  return fetchCached('admin-stats', async () => {
    const res = await fetch('/api/admin/stats', { credentials: 'same-origin' });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`admin stats fetch failed (${res.status})${detail ? `: ${detail.slice(0, 120)}` : ''}`);
    }
    return res.json();
  }, 60_000);
}

export interface AdminTeacherRow {
  id: string;
  name: string;
  account: string;
  password: string;
  roles: ('admin' | 'teacher')[];
  note?: string;
}

export async function fetchAdminList(): Promise<AdminTeacherRow[]> {
  return fetchCached('admin-list', async () => {
    const res = await fetch('/api/admin/list');
    if (!res.ok) throw new Error('admin list fetch failed');
    return res.json();
  });
}

export function invalidateAdminList(): void {
  invalidateFetchCache('admin-list');
}

export async function fetchTeacherCourseNames(account: string): Promise<string[]> {
  return fetchCached(`teacher-course-names:${account}`, async () => {
    const res = await fetch('/api/teacher/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.courses || []).map((str: string) => {
      const match = str.match(/(.+?)\(([^)]*\))$/);
      return match ? match[1] : str;
    });
  });
}

export async function fetchCoursesByTeacherId<T = unknown>(teacherId: string): Promise<T[]> {
  return fetchCached(`courses-by-teacher:${teacherId}`, async () => {
    const res = await fetch('/api/courses/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId }),
    });
    if (!res.ok) throw new Error('courses list fetch failed');
    return res.json();
  });
}

export async function fetchAdminCoursesList<T = unknown>(): Promise<T[]> {
  return fetchCached('admin-courses-list', async () => {
    const res = await fetch('/api/courses/list', { method: 'GET' });
    if (!res.ok) throw new Error('admin courses fetch failed');
    return res.json();
  });
}

export function invalidateTeacherCourses(teacherId: string, account?: string): void {
  invalidateFetchCache(`courses-by-teacher:${teacherId}`);
  if (account) invalidateFetchCache(`teacher-course-names:${account}`);
  invalidateFetchCache('admin-courses-list');
}

/** 管理員異動課程後，清除所有教師／管理員課程清單快取 */
export function invalidateAdminCoursesList(): void {
  invalidateFetchCache('admin-courses-list');
  invalidateFetchCache('courses-by-teacher');
}

export async function fetchTeacherQuizzes(teacherId: string): Promise<Quiz[]> {
  return fetchCached(`quizzes-list:${teacherId}`, async () => {
    const res = await fetch('/api/quizzes/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId }),
    });
    if (!res.ok) throw new Error('quizzes list fetch failed');
    const data = await res.json();
    return (data.quizzes ?? []) as Quiz[];
  }, 15_000);
}

export function invalidateTeacherQuizzes(teacherId: string): void {
  invalidateFetchCache(`quizzes-list:${teacherId}`);
}

/** 教師端課堂列表（含隱藏課堂；快取與學生端分離） */
export async function fetchTeacherCourseLessons(courseId: string): Promise<unknown[]> {
  return fetchCached(
    `course-lessons:teacher:${courseId}`,
    async () => {
      const res = await fetch('/api/courses/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });
      if (!res.ok) throw new Error('lessons list fetch failed');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    10_000
  );
}

export function invalidateTeacherCourseLessons(courseId: string): void {
  invalidateFetchCache(`course-lessons:teacher:${courseId}`);
  invalidateFetchCache(`course-lessons:student:${courseId}`);
}

export async function fetchQuizByCode(quizCode: string): Promise<Quiz> {
  return fetchCached(`quiz-get:${quizCode}`, async () => {
    const res = await fetch('/api/quizzes/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizCode }),
    });
    if (!res.ok) throw new Error('quiz get failed');
    const data = await res.json();
    return data.quiz as Quiz;
  }, 10_000);
}

export function invalidateQuizByCode(quizCode: string): void {
  invalidateFetchCache(`quiz-get:${quizCode}`);
}

export async function fetchQuizGradingOverview(
  quizId: string,
  teacherId: string,
  courseScope = 'all'
): Promise<QuizGradingOverview | null> {
  return fetchCached(`quiz-grading-overview:${quizId}:${teacherId}:${courseScope}`, async () => {
    const res = await fetch('/api/quiz-submissions/overview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId, teacherId, courseScope }),
    });
    if (!res.ok) throw new Error('grading overview fetch failed');
    const data = await res.json();
    return (data.overview ?? null) as QuizGradingOverview | null;
  }, 15_000);
}

export function invalidateQuizGradingOverview(
  quizId: string,
  teacherId: string,
  courseScope = 'all'
): void {
  invalidateFetchCache(`quiz-grading-overview:${quizId}:${teacherId}:${courseScope}`);
}

export async function fetchQuizAnalytics(
  quizId: string,
  teacherId: string,
  courseScope = 'all'
): Promise<QuizAnalytics | null> {
  return fetchCached(`quiz-analytics:${quizId}:${teacherId}:${courseScope}`, async () => {
    const res = await fetch('/api/quiz-submissions/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quizId, teacherId, courseScope }),
    });
    if (!res.ok) throw new Error('quiz analytics fetch failed');
    const data = await res.json();
    return (data.analytics ?? null) as QuizAnalytics | null;
  }, 15_000);
}

export function invalidateQuizAnalytics(
  quizId: string,
  teacherId: string,
  courseScope = 'all'
): void {
  invalidateFetchCache(`quiz-analytics:${quizId}:${teacherId}:${courseScope}`);
}

export async function fetchTeacherSurveys(teacherId: string): Promise<Survey[]> {
  return fetchCached(`surveys-list:${teacherId}`, async () => {
    const res = await fetch('/api/surveys/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teacherId }),
    });
    if (!res.ok) throw new Error('surveys list fetch failed');
    const data = await res.json();
    return (data.surveys ?? []) as Survey[];
  }, 15_000);
}

export function invalidateTeacherSurveys(teacherId: string): void {
  invalidateFetchCache(`surveys-list:${teacherId}`);
}

export async function fetchSurveyByCode(surveyCode: string): Promise<Survey> {
  return fetchCached(`survey-get:${surveyCode}`, async () => {
    const res = await fetch('/api/surveys/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ surveyCode }),
    });
    if (!res.ok) throw new Error('survey get failed');
    const data = await res.json();
    return data.survey as Survey;
  }, 10_000);
}

export function invalidateSurveyByCode(surveyCode: string): void {
  invalidateFetchCache(`survey-get:${surveyCode}`);
}

export async function fetchExamDatesList<T = unknown>(): Promise<T[]> {
  return fetchCached('exam-dates-list', async () => {
    const res = await fetch('/api/exam-dates/list');
    if (!res.ok) throw new Error('exam dates fetch failed');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  }, 60_000);
}

export function invalidateExamDatesList(): void {
  invalidateFetchCache('exam-dates-list');
}

export async function fetchStudentList<T = unknown>(): Promise<T[]> {
  return fetchCached('student-list', async () => {
    const res = await fetch('/api/student/list');
    if (!res.ok) throw new Error(`student list fetch failed (${res.status})`);
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  });
}

export function invalidateStudentList(): void {
  invalidateFetchCache('student-list');
}

export async function fetchTeacherList<T = unknown>(): Promise<T[]> {
  return fetchCached('teacher-list', async () => {
    const res = await fetch('/api/teacher/list', {
      headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    });
    if (!res.ok) throw new Error('teacher list fetch failed');
    return res.json();
  });
}

export function invalidateTeacherList(): void {
  invalidateFetchCache('teacher-list');
}
