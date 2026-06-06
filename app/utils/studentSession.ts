import type { SessionData } from './session';

export interface SessionStudentInfo {
  id: string;
  name: string;
  studentId: string;
  account: string;
  email: string;
  grade: string;
  enrolledCourses: string[];
  attendance: unknown[];
  role: string;
}

export function isStudentSession(session: SessionData | null): boolean {
  if (!session) return false;
  const role = session.role;
  if (Array.isArray(role)) {
    return role.includes('student') || role.includes('學生');
  }
  return role === 'student' || role === '學生';
}

export function buildStudentInfoFromSession(session: SessionData): SessionStudentInfo {
  return {
    id: session.id,
    name: session.name,
    studentId: session.account,
    account: session.account,
    grade: '',
    email: '',
    enrolledCourses: [],
    attendance: [],
    role: 'student',
  };
}
