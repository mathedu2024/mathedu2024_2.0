import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
 
export async function POST(req: NextRequest) {
  try {
    const { date } = await req.json();
    let query = adminDb.collection('time-slots').where('status', '==', 'available');
    if (date) {
      query = query.where('date', '==', date);
    } else {
      const today = new Date().toISOString().split('T')[0];
      query = query.where('date', '>=', today);
    }
    const snapshot = await query.get();
    const slots = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(slots);
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 