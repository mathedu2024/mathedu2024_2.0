import 'server-only';

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import {
  QUIZ_IMAGE_ALLOWED_MIME_TYPES,
  QUIZ_IMAGE_FOLDER,
  QUIZ_MAX_IMAGE_FILE_BYTES,
  QUIZ_MAX_IMAGES_PER_QUIZ,
} from '@/utils/quizImageLimits';
import {
  listReferencedQuizImageKeys,
  quizImageKeyFromUrl,
} from '@/utils/quizImageHtml';
import {
  SITE_ERROR_CODES,
  SiteImgError,
} from '@/services/siteErrorCodes';
import type { Quiz } from './quizTypes';

let s3Client: S3Client | null = null;

function getR2Config() {
  const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME?.trim();
  const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL?.trim().replace(/\/$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName || !publicUrl) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicUrl };
}

export function isQuizImageStorageConfigured(): boolean {
  return getR2Config() !== null;
}

function requireR2Config() {
  const config = getR2Config();
  if (!config) {
    throw new SiteImgError(SITE_ERROR_CODES.IMG_NOT_CONFIGURED, 'Cloudflare R2 env vars missing');
  }
  return config;
}

function getS3Client(): S3Client {
  const config = requireR2Config();
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }
  return s3Client;
}

export function buildQuizImageKey(quizCode: string, filename: string): string {
  return `${QUIZ_IMAGE_FOLDER}/${quizCode}/${filename}`;
}

export function buildQuizImagePrefix(quizCode: string): string {
  return `${QUIZ_IMAGE_FOLDER}/${quizCode}/`;
}

export function buildQuizImagePublicUrl(key: string): string {
  const config = requireR2Config();
  return `${config.publicUrl}/${key}`;
}

function extensionFromMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/gif':
      return 'gif';
    case 'image/webp':
      return 'webp';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'bin';
  }
}

function wrapStorageFault(operation: string, error: unknown): never {
  if (error instanceof SiteImgError) throw error;
  const detail = error instanceof Error ? error.message : String(error);
  throw new SiteImgError(SITE_ERROR_CODES.IMG_STORAGE_FAULT, `${operation}: ${detail}`);
}

export async function listQuizImageKeys(quizCode: string): Promise<string[]> {
  if (!isQuizImageStorageConfigured()) return [];

  try {
    const config = requireR2Config();
    const client = getS3Client();
    const prefix = buildQuizImagePrefix(quizCode);
    const keys: string[] = [];
    let continuationToken: string | undefined;

    do {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: config.bucketName,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        })
      );
      for (const item of response.Contents ?? []) {
        if (item.Key) keys.push(item.Key);
      }
      continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
    } while (continuationToken);

    return keys;
  } catch (error) {
    wrapStorageFault('listQuizImageKeys', error);
  }
}

