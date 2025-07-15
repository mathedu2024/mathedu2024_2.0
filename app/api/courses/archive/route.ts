import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { id, archived } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    
    const updateData: any = { archived };
    if (archived) {
      updateData.status = '已封存';
    } else {
      updateData.status = '未開課';
    }
    
    await adminDb.collection('courses').doc(id).update(updateData);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '操作失敗' }, { status: 500 });
  }
} 