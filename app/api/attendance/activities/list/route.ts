import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { ensureActivityCheckInCode } from '@/services/attendanceCode';

export async function POST(req: NextRequest) {
  try {
    const { courseId } = await req.json();
    if (!courseId) return NextResponse.json({ error: 'Course ID required' }, { status: 400 });

    const activitiesRef = db.collection('courses').doc(courseId).collection('attendance');
    const snapshot = await activitiesRef.get();

    const activities = await Promise.all(snapshot.docs.map(async (doc) => {
        const data = doc.data();
        let checkInCode = data.checkInCode || null;
        if (!checkInCode) {
          try {
            checkInCode = await ensureActivityCheckInCode(db, courseId, doc.id);
          } catch {
            checkInCode = null;
          }
        }
        return {
            id: doc.id,
            title: data.title || data.type || '未命名活動',
            startTime: data.startTime || data.date || new Date().toISOString(),
            endTime: data.endTime || new Date().toISOString(),
            status: data.status || 'completed',
            checkInMethod: data.checkInMethod || 'manual',
            checkInCode,
            expected: data.expected || 0,
            present: data.present || 0,
            absent: data.absent || 0,
            leave: data.leave || 0,
        };
    }));

    return NextResponse.json(activities);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}