import { NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';

/**
 * 老師列表 API
 *
 * - 以 Firestore 文件 ID 作為老師的唯一識別（溝通橋梁），例如：2c8eac7b-d2bc-4f8b-a44d-b5c9b464d54b
 * - 顯示時一律使用 name 欄位
 * - 同時支援：
 *   - 新版：users 集合中的文件（以文件 ID 對應 courses.teachers）
 *   - 舊版：teachers 集合中的文件（相容舊資料）
 */
export async function GET() {
  try {
    // 新版來源：users 集合（不再以 role 篩選，改為全量讀取，確保能用 id 對接 courses.teachers）
    const usersSnapshot = await adminDb.collection('users').get();

    const teacherMap = new Map<string, { id: string; name: string; [key: string]: unknown }>();

    usersSnapshot.docs.forEach((doc) => {
      const data = doc.data();
      teacherMap.set(doc.id, {
        id: doc.id,
        name: (data as { name?: string }).name ?? '',
        ...data,
      });
    });

    // 舊版來源：teachers 集合（若存在則合併進來，id 仍為文件 ID）
    try {
      const legacySnapshot = await adminDb.collection('teachers').get();
      legacySnapshot.docs.forEach((doc) => {
        if (teacherMap.has(doc.id)) return; // 已有同 ID 的 users 資料就略過
        const data = doc.data();
        teacherMap.set(doc.id, {
          id: doc.id,
          name: (data as { name?: string }).name ?? '',
          ...data,
        });
      });
    } catch (e) {
      console.warn('teacher/list API - failed to read legacy teachers collection:', e);
    }

    const teachers = Array.from(teacherMap.values());
    return NextResponse.json(teachers);
  } catch (error) {
    console.error('Error fetching teachers:', error);
    return NextResponse.json({ error: 'Failed to fetch teachers' }, { status: 500 });
  }
}