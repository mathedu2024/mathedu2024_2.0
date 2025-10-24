import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../services/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  const { studentId, oldCourses, newCourses, studentInfo } = await req.json();
  if (!studentId || !Array.isArray(oldCourses) || !Array.isArray(newCourses)) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const getCourseDocRef = async (compositeId: string) => {
    const courseIdRegex = /^(.*)\((.*)\)$/;
    const match = compositeId.match(courseIdRegex);
    if (!match) return null;
    const name = match[1];
    const code = match[2];

    const courseQuery = await adminDb.collection('courses').where('name', '==', name).where('code', '==', code).limit(1).get();
    if (courseQuery.empty) {
      console.warn(`Could not find course document for compositeId: ${compositeId}`);
      return null;
    }
    return courseQuery.docs[0].ref;
  };

  let info = studentInfo;
  if (!info) {
    const userDoc = await adminDb.collection('users').doc(studentId).get();
    info = userDoc.exists ? userDoc.data() : { id: studentId };
  }
  
  const studentDetails = { 
    id: studentId, 
    name: info.name, 
    account: info.account, 
    email: info.email,
    studentId: info.studentId || studentId,
    grade: info.grade || '未設定'
  };

  const added = newCourses.filter((c: string) => !oldCourses.includes(c));
  const removed = oldCourses.filter((c: string) => !newCourses.includes(c));
  const unchanged = newCourses.filter((c: string) => oldCourses.includes(c));

  try {
    // Handle added courses
    for (const compositeId of added) {
      const courseDocRef = await getCourseDocRef(compositeId);

      if (courseDocRef) {
        const studentSubCollectionRef = courseDocRef.collection('students').doc(studentId);
        await adminDb.runTransaction(async (transaction) => {
          transaction.set(studentSubCollectionRef, studentDetails);
          transaction.update(courseDocRef, { students: FieldValue.arrayUnion(studentId) });
        });
      }

      // Also update student_data collection's enrolledCourses
      const studentDataDocRef = adminDb.collection('student_data').doc(studentId);
      const studentDataDoc = await studentDataDocRef.get();
      
      if (studentDataDoc.exists) {
        const currentEnrolledCourses = studentDataDoc.data()?.enrolledCourses || [];
        if (!currentEnrolledCourses.includes(compositeId)) {
          await studentDataDocRef.update({ 
            enrolledCourses: FieldValue.arrayUnion(compositeId) 
          });
          console.log(`Updated student_data for ${studentId}: added course ${compositeId}`);
        }
      } else {
        // Create student_data document if it doesn't exist
        await studentDataDocRef.set({ 
          enrolledCourses: [compositeId],
          studentId: studentId,
          name: studentDetails.name,
          account: studentDetails.account,
          email: studentDetails.email,
          grade: studentDetails.grade
        });
        console.log(`Created student_data for ${studentId}: added course ${compositeId}`);
      }
    }

    // Handle removed courses
    for (const compositeId of removed) {
      const courseDocRef = await getCourseDocRef(compositeId);

      if (courseDocRef) {
        const studentSubCollectionRef = courseDocRef.collection('students').doc(studentId);
        await adminDb.runTransaction(async (transaction) => {
          transaction.delete(studentSubCollectionRef);
          transaction.update(courseDocRef, { students: FieldValue.arrayRemove(studentId) });
        });
      }

      // Also update student_data collection's enrolledCourses
      const studentDataDocRef = adminDb.collection('student_data').doc(studentId);
      const studentDataDoc = await studentDataDocRef.get();
      
      if (studentDataDoc.exists) {
        await studentDataDocRef.update({ 
          enrolledCourses: FieldValue.arrayRemove(compositeId) 
        });
        console.log(`Updated student_data for ${studentId}: removed course ${compositeId}`);
      }
    }

    // Handle unchanged courses (update student info)
    if (studentInfo) {
      for (const compositeId of unchanged) {
        const courseDocRef = await getCourseDocRef(compositeId);
        if (courseDocRef) {
          const studentSubCollectionRef = courseDocRef.collection('students').doc(studentId);
          await studentSubCollectionRef.set(studentDetails, { merge: true });
        }
      }
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error updating student courses:', error);
    const message = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ error: 'Failed to update course enrollments.', details: message }, { status: 500 });
  }
}