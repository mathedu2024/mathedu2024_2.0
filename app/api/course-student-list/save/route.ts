import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  const { studentId, oldCourses, newCourses, studentInfo } = await req.json();
  if (!studentId || !Array.isArray(oldCourses) || !Array.isArray(newCourses)) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  // 計算加選與退選的課程
  const added = newCourses.filter((c: string) => !oldCourses.includes(c));
  const removed = oldCourses.filter((c: string) => !newCourses.includes(c));

  // 取得學生資訊（如未傳入）
  let info = studentInfo;
  if (!info) {
    // 從 users 集合查詢
    const userDoc = await adminDb.collection('users').doc(studentId).get();
    info = userDoc.exists ? userDoc.data() : { id: studentId };
  }

  // 加選：將學生加入對應課程的 students 陣列
  for (const courseId of added) {
    const ref = adminDb.collection('course-student-list').doc(courseId);
    const doc = await ref.get();
    const students = (doc.exists ? doc.data()?.students : []) || [];
    if (!students.some((s: { id: string }) => s.id === studentId)) {
      students.push({ 
        id: studentId, 
        name: info.name, 
        account: info.account, 
        email: info.email,
        studentId: info.studentId || studentId,
        grade: info.grade || '未設定'
      });
    }
    await ref.set({ students }, { merge: true });
  }

  // 退選：將學生從對應課程的 students 陣列移除
  for (const courseId of removed) {
    const ref = adminDb.collection('course-student-list').doc(courseId);
    const doc = await ref.get();
    const students = (doc.exists ? doc.data()?.students : []) || [];
    const filteredStudents = students.filter((s: { id: string }) => s.id !== studentId);
    await ref.set({ students: filteredStudents }, { merge: true });
  }

  // 更新現有課程中的學生資訊（確保資訊同步）
  const allEnrolledCourses = [...oldCourses, ...newCourses];
  for (const courseId of allEnrolledCourses) {
    const ref = adminDb.collection('course-student-list').doc(courseId);
    const doc = await ref.get();
    if (doc.exists) {
      const students = doc.data()?.students || [];
      const studentIndex = students.findIndex((s: { id: string }) => s.id === studentId);
      if (studentIndex !== -1) {
        // 更新現有學生的資訊
        students[studentIndex] = {
          ...students[studentIndex],
          name: info.name,
          account: info.account,
          email: info.email,
          studentId: info.studentId || studentId,
          grade: info.grade || '未設定'
        };
        await ref.set({ students }, { merge: true });
      }
    }
  }

  return NextResponse.json({ success: true });
} 