import { NextResponse } from 'next/server';
import { db } from '../../../lib/db';

export async function GET() {
  try {
    const snapshot = await db.collection('courses').get();
    const courses = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return NextResponse.json(courses);
  } catch (error) {
    console.error('[COURSES_GET]', error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}