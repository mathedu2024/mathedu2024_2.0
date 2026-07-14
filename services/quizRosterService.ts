import { adminDb } from './firebase-admin';
import { resolveCourseDocsByEnrolledIds } from './courseId';
import { normalizeAssignedCourses, type Quiz } from './quizTypes';

export interface QuizRosterStudent {
  /** 系統內部學生 ID（與繳交紀錄 studentId 一致） */
  studentId: string;
  /** 學號（顯示用） */
  studentNumber: string;
  name: string;
  grade?: string;
  className?: string;
  account?: string;
  courseLabels: string[];
  /** 學生所屬、且在此測驗適用班級中的課程 key */
  courseIds: string[];
}

/** 取得測驗適用課程的學生名單（多課程合併、依學號去重） */
export async function getQuizCourseRoster(quiz: Quiz): Promise<QuizRosterStudent[]> {
  return getAssignedCoursesRoster(normalizeAssignedCourses(quiz));
}

/** 依適用班級取得合併學生名單（測驗／問卷共用） */
export async function getAssignedCoursesRoster(
  assigned: Array<{ courseId: string; courseName?: string }>
): Promise<QuizRosterStudent[]> {
  if (assigned.length === 0) return [];

  const courseKeys = assigned.map((c) => c.courseId);
  const courseDocs = await resolveCourseDocsByEnrolledIds(adminDb, courseKeys);
  const studentMap = new Map<string, QuizRosterStudent>();

  for (const ref of assigned) {
    const courseDoc = courseDocs.get(ref.courseId);
    if (!courseDoc) continue;

    const data = courseDoc.data();
    const label = ref.courseName || `${data.name ?? ''}（${data.code ?? ''}）`;
    const studentsSnap = await courseDoc.ref.collection('students').get();

    for (const sDoc of studentsSnap.docs) {
      const sData = sDoc.data();
      const studentId = sDoc.id;
      const studentNumber = String(
        sData.studentId || sData.studentCode || sData.account || ''
      ).trim();
      const existing = studentMap.get(studentId);
      if (existing) {
        if (!existing.courseLabels.includes(label)) {
          existing.courseLabels.push(label);
        }
        if (!existing.courseIds.includes(ref.courseId)) {
          existing.courseIds.push(ref.courseId);
        }
        if (!existing.studentNumber && studentNumber) {
          existing.studentNumber = studentNumber;
        }
        continue;
      }
      studentMap.set(studentId, {
        studentId,
        studentNumber,
        name: String(sData.name || ''),
        grade: sData.grade != null ? String(sData.grade) : undefined,
        className: sData.className != null ? String(sData.className) : undefined,
        account: sData.account != null ? String(sData.account) : undefined,
        courseLabels: [label],
        courseIds: [ref.courseId],
      });
    }
  }

  return Array.from(studentMap.values()).sort((a, b) =>
    (a.studentNumber || a.name).localeCompare(b.studentNumber || b.name, undefined, {
      numeric: true,
    })
  );
}
