import { adminDb } from '@/services/firebase-admin';
import { resolveCourseDocsByEnrolledIds } from '@/services/courseId';
import { isCourseArchived } from '@/services/courseArchive';
import { quizService } from '@/services/quizService';
import { quizSubmissionService } from '@/services/quizSubmissionService';
import { surveyService } from '@/services/surveyService';
import { surveyResponseService } from '@/services/surveyResponseService';
import {
  isQuizAccessibleToStudent,
  isStudentEnrolledInQuiz,
} from '@/services/quizStudentView';
import {
  formatQuizAnswerWindow,
  getQuizAnswerWindowPhase,
  normalizeAssignedCourses,
} from '@/services/quizTypes';
import {
  isSurveyAccessibleToStudent,
  isStudentEnrolledInSurvey,
} from '@/services/surveyStudentView';
import {
  formatSurveyAnswerWindow,
  getSurveyAnswerWindowPhase,
  getSurveyMaxAttempts,
  normalizeAssignedCourses as normalizeSurveyAssignedCourses,
} from '@/services/surveyTypes';
import { syncAttendanceLifecycle } from '@/services/attendanceLifecycle';
import { getTeacherCourseRecords } from '@/services/quizTeacherAccess';
import { tutoringService } from '@/services/tutoringService';
import { teacherCourseHubPath } from '@/utils/teacherCourseHub';

export type TodoItem = {
  id: string;
  kind: 'attendance' | 'quiz' | 'survey' | 'tutoring' | 'grading';
  /** 事件標題（測驗名、點名活動名等） */
  title: string;
  /** 時間列（作答期間／點名時間／輔導時段） */
  timeLabel: string;
  href: string;
  priority: number;
};

export type TodoSummary = {
  items: TodoItem[];
  counts: {
    attendance: number;
    quiz: number;
    survey: number;
    tutoring: number;
    grading: number;
    total: number;
  };
};

type ActiveCourse = { id: string; name: string; code: string };

function emptySummary(): TodoSummary {
  return {
    items: [],
    counts: { attendance: 0, quiz: 0, survey: 0, tutoring: 0, grading: 0, total: 0 },
  };
}

function finalize(items: TodoItem[]): TodoSummary {
  const sorted = [...items].sort(
    (a, b) => a.priority - b.priority || a.title.localeCompare(b.title, 'zh-Hant')
  );
  const counts = {
    attendance: sorted.filter((i) => i.kind === 'attendance').length,
    quiz: sorted.filter((i) => i.kind === 'quiz').length,
    survey: sorted.filter((i) => i.kind === 'survey').length,
    tutoring: sorted.filter((i) => i.kind === 'tutoring').length,
    grading: sorted.filter((i) => i.kind === 'grading').length,
    total: sorted.length,
  };
  return { items: sorted.slice(0, 12), counts };
}

function quizTimeLabel(quiz: {
  answerWindowEnabled?: boolean;
  answerStartAt?: string;
  answerEndAt?: string;
}): string {
  if (!quiz.answerWindowEnabled) return '不限時間（自主練習）';
  const label = formatQuizAnswerWindow(quiz);
  return label === '未設定' ? '未設定作答期間' : label;
}

function surveyTimeLabel(survey: {
  answerWindowEnabled?: boolean;
  answerStartAt?: string;
  answerEndAt?: string;
}): string {
  if (!survey.answerWindowEnabled) return '不限期間';
  return formatSurveyAnswerWindow(survey);
}

function formatAttendanceTime(start?: unknown, end?: unknown): string {
  const toDate = (value: unknown): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate: () => Date }).toDate === 'function'
    ) {
      return (value as { toDate: () => Date }).toDate();
    }
    const parsed = new Date(value as string | number);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };
  const fmt = (d: Date) =>
    d.toLocaleString('zh-TW', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  const s = toDate(start);
  const e = toDate(end);
  if (s && e) return `${fmt(s)} ~ ${fmt(e)}`;
  if (s) return `${fmt(s)} 起`;
  return '進行中';
}

