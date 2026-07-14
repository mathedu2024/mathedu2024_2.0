import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import { getSessionFromCookie } from '@/utils/session';
import { isCourseArchived } from '@/services/courseArchive';
import {
  buildTeacherActivityFeed,
  type CourseActivityCourseRef,
} from '@/services/courseActivityFeed';

export const dynamic = 'force-dynamic';

function isTeacherOrAdmin(session: {
  role?: string | string[];
  currentRole?: string;
} | null): boolean {
  if (!session) return false;
  if (session.currentRole === 'teacher' || session.currentRole === 'admin') return true;
  const role = session.role;
  if (typeof role === 'string') {
    const lower = role.toLowerCase();
    return (
      role === '老師' ||
      role === '管理員' ||
      lower === 'teacher' ||
      lower === 'admin'
    );
  }
  if (Array.isArray(role)) {
    return role.some((r) => {
      const lower = String(r).toLowerCase();
      return r === '老師' || r === '管理員' || lower === 'teacher' || lower === 'admin';
    });
  }
  return false;
}

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromCookie(req.headers.get('cookie') || '');
    if (!session?.id || !isTeacherOrAdmin(session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const teacherId = session.id;
    const snap = await adminDb
      .collection('courses')
      .where('teachers', 'array-contains', teacherId)
      .get();

    const courses: CourseActivityCourseRef[] = snap.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || '',
        code: d.code || '',
        status: d.status,
        archived: isCourseArchived({
          archived: d.archived,
          status: d.status,
          name: d.name,
        }),
      };
    });

    const items = await buildTeacherActivityFeed(teacherId, courses);
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error building teacher activity feed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load activity feed' },
      { status: 500 }
    );
  }
}
