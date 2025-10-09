import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  const doc = await adminDb.collection('student_data').doc(id).get();
  if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const studentData = doc.data();
  const enrolledCoursesRaw = studentData.enrolledCourses || [];
  
  const enrolledCourseNames = enrolledCoursesRaw.map((courseString: string) => {
    const lastParen = courseString.lastIndexOf('(');
    if (lastParen !== -1) {
      return courseString.substring(0, lastParen);
    }
    return courseString;
  });

  const profile = {
    id: doc.id,
    name: studentData.name,
    account: studentData.account,
    role: studentData.role,
    studentId: studentData.studentId,
    grade: studentData.grade,
    email: studentData.email || '',
    enrolledCourses: enrolledCourseNames,
  };

  return NextResponse.json(profile);
} 