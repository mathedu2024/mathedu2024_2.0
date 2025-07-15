import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const docRef = await adminDb.collection('time-slots').add({
      ...data,
      createdAt: new Date(),
      status: 'available',
      currentStudents: 0
    });
    const doc = await docRef.get();
    return NextResponse.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '建立失敗' }, { status: 500 });
  }
} 