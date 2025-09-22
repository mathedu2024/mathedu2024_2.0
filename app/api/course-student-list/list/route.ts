import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';

type StudentRef = string | { id: string } | { studentId: string };

export async function POST(req: NextRequest) {
  try {
    const { courseName, courseCode } = await req.json();
    if (!courseName || !courseCode) return NextResponse.json({ error: 'Missing courseName or courseCode' }, { status: 400 });
    
    const listDocId = `${courseName}(${courseCode})`;
    console.log('Fetching student list for:', listDocId);
    
    let doc = await adminDb.collection('course-student-list').doc(listDocId).get();

    if (!doc.exists) {
      console.log('Student list document not found for:', listDocId, 'Trying fallback to courseName only.');
      doc = await adminDb.collection('course-student-list').doc(courseName).get();
    }

    if (!doc.exists) {
      console.log('Student list document not found for:', listDocId, 'and fallback');
      return NextResponse.json([]);
    }
    
    const data = doc.data() || {};
    console.log('Raw student list data from Firestore:', data);

    let studentIdsInCourse: string[] = [];
    if (data.students && Array.isArray(data.students)) {
      studentIdsInCourse = data.students
        .map((s: StudentRef) => {
          if (typeof s === 'string') {
            return s;
          } else if (s && typeof s === 'object' && 'id' in s && s.id) {
            return s.id;
          } else if (s && typeof s === 'object' && 'studentId' in s && s.studentId) {
            return s.studentId;
          }
          console.log('Unknown student data format in course-student-list:', s);
          return null;
        })
        .filter((id: string | null): id is string => id !== null);
    }

    console.log('Extracted Student IDs:', studentIdsInCourse);

    if (studentIdsInCourse.length === 0) {
      console.log('No student IDs found or extracted, returning empty list.');
      return NextResponse.json([]);
    }

    // Fetch full student details from student_data collection
    console.log('Fetching student details for IDs:', studentIdsInCourse);
    const studentDocs = await adminDb.collection('student_data')
                                    .where(FieldPath.documentId(), 'in', studentIdsInCourse)
                                    .get();
    
    const studentsWithLatestData = studentDocs.docs.map(studentDoc => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...studentData } = studentDoc.data(); // Exclude password for security
      return { id: studentDoc.id, ...studentData };
    });
    console.log('Fetched student details from student_data:', studentsWithLatestData);

    // Ensure the order of students is maintained as per studentIdsInCourse
    const orderedStudents = studentIdsInCourse.map((id: string) => 
      studentsWithLatestData.find(student => student.id === id)
    ).filter(Boolean); // Filter out any students not found

    console.log('Final ordered students for response:', orderedStudents);

    return NextResponse.json(orderedStudents);
  } catch (error: unknown) {
    let message = '查詢失敗';
    if (error instanceof Error) {
      message = error.message;
      console.error('Error in /api/course-student-list/list:', error);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}