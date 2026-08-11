import { NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { listContentDocs } from '@/services/contentDbSplit';

const ANNOUNCEMENT_LIST_LIMIT = 50;

export async function GET() {
  try {
    const data = await listContentDocs('announcements', {
      orderBy: { field: 'createdAt', direction: 'desc' },
      limit: ANNOUNCEMENT_LIST_LIMIT,
    });
    return NextResponse.json(data);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    throw error;
  }
}
