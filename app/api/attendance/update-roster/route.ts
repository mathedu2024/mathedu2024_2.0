import { NextResponse } from 'next/server';
import { db } from '../../../../lib/db';

export async function POST(request: Request) {
  try {
    const { activityId, courseId, roster } = await request.json();
    
    const batch = db.batch();

    interface RosterItem {
      id: string;
      name: string;
      studentId: string;
      status: string;
      leaveType?: string;
      remarks?: string;
    }

    roster.forEach((student: RosterItem) => {
      // 使用 activityId + studentId 作為文件 ID 以確保唯一性
      const docRef = db.collection('attendance').doc(`${activityId}_${student.id}`);
      
      batch.set(docRef, {
        activityId,
        courseId,
        studentId: student.id, // UUID
        studentName: student.name, // Denormalize
        studentCode: student.studentId, // 學號
        status: student.status,
        leaveType: student.leaveType || null,
        remarks: student.remarks || null,
        updatedAt: new Date()
      }, { merge: true });
    });

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[UPDATE_ROSTER_POST]', error);
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}