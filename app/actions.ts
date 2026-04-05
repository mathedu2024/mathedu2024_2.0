'use server';

import { adminDb as db } from './firebaseAdmin';

// 輔助函式：遞迴將 Firestore 資料轉換為純 JSON (處理 Timestamp 與 Reference)
function serializeFirestoreData(data: unknown): unknown {
  if (data === null || data === undefined) return null;
  
  // 處理 Firestore Timestamp
  if (typeof data === 'object' && data !== null && 'toDate' in data && typeof (data as { toDate: unknown }).toDate === 'function') {
    return (data as { toDate: () => Date }).toDate().toISOString();
  }
  
  // 處理陣列
  if (Array.isArray(data)) {
    return data.map(serializeFirestoreData);
  }
  
  // 處理物件
  if (typeof data === 'object') {
    const result: Record<string, unknown> = {};
    for (const key in data) {
      result[key] = serializeFirestoreData((data as Record<string, unknown>)[key]);
    }
    return result;
  }
  
  return data;
}

export async function getAnnouncementsAction() {
  try {
    console.log('Server Action: 正在讀取公告資料...');
    const snapshot = await db.collection('announcements').orderBy('createdAt', 'desc').get();
    return snapshot.docs.map(doc => {
      return {
        id: doc.id,
        ...(serializeFirestoreData(doc.data()) as Record<string, unknown>),
      };
    });
  } catch (error) {
    // 修正: 只記錄錯誤訊息字串，避免 Next.js 序列化複雜 Error 物件導致客戶端崩潰
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch announcements:', errorMessage);
    throw new Error(`無法讀取公告資料: ${errorMessage}`);
  }
}

export async function getExamsAction() {
  try {
    console.log('Server Action: 正在讀取考試資料...');
    const snapshot = await db.collection('exam_dates').orderBy('startDate', 'asc').get();
    return snapshot.docs.map(doc => {
      return {
        id: doc.id,
        ...(serializeFirestoreData(doc.data()) as Record<string, unknown>),
      };
    });
  } catch (error) {
    // 修正: 只記錄錯誤訊息字串
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch exams:', errorMessage);
    throw new Error(`無法讀取考試資料: ${errorMessage}`);
  }
}

export async function getGradesAction(studentId: string) {
  try {
    console.log(`Server Action: 正在讀取成績資料 (studentId: ${studentId})...`);
    // 假設成績資料位於 'grades' 集合，請根據實際資料庫集合名稱調整
    const snapshot = await db.collection('grades').where('studentId', '==', studentId).get();
    return snapshot.docs.map(doc => {
      return {
        id: doc.id,
        ...(serializeFirestoreData(doc.data()) as Record<string, unknown>),
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch grades:', errorMessage);
    throw new Error(`無法讀取成績資料: ${errorMessage}`);
  }
}