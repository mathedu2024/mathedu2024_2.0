import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { courseId } = await req.json();
    if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
    let lessonsSnapshot;
    let fallback = false;
    try {
      lessonsSnapshot = await adminDb
        .collection('courses')
        .doc(courseId)
        .collection('lessons')
        .orderBy('order', 'asc')
        .orderBy('date', 'asc')
        .get();
    } catch {
      lessonsSnapshot = await adminDb
        .collection('courses')
        .doc(courseId)
        .collection('lessons')
        .orderBy('date', 'desc')
        .get();
      fallback = true;
    }
    let lessons = lessonsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (fallback) lessons = lessons.reverse();
    return NextResponse.json(lessons);
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 