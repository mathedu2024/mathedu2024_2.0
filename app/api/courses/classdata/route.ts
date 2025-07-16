import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

// GET: 讀取課程主資料
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');
    if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
    
    console.log('Fetching class data for courseId:', courseId);
    
    const doc = await adminDb.collection('courses').doc(courseId).collection('ClassData').doc('main').get();
    if (!doc.exists) {
      console.log('ClassData document not found for courseId:', courseId);
      return NextResponse.json({ location: '', description: '' }, { status: 200 });
    }
    
    const data = doc.data();
    console.log('ClassData found:', data);
    return NextResponse.json(data);
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST: 建立/更新課程主資料
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { courseId, ...classData } = data;
    if (!courseId) return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
    await adminDb.collection('courses').doc(courseId).collection('ClassData').doc('main').set(classData, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    let message = '寫入失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 