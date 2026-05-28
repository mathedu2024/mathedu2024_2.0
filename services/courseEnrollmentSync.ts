import { adminDb } from '@/services/firebase-admin';
import { getCourseCompositeKey, resolveSingleCourseDoc, type CourseRefTarget } from '@/services/courseId';
import { defaultGradeSettings, normalizeGradeDocStudents } from '@/services/gradeShape';
import { FieldValue } from 'firebase-admin/firestore';

type ResolvedCourseTarget = CourseRefTarget & { enrolledKeys: string[] };

export type SyncEnrollmentResult = {
  enrolledCourses: string[];
  addedCourseIds: string[];
  removedCourseIds: string[];
};

async function resolveCourseTargets(keys: string[]): Promise<ResolvedCourseTarget[]> {
  const byDocId = new Map<string, ResolvedCourseTarget>();

  for (const key of keys) {
    if (!key) continue;
    const doc = await resolveSingleCourseDoc(adminDb, key);
    if (!doc) continue;

    const data = doc.data();
    const target: CourseRefTarget = {
      id: doc.id,
      name: String(data.name || ''),
      code: String(data.code || ''),
    };

    const existing = byDocId.get(doc.id);
    if (existing) {
      if (!existing.enrolledKeys.includes(key)) existing.enrolledKeys.push(key);
    } else {
      byDocId.set(doc.id, { ...target, enrolledKeys: [key] });
    }
  }

  return [...byDocId.values()];
}

async function syncLegacyCourseStudentList(
  course: CourseRefTarget,
  studentId: string,
  action: 'add' | 'remove',
  studentDetails: Record<string, unknown>
) {
  const listDocId = getCourseCompositeKey(course.name, course.code);
  const listRef = adminDb.collection('course-student-list').doc(listDocId);
  const listDoc = await listRef.get();
  const students = listDoc.exists ? listDoc.data()?.students || [] : [];

  if (action === 'remove') {
    const updated = students.filter((s: { id?: string }) => s.id !== studentId);
    await listRef.set({ students: updated }, { merge: true });
    return;
  }

  if (!students.some((s: { id?: string }) => s.id === studentId)) {
    await listRef.set({ students: [...students, studentDetails] }, { merge: true });
  }
}

async function removeStudentFromCourseGrades(courseDocId: string, studentId: string, accountId?: string) {
  const gradeRef = adminDb.collection('courses').doc(courseDocId).collection('grades').doc('data');
  const gradeDoc = await gradeRef.get();
  if (!gradeDoc.exists) return;

  const students = normalizeGradeDocStudents(gradeDoc.data());
  const filtered = students.filter((row) => {
    const sid = String(row.studentId || '');
    return sid !== studentId && sid !== accountId;
  });

  if (filtered.length !== students.length) {
    await gradeRef.update({ students: filtered });
  }
}

async function ensureStudentInCourseGrades(
  courseDocId: string,
  studentId: string,
  studentDetails: { studentId: string; name: string; grade: string }
) {
  const gradeRef = adminDb.collection('courses').doc(courseDocId).collection('grades').doc('data');
  const gradeDoc = await gradeRef.get();

  const gradeRow = {
    studentId: studentDetails.studentId || studentId,
    name: studentDetails.name,
    grade: studentDetails.grade,
    regularScores: {},
    periodicScores: {},
  };

  if (!gradeDoc.exists) {
    await gradeRef.set({
      students: [gradeRow],
      columnDetails: {},
      regularColumns: 0,
      settings: defaultGradeSettings,
    });
    return;
  }

  const students = normalizeGradeDocStudents(gradeDoc.data());
  const exists = students.some((row) => {
    const sid = String(row.studentId || '');
    return sid === studentId || sid === studentDetails.studentId;
  });

  if (!exists) {
    await gradeRef.update({ students: [...students, gradeRow] });
  }
}

/** 確保學生已寫入課程名單（子集合 + students 陣列 + 成績名單 + 舊版集合） */
async function ensureStudentEnrolledInCourse(
  course: CourseRefTarget,
  studentId: string,
  studentDetails: Record<string, unknown>
) {
  const courseDocRef = adminDb.collection('courses').doc(course.id);
  const studentSubCollectionRef = courseDocRef.collection('students').doc(studentId);

  await adminDb.runTransaction(async (transaction) => {
    transaction.set(studentSubCollectionRef, studentDetails, { merge: true });
    transaction.update(courseDocRef, { students: FieldValue.arrayUnion(studentId) });
  });

  await ensureStudentInCourseGrades(course.id, studentId, {
    studentId: String(studentDetails.studentId || studentId),
    name: String(studentDetails.name || ''),
    grade: String(studentDetails.grade || ''),
  });
  await syncLegacyCourseStudentList(course, studentId, 'add', studentDetails);
}