function resolveActiveAssignedCourse(
  assigned: { courseId: string; courseName?: string }[],
  activeCourses: ActiveCourse[]
): ActiveCourse | null {
  const byId = new Map(activeCourses.map((c) => [c.id, c]));
  for (const ref of assigned) {
    const hit = byId.get(ref.courseId);
    if (hit) return hit;
    // 相容：courseId 可能是 name(code) 鍵
    const byCode = activeCourses.find(
      (c) =>
        c.code === ref.courseId ||
        `${c.name}(${c.code})` === ref.courseId ||
        c.id === ref.courseId
    );
    if (byCode) return byCode;
  }
  return null;
}

function tutoringEndMs(details?: {
  date?: string;
  endTime?: string;
  startTime?: string;
}): number | null {
  if (!details?.date) return null;
  const dateStr = details.date.split('T')[0];
  const end = details.endTime || details.startTime || '23:59';
  const d = new Date(`${dateStr}T${end}`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

export async function buildStudentTodoSummary(studentId: string): Promise<TodoSummary> {
  const profileSnap = await adminDb.collection('student_data').doc(studentId).get();
  if (!profileSnap.exists) return emptySummary();

  const enrolledCourses: string[] = profileSnap.data()?.enrolledCourses || [];
  if (enrolledCourses.length === 0) return emptySummary();

  const resolvedMap = await resolveCourseDocsByEnrolledIds(adminDb, enrolledCourses);
  const activeCourses: ActiveCourse[] = [];
  const seen = new Set<string>();
  for (const key of enrolledCourses) {
    const doc = resolvedMap.get(key);
    if (!doc || seen.has(doc.id)) continue;
    seen.add(doc.id);
    const d = doc.data();
    if (isCourseArchived({ archived: d.archived, status: d.status, name: d.name })) continue;
    activeCourses.push({
      id: doc.id,
      name: String(d.name || ''),
      code: String(d.code || ''),
    });
  }

  if (activeCourses.length === 0) return emptySummary();

  const items: TodoItem[] = [];
  const enrolledKeys = enrolledCourses;

  await Promise.all(
    activeCourses.map(async (course) => {
      try {
        const snap = await adminDb
          .collection('courses')
          .doc(course.id)
          .collection('attendance')
          .where('status', 'in', ['active', 'scheduled'])
          .get();
        for (const doc of snap.docs) {
          const lifecycle = await syncAttendanceLifecycle(course.id, doc.id);
          if (lifecycle.status !== 'active') continue;
          const method = String(doc.data().checkInMethod || '');
          if (method !== 'qr' && method !== 'numeric') continue;
          const attendee = await adminDb
            .collection('courses')
            .doc(course.id)
            .collection('attendance')
            .doc(doc.id)
            .collection('attendees')
            .doc(studentId)
            .get();
          if (attendee.exists) continue;
          const data = doc.data();
          items.push({
            id: `att:${course.id}:${doc.id}`,
            kind: 'attendance',
            title: String(data.title || '點名'),
            timeLabel: `${course.name} · ${formatAttendanceTime(data.startTime, data.endTime)}`,
            href: `/student/attendance?courseId=${encodeURIComponent(course.id)}&activity=${encodeURIComponent(doc.id)}`,
            priority: 1,
          });
        }
      } catch {
        // ignore per-course
      }
    })
  );

  const [publishedQuizzes, publishedSurveys, appointments] = await Promise.all([
    quizService.listPublished(),
    surveyService.listPublished(),
    tutoringService.getStudentAppointments(studentId).catch(() => []),
  ]);

  const submissionsByQuiz = await quizSubmissionService.listGroupedByStudent(studentId);

  for (const quiz of publishedQuizzes) {
    const assigned = normalizeAssignedCourses(quiz);
    // 封存課所屬測驗一律不進待辦
    const course = resolveActiveAssignedCourse(assigned, activeCourses);
    if (!course) continue;

    const enrolled = isStudentEnrolledInQuiz(quiz, enrolledKeys);
    if (!enrolled) continue;
    const access = isQuizAccessibleToStudent(quiz, enrolledKeys);
    if (!access.ok) continue;
    const phase = getQuizAnswerWindowPhase(quiz);
    // 自主練習（不限時間）phase=unlimited；有時段則僅 open
    if (phase === 'ended' || phase === 'upcoming') continue;
    const allSubmissions = submissionsByQuiz.get(quiz.id) ?? [];
    if (allSubmissions.length > 0) continue;

    items.push({
      id: `quiz:${quiz.id}`,
      kind: 'quiz',
      title: quiz.title,
      timeLabel: quizTimeLabel(quiz),
      href: `/student/courses/${encodeURIComponent(course.code)}?tab=exams&exam=${encodeURIComponent(quiz.id)}`,
      priority: 2,
    });
  }

  for (const survey of publishedSurveys) {
    const assigned = normalizeSurveyAssignedCourses(survey);
    const course = resolveActiveAssignedCourse(assigned, activeCourses);
    if (!course) continue;

    const enrolled = isStudentEnrolledInSurvey(survey, enrolledKeys);
    if (!enrolled) continue;
    const access = isSurveyAccessibleToStudent(survey, enrolledKeys);
    if (!access.ok) continue;
    const phase = getSurveyAnswerWindowPhase(survey);
    if (phase === 'ended' || phase === 'upcoming') continue;
    const submissions = await surveyResponseService.listByStudentAndSurvey(survey.id, studentId);
    const maxAttempts = getSurveyMaxAttempts(survey);
    if (submissions.length >= maxAttempts || submissions.length > 0) continue;

    items.push({
      id: `survey:${survey.id}`,
      kind: 'survey',
      title: survey.title,
      timeLabel: surveyTimeLabel(survey),
      href: `/student/courses/${encodeURIComponent(course.code)}?tab=surveys&survey=${encodeURIComponent(survey.id)}`,
      priority: 3,
    });
  }

  const now = Date.now();
  const upcoming = (
    appointments as Array<{
      id?: string;
      slotId?: string;
      status?: string;
      slotDetails?: {
        title?: string;
        date?: string;
        startTime?: string;
        endTime?: string;
        teacherName?: string;
      };
    }>
  ).filter((a) => {
    if (a.status !== 'pending' && a.status !== 'confirmed') return false;
    const endMs = tutoringEndMs(a.slotDetails);
    if (endMs != null && endMs <= now) return false; // 已過期不顯示
    return true;
  });

  for (const appt of upcoming.slice(0, 5)) {
    const details = appt.slotDetails;
    const title =
      details?.title?.trim() ||
      (appt.status === 'pending' ? '輔導預約（待確認）' : '輔導預約');
    const timeParts = [
      details?.teacherName,
      details?.date ? details.date.split('T')[0] : '',
      details?.startTime && details?.endTime
        ? `${details.startTime}–${details.endTime}`
        : details?.startTime || '',
    ].filter(Boolean);
    items.push({
      id: `tutoring:${appt.slotId || appt.id}`,
      kind: 'tutoring',
      title,
      timeLabel: timeParts.join(' · ') || '時段待確認',
      href: '/student/counseling',
      priority: appt.status === 'pending' ? 4 : 5,
    });
  }

  return finalize(items);
}

export async function buildTeacherTodoSummary(teacherId: string): Promise<TodoSummary> {
  const courses = await getTeacherCourseRecords(teacherId);
  const activeCourses = (
    await Promise.all(
      courses.map(async (c) => {
        const snap = await adminDb.collection('courses').doc(c.id).get();
        if (!snap.exists) return null;
        const d = snap.data()!;
        if (isCourseArchived({ archived: d.archived, status: d.status, name: d.name })) return null;
        return { id: c.id, name: c.name, code: c.code };
      })
    )
  ).filter((c): c is ActiveCourse => !!c);

  const items: TodoItem[] = [];

  await Promise.all(
    activeCourses.map(async (course) => {
      try {
        const snap = await adminDb
          .collection('courses')
          .doc(course.id)
          .collection('attendance')
          .where('status', 'in', ['active', 'scheduled'])
          .get();
        for (const doc of snap.docs) {
          const lifecycle = await syncAttendanceLifecycle(course.id, doc.id);
          if (lifecycle.status !== 'active') continue;
          const data = doc.data();
          items.push({
            id: `att:${course.id}:${doc.id}`,
            kind: 'attendance',
            title: String(data.title || '點名'),
            timeLabel: `${course.name} · ${formatAttendanceTime(data.startTime, data.endTime)}`,
            href: teacherCourseHubPath(course.code, 'attendance'),
            priority: 1,
          });
        }
      } catch {
        // ignore
      }
    })
  );

  const quizzes = await quizService.listAccessibleByTeacher(teacherId);
  const published = quizzes.filter((q) => q.status === 'published');

  await Promise.all(
    published.map(async (quiz) => {
      try {
        const assigned = normalizeAssignedCourses(quiz);
        const course = resolveActiveAssignedCourse(assigned, activeCourses);
        // 封存課測驗不列待批改
        if (!course && assigned.length > 0) return;

        const hasShort = quiz.sections.some((sec) =>
          sec.questions.some(
            (q) =>
              q.type === 'short_answer' ||
              (q.type === 'group' &&
                'subQuestions' in q &&
                q.subQuestions.some((sq) => sq.type === 'short_answer'))
          )
        );
        if (!hasShort) return;
        const submissions = await quizSubmissionService.listSubmissionsForFeed(quiz.id);
        const pending = submissions.filter(
          (s) =>
            s.status === 'grading' ||
            s.answers.some((a) => a.gradingStatus === 'pending' && a.questionType === 'short_answer')
        );
        if (pending.length === 0) return;
        items.push({
          id: `grading:${quiz.id}`,
          kind: 'grading',
          title: quiz.title,
          timeLabel: `待批改 ${pending.length} 份${course ? ` · ${course.name}` : ''}`,
          href: course
            ? `${teacherCourseHubPath(course.code, 'exams')}`
            : `/back-panel/teacher-exams/${encodeURIComponent(quiz.quizCode)}/grading`,
          priority: 2,
        });
      } catch {
        // ignore
      }
    })
  );

  try {
    const slotsSnap = await adminDb
      .collection('tutoringSlots')
      .where('teacherId', '==', teacherId)
      .get();
    const now = Date.now();
    let pendingCount = 0;
    let nearestLabel = '';
    for (const doc of slotsSnap.docs) {
      const data = doc.data();
      const endMs = tutoringEndMs({
        date: data.date,
        endTime: data.endTime,
        startTime: data.startTime,
      });
      if (endMs != null && endMs <= now) continue;
      const booked = (data.bookedStudents || []) as Array<{ status?: string }>;
      const pendingHere = booked.filter((b) => b.status === 'pending').length;
      if (pendingHere === 0) continue;
      pendingCount += pendingHere;
      if (!nearestLabel) {
        nearestLabel = [data.date?.split?.('T')?.[0] || data.date, data.startTime]
          .filter(Boolean)
          .join(' ');
      }
    }
    if (pendingCount > 0) {
      items.push({
        id: 'tutoring:pending',
        kind: 'tutoring',
        title: `待確認輔導（${pendingCount}）`,
        timeLabel: nearestLabel || '請至輔導管理處理',
        href: '/back-panel/tutoring',
        priority: 3,
      });
    }
  } catch {
    // ignore
  }

  return finalize(items);
}
