import { fetchCached, invalidateFetchCache } from './clientFetchCache';
import { clearSession } from './session';

export class StudentApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'StudentApiError';
    this.status = status;
  }
}

/** Cookie 失效時徹底清除工作階段並通知 UI */
function notifyStudentSessionInvalid(): void {
  if (typeof window === 'undefined') return;
  clearSession();
  void fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}

const STUDENT_DASHBOARD_CACHE_PREFIX = 'student-dashboard-v3';

export function invalidateStudentClientCache(studentId?: string): void {
  if (studentId) {
    invalidateFetchCache(`student-profile:${studentId}`);
    invalidateFetchCache(`student-dashboard:${studentId}`);
    invalidateFetchCache(`${STUDENT_DASHBOARD_CACHE_PREFIX}:${studentId}`);
    invalidateFetchCache(`student-exams-list:${studentId}`);
    invalidateFetchCache(`student-surveys-list:${studentId}`);
    return;
  }
  invalidateFetchCache('student-profile');
  invalidateFetchCache('student-dashboard');
  invalidateFetchCache(STUDENT_DASHBOARD_CACHE_PREFIX);
  invalidateFetchCache('student-exams-list');
  invalidateFetchCache('student-surveys-list');
}

export async function fetchStudentProfile(studentId: string): Promise<Record<string, unknown>> {
  return fetchCached(`student-profile:${studentId}`, async () => {
    const res = await fetch('/api/student/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: studentId }),
    });
    if (!res.ok) {
      invalidateFetchCache(`student-profile:${studentId}`);
      if (res.status === 401 || res.status === 403) {
        notifyStudentSessionInvalid();
        throw new StudentApiError('student session invalid', res.status);
      }
      throw new Error(`profile fetch failed (${res.status})`);
    }
    return res.json();
  });
}

/** 學生儀表板 API 回傳的課程摘要 */
export interface StudentDashboardCourse {
  id: string;
  name: string;
  code: string;
  status: string;
  archived?: boolean;
  gradeTags?: string[];
  subjectTag?: string;
  startDate?: string;
  endDate?: string;
  teachers?: string[];
  teacherName?: string;
  description?: string;
  teachingMethod?: string;
  courseNature?: string;
  location?: string;
  liveStreamURL?: string;
  coverImageURL?: string;
  classTimes?: unknown[];
  customLinks?: unknown[];
  announcements?: unknown[];
}

export interface StudentDashboardData {
  courses?: StudentDashboardCourse[];
}

export async function fetchStudentDashboardData(
  studentId: string,
  options?: { coursesOnly?: boolean }
): Promise<StudentDashboardData> {
  const coursesOnly = options?.coursesOnly === true;
  const cacheKey = `${STUDENT_DASHBOARD_CACHE_PREFIX}:${studentId}:${coursesOnly ? 'courses' : 'full'}`;
  return fetchCached(cacheKey, async () => {
    const res = await fetch('/api/student/dashboard-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, coursesOnly }),
    });
    if (!res.ok) {
      invalidateFetchCache(`${STUDENT_DASHBOARD_CACHE_PREFIX}:${studentId}`);
      invalidateFetchCache(`student-dashboard:${studentId}`);
      if (res.status === 401 || res.status === 403) {
        notifyStudentSessionInvalid();
        throw new StudentApiError('student session invalid', res.status);
      }
      throw new Error('dashboard fetch failed');
    }
    return res.json() as Promise<StudentDashboardData>;
  });
}

export interface StudentExamAttemptSummary {
  id: string;
  attemptIndex: number;
  submittedAt: string;
  totalScore: number | null;
  status: string;
}

export interface StudentExamListItem {
  id: string;
  quizCode: string;
  title: string;
  totalPoints: number;
  timeLimitLabel: string;
  answerWindowLabel: string;
  attemptLimitLabel: string;
  attemptUnlimited: boolean;
  maxAttempts: number | null;
  submissionCount: number;
  accessible: boolean;
  inaccessibleReason?: string;
  submitted: boolean;
  canRetake: boolean;
  resultsPublished: boolean;
  submissionStatus: string | null;
  submissionScore: number | null;
  scorePolicy?: string;
  multipleAttempts?: boolean;
  latestSubmissionId?: string | null;
  windowPhase?: 'open' | 'upcoming' | 'ended' | 'unlimited';
  windowEnded?: boolean;
  attempts?: StudentExamAttemptSummary[];
  examLockEnabled?: boolean;
  requireFullscreen?: boolean;
  assignedCourses?: { courseId: string; courseName: string }[];
  order?: number;
  createdAt?: string;
}

