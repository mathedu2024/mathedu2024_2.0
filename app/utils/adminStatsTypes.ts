export type AdminSystemLogRow = {
  id: string;
  time: string;
  actor: string;
  action: string;
  status: 'success' | 'error' | 'info';
  statusLabel: string;
};

export type AdminPendingReviews = {
  posts: number;
  teachers: number;
};

export type AdminStatsPayload = {
  studentCount: number;
  teacherCount: number;
  courseCount: number;
  /** 未封存課程數 */
  activeCourseCount: number;
  /** 本月（台灣時區）新註冊學生 */
  monthNewStudents: number;
  /** 近 7 日每日新註冊（長度 7，由舊到新） */
  weeklyGrowth: number[];
  /** 近 30 日每日新註冊（長度 30，由舊到新） */
  monthlyGrowth: number[];
  pendingReviews: AdminPendingReviews;
  recentLogs: AdminSystemLogRow[];
  dbReadGuard?: unknown;
  dbWriteGuard?: unknown;
};

export const EMPTY_ADMIN_STATS: AdminStatsPayload = {
  studentCount: 0,
  teacherCount: 0,
  courseCount: 0,
  activeCourseCount: 0,
  monthNewStudents: 0,
  weeklyGrowth: Array.from({ length: 7 }, () => 0),
  monthlyGrowth: Array.from({ length: 30 }, () => 0),
  pendingReviews: { posts: 0, teachers: 0 },
  recentLogs: [],
};
