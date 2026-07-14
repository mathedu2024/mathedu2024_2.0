import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ message: 'Exam ID is required' }, { status: 400 });
    }

    // Prevent deletion of main exams (學測, 統測, 會考, 分科測驗)
    const MAIN_EXAM_IDS = ['gsat', 'tcat', 'bcat', 'ast'];
    if (MAIN_EXAM_IDS.includes(id)) {
      return NextResponse.json({ message: 'Cannot delete main exam dates' }, { status: 403 });
    }

    await adminDb.collection('exam_dates').doc(id).delete();

    return NextResponse.json({ message: 'Exam date deleted successfully' });
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    console.error('Error deleting exam date:', error);
    return NextResponse.json({ message: 'Error deleting exam date' }, { status: 500 });
  }
}
