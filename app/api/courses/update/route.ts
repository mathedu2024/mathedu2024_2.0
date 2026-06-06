import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';
import { cookies } from 'next/headers';

const TEACHER_EDITABLE_FIELDS = ['description', 'customLinks', 'announcements'] as const;
const CLASS_DATA_SYNC_FIELDS = ['description', 'location', 'liveStreamURL', 'customLinks', 'announcements'] as const;

function pickFields<T extends Record<string, unknown>>(data: T, fields: readonly string[]): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of fields) {
    if (key in data) picked[key] = data[key];
  }
  return picked;
}

export async function POST(req: NextRequest) {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let sessionData: { id?: string; role?: string[] | string };
  try {
    sessionData = JSON.parse(decodeURIComponent(sessionCookie.value));
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const roleList = Array.isArray(sessionData.role) ? sessionData.role : [sessionData.role || ''];
  const isAdmin = roleList.includes('admin');
  const isTeacher = roleList.includes('teacher');

  if (!isAdmin && !isTeacher) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const data = await req.json();
    const id = data.id || Date.now().toString();

    const courseRef = adminDb.collection('courses').doc(id);
    const oldCourseDoc = await courseRef.get();
    if (!oldCourseDoc.exists) {
      return NextResponse.json({ error: '找不到課程' }, { status: 404 });
    }

    const oldCourseData = oldCourseDoc.data()!;
    const oldTeacherIds = (oldCourseData.teachers || []) as string[];

    let updatePayload: Record<string, unknown>;

    if (isAdmin) {
      updatePayload = { ...data };
      delete updatePayload.id;
    } else {
      const teacherId = sessionData.id;
      const teacherIds = (oldCourseData.teachers || []) as string[];
      if (!teacherId || !teacherIds.includes(teacherId)) {
        return NextResponse.json({ error: '無權限修改此課程' }, { status: 403 });
      }
      updatePayload = pickFields(data, TEACHER_EDITABLE_FIELDS);
      if (Object.keys(updatePayload).length === 0) {
        return NextResponse.json({ error: '無可更新的欄位' }, { status: 400 });
      }
    }

    updatePayload.updatedAt = new Date().toISOString();

    await courseRef.set(updatePayload, { merge: true });

    const classDataUpdate = pickFields(updatePayload, CLASS_DATA_SYNC_FIELDS);
    if (Object.keys(classDataUpdate).length > 0) {
      await courseRef.collection('ClassData').doc('main').set(classDataUpdate, { merge: true });
    }

    if (isAdmin && data.teachers && Array.isArray(data.teachers)) {
      try {
        const courseKey = `${data.name ?? oldCourseData.name}(${data.code ?? oldCourseData.code})`;

        for (const oldTeacherId of oldTeacherIds) {
          if (!data.teachers.includes(oldTeacherId)) {
            try {
              const oldTeacherRef = adminDb.collection('users').doc(oldTeacherId);
              const oldTeacherDoc = await oldTeacherRef.get();

              if (oldTeacherDoc.exists) {
                const oldTeacherData = oldTeacherDoc.data();
                const oldCourses = oldTeacherData?.courses || [];
                const updatedCourses = oldCourses.filter((course: string) => course !== courseKey);

                await oldTeacherRef.update({
                  courses: updatedCourses,
                  updatedAt: new Date().toISOString(),
                });
              }
            } catch (error) {
              console.error(`Error removing course from old teacher ${oldTeacherId}:`, error);
            }
          }
        }

        for (const teacherId of data.teachers) {
          try {
            const teacherRef = adminDb.collection('users').doc(teacherId);
            const teacherDoc = await teacherRef.get();

            if (teacherDoc.exists) {
              const teacherData = teacherDoc.data();
              const currentCourses = teacherData?.courses || [];

              if (!currentCourses.includes(courseKey)) {
                await teacherRef.update({
                  courses: [...currentCourses, courseKey],
                  updatedAt: new Date().toISOString(),
                });
              }
            }
          } catch (error) {
            console.error(`Error updating teacher ${teacherId}:`, error);
          }
        }
      } catch (error) {
        console.error('Error syncing teacher courses:', error);
      }
    }

    return NextResponse.json({ success: true, id });
  } catch (error: unknown) {
    let message = '更新課程失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
