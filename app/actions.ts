'use server';

import { adminDb as db } from './firebaseAdmin';

function serializeFirestoreData(data: unknown): unknown {
  if (data === null || data === undefined) return null;
  
  if (typeof data === 'object' && data !== null && 'toDate' in data && typeof (data as { toDate: unknown }).toDate === 'function') {
    return (data as { toDate: () => Date }).toDate().toISOString();
  }
  
  if (Array.isArray(data)) {
    return data.map(serializeFirestoreData);
  }
  
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
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Failed to fetch exams:', errorMessage);
    throw new Error(`無法讀取考試資料: ${errorMessage}`);
  }
}

export async function getGradesAction(studentId: string) {
  try {
    console.log(`Server Action: 正在讀取成績資料 (studentId: ${studentId})...`);
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