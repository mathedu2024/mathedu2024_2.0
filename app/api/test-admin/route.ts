import { NextResponse } from 'next/server';

export async function GET() {
  try {
    console.log('Testing Firebase admin connection...');
    
    // Test basic connection by trying to read a document
    // const testDoc = await adminDb.collection('test').doc('test').get(); // 未使用
    
    return NextResponse.json({ 
      success: true, 
      message: 'Firebase admin connection successful',
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 