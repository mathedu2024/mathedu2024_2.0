import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  const data = await req.json();
  const id = data.id || Date.now().toString();
  await adminDb.collection('course_info').doc(id).set(data, { merge: true });
  return NextResponse.json({ success: true, id });
} 