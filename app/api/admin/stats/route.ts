import { NextRequest, NextResponse } from 'next/server';
import { getDbReadGuardStats } from '@/services/dbReadGuard';
import { getDbWriteGuardStats } from '@/services/dbWriteGuard';
import { adminDb } from '../../../../services/firebase-admin';
import { contentWriteCollection } from '@/services/contentDbSplit';
import { isCourseArchived } from '@/services/courseArchive';
import { trySiteDbErrorResponse } from '@/utils/apiErrorResponse';
import { requireAuthFromRequest, authGuard } from '@/services/apiAuth';
import { DISPLAY_TIME_ZONE, formatDateTimeZhTw } from '@/utils/dateTimeFormat';
import type { AdminStatsPayload, AdminSystemLogRow } from '@/utils/adminStatsTypes';

function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'object') {
    const maybeTs = value as { toDate?: () => Date; _seconds?: number; seconds?: number };
    if (typeof maybeTs.toDate === 'function') {
      try {
        const d = maybeTs.toDate();
        return Number.isNaN(d.getTime()) ? null : d;
      } catch {
        return null;
      }
    }
    const seconds = maybeTs._seconds ?? maybeTs.seconds;
    if (typeof seconds === 'number') {
      const d = new Date(seconds * 1000);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  }
  return null;
}

function taipeiDayKey(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: DISPLAY_TIME_ZONE });
}

function taipeiMonthKey(d: Date): string {
  return d.toLocaleDateString('en-CA', {
    timeZone: DISPLAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
  }).slice(0, 7);
}

/** 由舊到新的近 N 個台灣日曆日（含今天） */
function buildDayKeys(days: number): string[] {
  const keys: string[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    keys.push(taipeiDayKey(new Date(now - i * 86_400_000)));
  }
  return keys;
}

function bucketCounts(dates: Date[], dayKeys: string[]): number[] {
  const map = new Map(dayKeys.map((k) => [k, 0]));
  for (const d of dates) {
    const key = taipeiDayKey(d);
    if (map.has(key)) map.set(key, (map.get(key) || 0) + 1);
  }
  return dayKeys.map((k) => map.get(k) || 0);
}

function isTeacherRole(data: Record<string, unknown>): boolean {
  const role = data.role;
  const roles = data.roles;
  return (
    (Array.isArray(role) && role.includes('teacher')) ||
    role === 'teacher' ||
    (Array.isArray(roles) && roles.includes('teacher')) ||
    roles === 'teacher'
  );
}

type ActivityDraft = {
  id: string;
  at: Date;
  actor: string;
  action: string;
  status: AdminSystemLogRow['status'];
  statusLabel: string;
};

