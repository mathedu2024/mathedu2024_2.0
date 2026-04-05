import { NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

// 老師列表：id 為 users 集合的文件 ID（溝通橋梁），顯示時請使用 name
export async function GET() {
  try {
    const snapshot = await adminDb.collection('users').where('role', '==', 'teacher').get();
    const teachers = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, name: data.name ?? '', ...data };
    });
    return NextResponse.json(teachers);
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 