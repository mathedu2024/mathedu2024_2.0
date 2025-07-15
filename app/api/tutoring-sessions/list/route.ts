import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function GET(req: NextRequest) {
  const snapshot = await adminDb.collection('tutoring-sessions').get();
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  try {
    const { teacherId } = await req.json();
    if (!teacherId) return NextResponse.json({ error: 'Missing teacherId' }, { status: 400 });
    const snapshot = await adminDb.collection('tutoring-sessions')
      .where('teacherId', '==', teacherId)
      .orderBy('createdAt', 'desc')
      .get();
    const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(sessions);
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '查詢失敗' }, { status: 500 });
  }
} 