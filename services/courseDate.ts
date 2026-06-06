/** Normalize Firestore Timestamp / ISO / yyyy-MM-dd to display-friendly yyyy/MM/dd */
export function normalizeCourseDate(field: unknown): string {
  if (field == null || field === '') return '';

  if (typeof field === 'object' && field !== null) {
    const ts = field as { toDate?: () => Date; _seconds?: number; seconds?: number };
    if (typeof ts.toDate === 'function') {
      const d = ts.toDate();
      return formatDateParts(d);
    }
    const sec = ts._seconds ?? ts.seconds;
    if (typeof sec === 'number') {
      return formatDateParts(new Date(sec * 1000));
    }
  }

  const str = String(field).trim();
  if (!str) return '';

  const date = new Date(str.includes('T') ? str : str.replace(/-/g, '/'));
  if (isNaN(date.getTime())) return str;

  return formatDateParts(date);
}

function formatDateParts(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}/${m}/${d}`;
}

export function formatCourseDateForDisplay(field: unknown): string {
  const normalized = normalizeCourseDate(field);
  return normalized || '未設定';
}
