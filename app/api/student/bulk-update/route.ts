import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

interface StudentData {
  studentId?: string;
  name?: string;
  account?: string;
  email?: string;
  grade?: string;
  enrolledCourses?: string[];
}

async function getCourseDocRefByCompositeId(compositeId: string) {
  const match = compositeId.match(/^(.*)\((.*)\)$/);
  if (!match) return null;
  const [, name, code] = match;
  const querySnap = await adminDb
    .collection('courses')
    .where('name', '==', name)
    .where('code', '==', code)
    .limit(1)
    .get();
  if (querySnap.empty) return null;
  return querySnap.docs[0].ref;
}

export async function POST(req: NextRequest) {
  try {
    const { studentIds, grade, addCourses, removeCourses } = await req.json();
    const ids = Array.isArray(studentIds) ? (studentIds as string[]).filter(Boolean) : [];
    const coursesToAdd = Array.isArray(addCourses) ? (addCourses as string[]).filter(Boolean) : [];
    const coursesToRemove = Array.isArray(removeCourses) ? (removeCourses as string[]).filter(Boolean) : [];

    if (ids.length === 0) {
      return NextResponse.json({ error: '缺少 studentIds' }, { status: 400 });
    }
    if (!grade && coursesToAdd.length === 0 && coursesToRemove.length === 0) {
      return NextResponse.json({ error: '至少提供 grade 或課程異動' }, { status: 400 });
    }

    const uniqueCourseIds = Array.from(new Set(coursesToAdd));
    const uniqueRemoveCourseIds = Array.from(new Set(coursesToRemove));
    const allTouchedCourseIds = Array.from(new Set([...uniqueCourseIds, ...uniqueRemoveCourseIds]));
    const courseRefs = new Map<string, FirebaseFirestore.DocumentReference>();
    for (const courseId of allTouchedCourseIds) {
      const ref = await getCourseDocRefByCompositeId(courseId);
      if (ref) courseRefs.set(courseId, ref);
    }

    let updatedCount = 0;

    for (const studentId of ids) {
      const studentDocRef = adminDb.collection('student_data').doc(studentId);
      const snap = await studentDocRef.get();
      if (!snap.exists) continue;
      const student = snap.data() as StudentData;
      const currentCourses = Array.isArray(student.enrolledCourses) ? student.enrolledCourses : [];
      const addedCourses = uniqueCourseIds.filter((courseId) => !currentCourses.includes(courseId));
      const removableCourses = uniqueRemoveCourseIds.filter((courseId) => currentCourses.includes(courseId));
      const mergedCourses = Array.from(
        new Set([...currentCourses.filter((courseId) => !removableCourses.includes(courseId)), ...addedCourses])
      );

      const payload: Record<string, unknown> = {};
      if (grade) payload.grade = grade;
      if (allTouchedCourseIds.length > 0) payload.enrolledCourses = mergedCourses;
      await studentDocRef.update(payload);

      if (addedCourses.length > 0) {
        const studentDetails = {
          id: studentId,
          name: student.name || '',
          account: student.account || studentId,
          email: student.email || '',
          studentId: student.studentId || studentId,
          grade: grade || student.grade || '未設定',
        };
        for (const courseId of addedCourses) {
          const courseRef = courseRefs.get(courseId);
          if (!courseRef) continue;
          const studentSubRef = courseRef.collection('students').doc(studentId);
          await adminDb.runTransaction(async (tx) => {
            tx.set(studentSubRef, studentDetails, { merge: true });
            tx.update(courseRef, { students: FieldValue.arrayUnion(studentId) });
          });
        }
      }

      if (removableCourses.length > 0) {
        for (const courseId of removableCourses) {
          const courseRef = courseRefs.get(courseId);
          if (!courseRef) continue;
          const studentSubRef = courseRef.collection('students').doc(studentId);
          await adminDb.runTransaction(async (tx) => {
            tx.delete(studentSubRef);
            tx.update(courseRef, { students: FieldValue.arrayRemove(studentId) });
          });
        }
      }

      if (grade && currentCourses.length > 0) {
        for (const courseId of mergedCourses) {
          const courseRef = courseRefs.get(courseId) || await getCourseDocRefByCompositeId(courseId);
          if (!courseRef) continue;
          await courseRef.collection('students').doc(studentId).set({ grade }, { merge: true });
        }
      }

      updatedCount += 1;
    }

    return NextResponse.json({ success: true, updatedCount });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '批次修改失敗';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
