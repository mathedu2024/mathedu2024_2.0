import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, newStatus } = await req.json();
    if (!sessionId || !newStatus) {
      return NextResponse.json({ error: '缺少參數' }, { status: 400 });
    }
    const docRef = adminDb.collection('tutoring-sessions').doc(sessionId);
    await docRef.update({ status: newStatus, updatedAt: new Date() });
    const doc = await docRef.get();
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (error: unknown) {
    let message = '更新失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 