import { NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';
 
export async function GET() {
  const snapshot = await adminDb.collection('student_data').get();
  const data = snapshot.docs.map(doc => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...studentData } = doc.data();
    return { id: doc.id, ...studentData };
  });
  return NextResponse.json(data);
} 