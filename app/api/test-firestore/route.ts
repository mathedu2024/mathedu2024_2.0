import { NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function GET() {
  try {
    console.log('=== 測試 Firestore 連線 ===');
    
    // 測試寫入
    const testDocId = `test-${Date.now()}`;
    const testData = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Firestore 連線測試'
    };
    
    console.log('準備寫入測試資料:', testData);
    
    const docRef = adminDb.collection('test').doc(testDocId);
    await docRef.set(testData);
    
    console.log('測試資料寫入成功');
    
    // 測試讀取
    const docSnapshot = await docRef.get();
    if (docSnapshot.exists) {
      console.log('測試資料讀取成功:', docSnapshot.data());
      
      // 清理測試資料
      await docRef.delete();
      console.log('測試資料已清理');
      
      return NextResponse.json({ 
        success: true, 
        message: 'Firestore 連線正常',
        testData: docSnapshot.data()
      });
    } else {
      throw new Error('寫入後無法讀取測試資料');
    }
    
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 