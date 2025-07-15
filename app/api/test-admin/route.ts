import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    console.log('Testing Firebase admin connection...');
    
    // Test basic connection by trying to read a document
    const testDoc = await adminDb.collection('test').doc('connection').get();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Firebase admin connection successful',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Firebase admin connection test failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as any).message || 'Connection failed',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 