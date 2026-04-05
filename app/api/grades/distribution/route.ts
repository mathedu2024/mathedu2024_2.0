import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase-admin';
import * as cookie from 'cookie';

function getTaiwanPercentileLevels(scores: number[]) {
  if (!scores || scores.length === 0) {
    return { 平均: null, 頂標: null, 前標: null, 均標: null, 後標: null, 底標: null };
  }
  const sorted = [...scores].sort((a, b) => b - a);
  const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  return {
    平均: avg,
    頂標: sorted[Math.floor(scores.length * 0.12)] ?? null,
    前標: sorted[Math.floor(scores.length * 0.25)] ?? null,
    均標: sorted[Math.floor(scores.length * 0.5)] ?? null,
    後標: sorted[Math.floor(scores.length * 0.75)] ?? null,
    底標: sorted[Math.floor(scores.length * 0.88)] ?? null,
  };
}

async function resolveCourseFirestoreId(params: {
  courseId?: string;
  courseKey?: string;
}): Promise<string | null> {
  if (params.courseId) {
    const doc = await adminDb.collection('courses').doc(params.courseId).get();
    if (doc.exists) return params.courseId;
  }
  if (!params.courseKey) return null;

  const direct = await adminDb
    .collection('courses')
    .doc(params.courseKey)
    .collection('grades')
    .doc('data')
    .get();
  if (direct.exists) return params.courseKey;

  const m = params.courseKey.match(/^(.+)\(([^)]+)\)$/);
  if (m) {
    const name = m[1].trim();
    const code = m[2].trim();
    const q = await adminDb
      .collection('courses')
      .where('name', '==', name)
      .where('code', '==', code)
      .limit(1)
      .get();
    if (!q.empty) return q.docs[0].id;
    const altId = `${name}(${code})`;
    const d2 = await adminDb.collection('courses').doc(altId).get();
    if (d2.exists) return altId;
  }

  return null;
}

function collectScores(
  students: Record<string, unknown>[],
  columnId: string | number,
  source: 'regular' | 'periodic'
): number[] {
  const key = String(columnId);
  const out: number[] = [];
  for (const row of students) {
    const scores =
      source === 'regular'
        ? (row.regularScores as Record<string, number> | undefined)
        : (row.periodicScores as Record<string, number> | undefined);
    if (scores && typeof scores === 'object') {
      const v = scores[key];
      if (typeof v === 'number' && !Number.isNaN(v)) out.push(v);
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  try {
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
    const userRole = session?.role;
    const roles = Array.isArray(userRole) ? userRole : userRole ? [userRole] : [];
    const allowed = roles.some((r: string) =>
      ['student', 'teacher', 'admin'].includes(String(r))
    );
    if (!userId || !allowed) {
      return NextResponse.json({ error: 'Forbidden: Invalid session' }, { status: 403 });
    }

    const body = await req.json();
    const { courseId, courseKey, columnId, scoreKind } = body as {
      courseId?: string;
      courseKey?: string;
      columnId?: string | number;
      scoreKind?: 'regular' | 'periodic';
    };

    if (columnId === undefined || columnId === null) {
      return NextResponse.json({ error: 'Missing columnId' }, { status: 400 });
    }

    const firestoreCourseId = await resolveCourseFirestoreId({ courseId, courseKey });
    if (!firestoreCourseId) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    const gradeSnap = await adminDb
      .collection('courses')
      .doc(firestoreCourseId)
      .collection('grades')
      .doc('data')
      .get();

    if (!gradeSnap.exists) {
      return NextResponse.json({
        statistics: getTaiwanPercentileLevels([]),
        distribution: [],
      });
    }

    const gradeData = gradeSnap.data() as Record<string, unknown>;
    const students = Array.isArray(gradeData.students)
      ? (gradeData.students as Record<string, unknown>[])
      : [];

    let kind: 'regular' | 'periodic' = scoreKind === 'periodic' ? 'periodic' : 'regular';
    if (!scoreKind) {
      const cols = (gradeData.columnDetails || gradeData.columns) as Record<string, unknown> | undefined;
      const isRegularIdx =
        cols &&
        (String(columnId) in cols ||
          (typeof columnId === 'number' && String(columnId) in cols));
      kind = isRegularIdx ? 'regular' : 'periodic';
    }

    const allScores = collectScores(students, columnId, kind);

    if (allScores.length === 0) {
      return NextResponse.json({
        statistics: getTaiwanPercentileLevels([]),
        distribution: [],
      });
    }

    const statistics = getTaiwanPercentileLevels(allScores);

    const distribution = [
      { range: '90-100', count: 0 },
      { range: '80-89', count: 0 },
      { range: '70-79', count: 0 },
      { range: '60-69', count: 0 },
      { range: '50-59', count: 0 },
      { range: '<50', count: 0 },
    ];
    allScores.forEach((score) => {
      if (score >= 90) distribution[0].count++;
      else if (score >= 80) distribution[1].count++;
      else if (score >= 70) distribution[2].count++;
      else if (score >= 60) distribution[3].count++;
      else if (score >= 50) distribution[4].count++;
      else distribution[5].count++;
    });

    return NextResponse.json({ statistics, distribution });
  } catch (error: unknown) {
    let message = 'An unexpected error occurred';
    if (error instanceof Error) message = error.message;
    console.error('Error fetching grade distribution:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
