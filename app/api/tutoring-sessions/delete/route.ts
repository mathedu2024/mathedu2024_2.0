import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    if (!sessionId) {
      return NextResponse.json({ error: '缺少參數' }, { status: 400 });
    }
    await adminDb.collection('tutoring-sessions').doc(sessionId).delete();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    let message = '刪除失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 