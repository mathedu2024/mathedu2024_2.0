import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function POST(req: NextRequest) {
  const data = await req.json();
  // TODO: session 驗證與權限檢查
  if (!data.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  await adminDb.collection('users').doc(data.id).set(data, { merge: true });
  return NextResponse.json({ success: true });
} 