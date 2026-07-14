import { parse as parseCookie } from 'cookie';
import { adminDb } from '@/services/firebase-admin';
import { getCourseCompositeKey } from '@/services/courseId';

export interface ServerStudentSession {
  id: string;
  name: string;
  account: string;
}

export async function getStudentSessionFromRequest(
  request: Request
): Promise<ServerStudentSession | null> {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = parseCookie(cookieHeader);
  const sessionCookie = cookies.session;
  if (!sessionCookie) return null;

  try {
    const session = JSON.parse(decodeURIComponent(sessionCookie));
    const role = session?.role;
    const roles = Array.isArray(role) ? role : [role];
    if (!roles.some((r: string) => String(r).includes('student'))) return null;
    if (!session?.id) return null;
    return {
      id: session.id,
      name: session.name ?? '',
      account: session.account ?? session.id,
    };
  } catch {
    return null;
  }
}

export async function getStudentEnrolledCourseIds(studentDocId: string): Promise<string[]> {
  const keys = new Set<string>();

  const doc = await adminDb.collection('student_data').doc(studentDocId).get();
  if (doc.exists) {
    const data = doc.data()!;
    const courses = data.enrolledCourses || data.courses || [];
    if (Array.isArray(courses)) {
      courses.forEach((c) => keys.add(String(c)));
    }
  }

  const rosterSnap = await adminDb
    .collection('courses')
    .where('students', 'array-contains', studentDocId)
    .get();
  rosterSnap.docs.forEach((courseDoc) => {
    keys.add(courseDoc.id);
    const data = courseDoc.data();
    const name = String(data.name || '');
    const code = String(data.code || '');
    if (name && code) {
      keys.add(getCourseCompositeKey(name, code));
    }
  });

  return [...keys];
}
