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
    const userData = { id: doc.id, ...doc.data() };
    console.log('teacher/profile API - Returning user data:', userData);
    
    return NextResponse.json(userData);
  } catch (error) {
    console.error('teacher/profile API - Error:', error);
    return NextResponse.json({ error: (error as any).message || '查詢失敗' }, { status: 500 });
  }
} 