import type { DocumentData, DocumentReference, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb, quizDb } from './firebase-admin';

function requireDb(db: FirebaseFirestore.Firestore | undefined, label: string): FirebaseFirestore.Firestore {
  if (!db || typeof db.collection !== 'function') {
    throw new Error(`Firebase ${label} DB is not initialized`);
  }
  return db;
}

function underlyingAdminState(): { db: FirebaseFirestore.Firestore; quizDb: FirebaseFirestore.Firestore } {
  const state = (globalThis as typeof globalThis & {
    _firebaseAdmin?: { db: FirebaseFirestore.Firestore; quizDb: FirebaseFirestore.Firestore };
  })._firebaseAdmin;
  if (!state?.db || !state.quizDb) {
    throw new Error('Firebase Admin DB is not initialized');
  }
  return state;
}

/** 測驗專用 FB 是否已與主站分離（未設定 QUIZ 憑證時兩者為同一實例） */
export function isQuizDbSeparated(): boolean {
  const state = underlyingAdminState();
  return state.quizDb !== state.db;
}

export type QuizDataLocation = 'quiz' | 'core';

export function quizzesCollection(location: QuizDataLocation) {
  const db = location === 'quiz' ? requireDb(quizDb, 'quiz') : requireDb(adminDb, 'core');
  return db.collection('quizzes');
}

export function submissionsCollection(location: QuizDataLocation) {
  const db = location === 'quiz' ? requireDb(quizDb, 'quiz') : requireDb(adminDb, 'core');
  return db.collection('quiz_submissions');
}

export async function findQuizDocument(
  quizId: string
): Promise<{ location: QuizDataLocation; ref: DocumentReference; data: DocumentData } | null> {
  const quizDoc = await quizzesCollection('quiz').doc(quizId).get();
  if (quizDoc.exists) {
    return { location: 'quiz', ref: quizDoc.ref, data: quizDoc.data()! };
  }

  if (!isQuizDbSeparated()) return null;

  const coreDoc = await quizzesCollection('core').doc(quizId).get();
  if (coreDoc.exists) {
    return { location: 'core', ref: coreDoc.ref, data: coreDoc.data()! };
  }

  return null;
}

export async function findQuizDocumentByCode(
  quizCode: string
): Promise<{ location: QuizDataLocation; ref: DocumentReference; data: DocumentData; id: string } | null> {
  const quizSnap = await quizzesCollection('quiz').where('quizCode', '==', quizCode).limit(1).get();
  if (!quizSnap.empty) {
    const doc = quizSnap.docs[0];
    return { location: 'quiz', ref: doc.ref, data: doc.data(), id: doc.id };
  }

  if (!isQuizDbSeparated()) return null;

  const coreSnap = await quizzesCollection('core').where('quizCode', '==', quizCode).limit(1).get();
  if (!coreSnap.empty) {
    const doc = coreSnap.docs[0];
    return { location: 'core', ref: doc.ref, data: doc.data(), id: doc.id };
  }

  return null;
}

/** 合併兩庫查詢結果；同一 docId 以 quiz 庫為準 */
export function mergeDocsById(
  preferred: QueryDocumentSnapshot[],
  fallback: QueryDocumentSnapshot[]
): QueryDocumentSnapshot[] {
  const map = new Map<string, QueryDocumentSnapshot>();
  for (const doc of fallback) map.set(doc.id, doc);
  for (const doc of preferred) map.set(doc.id, doc);
  return Array.from(map.values());
}

/**
 * 將測驗本體與相關作答從主站 DB 搬到測驗 DB（同 docId），成功後刪除舊庫資料。
 * 跨專案無單一 transaction：先寫新庫 → 確認 → 再刪舊庫。
 */
export async function migrateQuizAndSubmissionsFromCore(
  quizId: string,
  quizData: DocumentData
): Promise<void> {
  if (!isQuizDbSeparated()) return;

  const quizRef = quizzesCollection('quiz').doc(quizId);
  await quizRef.set(quizData, { merge: false });

  const coreSubsSnap = await submissionsCollection('core').where('quizId', '==', quizId).get();
  if (!coreSubsSnap.empty) {
    const docs = coreSubsSnap.docs;
    const chunkSize = 400;

    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const writeBatch = quizDb.batch();
      for (const doc of chunk) {
        writeBatch.set(submissionsCollection('quiz').doc(doc.id), doc.data(), { merge: false });
      }
      await writeBatch.commit();
    }

    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const deleteBatch = adminDb.batch();
      for (const doc of chunk) {
        deleteBatch.delete(doc.ref);
      }
      await deleteBatch.commit();
    }
  }

  await quizzesCollection('core').doc(quizId).delete();
  console.log(`[quiz-migrate] Moved quiz ${quizId} (+ ${coreSubsSnap.size} submissions) from core → quiz DB`);
}

/** 解析作答應寫入／更新的庫：測驗在哪，作答就跟哪 */
export async function resolveSubmissionLocation(quizId: string): Promise<QuizDataLocation> {
  if (!isQuizDbSeparated()) return 'quiz';

  const quizDoc = await quizzesCollection('quiz').doc(quizId).get();
  if (quizDoc.exists) return 'quiz';

  const coreDoc = await quizzesCollection('core').doc(quizId).get();
  if (coreDoc.exists) return 'core';

  return 'quiz';
}
