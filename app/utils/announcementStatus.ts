import { isStudentVisible } from '@/components/StudentVisibilityToggle';
import type { CourseAnnouncement } from '@/components/TeacherAnnouncementEditor';

export type AnnouncementStatusFilter = 'all' | 'published' | 'draft' | 'scheduled';

export type AnnouncementDisplayStatus = 'published' | 'draft' | 'scheduled';

/** 依可見性／預定時間推導顯示狀態 */
export function getAnnouncementDisplayStatus(
  ann: Pick<CourseAnnouncement, 'visibleToStudents' | 'scheduledAt'>
): AnnouncementDisplayStatus {
  const scheduledAt = ann.scheduledAt?.trim();
  if (
    scheduledAt &&
    !Number.isNaN(Date.parse(scheduledAt)) &&
    Date.parse(scheduledAt) > Date.now() &&
    !isStudentVisible(ann.visibleToStudents)
  ) {
    return 'scheduled';
  }
  if (isStudentVisible(ann.visibleToStudents)) return 'published';
  return 'draft';
}

export function announcementStatusLabel(status: AnnouncementDisplayStatus): string {
  if (status === 'published') return '已發佈';
  if (status === 'scheduled') return '預定';
  return '草稿';
}

export function formatAnnouncementDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

export function announcementPreviewText(html: string, max = 80): string {
  const text = String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}
