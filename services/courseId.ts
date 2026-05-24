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
 * Resolve enrolled course keys to Firestore course documents.
 * Tries document id first, then name+code, then unique code-only match.
 */
export async function resolveCourseDocsByEnrolledIds(
  db: Firestore,
  enrolledCourses: string[]
): Promise<Map<string, FirebaseFirestore.QueryDocumentSnapshot>> {
  const resolved = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  const uniqueIds = [...new Set(enrolledCourses.filter(Boolean))];

  if (uniqueIds.length === 0) return resolved;

  const directSnap = await db.collection('courses').where('__name__', 'in', uniqueIds).get();
  directSnap.docs.forEach((doc) => resolved.set(doc.id, doc));

  const missingIds = uniqueIds.filter((id) => !resolved.has(id));
  for (const enrolledId of missingIds) {
    const doc = await resolveSingleCourseDoc(db, enrolledId);
    if (doc) resolved.set(enrolledId, doc);
  }

  return resolved;
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