export async function fetchStudentExamList(
  studentId: string,
  options?: { courseId?: string; courseName?: string; courseCode?: string }
): Promise<StudentExamListItem[]> {
  const courseId = options?.courseId?.trim() || '';
  const cacheKey = courseId
    ? `student-exams-list:${studentId}:course:${courseId}`
    : `student-exams-list:${studentId}`;

  return fetchCached(
    cacheKey,
    async () => {
      const res = await fetch('/api/student/exams/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: courseId || undefined,
          courseName: options?.courseName,
          courseCode: options?.courseCode,
        }),
      });
      if (!res.ok) throw new Error('exam list fetch failed');
      const data = await res.json();
      return (data.exams ?? []) as StudentExamListItem[];
    },
    15_000
  );
}

export interface StudentSurveyAttemptSummary {
  id: string;
  attemptIndex: number;
  submittedAt: string;
}

export interface StudentSurveyListItem {
  id: string;
  surveyCode: string;
  title: string;
  description?: string;
  responseMode: 'named' | 'anonymous';
  responseModeLabel: string;
  answerWindowLabel: string;
  maxAttempts: number;
  submissionCount: number;
  enrolled: boolean;
  accessible: boolean;
  inaccessibleReason?: string;
  submitted: boolean;
  canRetake: boolean;
  canViewResponse?: boolean;
  responsesVisibleToStudents?: boolean;
  windowPhase?: 'open' | 'upcoming' | 'ended' | 'unlimited';
  windowEnded?: boolean;
  attempts?: StudentSurveyAttemptSummary[];
  assignedCourses?: { courseId: string; courseName: string }[];
  order?: number;
  createdAt?: string;
}

export async function fetchStudentSurveyList(
  studentId: string,
  options?: { courseId?: string; courseName?: string; courseCode?: string }
): Promise<StudentSurveyListItem[]> {
  const courseId = options?.courseId?.trim() || '';
  const cacheKey = courseId
    ? `student-surveys-list:${studentId}:course:${courseId}`
    : `student-surveys-list:${studentId}`;

  return fetchCached(
    cacheKey,
    async () => {
      const res = await fetch('/api/student/surveys/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: courseId || undefined,
          courseName: options?.courseName,
          courseCode: options?.courseCode,
        }),
      });
      if (!res.ok) throw new Error('survey list fetch failed');
      const data = await res.json();
      return (data.surveys ?? []) as StudentSurveyListItem[];
    },
    15_000
  );
}

export function invalidateStudentSurveyList(studentId: string): void {
  invalidateFetchCache(`student-surveys-list:${studentId}`);
}

export async function fetchStudentExamByCode(
  quizCode: string,
  options?: { submissionId?: string; review?: boolean; take?: boolean }
): Promise<Record<string, unknown>> {
  const submissionId = options?.submissionId;
  const review = options?.review;
  const take = options?.take;
  const cacheKey = submissionId
    ? `student-exam-get:${quizCode}:${submissionId}`
    : review
      ? `student-exam-get:${quizCode}:review`
      : take
        ? `student-exam-get:${quizCode}:take`
        : `student-exam-get:${quizCode}`;

  if (take) {
    invalidateFetchCache(`student-exam-get:${quizCode}`);
    invalidateFetchCache(`student-exam-get:${quizCode}:take`);
  }

  return fetchCached(
    cacheKey,
    async () => {
      const res = await fetch('/api/student/exams/get', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizCode,
          submissionId,
          review: !!review,
          take: !!take,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = new Error(String(data.error || 'exam fetch failed')) as Error & {
          status?: number;
          requireConfirm?: boolean;
          assignedCourses?: Array<{ courseId?: string; courseName?: string }>;
          quizCode?: string;
        };
        err.status = res.status;
        err.requireConfirm = !!data.requireConfirm;
        err.assignedCourses = Array.isArray(data.assignedCourses) ? data.assignedCourses : [];
        err.quizCode = typeof data.quizCode === 'string' ? data.quizCode : quizCode;
        throw err;
      }
      return data;
    },
    take || submissionId || review ? 0 : 10_000
  );
}

