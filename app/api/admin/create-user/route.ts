import { NextRequest, NextResponse } from 'next/server';

import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    
    if (!data.id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    console.log(`API - Creating/updating user: ${data.id}`);
    
    await adminDb.collection('users').doc(data.id).set(data, { merge: true });
    
    console.log(`API - User ${data.id} created/updated successfully`);
    return NextResponse.json({ success: true, message: '用戶創建/更新成功' });
  } catch (error) {
    console.error('API - Create user error:', error);
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    );
  }
} 