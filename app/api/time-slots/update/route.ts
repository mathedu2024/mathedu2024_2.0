import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { id, ...updateData } = await req.json();
    const docRef = adminDb.collection('time-slots').doc(id);
    await docRef.update({ ...updateData, updatedAt: new Date() });
    const doc = await docRef.get();
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '更新失敗' }, { status: 500 });
  }
} 