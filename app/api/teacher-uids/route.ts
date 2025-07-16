import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { teacherEmails } = await req.json();
    if (!teacherEmails || !Array.isArray(teacherEmails)) {
      return NextResponse.json({ error: 'teacherEmails 必須為陣列' }, { status: 400 });
    }
    const uids: string[] = [];
    const batchSize = 30;
    for (let i = 0; i < teacherEmails.length; i += batchSize) {
      const batch = teacherEmails.slice(i, i + batchSize);
      const snapshot = await adminDb.collection('users').where('email', 'in', batch).get();
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.uid) uids.push(data.uid);
      });
    }
    return NextResponse.json({ uids });
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 