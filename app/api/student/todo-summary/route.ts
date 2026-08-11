import { NextRequest, NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { requireAuthFromRequest } from '@/services/apiAuth';
import { buildStudentTodoSummary } from '@/services/todoSummary';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = requireAuthFromRequest(req, 'student');
  if (auth.ok === false) return auth.response;

  try {
    const summary = await buildStudentTodoSummary(auth.session.id);
    return NextResponse.json(summary);
  } catch (error) {
    const siteErr = trySiteDbReadErrorResponse(error, req);
    if (siteErr) return siteErr;
    console.error('[todo-summary/student]', error);
    return NextResponse.json({ error: '無法載入待辦' }, { status: 500 });
  }
}
