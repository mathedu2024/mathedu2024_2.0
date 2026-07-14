'use client';

import { QUIZ_IMAGE_ALLOWED_MIME_TYPES, QUIZ_MAX_IMAGE_FILE_BYTES, QUIZ_MAX_IMAGES_PER_QUIZ } from '@/utils/quizImageLimits';
import {
  listPendingQuizImageUrls,
  replacePendingQuizImageUrlsInQuiz,
} from '@/utils/quizImageHtml';
import type { Quiz } from '@/services/quizTypes';

export interface QuizImageUploadParams {
  quizCode: string;
  teacherId: string;
  /** 測驗是否已有 Firestore id（儲存流程會先建立再上傳） */
  isPersisted: boolean;
  /** 讀取當下圖片數量（避免每次改題就讓 Context 變動觸發編輯器重渲染） */
  getImageCount: () => number;
  /** 登記本機暫存圖（儲存時才上傳） */
  registerPendingImage: (blobUrl: string, file: File) => void;
  getPendingFile: (blobUrl: string) => File | undefined;
}

/** 模組級暫存：blob URL → File（跨編輯器實例共用） */
const pendingQuizImages = new Map<string, File>();

export function registerPendingQuizImage(blobUrl: string, file: File): void {
  pendingQuizImages.set(blobUrl, file);
}

export function getPendingQuizImageFile(blobUrl: string): File | undefined {
  return pendingQuizImages.get(blobUrl);
}

export function revokePendingQuizImage(blobUrl: string): void {
  const file = pendingQuizImages.get(blobUrl);
  if (file) pendingQuizImages.delete(blobUrl);
  if (blobUrl.startsWith('blob:')) {
    try {
      URL.revokeObjectURL(blobUrl);
    } catch {
      /* ignore */
    }
  }
}

export function createLocalQuizImagePreview(file: File): string {
  if (!QUIZ_IMAGE_ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('不支援的圖片格式');
  }
  if (file.size > QUIZ_MAX_IMAGE_FILE_BYTES) {
    throw new Error('圖片檔案超過大小上限');
  }
  const blobUrl = URL.createObjectURL(file);
  registerPendingQuizImage(blobUrl, file);
  return blobUrl;
}

export async function uploadQuizImageFile(
  file: File,
  params: Pick<QuizImageUploadParams, 'quizCode' | 'teacherId'> & {
    skipStoredCountCheck?: boolean;
  }
): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('quizCode', params.quizCode);
  formData.append('teacherId', params.teacherId);
  if (params.skipStoredCountCheck) {
    formData.append('skipStoredCountCheck', '1');
  }

  const res = await fetch('/api/quiz-images/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '圖片上傳失敗');
  }
  if (typeof data.url !== 'string' || !data.url) {
    throw new Error('圖片上傳回應格式錯誤');
  }
  return data.url;
}

/**
 * 儲存前：將內容中的 blob／data 暫存圖上傳至 R2，並回傳替換後的測驗內容。
 */
export async function flushPendingQuizImagesInQuiz(
  quiz: Quiz,
  params: Pick<QuizImageUploadParams, 'quizCode' | 'teacherId'>
): Promise<Quiz> {
  const pendingUrls = listPendingQuizImageUrls(quiz);
  if (pendingUrls.length === 0) return quiz;

  const urlMap = new Map<string, string>();

  for (const pendingUrl of pendingUrls) {
    let file = getPendingQuizImageFile(pendingUrl);
    if (!file && pendingUrl.startsWith('data:image/')) {
      file = await dataUrlToFile(pendingUrl);
    }
    if (!file) {
      throw new Error('找不到待上傳的圖片檔案，請重新插入後再儲存');
    }

    const publicUrl = await uploadQuizImageFile(file, {
      quizCode: params.quizCode,
      teacherId: params.teacherId,
      skipStoredCountCheck: true,
    });
    urlMap.set(pendingUrl, publicUrl);
    revokePendingQuizImage(pendingUrl);
  }

  return replacePendingQuizImageUrlsInQuiz(quiz, urlMap);
}

async function dataUrlToFile(dataUrl: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const mime = blob.type || 'image/png';
  const ext = mime.split('/')[1] || 'png';
  return new File([blob], `paste.${ext}`, { type: mime });
}

export function formatQuizImageLimitHint(imageCount: number): string {
  return `圖片 ${imageCount} / ${QUIZ_MAX_IMAGES_PER_QUIZ} 張（儲存時才上傳）`;
}
