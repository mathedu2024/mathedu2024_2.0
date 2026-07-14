import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { surveyService } from '@/services/surveyService';
import { surveyResponseService } from '@/services/surveyResponseService';
import { getTeacherCourseRecords } from '@/services/quizTeacherAccess';
import { getAssignedCoursesRoster } from '@/services/quizRosterService';
import { formatGradingStudentNumber } from '@/utils/gradingStudentRows';
import { normalizeAssignedCourses } from '@/services/surveyTypes';

export async function POST(req: NextRequest) {
  try {
    const { surveyId, teacherId } = await req.json();
    if (!surveyId || !teacherId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const survey = await surveyService.getById(surveyId);
    if (!survey) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    const teacherCourses = await getTeacherCourseRecords(teacherId);
    const teacherCourseIds = new Set(teacherCourses.map((c) => c.id));
    const canAccess =
      survey.teacherId === teacherId ||
      normalizeAssignedCourses(survey).some((c) => teacherCourseIds.has(c.courseId));
    if (!canAccess) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const raw = await surveyResponseService.listBySurvey(surveyId);
    const isAnonymous = survey.responseMode === 'anonymous';
    const roster = await getAssignedCoursesRoster(normalizeAssignedCourses(survey));

    const rosterById = new Map(
      roster.map((s) => [
        s.studentId,
        {
          studentNumber: formatGradingStudentNumber(s.studentNumber, s.account),
          name: s.name,
        },
      ])
    );

    const submittedStudentIds = new Set(raw.map((r) => r.studentId).filter(Boolean));
    const enrolledCount = roster.length;
    const submittedInRoster = roster.filter((s) => submittedStudentIds.has(s.studentId)).length;
    const submittedOutsideRoster = [...submittedStudentIds].filter((id) => !rosterById.has(id)).length;
    const submittedStudentCount = isAnonymous
      ? submittedStudentIds.size
      : submittedInRoster + submittedOutsideRoster;
    const notSubmittedStudentCount = Math.max(0, enrolledCount - submittedInRoster);

    const responses = raw.map((r, i) => {
      const view = surveyResponseService.toTeacherView(r, i + 1);
      if (view.responseMode === 'anonymous') {
        return {
          id: view.id,
          surveyId: view.surveyId,
          responseMode: 'anonymous' as const,
          studentId: '',
          studentName: view.studentName,
          studentNumber: '',
          attemptIndex: view.attemptIndex,
          submittedAt: view.submittedAt,
          answers: view.answers,
          submitted: true,
        };
      }

      const fromRoster = rosterById.get(r.studentId);
      return {
        id: view.id,
        surveyId: view.surveyId,
        responseMode: 'named' as const,
        studentId: r.studentId,
        studentName: view.studentName || fromRoster?.name || '（未命名）',
        studentNumber: fromRoster?.studentNumber || '—',
        attemptIndex: view.attemptIndex,
        submittedAt: view.submittedAt,
        answers: view.answers,
        submitted: true,
      };
    });

    /** 記名：合併班級名單，含未填寫者；不記名：僅回傳已填回應 */
    const rows = isAnonymous
      ? responses
      : (() => {
          const byStudent = new Map<string, (typeof responses)[number]>();
          for (const res of responses) {
            if (!res.studentId) continue;
            const existing = byStudent.get(res.studentId);
            if (!existing || new Date(res.submittedAt).getTime() > new Date(existing.submittedAt).getTime()) {
              byStudent.set(res.studentId, res);
            }
          }

          const list = roster.map((s) => {
            const submitted = byStudent.get(s.studentId);
            if (submitted) return submitted;
            return {
              id: `pending:${s.studentId}`,
              surveyId: survey.id,
              responseMode: 'named' as const,
              studentId: s.studentId,
              studentName: s.name || '（未命名）',
              studentNumber: formatGradingStudentNumber(s.studentNumber, s.account),
              attemptIndex: 0,
              submittedAt: '',
              answers: {},
              submitted: false,
            };
          });

          // 名單外但已填寫者
          for (const res of responses) {
            if (res.studentId && !rosterById.has(res.studentId)) {
              list.push(res);
            }
          }

          return list.sort((a, b) => {
            if (a.submitted !== b.submitted) return a.submitted ? -1 : 1;
            return (a.studentNumber || a.studentName).localeCompare(
              b.studentNumber || b.studentName,
              undefined,
              { numeric: true }
            );
          });
        })();

    return NextResponse.json({
      responses: rows,
      responseMode: survey.responseMode,
      totalResponses: raw.length,
      enrolledCount,
      submittedStudentCount,
      notSubmittedStudentCount,
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    console.error('Error listing survey responses:', error);
    return NextResponse.json({ error: 'Failed to list responses' }, { status: 500 });
  }
}
