import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  const { id, students } = await req.json();
  if (!id || !Array.isArray(students)) return NextResponse.json({ error: 'Missing id or students' }, { status: 400 });
  await adminDb.collection('courses').doc(id).update({ students });
  return NextResponse.json({ success: true });
} 