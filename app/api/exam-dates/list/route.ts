import { NextResponse } from 'next/server';
import { trySiteDbReadErrorResponse } from '@/utils/apiErrorResponse';
import { listContentDocs } from '@/services/contentDbSplit';

export async function GET() {
  try {
    const data = await listContentDocs('exam_dates');
    return NextResponse.json(data);
  } catch (error) {
    const siteReadErrorResponse = trySiteDbReadErrorResponse(error);
    if (siteReadErrorResponse) return siteReadErrorResponse;
    throw error;
  }
}
