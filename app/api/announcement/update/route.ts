import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { id, ...data } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    await adminDb.collection('announcements').doc(id).update({
      ...data,
      updatedAt: new Date()
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating announcement:', error);
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
} 