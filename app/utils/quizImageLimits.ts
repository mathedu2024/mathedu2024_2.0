/** 單一測驗卷最多圖片張數 */
export const QUIZ_MAX_IMAGES_PER_QUIZ = 10;

/** 單一圖片檔案大小上限（10 GB） */
export const QUIZ_MAX_IMAGE_FILE_BYTES = 10 * 1024 * 1024 * 1024;

export const QUIZ_IMAGE_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

export const QUIZ_IMAGE_FOLDER = 'quiz-images';
