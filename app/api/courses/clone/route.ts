import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import {
  requireAuthFromRequest,
  requireCourseStaffAccess,
  authGuard,
  sessionHasRole,
} from '@/services/apiAuth';
import { isCourseArchived } from '@/services/courseArchive';

const COPY_TOP_LEVEL_FIELDS = [
  'name',
  'teachingMethod',
  'teachers',
  'gradeTags',
  'subjectTag',
  'courseNature',
  'description',
  'coverImageURL',
  'location',
  'liveStreamURL',
  'classTimes',
  'customLinks',
  'timeArrangementType',
  'showInIntroduction',
] as const;

/**
 * 從既有課程（含封存）複製為新學期課程。
 * 複製：基本資料、ClassData、課堂單元
 * 不複製：學生名單、成績、點名、測驗／問卷指派（請於新課另行複製測驗／問卷）
 */
export async function POST(req: NextRequest) {
  const auth = requireAuthFromRequest(req, 'admin', 'teacher');
  if (auth.ok === false) return auth.response;

  try {
    const body = await req.json();
    const sourceCourseId = typeof body.sourceCourseId === 'string' ? body.sourceCourseId.trim() : '';
    const newCode = typeof body.newCode === 'string' ? body.newCode.trim() : '';
    const newName = typeof body.newName === 'string' ? body.newName.trim() : '';

    if (!sourceCourseId || !newCode) {
      return NextResponse.json(
        { error: '請提供來源課程與新課程代碼' },
        { status: 400 }
      );
    }

    const courseDenied = authGuard(await requireCourseStaffAccess(auth.session, sourceCourseId));
    if (courseDenied) return courseDenied;

    // 老師可複製自己授課的封存課；管理員皆可
    if (!sessionHasRole(auth.session, 'admin')) {
      // already checked teachers[] via requireCourseStaffAccess
    }

    const sourceRef = adminDb.collection('courses').doc(sourceCourseId);
    const sourceSnap = await sourceRef.get();
    if (!sourceSnap.exists) {
      return NextResponse.json({ error: '找不到來源課程' }, { status: 404 });
    }

    const source = sourceSnap.data() as Record<string, unknown>;
    const codeTaken = await adminDb.collection('courses').where('code', '==', newCode).limit(1).get();
    if (!codeTaken.empty) {
      return NextResponse.json({ error: '課程代碼已存在，請換一個' }, { status: 409 });
    }

    const newId = `${Date.now()}`;
    const displayName =
      newName ||
      String(source.name || '未命名課程').replace(/\s*（已封存）\s*$/, '').trim() ||
      '未命名課程';

    const courseData: Record<string, unknown> = {
      id: newId,
      code: newCode,
      name: displayName,
      status: '未開課',
      archived: false,
      startDate: body.startDate ?? '',
      endDate: body.endDate ?? '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      clonedFrom: sourceCourseId,
    };

    for (const key of COPY_TOP_LEVEL_FIELDS) {
      if (key in source) courseData[key] = source[key];
    }
    courseData.name = displayName;
    courseData.code = newCode;
    if (!Array.isArray(courseData.teachers) || (courseData.teachers as string[]).length === 0) {
      courseData.teachers = [auth.session.id];
    }

    await adminDb.collection('courses').doc(newId).set(courseData);

    // ClassData
    const classDataSnap = await sourceRef.collection('ClassData').doc('main').get();
    if (classDataSnap.exists) {
      const classData = { ...(classDataSnap.data() || {}) };
      delete (classData as { announcements?: unknown }).announcements;
      await adminDb
        .collection('courses')
        .doc(newId)
        .collection('ClassData')
        .doc('main')
        .set({
          ...classData,
          description: courseData.description ?? classData.description,
          location: courseData.location ?? classData.location,
          liveStreamURL: courseData.liveStreamURL ?? classData.liveStreamURL,
          customLinks: courseData.customLinks ?? classData.customLinks,
        });
    }

    // Lessons（不含作業繳交等子集合；僅單元本體）
    const lessonsSnap = await sourceRef.collection('lessons').get();
    if (!lessonsSnap.empty) {
      let batch = adminDb.batch();
      let ops = 0;
      for (const doc of lessonsSnap.docs) {
        const data = doc.data();
        const newLessonRef = adminDb.collection('courses').doc(newId).collection('lessons').doc();
        batch.set(newLessonRef, {
          ...data,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        ops += 1;
        if (ops >= 400) {
          await batch.commit();
          batch = adminDb.batch();
          ops = 0;
        }
      }
      if (ops > 0) await batch.commit();
    }

    // 同步老師授課清單
    const teachers = Array.isArray(courseData.teachers) ? (courseData.teachers as string[]) : [];
    const courseKey = `${displayName}(${newCode})`;
    for (const teacherId of teachers) {
      try {
        const teacherRef = adminDb.collection('users').doc(teacherId);
        const teacherDoc = await teacherRef.get();
        if (!teacherDoc.exists) continue;
        const currentCourses = (teacherDoc.data()?.courses || []) as string[];
        if (!currentCourses.includes(courseKey)) {
          await teacherRef.update({
            courses: [...currentCourses, courseKey],
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (e) {
        console.error(`clone: sync teacher ${teacherId} failed`, e);
      }
    }

    return NextResponse.json({
      success: true,
      id: newId,
      code: newCode,
      name: displayName,
      sourceArchived: isCourseArchived({
        archived: source.archived as boolean | string | undefined,
        status: source.status as string | undefined,
        name: source.name as string | undefined,
      }),
      message: '已複製為新課程（不含學生、成績、點名；測驗／問卷請另行從封存課複製）',
    });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('[API/courses/clone] Error:', error);
    const message = error instanceof Error ? error.message : '複製課程失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
