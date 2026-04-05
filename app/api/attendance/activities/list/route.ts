import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { courseId } = await req.json();
    if (!courseId) return NextResponse.json({ error: 'Course ID required' }, { status: 400 });

    const activitiesRef = db.collection('courses').doc(courseId).collection('attendance');
    const snapshot = await activitiesRef.get();

    const activities = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            title: data.title || data.type || '未命名活動',
            startTime: data.startTime || data.date || new Date().toISOString(),
            endTime: data.endTime || new Date().toISOString(),
            status: data.status || 'completed',
            checkInMethod: data.checkInMethod || 'manual',
            checkInCode: data.checkInCode || null,
            expected: data.expected || 0,
            present: data.present || 0,
            absent: data.absent || 0,
            leave: data.leave || 0,
        };
    });

    return NextResponse.json(activities);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}