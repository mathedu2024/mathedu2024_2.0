import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { db } from '@/lib/firebase';
import { normalizeCourseDate } from '@/services/courseDate';
import {
  getSessionFromRequest,
  isStaffSession,
  sessionHasRole,
} from '@/services/apiAuth';

const PUBLIC_COURSE_FIELDS = [
  'name', 'code', 'teachingMethod', 'teachers', 'startDate', 'endDate',
  'status', 'gradeTags', 'subjectTag', 'courseNature', 'showInIntroduction',
  'archived', 'description', 'coverImageURL', 'location', 'liveStreamURL', 'classTimes',
] as const;

function pickPublicCourseFields(id: string, data: Record<string, unknown>) {
  const picked: Record<string, unknown> = { id };
  for (const key of PUBLIC_COURSE_FIELDS) {
    if (key in data) picked[key] = data[key];
  }
  picked.startDate = normalizeCourseDate(data.startDate);
  picked.endDate = normalizeCourseDate(data.endDate);
  return picked;
}

async function listCourses(req: NextRequest, teacherId = '') {
  try {
    const session = getSessionFromRequest(req);
    const isStaff = session ? isStaffSession(session) : false;
    const isAdmin = session ? sessionHasRole(session, 'admin') : false;

    // 非管理員僅能查自己的授課清單；未登入或學生忽略 teacherId，走公開欄位
    let effectiveTeacherId = '';
    if (teacherId && isStaff) {
      if (isAdmin || session?.id === teacherId) {
        effectiveTeacherId = teacherId;
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const snapshot = effectiveTeacherId
      ? await db.collection('courses').where('teachers', 'array-contains', effectiveTeacherId).get()
      : await db.collection('courses').get();

    const courses = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        if (isStaff) {
          return {
            id: doc.id,
            ...data,
            startDate: normalizeCourseDate(data.startDate),
            endDate: normalizeCourseDate(data.endDate),
          };
        }
        return pickPublicCourseFields(doc.id, data);
      })
      .filter((course) => {
        if (isStaff) return true;
        const archived = course.archived === true;
        const showIntro = course.showInIntroduction !== false;
        return showIntro && !archived;
      });

    return NextResponse.json(courses);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error fetching courses:', error);
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const teacherId = req.nextUrl.searchParams.get('teacherId')?.trim() || '';
  return listCourses(req, teacherId);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const teacherId =
    typeof body?.teacherId === 'string' ? body.teacherId.trim() : '';
  return listCourses(req, teacherId);
}
