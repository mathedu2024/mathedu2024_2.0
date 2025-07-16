import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json([]);
    }
    // Firestore in 查詢最多 10 個，需分批查詢
    const batchSize = 10;
    let teachers: { id: string; name: string }[] = [];
    for (let i = 0; i < ids.length; i += batchSize) {
      const batchIds = ids.slice(i, i + batchSize);
      // 用文件ID查詢
      const snap = await adminDb.collection('users').where(FieldPath.documentId(), 'in', batchIds).get();
      teachers = teachers.concat(
        snap.docs.map((doc: any) => {
          const data = doc.data();
          return { id: doc.id, name: data.name };
        })
      );
    }
    return NextResponse.json(teachers);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
} 