
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import { parse as parseCookie } from 'cookie';

interface CourseInfo {
  id: string;
  name: string;
  code: string;
  teacherName?: string;
}

type StudentGradeRow = { studentId: string; regularScores?: Record<string, number>; periodicScores?: Record<string, number>; manualAdjust?: number; };

export async function POST(req: NextRequest) {
  try {
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) {
      return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
    }

    const cookies = parseCookie(cookieHeader);
    const sessionCookie = cookies.session;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
    }

    const session = JSON.parse(decodeURIComponent(sessionCookie));
    const userId = session?.id;
    const userRole = session?.role;

    if (!userId || !userRole.includes('student')) {
      return NextResponse.json({ error: 'Forbidden: Invalid role or missing user ID' }, { status: 403 });
    }

    const studentProfileDoc = await adminDb.collection('student_data').doc(userId).get();
    if (!studentProfileDoc.exists) {
        // Fallback to query by studentId if userId is not the document ID
        const studentQuery = await adminDb.collection('student_data').where('studentId', '==', userId).limit(1).get();
        if (studentQuery.empty) {
            return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
        }
        const studentDoc = studentQuery.docs[0];
        const studentId = studentDoc.id;
        const enrolledCourses = studentDoc.data().enrolledCourses || [];
        return fetchCourseData(studentId, enrolledCourses);
    }
    
    const studentId = studentProfileDoc.data()?.studentId || userId;
    const enrolledCourses = studentProfileDoc.data()?.enrolledCourses || [];

    return fetchCourseData(studentId, enrolledCourses);

  } catch (error: unknown) {
    let message = 'An unexpected error occurred';
    if (error instanceof Error) {
      message = error.message;
    }
    console.error('Error fetching student dashboard data:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function fetchCourseData(studentId: string, enrolledCourses: string[]) {
    if (enrolledCourses.length === 0) {
        return NextResponse.json({ courses: [], grades: {} });
    }

    const courseDocs = await adminDb.collection('courses').where('__name__', 'in', enrolledCourses).get();
    
    const courses: CourseInfo[] = [];
    const teacherIds = new Set<string>();

    courseDocs.forEach(doc => {
        const data = doc.data();
        courses.push({
            id: doc.id,
            name: data.name,
            code: data.code,
        });
        if (data.teachers && data.teachers.length > 0) {
            teacherIds.add(data.teachers[0]);
        }
    });

    const teacherNamesMap: Record<string, string> = {};
    if (teacherIds.size > 0) {
        // Try fetching from 'users' collection first (more likely to have full user names)
        const userDocs = await adminDb.collection('users').where('__name__', 'in', Array.from(teacherIds)).get();
        userDocs.forEach(doc => {
            const data = doc.data();
            if (data.name) {
                teacherNamesMap[doc.id] = data.name;
            }
        });

        // Fallback to 'teachers' collection for any missing names or if 'users' doesn't have the name field
        const missingTeacherIds = Array.from(teacherIds).filter(id => !teacherNamesMap[id]);
        if (missingTeacherIds.length > 0) {
            const teacherDocs = await adminDb.collection('teachers').where('__name__', 'in', missingTeacherIds).get();
            teacherDocs.forEach(doc => {
                const data = doc.data();
                if (data.name) {
                    teacherNamesMap[doc.id] = data.name;
                }
            });
        }
    }

    courses.forEach(course => {
        const courseDoc = courseDocs.docs.find(d => d.id === course.id);
        if (courseDoc) {
            const teacherId = courseDoc.data().teachers?.[0];
            if (teacherId && teacherNamesMap[teacherId]) {
                course.teacherName = teacherNamesMap[teacherId];
            }
        }
    });

    const grades: Record<string, { columns: Record<string, { name: string; type: string; date: string; }>; totalSetting?: { regularDetail?: Record<string, { calcMethod: string; n?: number; percent: number; }>; periodicEnabled?: Record<string, boolean>; periodicPercent: number; }; periodicScores?: string[]; student: StudentGradeRow | null; }> = {};
    const gradePromises = courses.map(async (course) => {
        const gradeDocId = `${course.name}(${course.code})`;
        const gradeDoc = await adminDb.collection('grades').doc(gradeDocId).get();
        if (gradeDoc.exists) {
            const gradeData = gradeDoc.data();
            if (gradeData && gradeData.students) {
                const studentGrade = gradeData.students.find((s: StudentGradeRow) => s.studentId === studentId);
                if (studentGrade) {
                    grades[gradeDocId] = {
                        columns: gradeData.columns || {},
                        totalSetting: gradeData.totalSetting || {},
                        periodicScores: gradeData.periodicScores || [],
                        student: studentGrade,
                    };
                }
            }
        }
    });

    await Promise.all(gradePromises);

    return NextResponse.json({ courses, grades });
}
