import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/services/firebase';
import { doc, deleteDoc } from 'firebase/firestore';

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

    const examRef = doc(db, 'exam_dates', id);
    await deleteDoc(examRef);

    return NextResponse.json({ message: 'Exam date deleted successfully' });
  } catch (error) {
    console.error('Error deleting exam date:', error);
    return NextResponse.json({ message: 'Error deleting exam date' }, { status: 500 });
  }
}
