import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  const { id, ...studentData } = await req.json();
  // TODO: session 驗證與權限檢查
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await adminDb.collection('student_data').doc(id).set(studentData, { merge: true });
  return NextResponse.json({ success: true });
} 