export async function uploadQuizImage(
  quizCode: string,
  file: Buffer,
  mimeType: string,
  originalName?: string,
  options?: { skipStoredCountCheck?: boolean }
): Promise<{ url: string; key: string }> {
  requireR2Config();

  if (!QUIZ_IMAGE_ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('不支援的圖片格式');
  }
  if (file.byteLength > QUIZ_MAX_IMAGE_FILE_BYTES) {
    throw new Error('圖片檔案超過大小上限');
  }

  if (!options?.skipStoredCountCheck) {
    const existingKeys = await listQuizImageKeys(quizCode);
    if (existingKeys.length >= QUIZ_MAX_IMAGES_PER_QUIZ) {
      throw new Error(`每份測驗卷最多 ${QUIZ_MAX_IMAGES_PER_QUIZ} 張圖片`);
    }
  }

  const extFromName = originalName?.match(/\.([a-zA-Z0-9]+)$/)?.[1]?.toLowerCase();
  const ext =
    extFromName && /^[a-z0-9]{1,8}$/.test(extFromName)
      ? extFromName
      : extensionFromMime(mimeType);
  const key = buildQuizImageKey(quizCode, `${randomUUID()}.${ext}`);

  try {
    const config = requireR2Config();
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: file,
        ContentType: mimeType,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
  } catch (error) {
    if (error instanceof SiteImgError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new SiteImgError(SITE_ERROR_CODES.IMG_UPLOAD_FAILED, detail, 500);
  }

  return { key, url: buildQuizImagePublicUrl(key) };
}

export async function deleteQuizImageKeys(keys: string[]): Promise<void> {
  if (!isQuizImageStorageConfigured() || keys.length === 0) return;

  try {
    const config = requireR2Config();
    const client = getS3Client();
    const chunkSize = 1000;
    for (let i = 0; i < keys.length; i += chunkSize) {
      const chunk = keys.slice(i, i + chunkSize);
      await client.send(
        new DeleteObjectsCommand({
          Bucket: config.bucketName,
          Delete: {
            Objects: chunk.map((Key) => ({ Key })),
            Quiet: true,
          },
        })
      );
    }
  } catch (error) {
    if (error instanceof SiteImgError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new SiteImgError(SITE_ERROR_CODES.IMG_DELETE_FAILED, detail, 500);
  }
}

export async function deleteQuizImageByKey(key: string): Promise<void> {
  if (!isQuizImageStorageConfigured()) return;

  try {
    const config = requireR2Config();
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: config.bucketName,
        Key: key,
      })
    );
  } catch (error) {
    if (error instanceof SiteImgError) throw error;
    const detail = error instanceof Error ? error.message : String(error);
    throw new SiteImgError(SITE_ERROR_CODES.IMG_DELETE_FAILED, detail, 500);
  }
}

/** 刪除測驗卷在 R2 上的所有圖片 */
export async function deleteAllQuizImages(quizCode: string): Promise<void> {
  if (!quizCode || !isQuizImageStorageConfigured()) return;
  const keys = await listQuizImageKeys(quizCode);
  await deleteQuizImageKeys(keys);
}

/** 將來源考卷圖片複製到新 quizCode 資料夾（檔名不變，供複製考卷使用） */
export async function cloneQuizImageFolder(fromCode: string, toCode: string): Promise<number> {
  if (!fromCode || !toCode || fromCode === toCode || !isQuizImageStorageConfigured()) return 0;

  const keys = await listQuizImageKeys(fromCode);
  if (keys.length === 0) return 0;

  const config = requireR2Config();
  const client = getS3Client();
  const fromPrefix = buildQuizImagePrefix(fromCode);
  let copied = 0;

  for (const key of keys) {
    if (!key.startsWith(fromPrefix)) continue;
    const filename = key.slice(fromPrefix.length);
    if (!filename) continue;
    const newKey = buildQuizImageKey(toCode, filename);
    try {
      await client.send(
        new CopyObjectCommand({
          Bucket: config.bucketName,
          CopySource: `${config.bucketName}/${key}`,
          Key: newKey,
        })
      );
      copied += 1;
    } catch (error) {
      wrapStorageFault('cloneQuizImageFolder', error);
    }
  }

  return copied;
}

/**
 * 刪除 R2 上未被測驗 HTML 引用的圖片（儲存後同步）。
 */
export async function syncOrphanedQuizImages(
  quiz: Pick<Quiz, 'quizCode' | 'sections' | 'description'>
): Promise<void> {
  if (!quiz.quizCode || !isQuizImageStorageConfigured()) return;

  const referenced = new Set(listReferencedQuizImageKeys(quiz));
  const stored = await listQuizImageKeys(quiz.quizCode);
  const orphanKeys = stored.filter((key) => !referenced.has(key));
  await deleteQuizImageKeys(orphanKeys);
}

/** @deprecated 儲存時才上傳／同步；保留相容舊呼叫 */
export async function prepareQuizImageUpload(
  quiz: Pick<Quiz, 'quizCode' | 'sections' | 'description'>
): Promise<void> {
  await syncOrphanedQuizImages(quiz);
}

export function assertQuizImageKeyBelongsToQuiz(key: string, quizCode: string): boolean {
  return key.startsWith(buildQuizImagePrefix(quizCode));
}

export function quizImageKeyFromPublicUrl(url: string): string | null {
  const key = quizImageKeyFromUrl(url);
  if (!key || !key.startsWith(`${QUIZ_IMAGE_FOLDER}/`)) return null;
  return key;
}
