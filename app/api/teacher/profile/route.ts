import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { account } = await req.json();
    console.log('teacher/profile API - Looking up teacher with account:', account);
    
    if (!account) return NextResponse.json({ error: 'Missing account' }, { status: 400 });
    
    const snapshot = await adminDb.collection('users').where('account', '==', account).get();
    console.log('teacher/profile API - Found', snapshot.docs.length, 'users with account:', account);
    
    if (snapshot.empty) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    
    const doc = snapshot.docs[0];
    // 以 Firestore 文件 ID 作為 id（溝通橋梁），前端顯示老師時請使用 name
    const userData = { id: doc.id, ...doc.data() };
    console.log('teacher/profile API - Returning user data:', userData);
    
    return NextResponse.json(userData);
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 