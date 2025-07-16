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
      grades = gradeData.students.reduce((acc: Record<string, unknown>, stu: Record<string, unknown>) => {
        if (stu.studentId) acc[stu.studentId as string] = stu;
        return acc;
      }, {} as Record<string, unknown>);
    }
    await adminDb.collection('grades').doc(docId).set({ ...gradeData, grades }, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    let message = '儲存失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 