import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../firebaseAdmin';

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const { id: rawId, ...data } = raw;
    const id = rawId || Date.now().toString();
    
    const announcementData = {
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await adminDb.collection('announcements').doc(id).set(announcementData, { merge: true });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('Error creating announcement:', error);
    return NextResponse.json({ error: '建立公告失敗' }, { status: 500 });
  }
} 