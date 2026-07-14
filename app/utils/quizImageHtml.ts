import {
  ensureQuizSections,
  flattenQuestions,
  isChoiceQuestion,
  isGroupQuestion,
  type Quiz,
  type QuizSection,
} from '@/services/quizTypes';
import { QUIZ_IMAGE_FOLDER, QUIZ_MAX_IMAGES_PER_QUIZ } from '@/utils/quizImageLimits';

const IMG_SRC_RE = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;

/** 從 HTML 字串擷取所有 img src */
export function extractImageUrlsFromHtml(html: string | undefined | null): string[] {
  if (!html) return [];
  const urls: string[] = [];
  let match: RegExpExecArray | null;
  IMG_SRC_RE.lastIndex = 0;
  while ((match = IMG_SRC_RE.exec(html)) !== null) {
    urls.push(match[1]);
  }
  return urls;
}

/** 是否為尚未上傳的本機暫存圖（blob:／data:） */
export function isPendingQuizImageUrl(url: string): boolean {
  if (!url) return false;
  return url.startsWith('blob:') || url.startsWith('data:image/');
}

/** 是否為本系統管理的測驗圖片 URL（路徑含 quiz-images/{quizCode}/） */
export function isManagedQuizImageUrl(url: string, quizCode?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url, 'https://placeholder.local');
    const path = parsed.pathname;
    if (!path.includes(`/${QUIZ_IMAGE_FOLDER}/`)) return false;
    if (!quizCode) return true;
    return path.includes(`/${QUIZ_IMAGE_FOLDER}/${quizCode}/`);
  } catch {
    return url.includes(`/${QUIZ_IMAGE_FOLDER}/`);
  }
}

