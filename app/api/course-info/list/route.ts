import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const snapshot = await adminDb.collection('course_info').get();
    const courses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(courses);
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '查詢失敗' }, { status: 500 });
  }
} 