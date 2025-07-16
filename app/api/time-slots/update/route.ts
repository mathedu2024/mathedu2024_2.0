import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { id, ...updateData } = await req.json();
    const docRef = adminDb.collection('time-slots').doc(id);
    await docRef.update({ ...updateData, updatedAt: new Date() });
    const doc = await docRef.get();
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (error: unknown) {
    let message = '更新失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 