export async function fetchStudentExamAttempts(
  quizCode: string
): Promise<StudentExamAttemptSummary[]> {
  const res = await fetch('/api/student/exams/submissions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quizCode }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(String(data.error || 'attempts fetch failed'));
  return (data.attempts ?? []) as StudentExamAttemptSummary[];
}

export function invalidateStudentExamList(studentId: string): void {
  invalidateFetchCache(`student-exams-list:${studentId}`);
}

export function invalidateStudentExamGet(quizCode: string, submissionId?: string): void {
  invalidateFetchCache(`student-exam-get:${quizCode}`);
  invalidateFetchCache(`student-exam-get:${quizCode}:review`);
  invalidateFetchCache(`student-exam-get:${quizCode}:take`);
  if (submissionId) {
    invalidateFetchCache(`student-exam-get:${quizCode}:${submissionId}`);
  }
}

export interface CourseClassData {
  customLinks?: { name: string; url: string; icon: string }[];
  announcements?: {
    id: string;
    title: string;
    content: string;
    links: { name: string; url: string }[];
    createdAt: string;
  }[];
  location?: string;
  description?: string;
}

/** 單一課程 ClassData（公告、自訂連結等），進入課程詳情時才載入 */
export async function fetchCourseClassData(courseId: string): Promise<CourseClassData> {
  return fetchCached(`course-classdata:${courseId}`, async () => {
    const res = await fetch(`/api/courses/classdata?courseId=${encodeURIComponent(courseId)}`);
    if (!res.ok) throw new Error('classdata fetch failed');
    return res.json() as Promise<CourseClassData>;
  });
}

/** 單一課程課堂列表（學生視角；快取與教師端分離） */
export async function fetchCourseLessons(courseId: string): Promise<unknown[]> {
  return fetchCached(
    `course-lessons:student:${courseId}`,
    async () => {
      const res = await fetch('/api/courses/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ courseId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(
          data && typeof data === 'object' && 'error' in data
            ? String((data as { error?: string }).error || '載入課堂失敗')
            : '載入課堂失敗'
        );
      }
      return Array.isArray(data) ? data : [];
    },
    15_000
  );
}

export interface StudentAttendanceActivity {
  id: string;
  courseId: string;
  firestoreCourseId: string;
  title: string;
  courseName: string;
  startTime: string;
  endTime: string;
  status: 'upcoming' | 'active' | 'past';
  studentStatus?: string;
  studentLeaveType?: string;
}

/** 學生點名活動；可傳 courseId 只拉單一課程 */
export async function fetchStudentAttendanceActivities(options?: {
  courseId?: string;
}): Promise<StudentAttendanceActivity[]> {
  const courseId = options?.courseId?.trim() || '';
  const cacheKey = courseId
    ? `student-attendance:${courseId}`
    : 'student-attendance:all';

  return fetchCached(
    cacheKey,
    async () => {
      const url = courseId
        ? `/api/attendance/student-all-activities?courseId=${encodeURIComponent(courseId)}`
        : '/api/attendance/student-all-activities';
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('attendance fetch failed');
      const data = await res.json();
      return (Array.isArray(data) ? data : []) as StudentAttendanceActivity[];
    },
    15_000
  );
}

/** 背景預熱學生儀表板快取（coursesOnly），供 Context 或首頁呼叫 */
export function prefetchStudentDashboard(studentId: string): void {
  void fetchStudentDashboardData(studentId, { coursesOnly: true }).catch(() => {});
}

/** 預熱單一課程常用資料（classdata／課堂），供列表頁 idle 時呼叫 */
export function prefetchCourseDetail(courseId: string): void {
  if (!courseId) return;
  void fetchCourseClassData(courseId).catch(() => {});
  void fetchCourseLessons(courseId).catch(() => {});
}
