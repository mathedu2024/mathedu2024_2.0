import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get('courseId');

    if (!courseId) {
      return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
    }

    const courseDocRef = adminDb.collection('courses').doc(courseId);
    const courseDoc = await courseDocRef.get();

    if (!courseDoc.exists) {
      console.log('Course not found for ID:', courseId);
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const studentsSnapshot = await courseDoc.ref.collection('students').get();
    if (studentsSnapshot.empty) {
      return NextResponse.json([]);
    }
    
    const students = studentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json(students);
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) {
      message = error.message;
      console.error('Error in /api/course-student-list/list:', error);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { courseName, courseCode } = body;

    if (!courseName || !courseCode) {
      return NextResponse.json({ error: 'Missing courseName or courseCode' }, { status: 400 });
    }

    // Find course by name and code
    const coursesSnapshot = await adminDb.collection('courses')
      .where('name', '==', courseName)
      .where('code', '==', courseCode)
      .get();

    if (coursesSnapshot.empty) {
      console.log('Course not found for name:', courseName, 'code:', courseCode);
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const courseDoc = coursesSnapshot.docs[0];
    const studentsSnapshot = await courseDoc.ref.collection('students').get();
    
    if (studentsSnapshot.empty) {
      return NextResponse.json([]);
    }
    
    const students = studentsSnapshot.docs.map(doc => ({
      studentId: doc.id,
      ...doc.data()
    }));

    return NextResponse.json(students);
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) {
      message = error.message;
      console.error('Error in /api/course-student-list/list POST:', error);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}