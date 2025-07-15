import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    let { id, ...data } = await req.json();
    if (!id) id = Date.now().toString();
    
    // 添加創建時間
    const announcementData = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // TODO: session 驗證與權限檢查
    await adminDb.collection('announcements').doc(id).set(announcementData, { merge: true });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating announcement:', error);
    return NextResponse.json({ error: '建立公告失敗' }, { status: 500 });
  }
} 