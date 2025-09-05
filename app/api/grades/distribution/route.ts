import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import * as cookie from 'cookie';

// Helper function to calculate Taiwanese percentile levels
function getTaiwanPercentileLevels(scores: number[]) {
  if (!scores || scores.length === 0) return { 平均: 0, 頂標: 0, 前標: 0, 均標: 0, 後標: 0, 底標: 0 };
  const sorted = [...scores].sort((a, b) => b - a);
  const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  return {
    平均: avg,
    頂標: sorted[Math.floor(scores.length * 0.12)] || 0,
    前標: sorted[Math.floor(scores.length * 0.25)] || 0,
    均標: sorted[Math.floor(scores.length * 0.5)] || 0,
    後標: sorted[Math.floor(scores.length * 0.75)] || 0,
    底標: sorted[Math.floor(scores.length * 0.88)] || 0
  };
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate user from session
    const cookieHeader = req.headers.get('cookie');
    if (!cookieHeader) {
      return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
    }
    const cookies = cookie.parse(cookieHeader);
    const sessionCookie = cookies.session;
    if (!sessionCookie) {
      return NextResponse.json({ error: 'Unauthorized: No session cookie' }, { status: 401 });
    }
    const session = JSON.parse(decodeURIComponent(sessionCookie));
    const userId = session?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Forbidden: Invalid user ID' }, { status: 403 });
    }

    // 2. Get parameters from request body
    const { courseKey, columnId } = await req.json();
    if (!courseKey || columnId === undefined) {
      return NextResponse.json({ error: 'Missing courseKey or columnId' }, { status: 400 });
    }

    // 3. Fetch grades document
    const gradeDoc = await adminDb.collection('grades').doc(courseKey).get();
    if (!gradeDoc.exists) {
      return NextResponse.json({ error: 'Grades not found for this course' }, { status: 404 });
    }
    const gradeData = gradeDoc.data();
    const gradesMap = (gradeData?.grades && typeof gradeData.grades === 'object') ? gradeData.grades : {};

    // 4. Extract all scores for the specific columnId
    const allScores: number[] = Object.values(gradesMap)
      .map((s: { regularScores?: { [key: string]: number } }) => s.regularScores?.[columnId])
      .filter((score: number | undefined) => typeof score === 'number' && !isNaN(score));

    if (allScores.length === 0) {
        return NextResponse.json({ statistics: getTaiwanPercentileLevels([]), distribution: [] });
    }

    // 5. Calculate statistics
    const statistics = getTaiwanPercentileLevels(allScores);

    // 6. Calculate grade distribution for the bar chart
    const distribution = [
        { range: '90-100', count: 0 },
        { range: '80-89', count: 0 },
        { range: '70-79', count: 0 },
        { range: '60-69', count: 0 },
        { range: '50-59', count: 0 },
        { range: '<50', count: 0 },
    ];
    allScores.forEach(score => {
        if (score >= 90) distribution[0].count++;
        else if (score >= 80) distribution[1].count++;
        else if (score >= 70) distribution[2].count++;
        else if (score >= 60) distribution[3].count++;
        else if (score >= 50) distribution[4].count++;
        else distribution[5].count++;
    });

    // 7. Return the aggregated data
    return NextResponse.json({ statistics, distribution });

  } catch (error: unknown) {
    let message = 'An unexpected error occurred';
    if (error instanceof Error) {
      message = error.message;
    }
    console.error('Error fetching grade distribution:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
