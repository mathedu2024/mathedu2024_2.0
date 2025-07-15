import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { courseName, courseCode } = await req.json();
    if (!courseName || !courseCode) return NextResponse.json({ error: 'Missing courseName or courseCode' }, { status: 400 });
    
    const listDocId = `${courseName}(${courseCode})`;
    console.log('Fetching student list for:', listDocId);
    
    const doc = await adminDb.collection('course-student-list').doc(listDocId).get();
    if (!doc.exists) {
      console.log('Student list document not found for:', listDocId);
      return NextResponse.json([]);
    }
    
    const data = doc.data() || {};
    const students = data.students || [];
    console.log('Found students:', students.length);
    return NextResponse.json(students);
  } catch (error) {
    console.error('Error fetching student list:', error);
    return NextResponse.json({ error: (error as any).message || '查詢失敗' }, { status: 500 });
  }
} 