/** 從公開 URL 反推 R2 object key */
export function quizImageKeyFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const marker = `/${QUIZ_IMAGE_FOLDER}/`;
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return null;
    return parsed.pathname.slice(idx + 1);
  } catch {
    const marker = `${QUIZ_IMAGE_FOLDER}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.slice(idx).split('?')[0].split('#')[0];
  }
}

function collectQuizImageUrls(
  sections: QuizSection[],
  description: string | undefined,
  quizCode: string
): Set<string> {
  const urls = new Set<string>();
  const addFromHtml = (html: string) => {
    for (const url of extractImageUrlsFromHtml(html)) {
      if (isManagedQuizImageUrl(url, quizCode) || isPendingQuizImageUrl(url)) {
        urls.add(url);
      }
    }
  };

  addFromHtml(description ?? '');
  for (const section of sections) {
    addFromHtml(section.description ?? '');
    for (const question of section.questions) {
      addFromHtml(question.content);
      if (isChoiceQuestion(question)) {
        for (const opt of question.options) addFromHtml(opt);
      }
      if (isGroupQuestion(question)) {
        for (const sub of question.subQuestions) {
          addFromHtml(sub.content);
          if (isChoiceQuestion(sub)) {
            for (const opt of sub.options) addFromHtml(opt);
          }
        }
      }
    }
  }
  return urls;
}

/** 計算測驗卷內引用的圖片數量（已上傳＋待儲存暫存圖，以唯一 URL 計） */
export function countQuizImagesInQuiz(
  quiz: Pick<Quiz, 'quizCode' | 'sections' | 'description'>
): number {
  const quizCode = quiz.quizCode || '_pending';
  return collectQuizImageUrls(quiz.sections ?? [], quiz.description, quizCode).size;
}

/** 取得測驗卷內所有「已上傳」管理圖片的 object key（不含 blob／data） */
export function listReferencedQuizImageKeys(
  quiz: Pick<Quiz, 'quizCode' | 'sections' | 'description'>
): string[] {
  const quizCode = quiz.quizCode;
  if (!quizCode) return [];
  const urls = collectQuizImageUrls(quiz.sections ?? [], quiz.description, quizCode);
  const keys = new Set<string>();
  for (const url of urls) {
    if (isPendingQuizImageUrl(url)) continue;
    const key = quizImageKeyFromUrl(url);
    if (key) keys.add(key);
  }
  return Array.from(keys);
}

/** 列出內容中尚未上傳的暫存圖片 URL */
export function listPendingQuizImageUrls(
  quiz: Pick<Quiz, 'sections' | 'description'>
): string[] {
  const urls = new Set<string>();
  const addFromHtml = (html: string) => {
    for (const url of extractImageUrlsFromHtml(html)) {
      if (isPendingQuizImageUrl(url)) urls.add(url);
    }
  };
  addFromHtml(quiz.description ?? '');
  for (const section of quiz.sections ?? []) {
    addFromHtml(section.description ?? '');
    for (const question of section.questions) {
      addFromHtml(question.content);
      if (isChoiceQuestion(question)) {
        for (const opt of question.options) addFromHtml(opt);
      }
      if (isGroupQuestion(question)) {
        for (const sub of question.subQuestions) {
          addFromHtml(sub.content);
          if (isChoiceQuestion(sub)) {
            for (const opt of sub.options) addFromHtml(opt);
          }
        }
      }
    }
  }
  return Array.from(urls);
}

/** 將 HTML 中的暫存 URL 替換成已上傳公開 URL */
export function replaceQuizImageUrlsInHtml(html: string, urlMap: Map<string, string>): string {
  if (!html || urlMap.size === 0) return html;
  let next = html;
  for (const [from, to] of urlMap) {
    if (!from || !to || from === to) continue;
    next = next.split(from).join(to);
  }
  return next;
}

export function replacePendingQuizImageUrlsInQuiz<
  T extends Pick<Quiz, 'sections' | 'description'>,
>(quiz: T, urlMap: Map<string, string>): T {
  if (urlMap.size === 0) return quiz;

  const mapHtml = (html: string) => replaceQuizImageUrlsInHtml(html, urlMap);

  const sections = quiz.sections.map((section) => ({
    ...section,
    description: section.description ? mapHtml(section.description) : section.description,
    questions: section.questions.map((question) => {
      if (isChoiceQuestion(question)) {
        return {
          ...question,
          content: mapHtml(question.content),
          options: question.options.map(mapHtml),
        };
      }
      if (isGroupQuestion(question)) {
        return {
          ...question,
          content: mapHtml(question.content),
          subQuestions: question.subQuestions.map((sub) => {
            if (isChoiceQuestion(sub)) {
              return {
                ...sub,
                content: mapHtml(sub.content),
                options: sub.options.map(mapHtml),
              };
            }
            return { ...sub, content: mapHtml(sub.content) };
          }),
        };
      }
      return { ...question, content: mapHtml(question.content) };
    }),
  }));

  return {
    ...quiz,
    description: quiz.description ? mapHtml(quiz.description) : quiz.description,
    sections,
  };
}

/** 移除 HTML 中尚未上傳的暫存圖片標籤（避免寫入資料庫） */
export function stripPendingQuizImageTagsFromHtml(html: string): string {
  if (!html) return html;
  return html.replace(
    /<img\b[^>]*\bsrc\s*=\s*["'](?:blob:|data:image\/)[^"']*["'][^>]*>/gi,
    ''
  );
}

export function stripPendingQuizImagesFromQuiz<T extends Pick<Quiz, 'sections' | 'description'>>(
  quiz: T
): T {
  const mapHtml = (html: string) => stripPendingQuizImageTagsFromHtml(html);

  const sections = quiz.sections.map((section) => ({
    ...section,
    description: section.description ? mapHtml(section.description) : section.description,
    questions: section.questions.map((question) => {
      if (isChoiceQuestion(question)) {
        return {
          ...question,
          content: mapHtml(question.content),
          options: question.options.map(mapHtml),
        };
      }
      if (isGroupQuestion(question)) {
        return {
          ...question,
          content: mapHtml(question.content),
          subQuestions: question.subQuestions.map((sub) => {
            if (isChoiceQuestion(sub)) {
              return {
                ...sub,
                content: mapHtml(sub.content),
                options: sub.options.map(mapHtml),
              };
            }
            return { ...sub, content: mapHtml(sub.content) };
          }),
        };
      }
      return { ...question, content: mapHtml(question.content) };
    }),
  }));

  return {
    ...quiz,
    description: quiz.description ? mapHtml(quiz.description) : quiz.description,
    sections,
  };
}

export function validateQuizImageCount(
  quiz: Pick<Quiz, 'quizCode' | 'sections' | 'description'>
): string | null {
  const count = countQuizImagesInQuiz(quiz);
  if (count > QUIZ_MAX_IMAGES_PER_QUIZ) {
    return `每份測驗卷最多 ${QUIZ_MAX_IMAGES_PER_QUIZ} 張圖片（目前 ${count} 張）`;
  }
  return null;
}

/** 從 sections 建立用於圖片同步的 Quiz 片段 */
export function quizImageSyncPayload(
  quizCode: string,
  sections: QuizSection[],
  description?: string
): Pick<Quiz, 'quizCode' | 'sections' | 'description'> {
  return ensureQuizSections({
    id: 'sync',
    quizCode,
    teacherId: '',
    title: '',
    status: 'draft',
    sections,
    description,
    totalPoints: 0,
  });
}

/** 將測驗內容中的圖片路徑從舊 quizCode 改寫為新 quizCode */
export function rewriteQuizImageCodeInQuiz(
  quiz: Pick<Quiz, 'sections' | 'description'>,
  fromCode: string,
  toCode: string
): { sections: QuizSection[]; description: string } {
  if (!fromCode || !toCode || fromCode === toCode) {
    return {
      sections: quiz.sections ?? [],
      description: quiz.description ?? '',
    };
  }
  const fromPath = `/${QUIZ_IMAGE_FOLDER}/${fromCode}/`;
  const toPath = `/${QUIZ_IMAGE_FOLDER}/${toCode}/`;
  const payload = JSON.stringify({
    sections: quiz.sections ?? [],
    description: quiz.description ?? '',
  });
  const rewritten = payload.split(fromPath).join(toPath);
  const parsed = JSON.parse(rewritten) as {
    sections: QuizSection[];
    description: string;
  };
  return {
    sections: parsed.sections,
    description: parsed.description ?? '',
  };
}

/** 供除錯／預覽：列出整卷所有題目 HTML 欄位 */
export function flattenQuizHtmlFields(quiz: Pick<Quiz, 'sections' | 'description'>): string[] {
  const normalized = ensureQuizSections({
    id: 'x',
    quizCode: 'x',
    teacherId: '',
    title: '',
    status: 'draft',
    sections: quiz.sections,
    description: quiz.description,
    totalPoints: 0,
  });
  const fields: string[] = [];
  if (normalized.description) fields.push(normalized.description);
  for (const section of normalized.sections) {
    if (section.description) fields.push(section.description);
    for (const q of flattenQuestions([section])) {
      fields.push(q.content);
      if (isChoiceQuestion(q)) fields.push(...q.options);
      if (isGroupQuestion(q)) {
        for (const sub of q.subQuestions) {
          fields.push(sub.content);
          if (isChoiceQuestion(sub)) fields.push(...sub.options);
        }
      }
    }
  }
  return fields;
}