async function removeStudentFromCourseAttendance(
  courseDocId: string,
  accountId: string,
  schoolStudentId?: string
) {
  const idsToDelete = new Set<string>([accountId]);
  if (schoolStudentId) idsToDelete.add(String(schoolStudentId));

  const attendanceSnap = await adminDb
    .collection('courses')
    .doc(courseDocId)
    .collection('attendance')
    .get();

  if (attendanceSnap.empty) return;

  let batch = adminDb.batch();
  let opCount = 0;

  const flushBatch = async () => {
    if (opCount === 0) return;
    await batch.commit();
    batch = adminDb.batch();
    opCount = 0;
  };

  for (const activityDoc of attendanceSnap.docs) {
    for (const id of idsToDelete) {
      batch.delete(activityDoc.ref.collection('roster').doc(id));
      batch.delete(activityDoc.ref.collection('records').doc(id));
      opCount += 2;
      if (opCount >= 450) await flushBatch();
    }
  }

  await flushBatch();
}

async function removeStudentFromCourse(
  course: CourseRefTarget,
  studentId: string,
  studentDetails: { studentId: string }
) {
  const courseDocRef = adminDb.collection('courses').doc(course.id);
  const studentSubCollectionRef = courseDocRef.collection('students').doc(studentId);

  await adminDb.runTransaction(async (transaction) => {
    transaction.delete(studentSubCollectionRef);
    transaction.update(courseDocRef, { students: FieldValue.arrayRemove(studentId) });
  });

  await removeStudentFromCourseGrades(course.id, studentId, studentDetails.studentId);
  await removeStudentFromCourseAttendance(course.id, studentId, studentDetails.studentId);
  await syncLegacyCourseStudentList(course, studentId, 'remove', studentDetails);
}

/**
 * 以「目標修課清單」對帳同步，不依賴前端 old/new 字串是否完全一致。
 * - 不在 newCourses 的課程 → 移除
 * - 在 newCourses 的課程 → 一律確保寫入課程名單（含重新加入）
 */
export async function syncStudentCourseEnrollments(
  studentId: string,
  oldCourses: string[],
  newCourses: string[],
  studentInfo?: Record<string, unknown>
): Promise<SyncEnrollmentResult> {
  let info = studentInfo;
  if (!info) {
    const studentDoc = await adminDb.collection('student_data').doc(studentId).get();
    if (studentDoc.exists) {
      info = studentDoc.data();
    } else {
      const userDoc = await adminDb.collection('users').doc(studentId).get();
      info = userDoc.exists ? userDoc.data() : { id: studentId };
    }
  }

  const studentDetails: Record<string, unknown> = {
    id: studentId,
    name: info.name ?? '',
    account: info.account ?? '',
    email: info.email ?? '',
    studentId: info.studentId || studentId,
    grade: info.grade || '未設定',
    schoolGroup: info.schoolGroup || '',
    className: info.className || '',
  };
  if (info.seatNumber != null && info.seatNumber !== '') {
    studentDetails.seatNumber = info.seatNumber;
  }

  const oldTargets = await resolveCourseTargets(oldCourses);
  const newTargets = await resolveCourseTargets(newCourses);
  const newDocIds = new Set(newTargets.map((t) => t.id));
  const oldDocIds = new Set(oldTargets.map((t) => t.id));

  const toRemove = oldTargets.filter((t) => !newDocIds.has(t.id));
  const addedCourseIds: string[] = [];

  for (const course of toRemove) {
    await removeStudentFromCourse(course, studentId, {
      studentId: String(studentDetails.studentId || studentId),
    });
  }

  for (const course of newTargets) {
    await ensureStudentEnrolledInCourse(course, studentId, studentDetails);
    if (!oldDocIds.has(course.id)) {
      addedCourseIds.push(course.id);
    }
  }

  const normalizedFromResolved = newTargets.map((t) => t.id);
  const unresolvedKeys = newCourses.filter(
    (key) => key && !newTargets.some((target) => target.enrolledKeys.includes(key))
  );
  const normalizedEnrolled = [...new Set([...normalizedFromResolved, ...unresolvedKeys])];

  const studentDataDocRef = adminDb.collection('student_data').doc(studentId);
  const studentDataDoc = await studentDataDocRef.get();

  if (studentDataDoc.exists) {
    await studentDataDocRef.update({ enrolledCourses: normalizedEnrolled });
  } else if (normalizedEnrolled.length > 0) {
    await studentDataDocRef.set({
      enrolledCourses: normalizedEnrolled,
      studentId,
      name: studentDetails.name,
      account: studentDetails.account,
      email: studentDetails.email,
      grade: studentDetails.grade,
      schoolGroup: studentDetails.schoolGroup,
      className: studentDetails.className,
      ...(studentDetails.seatNumber != null ? { seatNumber: studentDetails.seatNumber } : {}),
    });
  }

  return {
    enrolledCourses: normalizedEnrolled,
    addedCourseIds,
    removedCourseIds: toRemove.map((t) => t.id),
  };
}
