import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { getCourseCompositeKey } from '@/services/courseId';
import { isCourseArchived } from '@/services/courseArchive';
import { buildTeacherIdToNameMap, formatTeacherNames } from '@/services/teacherLookup';
import { normalizeCourseDate } from '@/services/courseDate';
import { quizService } from '@/services/quizService';
import { surveyService } from '@/services/surveyService';
import {
  isQuizAccessibleToStudent,
  isQuizAssignedToCourse,
  isStudentEnrolledInQuiz,
} from '@/services/quizStudentView';
import {
  isSurveyAccessibleToStudent,
  isSurveyAssignedToCourseRef,
  isStudentEnrolledInSurvey,
} from '@/services/surveyStudentView';
import {
  formatQuizAnswerWindow,
  formatQuizAttemptLimit,
  formatQuizTimeLimit,
  getQuizAnswerWindowPhase,
  getQuizAttemptScorePolicy,
  getQuizMaxAttempts,
  isQuizMultipleAttemptsAllowed,
  isQuizResultsPublished,
  isQuizExamLockEnabled,
  isQuizRequireFullscreen,
  normalizeAssignedCourses,
} from '@/services/quizTypes';
import {
  formatSurveyAnswerWindow,
  formatSurveyResponseMode,
  getSurveyAnswerWindowPhase,
  getSurveyMaxAttempts,
  isSurveyResponsesVisibleToStudents,
  normalizeAssignedCourses as normalizeSurveyAssignedCourses,
} from '@/services/surveyTypes';
import {
  getSessionFromRequest,
  isStaffSession,
  sessionHasRole,
} from '@/services/apiAuth';

export const dynamic = 'force-dynamic';

function toIso(value: unknown): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  return new Date().toISOString();
}

function activityStatus(startIso: string, endIso: string): 'upcoming' | 'active' | 'past' {
  const now = Date.now();
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isFinite(start) && start > now) return 'upcoming';
  if (Number.isFinite(end) && end < now) return 'past';
  return 'active';
}

