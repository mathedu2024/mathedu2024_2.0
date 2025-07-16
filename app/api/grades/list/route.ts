import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    const { courseKeys } = await req.json(); // courseKeys: ["課程名稱(課程代碼)"]
    if (!Array.isArray(courseKeys) || courseKeys.length === 0) {
      return NextResponse.json({ error: 'Missing courseKeys' }, { status: 400 });
    }
    const results: Record<string, unknown> = {};
    for (const key of courseKeys) {
      const doc = await adminDb.collection('grades').doc(key).get();
      if (doc.exists) {
        const data = doc.data();
        if (data) {
          // 取得 teacherIds 或 teachers 欄位
          let teacherIds = data.teacherIds || data.teachers || [];
          if (typeof teacherIds === 'string') teacherIds = [teacherIds];
          if (!Array.isArray(teacherIds)) teacherIds = [];
          let teacherNames: string[] = [];
          if (teacherIds.length > 0) {
            // 用 doc(id) 查詢
            const userDocs = await Promise.all(
              teacherIds.map((id: string) => adminDb.collection('users').doc(id).get())
            );
            teacherNames = userDocs
              .filter(doc => doc.exists)
              .map(doc => doc.get('name') || doc.get('account') || doc.id);
          }
          results[key] = { ...data, teacherNames };
        } else {
          results[key] = null;
        }
      } else {
        results[key] = null;
      }
    }
    return NextResponse.json(results);
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) message = error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
} 