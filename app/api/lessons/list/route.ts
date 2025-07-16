import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { courseId } = await req.json();
    if (!courseId) {
      return NextResponse.json({ error: '缺少 courseId' }, { status: 400 });
    }
    let lessonsSnap;
    let fallback = false;
    try {
      // 先嘗試用 order 排序
      lessonsSnap = await adminDb
        .collection('courses')
        .doc(courseId)
        .collection('lessons')
        .orderBy('order', 'asc')
        .orderBy('date', 'asc')
        .get();
    } catch {
      // fallback 用 date desc 排序
      lessonsSnap = await adminDb
        .collection('courses')
        .doc(courseId)
        .collection('lessons')
        .orderBy('date', 'desc')
        .get();
      fallback = true;
    }
    let lessons = lessonsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (fallback) lessons = lessons.reverse();
    return NextResponse.json(lessons);
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 