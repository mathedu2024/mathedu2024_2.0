import type { DocumentData } from 'firebase-admin/firestore';
import { adminDb } from './firebase-admin';

function requireDb(db: FirebaseFirestore.Firestore | undefined): FirebaseFirestore.Firestore {
  if (!db || typeof db.collection !== 'function') {
    throw new Error('Firebase core DB is not initialized');
  }
  return db;
}

/** 內容集合固定在 core（與課程同庫；測驗另走 quizDb） */
export function isContentDbSeparated(): boolean {
  return false;
}

export function contentCollection(name: string) {
  return requireDb(adminDb).collection(name);
}

export function contentWriteCollection(name: string) {
  return contentCollection(name);
}

export async function listContentDocs(
  collectionName: string,
  options?: {
    orderBy?: { field: string; direction?: FirebaseFirestore.OrderByDirection };
    limit?: number;
  }
): Promise<Array<{ id: string } & DocumentData>> {
  let q: FirebaseFirestore.Query = contentCollection(collectionName);
  if (options?.orderBy) {
    q = q.orderBy(options.orderBy.field, options.orderBy.direction || 'asc');
  }
  if (options?.limit) {
    q = q.limit(options.limit);
  }
  const snap = await q.get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

export async function getContentDoc(
  collectionName: string,
  docId: string
): Promise<{ id: string; data: DocumentData; location: 'core' } | null> {
  const doc = await contentCollection(collectionName).doc(docId).get();
  if (!doc.exists) return null;
  return { id: doc.id, data: doc.data()!, location: 'core' };
}
