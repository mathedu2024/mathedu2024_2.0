import { NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function GET() {
  const [studentsSnap, usersSnap, coursesSnap] = await Promise.all([
    adminDb.collection('student_data').get(),
    adminDb.collection('users').get(),
    adminDb.collection('courses').get(),
  ]);

  // 只統計 users 集合的教師數
  let teacherCount = 0;
  usersSnap.docs.forEach(doc => {
    const data = doc.data();
    if (
      (Array.isArray(data.role) && data.role.includes('teacher')) ||
      data.role === 'teacher' ||
      (Array.isArray(data.roles) && data.roles.includes('teacher')) ||
      data.roles === 'teacher'
    ) {
      teacherCount++;
    }
  });

  return NextResponse.json({
    studentCount: studentsSnap.size,
    teacherCount,
    courseCount: coursesSnap.size,
  });
} 