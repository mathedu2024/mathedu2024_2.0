import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    await adminDb.collection('course_info').doc(id).delete();
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    let message = '刪除失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 