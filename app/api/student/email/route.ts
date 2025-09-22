import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { studentID } = await req.json();
    if (!studentID) return NextResponse.json({ error: 'Missing studentID' }, { status: 400 });
    const snapshot = await adminDb.collection('student_data').where('studentID', '==', studentID).get();
    if (snapshot.empty) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const data = snapshot.docs[0].data();
    return NextResponse.json({ email: data.email || '' });
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 