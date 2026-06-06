import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { normalizeCourseDate } from '@/services/courseDate';

function mergeClassData(classData: Record<string, unknown>, courseData: Record<string, unknown>) {
  return {
    location: classData.location ?? courseData.location ?? '',
    description: classData.description ?? courseData.description ?? '',
    liveStreamURL: classData.liveStreamURL ?? courseData.liveStreamURL ?? '',
    customLinks: classData.customLinks ?? courseData.customLinks ?? [],
    announcements: classData.announcements ?? courseData.announcements ?? [],
    startDate: normalizeCourseDate(classData.startDate ?? courseData.startDate),
    endDate: normalizeCourseDate(classData.endDate ?? courseData.endDate),
  };
}

// GET: 讀取課程主資料（合併 ClassData 與課程主文件）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');
    if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });

    const courseRef = adminDb.collection('courses').doc(courseId);
    const [classDoc, courseDoc] = await Promise.all([
      courseRef.collection('ClassData').doc('main').get(),
      courseRef.get(),
    ]);

    const courseData = courseDoc.exists ? (courseDoc.data() as Record<string, unknown>) : {};
    const classData = classDoc.exists ? (classDoc.data() as Record<string, unknown>) : {};

    return NextResponse.json(mergeClassData(classData, courseData));
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: 建立/更新課程主資料
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { courseId, ...classData } = data;
    if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
    await adminDb.collection('courses').doc(courseId).collection('ClassData').doc('main').set(classData, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    let message = '寫入失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
