import type { DocumentData, DocumentReference, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { adminDb, quizDb } from './firebase-admin';
import { isQuizDbSeparated } from './quizDbSplit';

function requireDb(db: FirebaseFirestore.Firestore | undefined, label: string): FirebaseFirestore.Firestore {
  if (!db || typeof db.collection !== 'function') {
    throw new Error(`Firebase ${label} DB is not initialized`);
  }
  return db;
}

export type SurveyDataLocation = 'quiz' | 'core';

const SURVEYS = 'course_surveys';
const RESPONSES = 'survey_responses';

/** 問卷與測驗共用 quizDb；未分離時與主站同一實例 */
export function surveysCollection(location: SurveyDataLocation) {
  const db = location === 'quiz' ? requireDb(quizDb, 'quiz') : requireDb(adminDb, 'core');
  return db.collection(SURVEYS);
}

export function surveyResponsesCollection(location: SurveyDataLocation) {
  const db = location === 'quiz' ? requireDb(quizDb, 'quiz') : requireDb(adminDb, 'core');
  return db.collection(RESPONSES);
}

export async function findSurveyDocument(
  surveyId: string
): Promise<{ location: SurveyDataLocation; ref: DocumentReference; data: DocumentData } | null> {
  const quizDoc = await surveysCollection('quiz').doc(surveyId).get();
  if (quizDoc.exists) {
    return { location: 'quiz', ref: quizDoc.ref, data: quizDoc.data()! };
  }

  if (!isQuizDbSeparated()) return null;

  const coreDoc = await surveysCollection('core').doc(surveyId).get();
  if (coreDoc.exists) {
    return { location: 'core', ref: coreDoc.ref, data: coreDoc.data()! };
  }

  return null;
}

export async function findSurveyDocumentByCode(
  surveyCode: string
): Promise<{ location: SurveyDataLocation; ref: DocumentReference; data: DocumentData; id: string } | null> {
  const quizSnap = await surveysCollection('quiz').where('surveyCode', '==', surveyCode).limit(1).get();
  if (!quizSnap.empty) {
    const doc = quizSnap.docs[0];
    return { location: 'quiz', ref: doc.ref, data: doc.data(), id: doc.id };
  }

  if (!isQuizDbSeparated()) return null;

  const coreSnap = await surveysCollection('core').where('surveyCode', '==', surveyCode).limit(1).get();
  if (!coreSnap.empty) {
    const doc = coreSnap.docs[0];
    return { location: 'core', ref: doc.ref, data: doc.data(), id: doc.id };
  }

  return null;
}

/** 合併兩庫查詢結果；同一 docId 以 quiz 庫為準 */
export function mergeSurveyDocsById(
  preferred: QueryDocumentSnapshot[],
  fallback: QueryDocumentSnapshot[]
): QueryDocumentSnapshot[] {
  const map = new Map<string, QueryDocumentSnapshot>();
  for (const doc of fallback) map.set(doc.id, doc);
  for (const doc of preferred) map.set(doc.id, doc);
  return Array.from(map.values());
}

/**
 * 將問卷本體與回應從主站 DB 搬到測驗／問卷 DB（同 docId），成功後刪除舊庫資料。
 */
export async function migrateSurveyAndResponsesFromCore(
  surveyId: string,
  surveyData: DocumentData
): Promise<void> {
  if (!isQuizDbSeparated()) return;

  const surveyRef = surveysCollection('quiz').doc(surveyId);
  await surveyRef.set(surveyData, { merge: false });

  const coreResponsesSnap = await surveyResponsesCollection('core').where('surveyId', '==', surveyId).get();
  if (!coreResponsesSnap.empty) {
    const docs = coreResponsesSnap.docs;
    const chunkSize = 400;

    for (let i = 0; i < docs.length; i += chunkSize) {
      const chunk = docs.slice(i, i + chunkSize);
      const writeBatch = quizDb.batch();
      for (const doc of chunk) {
        writeBatch.set(surveyResponsesCollection('quiz').doc(doc.id), doc.data(), { merge: false });
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

  await surveysCollection('core').doc(surveyId).delete();
  console.log(
    `[survey-migrate] Moved survey ${surveyId} (+ ${coreResponsesSnap.size} responses) from core → quiz DB`
  );
}

/** 回應寫入／查詢庫：問卷在哪，回應就跟哪 */
export async function resolveSurveyResponseLocation(surveyId: string): Promise<SurveyDataLocation> {
  if (!isQuizDbSeparated()) return 'quiz';

  const quizDoc = await surveysCollection('quiz').doc(surveyId).get();
  if (quizDoc.exists) return 'quiz';

  const coreDoc = await surveysCollection('core').doc(surveyId).get();
  if (coreDoc.exists) return 'core';

  return 'quiz';
}

export { isQuizDbSeparated as isSurveyDbSeparated };
