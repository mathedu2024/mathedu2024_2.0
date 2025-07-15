import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { account } = await req.json();
    if (!account) return NextResponse.json({ error: 'Missing account' }, { status: 400 });
    const snapshot = await adminDb.collection('users').where('account', '==', account).get();
    if (snapshot.empty) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const doc = snapshot.docs[0];
    const data = doc.data();
    return NextResponse.json({ courses: data.courses || [] });
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '查詢失敗' }, { status: 500 });
  }
} 