import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    // 刪除學生主檔
    await adminDb.collection('student_data').doc(id).delete();
    // 同步移除所有課程名單中的該學生
    const courseLists = await adminDb.collection('course-student-list').get();
    const batch = adminDb.batch();
    courseLists.forEach(docSnap => {
      const data = docSnap.data();
      if (Array.isArray(data.students)) {
        const newStudents = data.students.filter((s: any) => s.studentId !== id);
        if (newStudents.length !== data.students.length) {
          batch.update(docSnap.ref, { students: newStudents });
        }
      }
    });
    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '刪除失敗' }, { status: 500 });
  }
} 