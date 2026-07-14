import type { Firestore } from 'firebase-admin/firestore';

/**
 * Parse composite course id: "課程名稱(課程代碼)".
 * Supports names that contain parentheses, e.g. "2026高二[數學]TRML(光仁)(M20261121)".
 */
export function parseCourseCompositeId(compositeId: string): { name: string; code: string } | null {
  const trimmed = compositeId.trim();
  const match = trimmed.match(/^(.+)\(([^()]+)\)$/);
  if (!match) return null;
  return { name: match[1], code: match[2] };
}

/**
 * Parse course display id "課程名稱（代碼）" or "課程名稱(代碼)".
 * Code is always the LAST bracketed segment (supports names with internal parentheses).
 */
export function parseCourseDisplayName(display: string): { name: string; code: string } | null {
  const trimmed = display.trim();
  const fullwidthEnd = trimmed.match(/^(.+)[（]([^（）]+)[）]$/);
  if (fullwidthEnd) {
    return { name: fullwidthEnd[1].trim(), code: fullwidthEnd[2].trim() };
  }
  return parseCourseCompositeId(trimmed);
}

/** Firestore `in` / `__name__ in` 上限為 30 */
const FIRESTORE_IN_LIMIT = 30;

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/**
 * Resolve enrolled course keys to Firestore course documents.
 * Tries document id first (chunked `in` queries), then name+code, then unique code-only match.
 */
export async function resolveCourseDocsByEnrolledIds(
  db: Firestore,
  enrolledCourses: string[]
): Promise<Map<string, FirebaseFirestore.QueryDocumentSnapshot>> {
  const resolved = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  const uniqueIds = [...new Set(enrolledCourses.filter(Boolean))];

  if (uniqueIds.length === 0) return resolved;

  const idChunks = chunkArray(uniqueIds, FIRESTORE_IN_LIMIT);
  const directSnaps = await Promise.all(
    idChunks.map((chunk) => db.collection('courses').where('__name__', 'in', chunk).get())
  );
  for (const snap of directSnaps) {
    snap.docs.forEach((doc) => resolved.set(doc.id, doc));
  }

  const missingIds = uniqueIds.filter((id) => !resolved.has(id));
  if (missingIds.length === 0) return resolved;

  const fallbackDocs = await Promise.all(
    missingIds.map(async (enrolledId) => {
      const doc = await resolveSingleCourseDoc(db, enrolledId);
      return doc ? ([enrolledId, doc] as const) : null;
    })
  );
  for (const entry of fallbackDocs) {
    if (entry) resolved.set(entry[0], entry[1]);
  }

  return resolved;
}

export function getCourseCompositeKey(name: string, code: string): string {
  return `${name}(${code})`;
}

export type CourseRefTarget = { id: string; name: string; code: string };

/** 判斷 enrolledCourses 中的 key 是否指向同一門課 */
export function enrolledKeyMatchesCourse(enrolledKey: string, course: CourseRefTarget): boolean {
  if (enrolledKey === course.id) return true;
  const composite = getCourseCompositeKey(course.name, course.code);
  if (enrolledKey === composite) return true;
  const parsedEnrolled = parseCourseDisplayName(enrolledKey);
  if (parsedEnrolled && parsedEnrolled.name === course.name && parsedEnrolled.code === course.code) {
    return true;
  }
  const parsedTarget = parseCourseDisplayName(course.id) ?? parseCourseCompositeId(course.id);
  if (
    parsedEnrolled &&
    parsedTarget &&
    parsedEnrolled.name === parsedTarget.name &&
    parsedEnrolled.code === parsedTarget.code
  ) {
    return true;
  }
  return false;
}

/** 從 enrolledCourses 移除指定課程（含舊版/別名 key） */
export function removeCoursesFromEnrolledList(
  enrolledCourses: string[],
  coursesToRemove: CourseRefTarget[]
): string[] {
  return enrolledCourses.filter(
    (key) => !coursesToRemove.some((course) => enrolledKeyMatchesCourse(key, course))
  );
}

/** 將選取的 course.id 轉成完整課程物件（供批次操作使用） */
export function resolveCoursesFromCatalog(
  selectedCourseIds: string[],
  catalog: CourseRefTarget[]
): CourseRefTarget[] {
  return selectedCourseIds
    .map((id) => catalog.find((c) => c.id === id))
    .filter((c): c is CourseRefTarget => !!c);
}

export async function resolveSingleCourseDoc(
  db: Firestore,
  enrolledId: string
): Promise<FirebaseFirestore.QueryDocumentSnapshot | null> {
  const direct = await db.collection('courses').doc(enrolledId).get();
  if (direct.exists) return direct as FirebaseFirestore.QueryDocumentSnapshot;

  const parsed = parseCourseCompositeId(enrolledId);
  if (!parsed) return null;

  const byNameCode = await db
    .collection('courses')
    .where('name', '==', parsed.name)
    .where('code', '==', parsed.code)
    .limit(1)
    .get();
  if (!byNameCode.empty) return byNameCode.docs[0];

  const byCode = await db.collection('courses').where('code', '==', parsed.code).get();
  if (byCode.size === 1) return byCode.docs[0];

  return null;
}
