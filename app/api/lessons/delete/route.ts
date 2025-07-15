import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { courseId, lessonId } = await req.json();
    if (!courseId || !lessonId) {
      return NextResponse.json({ error: '缺少 courseId 或 lessonId' }, { status: 400 });
    }
    const lessonRef = adminDb.collection('courses').doc(courseId).collection('lessons').doc(lessonId);
    await lessonRef.delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '刪除課堂失敗' }, { status: 500 });
  }
} 