import { NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function GET() {
  const snap = await adminDb.collection('users').where('roles', 'array-contains', 'teacher').get();
  const teachers = snap.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id, // 用文件ID
      name: data.name,
      account: data.account,
      roles: data.roles,
      // ...其他欄位如需
    };
      });
    return NextResponse.json(teachers);
} 