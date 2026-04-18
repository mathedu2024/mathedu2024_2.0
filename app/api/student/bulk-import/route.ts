import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

interface ImportStudentPayload {
  studentId: string;
  name: string;
  gender: 'male' | 'female';
  grade: string;
  account: string;
  email: string;
  phone: string;
  address: string;
  remarks: string;
  enrolledCourses: string[];
  password: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const students = Array.isArray(body?.students) ? body.students as ImportStudentPayload[] : [];

    if (students.length === 0) {
      return NextResponse.json({ error: '缺少匯入資料' }, { status: 400 });
    }

    if (students.length > 1000) {
      return NextResponse.json({ error: '單次最多匯入 1000 筆' }, { status: 400 });
    }

    const uniqueByStudentId = new Map<string, ImportStudentPayload>();
    for (const student of students) {
      if (!student?.studentId || !student?.name) continue;
      uniqueByStudentId.set(student.studentId, student);
    }
    const validStudents = Array.from(uniqueByStudentId.values());
    if (validStudents.length === 0) {
      return NextResponse.json({ error: '沒有有效的匯入資料' }, { status: 400 });
    }

    const studentRefs = validStudents.map((student) => adminDb.collection('student_data').doc(student.studentId));
    const snapshots = await adminDb.getAll(...studentRefs);
    const existingIds = new Set(snapshots.filter((snap) => snap.exists).map((snap) => snap.id));

    const toCreate = validStudents.filter((student) => !existingIds.has(student.studentId));
    let createdCount = 0;

    for (let i = 0; i < toCreate.length; i += 400) {
      const chunk = toCreate.slice(i, i + 400);
      const batch = adminDb.batch();
      chunk.forEach((student) => {
        const docRef = adminDb.collection('student_data').doc(student.studentId);
        batch.set(docRef, student, { merge: false });
      });
      await batch.commit();
      createdCount += chunk.length;
    }

    return NextResponse.json({
      success: true,
      createdCount,
      skippedCount: validStudents.length - createdCount,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '批次匯入失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
