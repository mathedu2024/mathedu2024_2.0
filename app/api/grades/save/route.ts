import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { courseName, courseCode, gradeData } = await req.json();
    if (!courseName || !courseCode || !gradeData) {
      return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
    }
    const docId = `${courseName}(${courseCode})`;
    // 自動補上 grades 物件
    let grades = {};
    if (Array.isArray(gradeData.students)) {
      grades = gradeData.students.reduce((acc: any, stu: any) => {
        if (stu.studentId) acc[stu.studentId] = stu;
        return acc;
      }, {});
    }
    await adminDb.collection('grades').doc(docId).set({ ...gradeData, grades }, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '成績儲存失敗' }, { status: 500 });
  }
} 