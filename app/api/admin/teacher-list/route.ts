import { NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function GET() {
  try {
    const snapshot = await adminDb.collection('users').where('role', '==', 'teacher').get();
    const teachers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(teachers);
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 