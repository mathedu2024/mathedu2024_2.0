import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const snapshot = await adminDb.collection('科目資料').get();
    const subjects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(subjects);
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '查詢失敗' }, { status: 500 });
  }
} 