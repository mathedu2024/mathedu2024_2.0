// 移除第2行未使用的auth导入
import { NextRequest, NextResponse } from 'next/server';
// import { auth } from '@/app/config/auth'; // 移除这一行
import { adminDb } from '@/services/firebase-admin';
import { parse as parseCookie } from 'cookie';

export async function POST(req: NextRequest) {
  try {
    // 1. Get user session from cookie
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

    if (!userId || (Array.isArray(userRole) ? !userRole.includes('student') : userRole !== 'student')) {
      return NextResponse.json({ error: 'Forbidden: Invalid role or missing user ID' }, { status: 403 });
    }

    // 2. Get courseKey from request body
    const { courseKey } = await req.json();
    if (!courseKey) {
      return NextResponse.json({ error: 'Missing courseKey' }, { status: 400 });
    }

    // 3. Fetch user document to get their studentId (school number)
    const userDoc = await adminDb.collection('student_data').doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const studentId = userDoc.data()?.studentId;
    if (!studentId) {
      return NextResponse.json({ error: 'Student ID not found for this user' }, { status: 404 });
    }

    // 4. Fetch the grades document for the course
    const gradeDoc = await adminDb.collection('grades').doc(courseKey).get();
    if (!gradeDoc.exists) {
      return NextResponse.json({ gradeData: null });
    }
    const gradeData = gradeDoc.data();
    if (!gradeData) {
      return NextResponse.json({ gradeData: null });
    }

    // 5. Find the specific student's grades within the document
    const gradesMap = (gradeData.grades && typeof gradeData.grades === 'object') ? gradeData.grades : {};
    const studentGradeData = gradesMap[studentId];

    // 6. Calculate statistics for periodic scores
    const statistics: Record<string, { rank: number | null; totalStudents: number }> = {};
    if (gradeData.periodicScores && Array.isArray(gradeData.periodicScores)) {
      gradeData.periodicScores.forEach((scoreName: string) => {
        const allScores: number[] = Object.values(gradesMap)
          .map((s: { periodicScores?: Record<string, number> }) => s.periodicScores?.[scoreName])
          .filter((s: number | undefined) => typeof s === 'number' && !isNaN(s));
        
        const myScore = studentGradeData?.periodicScores?.[scoreName];
        let rank: number | null = null;

        if (typeof myScore === 'number' && !isNaN(myScore)) {
          rank = allScores.filter(s => s > myScore).length + 1;
        }

        statistics[scoreName] = {
          rank,
          totalStudents: allScores.length,
        };
      });
    }

    // 7. Construct the response
    const responseData = {
      columns: gradeData.columns || {},
      totalSetting: gradeData.totalSetting || {},
      periodicScores: gradeData.periodicScores || [],
      student: studentGradeData ? { studentId, ...studentGradeData } : null,
      statistics: statistics,
    };

    return NextResponse.json(responseData);

  } catch (error: unknown) {
    let message = 'An unexpected error occurred';
    if (error instanceof Error) {
      message = error.message;
    }
    console.error('Error fetching student grades:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
