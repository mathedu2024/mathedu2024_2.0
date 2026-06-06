
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import type { GradeSettingsShape } from '@/services/gradeShape';
import { settingsToTotalSetting } from '@/services/gradeShape';
import { resolveCourseDocsByEnrolledIds } from '@/services/courseId';
import { isCourseArchived } from '@/services/courseArchive';
import { buildTeacherIdToNameMap, formatTeacherNames } from '@/services/teacherLookup';
import { normalizeCourseDate } from '@/services/courseDate';

export const dynamic = 'force-dynamic';
import { parse as parseCookie } from 'cookie';

interface ClassTime {
  day: string;
  startTime: string;
  endTime: string;
}

interface CourseInfo {
  id: string;
  name: string;
  code: string;
  teacherName?: string;
  status: string;
  gradeTags: string[];
  subjectTag: string;
  startDate: string;
  endDate: string;
  teachers: string[];
  description: string;
  teachingMethod: string;
  courseNature: string;
  location?: string;
  liveStreamURL?: string;
  coverImageURL?: string;
  classTimes?: ClassTime[];
  archived?: boolean;
  customLinks?: { name: string; url: string; icon: string }[];
  announcements?: { id: string; title: string; type?: string; content: string; links: { name: string; url: string }[]; createdAt: string }[];
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

    const resolvedMap = await resolveCourseDocsByEnrolledIds(adminDb, enrolledCourses);

    const courseDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    const seenDocIds = new Set<string>();
    const teacherLookup = await buildTeacherIdToNameMap(adminDb);

    for (const enrolledId of enrolledCourses) {
        const doc = resolvedMap.get(enrolledId);
        if (!doc || seenDocIds.has(doc.id)) continue;
        seenDocIds.add(doc.id);
        courseDocs.push(doc);
    }

    const classDataEntries = await Promise.all(
        courseDocs.map(async (doc) => {
            try {
                const classDoc = await adminDb.collection('courses').doc(doc.id).collection('ClassData').doc('main').get();
                return [doc.id, classDoc.exists ? classDoc.data() : null] as const;
            } catch {
                return [doc.id, null] as const;
            }
        })
    );
    const classDataByCourseId = new Map(classDataEntries);

    const courses: CourseInfo[] = [];
    for (const doc of courseDocs) {
        const data = doc.data();
        const teachersList = Array.isArray(data.teachers) ? data.teachers : [];
        const classData = classDataByCourseId.get(doc.id) || {};
        const courseInfo: CourseInfo = {
            id: doc.id,
            name: data.name,
            code: data.code,
            status: data.status,
            gradeTags: data.gradeTags,
            subjectTag: data.subjectTag,
            startDate: normalizeCourseDate(data.startDate),
            endDate: normalizeCourseDate(data.endDate),
            teachers: teachersList,
            description: data.description || classData.description,
            teachingMethod: data.teachingMethod,
            courseNature: data.courseNature,
            location: data.location || classData.location,
            liveStreamURL: data.liveStreamURL || classData.liveStreamURL,
            coverImageURL: data.coverImageURL,
            classTimes: data.classTimes,
            archived: data.archived ?? false,
            teacherName: formatTeacherNames(teachersList, teacherLookup) || undefined,
            customLinks: (classData.customLinks ?? data.customLinks) || [],
            announcements: (classData.announcements ?? data.announcements) || [],
        };
        if (isCourseArchived(courseInfo)) continue;
        courses.push(courseInfo);
    }

    const grades: Record<
      string,
      {
        courseId: string;
        columns: Record<string, { name: string; type: string; date: string }>;
        totalSetting?: {
          regularDetail?: Record<string, { calcMethod: string; n?: number; percent: number }>;
          periodicEnabled?: Record<string, boolean>;
          periodicPercent: number;
        };
        periodicScores?: string[];
        student: StudentGradeRow | null;
      }
    > = {};
    const gradePromises = courses.map(async (course) => {
        const gradeDocId = `${course.name}(${course.code})`;
        const gradeDoc = await adminDb.collection('courses').doc(course.id).collection('grades').doc('data').get();
        if (gradeDoc.exists) {
            const gradeData = gradeDoc.data();
            if (gradeData && gradeData.students) {
                const studentGrade = gradeData.students.find((s: StudentGradeRow) => s.studentId === studentId);
                if (studentGrade) {
                    grades[gradeDocId] = {
                        courseId: course.id,
                        columns: gradeData.columns || gradeData.columnDetails || {},
                        totalSetting:
                            gradeData.totalSetting ||
                            (gradeData.settings
                                ? settingsToTotalSetting(gradeData.settings as GradeSettingsShape)
                                : {}),
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
