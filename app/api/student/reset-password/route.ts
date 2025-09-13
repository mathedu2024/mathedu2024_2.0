import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    
    if (!id) {
      return NextResponse.json({ error: 'Missing student ID' }, { status: 400 });
    }

    // 重置密碼為預設密碼 'abcd1234'
    const defaultPassword = 'abcd1234';
    
    // 更新學生密碼為明文密碼
    await adminDb.collection('student_data').doc(id).update({
      password: defaultPassword
    });

    return NextResponse.json({ 
      success: true, 
      message: '密碼已重置為預設值' 
    });

  } catch (error) {
    console.error('重置學生密碼失敗:', error);
    return NextResponse.json(
      { error: '重置密碼時發生錯誤' }, 
      { status: 500 }
    );
  }
}
