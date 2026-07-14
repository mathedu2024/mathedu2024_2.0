import { NextRequest, NextResponse } from 'next/server';
import { trySiteErrorResponse } from '@/utils/apiErrorResponse';
import { quizService } from '@/services/quizService';
import { canTeacherEditQuiz } from '@/services/quizTeacherAccess';
import {
  isQuizImageStorageConfigured,
  uploadQuizImage,
} from '@/services/quizImageStorage';
import {
  QUIZ_IMAGE_ALLOWED_MIME_TYPES,
  QUIZ_MAX_IMAGE_FILE_BYTES,
} from '@/utils/quizImageLimits';
import { SITE_ERROR_CODES, SiteImgError } from '@/services/siteErrorCodes';

export async function POST(request: NextRequest) {
  try {
    if (!isQuizImageStorageConfigured()) {
      throw new SiteImgError(SITE_ERROR_CODES.IMG_NOT_CONFIGURED, 'Cloudflare R2 env vars missing');
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const quizCode = String(formData.get('quizCode') ?? '').trim();
    const teacherId = String(formData.get('teacherId') ?? '').trim();
    /** 儲存流程批次上傳：略過 R2 現有張數檢查（儲存後會同步刪除孤兒圖） */
    const skipStoredCountCheck = String(formData.get('skipStoredCountCheck') ?? '') === '1';

    if (!(file instanceof File)) {
      return NextResponse.json({ error: '請選擇圖片檔案' }, { status: 400 });
    }
    if (!quizCode || !teacherId) {
      return NextResponse.json({ error: '缺少必要資料，請重新整理後再試' }, { status: 400 });
    }

    const quiz = await quizService.getByCode(quizCode);
    if (!quiz) {
      return NextResponse.json({ error: '請先儲存測驗後再加入圖片' }, { status: 404 });
    }
    if (!canTeacherEditQuiz(quiz, teacherId)) {
      return NextResponse.json({ error: '無權限上傳此測驗的圖片' }, { status: 403 });
    }

    // 使用者操作問題：直接文字提醒，不帶內部錯誤代碼
    if (!QUIZ_IMAGE_ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: '不支援的圖片格式' }, { status: 400 });
    }
    if (file.size > QUIZ_MAX_IMAGE_FILE_BYTES) {
      return NextResponse.json({ error: '圖片檔案超過大小上限' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadQuizImage(quizCode, buffer, file.type, file.name, {
      skipStoredCountCheck,
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      key: result.key,
    });
  } catch (error) {
    const siteErrorResponse = trySiteErrorResponse(error, request);
    if (siteErrorResponse) return siteErrorResponse;

    // 其餘使用者可理解的 Error（格式／張數等）
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    console.error('Quiz image upload error:', error);
    return NextResponse.json({ error: '圖片上傳失敗' }, { status: 500 });
  }
}
