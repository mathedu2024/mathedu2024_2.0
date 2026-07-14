import type { QuizRosterStudent } from '@/services/quizRosterService';
import type { Quiz } from '@/services/quizTypes';
import {
  groupSubmissionsByStudent,
  pickOneSubmissionPerStudent,
  type QuizSubmission,
} from '@/services/quizSubmissionTypes';

export interface GradingStudentRow {
  studentId: string;
  studentNumber: string;
  name: string;
  submitted: boolean;
  primarySubmission: QuizSubmission | null;
  allSubmissions: QuizSubmission[];
}

export function formatGradingStudentNumber(
  studentNumber: string,
  account?: string
): string {
  const number = studentNumber.trim();
  if (number) return number;
  const fallback = account?.trim();
  return fallback || '—';
}

function sortSubmissionsNewestFirst(submissions: QuizSubmission[]): QuizSubmission[] {
  return [...submissions].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

export function buildGradingStudentRows(
  roster: QuizRosterStudent[],
  submissions: QuizSubmission[],
  quiz: Quiz
): GradingStudentRow[] {
  const byStudent = groupSubmissionsByStudent(submissions);
  const primaryByStudent = new Map(
    pickOneSubmissionPerStudent(submissions, quiz).map((sub) => [sub.studentId, sub])
  );

  return roster
    .map((student) => {
      const allSubmissions = sortSubmissionsNewestFirst(byStudent.get(student.studentId) ?? []);
      const primarySubmission = primaryByStudent.get(student.studentId) ?? allSubmissions[0] ?? null;

      return {
        studentId: student.studentId,
        studentNumber: formatGradingStudentNumber(student.studentNumber, student.account),
        name: student.name || primarySubmission?.studentName || '（未命名）',
        submitted: allSubmissions.length > 0,
        primarySubmission,
        allSubmissions,
      };
    })
    .sort((a, b) =>
      a.studentNumber.localeCompare(b.studentNumber, undefined, { numeric: true })
    );
}
