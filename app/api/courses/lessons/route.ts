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
    } catch (err) {
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
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '查詢失敗' }, { status: 500 });
  }
} 