/** 老師／管理員：以學生視角預覽單一課程資料 */
export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session?.id || !isStaffSession(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const courseCode = req.nextUrl.searchParams.get('code')?.trim() || '';
    if (!courseCode) {
      return NextResponse.json({ error: 'Missing course code' }, { status: 400 });
    }

    const snap = await adminDb.collection('courses').where('code', '==', courseCode).limit(5).get();
    if (snap.empty) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const isAdmin = sessionHasRole(session, 'admin');
    const courseDoc =
      snap.docs.find((doc) => {
        if (isAdmin) return true;
        const teachers = Array.isArray(doc.data().teachers) ? doc.data().teachers : [];
        return teachers.includes(session.id);
      }) ?? null;

    if (!courseDoc) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const data = courseDoc.data();
    const teachersList = Array.isArray(data.teachers) ? (data.teachers as string[]) : [];
    const teacherLookup = await buildTeacherIdToNameMap(adminDb, teachersList);

    let classData: Record<string, unknown> = {};
    try {
      const classDoc = await adminDb.collection('courses').doc(courseDoc.id).collection('ClassData').doc('main').get();
      if (classDoc.exists) classData = classDoc.data() || {};
    } catch {
      classData = {};
    }

    const archivedFlag = isCourseArchived({
      archived: data.archived,
      status: data.status,
      name: data.name,
    });

    const course = {
      id: courseDoc.id,
      name: data.name || '',
      code: data.code || courseCode,
      status: archivedFlag ? '已封存' : (data.status || ''),
      gradeTags: data.gradeTags || [],
      subjectTag: data.subjectTag || '',
      startDate: normalizeCourseDate(data.startDate),
      endDate: normalizeCourseDate(data.endDate),
      teachers: teachersList,
      description: data.description || classData.description || '',
      teachingMethod: data.teachingMethod || '',
      courseNature: data.courseNature || '',
      location: data.location || classData.location || '',
      liveStreamURL: data.liveStreamURL || classData.liveStreamURL || '',
      coverImageURL: data.coverImageURL || '',
      classTimes: data.classTimes || [],
      archived: archivedFlag,
      teacherName: formatTeacherNames(teachersList, teacherLookup) || undefined,
      customLinks: (classData.customLinks ?? data.customLinks) || [],
      announcements: (classData.announcements ?? data.announcements) || [],
    };

    const enrolledKeys = [
      course.id,
      getCourseCompositeKey(course.name, course.code),
    ].filter(Boolean);

    const courseRef = {
      id: course.id,
      name: course.name,
      code: course.code,
    };

    const [publishedQuizzes, publishedSurveys, attendanceSnap] = await Promise.all([
      quizService.listPublished(),
      surveyService.listPublished(),
      adminDb.collection('courses').doc(courseDoc.id).collection('attendance').get(),
    ]);

    const scopedQuizzes = publishedQuizzes.filter((quiz) =>
      isQuizAssignedToCourse(normalizeAssignedCourses(quiz), courseRef)
    );

    const exams = scopedQuizzes
      .map((quiz) => {
        const enrolled = isStudentEnrolledInQuiz(quiz, enrolledKeys);
        const access = isQuizAccessibleToStudent(quiz, enrolledKeys);
        const maxAttempts = getQuizMaxAttempts(quiz);
        const windowPhase = getQuizAnswerWindowPhase(quiz);
        return {
          id: quiz.id,
          quizCode: quiz.quizCode,
          title: quiz.title,
          totalPoints: quiz.totalPoints,
          timeLimitLabel: formatQuizTimeLimit(quiz),
          answerWindowLabel: formatQuizAnswerWindow(quiz),
          attemptLimitLabel: formatQuizAttemptLimit(quiz),
          attemptUnlimited: maxAttempts === null,
          maxAttempts,
          submissionCount: 0,
          enrolled,
          accessible: access.ok,
          inaccessibleReason: access.reason,
          submitted: false,
          canRetake: false,
          resultsPublished: isQuizResultsPublished(quiz),
          submissionStatus: null,
          submissionScore: null,
          scorePolicy: getQuizAttemptScorePolicy(quiz),
          multipleAttempts: isQuizMultipleAttemptsAllowed(quiz),
          latestSubmissionId: null,
          windowPhase,
          windowEnded: windowPhase === 'ended',
          attempts: [],
          examLockEnabled: isQuizExamLockEnabled(quiz),
          requireFullscreen: isQuizRequireFullscreen(quiz),
          assignedCourses: normalizeAssignedCourses(quiz),
          order: typeof quiz.order === 'number' ? quiz.order : undefined,
          createdAt: quiz.createdAt,
        };
      })
      .filter((e) => e.enrolled);

    const scopedSurveys = publishedSurveys.filter((survey) =>
      isSurveyAssignedToCourseRef(survey, courseRef)
    );

    const surveys = scopedSurveys
      .map((survey) => {
        const enrolled = isStudentEnrolledInSurvey(survey, enrolledKeys);
        const access = isSurveyAccessibleToStudent(survey, enrolledKeys);
        const maxAttempts = getSurveyMaxAttempts(survey);
        const windowPhase = getSurveyAnswerWindowPhase(survey);
        return {
          id: survey.id,
          surveyCode: survey.surveyCode,
          title: survey.title,
          description: survey.description,
          responseMode: survey.responseMode,
          responseModeLabel: formatSurveyResponseMode(survey.responseMode),
          answerWindowLabel: formatSurveyAnswerWindow(survey),
          maxAttempts,
          submissionCount: 0,
          enrolled,
          accessible: access.ok,
          inaccessibleReason: access.reason,
          submitted: false,
          canRetake: false,
          canViewResponse: false,
          responsesVisibleToStudents: isSurveyResponsesVisibleToStudents(survey),
          windowPhase,
          windowEnded: windowPhase === 'ended',
          assignedCourses: normalizeSurveyAssignedCourses(survey),
          order: typeof survey.order === 'number' ? survey.order : undefined,
          createdAt: survey.createdAt,
        };
      })
      .filter((s) => s.enrolled);

    const attendance = attendanceSnap.docs
      .filter((doc) => doc.data().visibleToStudents !== false)
      .map((doc) => {
        const activityData = doc.data();
        const startTime = toIso(activityData.startTime || activityData.date);
        const endTime = toIso(activityData.endTime || activityData.startTime || activityData.date);
        return {
          id: doc.id,
          courseId: course.id,
          firestoreCourseId: course.id,
          title: activityData.title || activityData.type || '未命名活動',
          courseName: course.name,
          startTime,
          endTime,
          status: activityStatus(startTime, endTime),
          studentStatus: '',
          studentLeaveType: undefined as string | undefined,
        };
      });

    return NextResponse.json({ course, exams, surveys, attendance });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error building teacher course preview:', error);
    return NextResponse.json({ error: 'Failed to load course preview' }, { status: 500 });
  }
}
