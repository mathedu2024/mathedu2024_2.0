import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { account } = await req.json();
    if (!account) return NextResponse.json({ error: 'Missing account' }, { status: 400 });
    const snapshot = await adminDb.collection('student_data').where('account', '==', account).get();
    if (snapshot.empty) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const data = snapshot.docs[0].data();
    return NextResponse.json({ email: data.email || '' });
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '查詢失敗' }, { status: 500 });
  }
} 