function formatActivityTime(d: Date): string {
  return formatDateTimeZhTw(d, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function GET(req: NextRequest) {
  const denied = authGuard(requireAuthFromRequest(req, 'admin'));
  if (denied) return denied;

  try {
    const dayKeys30 = buildDayKeys(30);
    const dayKeys7 = dayKeys30.slice(-7);
    const currentMonth = taipeiMonthKey(new Date());
    const monthStartMs = new Date(`${currentMonth}-01T00:00:00+08:00`).getTime();
    const thirtyDaysAgoMs = Date.now() - 30 * 86_400_000;
    const sinceIso = new Date(Math.min(monthStartMs, thirtyDaysAgoMs)).toISOString();

    const [
      studentCountSnap,
      courseCountSnap,
      usersSnap,
      pendingCommentsSnap,
      pendingInvitesSnap,
      recentStudentsSnap,
      coursesSnap,
      recentCommentsSnap,
      recentAnnouncementsSnap,
      recentInvitesSnap,
    ] = await Promise.all([
      adminDb.collection('student_data').count().get(),
      adminDb.collection('courses').count().get(),
      adminDb.collection('users').get(),
      contentWriteCollection('blog_comments').where('isApproved', '==', false).count().get(),
      adminDb.collection('teacher_invites').where('status', '==', 'pending').get(),
      adminDb.collection('student_data').where('createdAt', '>=', sinceIso).get(),
      adminDb.collection('courses').get(),
      contentWriteCollection('blog_comments').orderBy('createdAt', 'desc').limit(10).get(),
      contentWriteCollection('announcements').orderBy('createdAt', 'desc').limit(5).get(),
      adminDb.collection('teacher_invites').orderBy('createdAt', 'desc').limit(5).get(),
    ]);

    let teacherCount = 0;
    usersSnap.docs.forEach((doc) => {
      if (isTeacherRole(doc.data() as Record<string, unknown>)) teacherCount++;
    });

    const nowMs = Date.now();
    let pendingTeachers = 0;
    pendingInvitesSnap.docs.forEach((doc) => {
      const data = doc.data();
      const exp = toDate(data.expiresAt);
      if (!exp || exp.getTime() > nowMs) pendingTeachers++;
    });

    const recentStudentDates: Date[] = [];
    let monthNewStudents = 0;
    const activities: ActivityDraft[] = [];

    recentStudentsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const created = toDate(data.createdAt);
      if (!created) return;
      recentStudentDates.push(created);
      if (taipeiMonthKey(created) === currentMonth) monthNewStudents++;
      activities.push({
        id: `student-${doc.id}`,
        at: created,
        actor: String(data.name || data.account || doc.id),
        action: '新學生註冊',
        status: 'success',
        statusLabel: '註冊',
      });
    });

    const activitySinceMs = Date.now() - 30 * 86_400_000;
    let activeCourseCount = 0;
    coursesSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (!isCourseArchived(data as { status?: string; archived?: boolean | string; name?: string })) {
        activeCourseCount++;
      }
      const created = toDate(data.createdAt);
      if (!created || created.getTime() < activitySinceMs) return;
      const teacherLabel = Array.isArray(data.teachers) ? data.teachers[0] : data.teachers;
      activities.push({
        id: `course-${doc.id}`,
        at: created,
        actor: String(data.createdByName || teacherLabel || '系統'),
        action: `建立課程「${String(data.name || data.code || doc.id)}」`,
        status: 'info',
        statusLabel: '課程',
      });
    });

    recentCommentsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const created = toDate(data.createdAt) || toDate(data.updatedAt);
      if (!created) return;
      const approved = Boolean(data.isApproved);
      activities.push({
        id: `comment-${doc.id}`,
        at: created,
        actor: String(data.userName || data.userId || '訪客'),
        action: approved
          ? `留言通過：${String(data.postTitle || data.postId || '').slice(0, 40) || '文章'}`
          : `待審留言：${String(data.content || '').slice(0, 40) || '（無內容）'}`,
        status: approved ? 'success' : 'info',
        statusLabel: approved ? '已審' : '待審',
      });
    });

    recentAnnouncementsSnap.docs.forEach((doc) => {
      const data = doc.data();
      const created = toDate(data.createdAt);
      if (!created) return;
      activities.push({
        id: `announcement-${doc.id}`,
        at: created,
        actor: String(data.author || data.createdBy || '管理員'),
        action: `發布公告「${String(data.title || doc.id)}」`,
        status: 'info',
        statusLabel: '公告',
      });
    });

    recentInvitesSnap.docs.forEach((doc) => {
      const data = doc.data();
      const created = toDate(data.createdAt);
      if (!created) return;
      const status = String(data.status || 'pending');
      activities.push({
        id: `invite-${doc.id}`,
        at: created,
        actor: String(data.email || data.name || '邀請'),
        action:
          status === 'claimed'
            ? `教師邀請已開通：${String(data.name || data.email || '')}`
            : `寄出教師邀請：${String(data.name || data.email || '')}`,
        status: status === 'claimed' ? 'success' : 'info',
        statusLabel: status === 'claimed' ? '已開通' : '邀請',
      });
    });

    activities.sort((a, b) => b.at.getTime() - a.at.getTime());
    const recentLogs: AdminSystemLogRow[] = activities.slice(0, 12).map((row) => ({
      id: row.id,
      time: formatActivityTime(row.at),
      actor: row.actor,
      action: row.action,
      status: row.status,
      statusLabel: row.statusLabel,
    }));

    const weeklyGrowth = bucketCounts(recentStudentDates, dayKeys7);
    const monthlyGrowth = bucketCounts(recentStudentDates, dayKeys30);

    const payload: AdminStatsPayload = {
      studentCount: studentCountSnap.data().count,
      teacherCount,
      courseCount: courseCountSnap.data().count,
      activeCourseCount,
      monthNewStudents,
      weeklyGrowth,
      monthlyGrowth,
      pendingReviews: {
        posts: pendingCommentsSnap.data().count,
        teachers: pendingTeachers,
      },
      recentLogs,
      dbReadGuard: getDbReadGuardStats(),
      dbWriteGuard: getDbWriteGuardStats(),
    };

    return NextResponse.json(payload);
  } catch (error) {
    const siteErrorResponse = trySiteDbErrorResponse(error, req);
    if (siteErrorResponse) return siteErrorResponse;
    throw error;
  }
}
