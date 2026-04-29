import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

const gradeRankDesc: Record<string, number> = {
  '進修': 100,
  '大一': 90,
  '高三': 80,
  '高二': 79,
  '高一': 78,
  '職三': 70,
  '職二': 69,
  '職一': 68,
  '國三': 60,
  '國二': 59,
  '國一': 58,
};

const chineseClassOrder: Record<string, number> = {
  '忠': 1, '孝': 2, '仁': 3, '愛': 4, '信': 5, '義': 6, '和': 7, '平': 8,
};

const parseClassRank = (className?: string) => {
  const value = String(className || '').trim();
  if (!value) return { bucket: 9, rank: Number.MAX_SAFE_INTEGER };
  const num = Number(value.replace(/[^0-9]/g, ''));
  if (!Number.isNaN(num) && num > 0) return { bucket: 1, rank: num };
  const first = value[0];
  if (first in chineseClassOrder) return { bucket: 2, rank: chineseClassOrder[first] };
  return { bucket: 3, rank: value.charCodeAt(0) };
};

const sortStudentsForSchool = <T extends { grade?: string; className?: string; seatNumber?: number; name?: string }>(students: T[]): T[] => {
  return [...students].sort((a, b) => {
    const gradeDiff = (gradeRankDesc[b.grade || ''] || 0) - (gradeRankDesc[a.grade || ''] || 0);
    if (gradeDiff !== 0) return gradeDiff;

    const classA = parseClassRank(a.className);
    const classB = parseClassRank(b.className);
    if (classA.bucket !== classB.bucket) return classA.bucket - classB.bucket;
    if (classA.rank !== classB.rank) return classA.rank - classB.rank;

    const seatA = Number(a.seatNumber || 999);
    const seatB = Number(b.seatNumber || 999);
    if (seatA !== seatB) return seatA - seatB;
    return String(a.name || '').localeCompare(String(b.name || ''), 'zh-Hant');
  });
};

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
    } as { id: string; grade?: string; className?: string; seatNumber?: number; name?: string; [key: string]: unknown }));

    return NextResponse.json(sortStudentsForSchool(students));
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
    } as { studentId: string; grade?: string; className?: string; seatNumber?: number; name?: string; [key: string]: unknown }));

    return NextResponse.json(sortStudentsForSchool(students));
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) {
      message = error.message;
      console.error('Error in /api/course-student-list/list POST:', error);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}