import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    await adminDb.collection('time-slots').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '刪除失敗' }, { status: 500 });
  }
} 