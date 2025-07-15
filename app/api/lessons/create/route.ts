import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { courseId, ...lessonData } = data;
    if (!courseId) {
      return NextResponse.json({ error: '缺少 courseId' }, { status: 400 });
    }
    // 先查詢目前最大 order
    const lessonsSnapshot = await adminDb.collection('courses').doc(courseId).collection('lessons').orderBy('order', 'desc').limit(1).get();
    let nextOrder = 0;
    if (!lessonsSnapshot.empty) {
      const maxOrderLesson = lessonsSnapshot.docs[0].data();
      if (typeof maxOrderLesson.order === 'number') {
        nextOrder = maxOrderLesson.order + 1;
      }
    }
    // 建立一個新的 lesson document
    const lessonRef = adminDb.collection('courses').doc(courseId).collection('lessons').doc();
    await lessonRef.set({
      ...lessonData,
      id: lessonRef.id,
      order: nextOrder,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ success: true, id: lessonRef.id });
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '新增課堂失敗' }, { status: 500 });
  }
} 