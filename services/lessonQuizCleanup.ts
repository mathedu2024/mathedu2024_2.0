import { adminDb } from './firebase-admin';
import type { LessonAssignedQuiz } from './lessonQuiz';

function lessonReferencesQuiz(data: FirebaseFirestore.DocumentData, quizCode: string): boolean {
  const assignedQuizzes = data.assignedQuizzes;
  if (
    Array.isArray(assignedQuizzes) &&
    assignedQuizzes.some(
      (q) => q && typeof q === 'object' && (q as LessonAssignedQuiz).quizCode === quizCode
    )
  ) {
    return true;
  }
  const assignedQuizCodes = data.assignedQuizCodes;
  if (Array.isArray(assignedQuizCodes) && assignedQuizCodes.includes(quizCode)) {
    return true;
  }
  return false;
}

function buildLessonQuizRemovalPayload(
  data: FirebaseFirestore.DocumentData,
  quizCode: string
): { changed: boolean; payload: Record<string, unknown> } {
  const prevQuizzes = Array.isArray(data.assignedQuizzes)
    ? (data.assignedQuizzes as LessonAssignedQuiz[])
    : [];
  const prevCodes = Array.isArray(data.assignedQuizCodes)
    ? (data.assignedQuizCodes as string[])
    : [];

  const nextQuizzes = prevQuizzes.filter((q) => q?.quizCode !== quizCode);
  const nextCodes = prevCodes.filter((code) => code !== quizCode);

  const changed =
    nextQuizzes.length !== prevQuizzes.length || nextCodes.length !== prevCodes.length;

  if (!changed) {
    return { changed: false, payload: {} };
  }

  const onlineExam = typeof data.onlineExam === 'string' ? data.onlineExam.trim() : '';
  const noOnlineExam =
    nextQuizzes.length === 0 && nextCodes.length === 0 && !onlineExam;

  return {
    changed: true,
    payload: {
      assignedQuizzes: nextQuizzes,
      assignedQuizCodes: nextCodes,
      requireQuizBeforeVideo: nextQuizzes.some((q) => q.requireBeforeVideo),
      noOnlineExam,
      updatedAt: new Date().toISOString(),
    },
  };
}

/** 測驗刪除時，自所有課堂移除該測驗的指派 */
export async function removeQuizFromAllLessons(quizCode: string): Promise<number> {
  if (!quizCode) return 0;

  let updatedCount = 0;
  const coursesSnap = await adminDb.collection('courses').get();

  for (const courseDoc of coursesSnap.docs) {
    const lessonsSnap = await courseDoc.ref.collection('lessons').get();
    for (const lessonDoc of lessonsSnap.docs) {
      const data = lessonDoc.data();
      if (!lessonReferencesQuiz(data, quizCode)) continue;

      const { changed, payload } = buildLessonQuizRemovalPayload(data, quizCode);
      if (changed) {
        await lessonDoc.ref.set(payload, { merge: true });
        updatedCount += 1;
      }
    }
  }

  return updatedCount;
}
