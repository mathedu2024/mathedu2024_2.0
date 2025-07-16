import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { courseId, order } = await req.json();
    if (!courseId || !Array.isArray(order)) {
      return NextResponse.json({ error: '缺少 courseId 或 order' }, { status: 400 });
    }
    // 先檢查所有 lesson 是否存在
    const lessonsCol = adminDb.collection('courses').doc(courseId).collection('lessons');
    const missingIds: string[] = [];
    for (const lessonId of order) {
      const doc = await lessonsCol.doc(lessonId).get();
      if (!doc.exists) missingIds.push(lessonId);
    }
    if (missingIds.length > 0) {
      return NextResponse.json({ error: `下列課堂不存在: ${missingIds.join(', ')}` }, { status: 400 });
    }
    // 批次更新順序
    const batch = adminDb.batch();
    order.forEach((lessonId: string, idx: number) => {
      const ref = lessonsCol.doc(lessonId);
      batch.update(ref, { order: idx });
    });
    try {
      await batch.commit();
    } catch (err: unknown) {
      let message = 'Firestore 批次寫入失敗';
      if (err instanceof Error) message = err.message;
      return NextResponse.json({ error: message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    let message = '課堂排序更新失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 