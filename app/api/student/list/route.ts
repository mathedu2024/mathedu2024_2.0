import { NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';
 
export async function GET() {
  const snapshot = await adminDb.collection('student_data').get();
  const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json(data);
} 