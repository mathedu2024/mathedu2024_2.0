import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    // 先查找 account 欄位等於 id 的文件
    const snapshot = await adminDb.collection('users').where('account', '==', id).get();
    if (snapshot.empty) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const batch = adminDb.batch();
    snapshot.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '刪除失敗' }, { status: 500 });
  }
} 