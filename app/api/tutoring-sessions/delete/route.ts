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
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '刪除失敗' }, { status: 500 });
  }
} 