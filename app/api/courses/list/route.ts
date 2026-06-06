import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { normalizeCourseDate } from '@/services/courseDate';

async function getCourses() {
  try {
    const snapshot = await db.collection('courses').get();
    
    const courses = snapshot.docs.map(doc => {
      const data = doc.data();

      return {
        id: doc.id,
        ...data,
        startDate: normalizeCourseDate(data.startDate),
        endDate: normalizeCourseDate(data.endDate),
      };
    });

    return NextResponse.json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    return NextResponse.json({ error: 'Failed to fetch courses' }, { status: 500 });
  }
}

export async function GET() {
  return getCourses();
}

export async function POST() {
  return getCourses();
}