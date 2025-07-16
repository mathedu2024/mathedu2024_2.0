import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { courseName, courseCode, studentId } = await req.json();
    if (!courseName || !courseCode || !studentId) {
      return NextResponse.json({ error: 'Missing courseName, courseCode, or studentId' }, { status: 400 });
    }

    const listDocId = `${courseName}(${courseCode})`;
    const docRef = adminDb.collection('course-student-list').doc(listDocId);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Course student list not found' }, { status: 404 });
    }

    const data = doc.data() || {};
    const students = data.students || [];
    
    // 移除指定學生
    const updatedStudents = students.filter((s: { id: string }) => s.id !== studentId);
    
    // 更新文檔
    await docRef.set({ students: updatedStudents }, { merge: true });

    // 同時更新學生的 enrolledCourses（更新 users 集合）
    const userDocRef = adminDb.collection('users').doc(studentId);
    const userDoc = await userDocRef.get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      const enrolledCourses = userData?.enrolledCourses || [];
      const courseId = `${courseName}(${courseCode})`;
      const updatedEnrolledCourses = enrolledCourses.filter((course: string) => course !== courseId);
      
      await userDocRef.update({ enrolledCourses: updatedEnrolledCourses });
      console.log(`Updated users for ${studentId}: removed course ${courseId}`);
    } else {
      console.log(`User not found for ${studentId}`);
    }

    // 同時更新 student_data 集合中的 enrolledCourses
    // 注意：studentId 是學生的文檔 ID（學號）
    const studentDataDocRef = adminDb.collection('student_data').doc(studentId);
    const studentDataDoc = await studentDataDocRef.get();
    
    if (studentDataDoc.exists) {
      const studentData = studentDataDoc.data();
      const enrolledCourses = studentData?.enrolledCourses || [];
      const courseId = `${courseName}(${courseCode})`;
      const updatedEnrolledCourses = enrolledCourses.filter((course: string) => course !== courseId);
      
      await studentDataDocRef.update({ enrolledCourses: updatedEnrolledCourses });
      console.log(`Updated student_data for ${studentId}: removed course ${courseId}`);
    } else {
      console.log(`Student data not found for ${studentId}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    let message = '移除失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 