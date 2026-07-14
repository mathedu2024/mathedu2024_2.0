import { NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { db } from '@/utils/firebase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    const docRef = db.collection('student_data').doc(id);
    const doc = await docRef.get();

    if (doc.exists) {
      return NextResponse.json({ id: doc.id, ...doc.data() });
    }

    // 與 dashboard-data 一致：doc id 對不到時改以 studentId 欄位查詢
    const byStudentId = await db
      .collection('student_data')
      .where('studentId', '==', id)
      .limit(1)
      .get();

    if (!byStudentId.empty) {
      const matched = byStudentId.docs[0];
      return NextResponse.json({ id: matched.id, ...matched.data() });
    }

    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error fetching student profile:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', details: (error as Error)?.message },
      { status: 500 }
    );
  }
}
