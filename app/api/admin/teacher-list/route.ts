import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';

export async function GET(req: NextRequest) {
  try {
    const snapshot = await adminDb.collection('admin-teachers').get();
    const teachers = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((user: any) => {
        if (Array.isArray(user.role) && user.role.includes('teacher')) return true;
        if (user.role === 'teacher') return true;
        if (Array.isArray(user.roles) && user.roles.includes('teacher')) return true;
        if (user.roles === 'teacher') return true;
        return false;
      });
    return NextResponse.json(teachers);
  } catch (error) {
    return NextResponse.json({ error: (error as any).message || '查詢失敗' }, { status: 500 });
  }
} 