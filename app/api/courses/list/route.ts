import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';

async function getCourses() {
  try {
    const snapshot = await db.collection('courses').get();
    
    const courses = snapshot.docs.map(doc => {
      const data = doc.data();
      
      // 輔助函式：如果欄位是 Firestore Timestamp，則轉換為 ISO 字串
      const convertDate = (field: unknown) => {
        const timestamp = field as { toDate?: () => Date };
        if (timestamp && typeof timestamp.toDate === 'function') {
          return timestamp.toDate().toISOString();
        }
        return field;
      };

      return {
        id: doc.id,
        ...data,
        startDate: convertDate(data.startDate),
        endDate: convertDate(data.endDate),
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