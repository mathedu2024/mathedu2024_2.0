
import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { adminDb } from '@/services/firebase-admin';
import type { GradeSettingsShape } from '@/services/gradeShape';
import { settingsToTotalSetting } from '@/services/gradeShape';
import { resolveCourseDocsByEnrolledIds, getCourseCompositeKey } from '@/services/courseId';
import { isCourseArchived } from '@/services/courseArchive';
import { buildTeacherIdToNameMap, formatTeacherNames } from '@/services/teacherLookup';
import { normalizeCourseDate } from '@/services/courseDate';

export const dynamic = 'force-dynamic';
import { getStudentSessionFromRequest } from '@/utils/studentSession';

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
    const session = getStudentSessionFromRequest(req.headers.get('cookie'));
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized: Student session required' }, { status: 401 });
    }

    const userId = session.id;

    const body = await req.json().catch(() => ({}));
    const coursesOnly = body.coursesOnly === true;

    const studentProfileDoc = await adminDb.collection('student_data').doc(userId).get();
    if (!studentProfileDoc.exists) {
        const studentQuery = await adminDb.collection('student_data').where('studentId', '==', userId).limit(1).get();
        if (studentQuery.empty) {
            return NextResponse.json({ error: 'Student profile not found' }, { status: 404 });
        }
        const studentDoc = studentQuery.docs[0];
        const studentId = studentDoc.data().studentId || studentDoc.id;
        const enrolledCourses = studentDoc.data().enrolledCourses || [];
        return fetchCourseData(studentId, enrolledCourses, coursesOnly);
    }
    
    const studentId = studentProfileDoc.data()?.studentId || userId;
    const enrolledCourses = studentProfileDoc.data()?.enrolledCourses || [];

    return fetchCourseData(studentId, enrolledCourses, coursesOnly);

  } catch (error: unknown) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error, req);
    if (siteReadErrorResponse) return siteReadErrorResponse;

    let message = 'An unexpected error occurred';
    if (error instanceof Error) {
      message = error.message;
    }
    console.error('Error fetching student dashboard data:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function fetchCourseData(studentId: string, enrolledCourses: string[], coursesOnly = false) {
    if (enrolledCourses.length === 0) {
        return NextResponse.json({ courses: [], grades: {} });
    }

    const resolvedMap = await resolveCourseDocsByEnrolledIds(adminDb, enrolledCourses);

    const courseDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
    const seenDocIds = new Set<string>();
    const allTeacherIds: string[] = [];

    for (const enrolledId of enrolledCourses) {
        const doc = resolvedMap.get(enrolledId);
        if (!doc || seenDocIds.has(doc.id)) continue;
        seenDocIds.add(doc.id);
        courseDocs.push(doc);
        const teachersList = Array.isArray(doc.data().teachers) ? doc.data().teachers : [];
        allTeacherIds.push(...teachersList);
    }

    const teacherLookup = await buildTeacherIdToNameMap(adminDb, allTeacherIds);

    const classDataByCourseId = coursesOnly
        ? new Map<string, Record<string, unknown>>()
        : new Map(
            (
                await Promise.all(
                    courseDocs.map(async (doc) => {
                        try {
                            const classDoc = await adminDb.collection('courses').doc(doc.id).collection('ClassData').doc('main').get();
                            return [doc.id, classDoc.exists ? classDoc.data() : null] as const;
                        } catch {
                            return [doc.id, null] as const;
                        }
                    })
                )
            )
        );

    const courses: CourseInfo[] = [];
    const coveredKeys = new Set<string>();

    for (const doc of courseDocs) {
        const data = doc.data();
        const classData = classDataByCourseId.get(doc.id) || {};
        const archivedFlag = isCourseArchived({
            archived: data.archived,
            status: data.status,
            name: data.name,
        });
        const teachersList = Array.isArray(data.teachers) ? data.teachers : [];
        courses.push({
            id: doc.id,
            name: data.name,
            code: data.code,
            status: archivedFlag ? '已封存' : (data.status || ''),
            gradeTags: data.gradeTags,
            subjectTag: data.subjectTag,
            startDate: normalizeCourseDate(data.startDate),
            endDate: normalizeCourseDate(data.endDate),
            teachers: teachersList,
            description: coursesOnly ? (data.description || '') : (data.description || classData.description),
            teachingMethod: data.teachingMethod,
            courseNature: data.courseNature,
            location: coursesOnly ? data.location : (data.location || classData.location),
            liveStreamURL: coursesOnly ? data.liveStreamURL : (data.liveStreamURL || classData.liveStreamURL),
            coverImageURL: data.coverImageURL,
            classTimes: data.classTimes,
            archived: archivedFlag,
            teacherName: formatTeacherNames(teachersList, teacherLookup) || undefined,
            customLinks: coursesOnly ? [] : ((classData.customLinks ?? data.customLinks) || []),
            announcements: coursesOnly ? [] : ((classData.announcements ?? data.announcements) || []),
        });
        coveredKeys.add(doc.id);
        coveredKeys.add(getCourseCompositeKey(data.name, data.code));
    }

    for (const enrolledId of enrolledCourses) {
        if (!enrolledId || coveredKeys.has(enrolledId)) continue;
        const alreadyListed = courses.some(
            (course) =>
                course.id === enrolledId ||
                getCourseCompositeKey(course.name, course.code) === enrolledId
        );
        if (alreadyListed) continue;

        // resolveCourseDocsByEnrolledIds 已嘗試過；仍找不到則以 placeholder 顯示
        const match = enrolledId.match(/^(.+)\(([^()]+)\)$/) || enrolledId.match(/^(.+)[（]([^（）]+)[）]$/);
        courses.push({
            id: enrolledId,
            name: match ? match[1].trim() : enrolledId,
            code: match ? match[2].trim() : '',
            status: '已封存',
            gradeTags: [],
            subjectTag: '',
            startDate: '',
            endDate: '',
            teachers: [],
            description: '',
            teachingMethod: '',
            courseNature: '',
            archived: true,
        });
        coveredKeys.add(enrolledId);
    }

    if (coursesOnly) {
        return NextResponse.json({ courses, grades: {} });
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
