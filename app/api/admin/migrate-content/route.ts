import { NextRequest, NextResponse } from 'next/server';
import { authGuard, requireAuthFromRequest } from '@/services/apiAuth';

/** 內容已固定在 core，無需遷移。保留此端點以免舊腳本／文件失效。 */
export async function POST(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin'));
  if (denied) return denied;

  return NextResponse.json({
    success: true,
    skipped: true,
    message: '部落格／公告／考試日期已固定使用 core 資料庫，無需遷移。',
  });
}
