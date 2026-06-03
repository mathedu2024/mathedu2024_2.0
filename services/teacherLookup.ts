import type { Firestore } from 'firebase-admin/firestore';

/** 建立 id / uid / account → 顯示名稱 對照（與 CourseManager、公開課程頁一致） */
export async function buildTeacherIdToNameMap(db: Firestore): Promise<Map<string, string>> {
  const map = new Map<string, string>();

  const addEntry = (key: string | undefined | null, name: string) => {
    const trimmedKey = typeof key === 'string' ? key.trim() : '';
    const trimmedName = name.trim();
    if (!trimmedKey || !trimmedName || map.has(trimmedKey)) return;
    map.set(trimmedKey, trimmedName);
  };

  const usersSnap = await db.collection('users').get();
  usersSnap.docs.forEach((doc) => {
    const data = doc.data();
    const name = String(data.name ?? '');
    addEntry(doc.id, name);
    addEntry(data.uid as string | undefined, name);
    addEntry(data.account as string | undefined, name);
  });

  try {
    const teachersSnap = await db.collection('teachers').get();
    teachersSnap.docs.forEach((doc) => {
      const data = doc.data();
      const name = String(data.name ?? '');
      addEntry(doc.id, name);
      addEntry(data.uid as string | undefined, name);
      addEntry(data.account as string | undefined, name);
    });
  } catch {
    // legacy teachers 集合可選
  }

  return map;
}

/** 將 courses.teachers 陣列轉成顯示用字串（多位以「、」連接） */
export function formatTeacherNames(
  teacherIds: string[] | undefined | null,
  lookup: Map<string, string>
): string {
  if (!teacherIds?.length) return '';
  const names: string[] = [];
  const seen = new Set<string>();
  for (const id of teacherIds) {
    const key = typeof id === 'string' ? id.trim() : '';
    if (!key) continue;
    const name = lookup.get(key);
    if (name && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names.join('、');
}
