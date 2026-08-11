'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import StatCard from '@/components/console/StatCard';
import type { Course } from '@/components/TeacherCourseManager';
import type { CourseActivityItem } from '@/services/courseActivityTypes';
import { formatActivityDateTime } from '@/services/courseActivityTypes';
import type { TodoItem, TodoSummary } from '@/services/todoSummary';
import {
  getTeacherCourseBucket,
  getTeacherCourseBucketBadgeClass,
} from '@/components/studentCourseListShared';
import { teacherCourseHubPath } from '@/utils/teacherCourseHub';

function timeGreeting(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return '晚安';
  if (h < 11) return '早安';
  if (h < 14) return '午安';
  if (h < 18) return '下午好';
  return '晚安';
}

function relativeTime(iso?: string): string {
  if (!iso) return '';
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const diff = Date.now() - t;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '剛剛';
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  const d = Math.floor(h / 24);
  return `${d} 天前`;
}

type Props = {
  userName?: string;
  courses: Course[];
};

export default function TeacherDashboard({ userName, courses }: Props) {
  const [news, setNews] = useState<CourseActivityItem[]>([]);
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);

  const activeCourses = useMemo(
    () => courses.filter((c) => !c.archived && c.status !== '已封存'),
    [courses]
  );

  const studentTotal = useMemo(() => {
    const ids = new Set<string>();
    activeCourses.forEach((c) => {
      (c.students || []).forEach((s) => {
        const key = s.studentId || s.id;
        if (key) ids.add(key);
      });
    });
    return ids.size;
  }, [activeCourses]);

  const previewCourses = activeCourses.slice(0, 4);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setNewsLoading(true);
        const [feedRes, todoRes] = await Promise.all([
          fetch('/api/teacher/activity-feed', { cache: 'no-store' }),
          fetch('/api/teacher/todo-summary', { cache: 'no-store' }),
        ]);
        if (feedRes.ok) {
          const data = await feedRes.json();
          const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
          if (!cancelled) setNews(items.slice(0, 8));
        }
        if (todoRes.ok) {
          const data = (await todoRes.json()) as TodoSummary;
          if (!cancelled) setTodos((data.items || []).slice(0, 5));
        }
      } catch {
        if (!cancelled) {
          setNews([]);
          setTodos([]);
        }
      } finally {
        if (!cancelled) setNewsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full min-w-0 space-y-8 animate-fade-in text-on-surface">
      <section>
        <h2 className="font-display text-3xl md:text-4xl font-extrabold tracking-tight text-on-surface mb-2">
          {timeGreeting()}
          {userName ? `，${userName}` : ''}
        </h2>
        <p className="text-lg text-on-surfaceVariant">這是您目前的教學概況</p>
      </section>

      {/* Stats — 無「老師開課」CTA */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <StatCard
          tone="primary"
          label="學生總數"
          value={studentTotal.toLocaleString('zh-TW')}
          icon={<i className="fas fa-users" aria-hidden />}
        />
        <StatCard
          tone="secondary"
          label="進行中課程"
          value={activeCourses.length.toLocaleString('zh-TW')}
          icon={<i className="fas fa-school" aria-hidden />}
        />
        <StatCard
          tone="tertiary"
          label="平均評分"
          value="—"
          hint="即將開放"
          icon={<i className="fas fa-star" aria-hidden />}
        />
        <div className="relative overflow-hidden rounded-xl">
          <div className="absolute inset-0 bg-gradient-to-br from-error/10 to-transparent pointer-events-none" />
          <StatCard
            tone="neutral"
            label="最新消息"
            value={newsLoading ? '…' : news.length.toLocaleString('zh-TW')}
            icon={<i className="fas fa-newspaper text-error" aria-hidden />}
            className="relative border-error/20"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Course management preview */}
        <section className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-center gap-2">
            <h3 className="font-display text-xl md:text-2xl font-bold">課程管理</h3>
            <Link
              href="/back-panel/teacher-courses"
              className="text-primary font-medium hover:underline flex items-center gap-1 text-sm md:text-base"
            >
              查看全部 <i className="fas fa-arrow-right text-xs" aria-hidden />
            </Link>
          </div>

          {previewCourses.length === 0 ? (
            <div className="rounded-xl border border-dashed border-outline-variant bg-surface-containerLowest p-10 text-center text-on-surfaceVariant">
              <p className="font-semibold text-on-surface mb-1">尚無指派課程</p>
              <p className="text-sm">課程由管理員開設並指派授課老師，請聯繫管理員。</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {previewCourses.map((course) => {
                const bucket = getTeacherCourseBucket(course);
                const isDraft = bucket === '草稿';
                const muted = isDraft || bucket === '已封存';
                const studentCount = Array.isArray(course.students) ? course.students.length : 0;
                const href = teacherCourseHubPath(course.code, 'lessons');
                return (
                  <article
                    key={course.id}
                    className={`bg-surface-containerLowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/40 hover:shadow-elevate transition-all group ${
                      muted ? 'opacity-90' : ''
                    }`}
                  >
                    <div
                      className={`relative aspect-video overflow-hidden bg-gradient-to-br from-primary/15 via-surface-container to-tertiary/10 ${
                        muted ? 'grayscale-[40%]' : ''
                      }`}
                    >
                      {course.coverImageURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={course.coverImageURL}
                          alt=""
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : null}
                      <div
                        className={`absolute top-3 right-3 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider font-bold shadow-sm ${getTeacherCourseBucketBadgeClass(bucket)}`}
                      >
                        {bucket === '草稿' ? '草稿箱' : bucket}
                      </div>
                    </div>
                    <div className="p-5">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {(course.gradeTags || []).slice(0, 2).map((t) => (
                          <span
                            key={t}
                            className="px-2 py-0.5 rounded-full bg-surface-container text-on-surfaceVariant font-mono text-[10px]"
                          >
                            {t}
                          </span>
                        ))}
                        <span className="px-2 py-0.5 rounded-full bg-surface-container text-on-surfaceVariant font-mono text-[10px]">
                          {course.code}
                        </span>
                      </div>
                      <h4 className="font-display text-lg font-bold leading-tight mb-2 line-clamp-2">
                        {course.name}
                      </h4>
                      <div className="flex items-center gap-4 text-on-surfaceVariant text-sm mb-4">
                        <span className="flex items-center gap-1">
                          <i className="fas fa-user-group text-xs" aria-hidden /> {studentCount} 位學生
                        </span>
                        {course.subjectTag ? (
                          <span className="flex items-center gap-1 truncate">
                            <i className="fas fa-bookmark text-xs" aria-hidden /> {course.subjectTag}
                          </span>
                        ) : null}
                      </div>
                      <Link
                        href={href}
                        className={`block w-full py-2.5 text-center rounded-lg font-bold text-sm transition-colors ${
                          isDraft
                            ? 'bg-surface-container text-on-surfaceVariant hover:bg-surface-containerHigh'
                            : 'border-2 border-primary-container text-primary hover:bg-primary-container hover:text-on-primary'
                        }`}
                      >
                        {isDraft ? '繼續編輯' : '管理課程'}
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Sidebar: todos + 最新消息 */}
        <aside className="space-y-6">
          <div className="bg-primary text-on-primary rounded-xl p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-container rounded-full blur-2xl opacity-50 -translate-y-1/2 translate-x-1/2" />
            <div className="relative z-10">
              <h3 className="font-display text-lg font-bold mb-4 flex items-center gap-2">
                <i className="fas fa-calendar-check" aria-hidden />
                待辦事項
              </h3>
              {todos.length === 0 ? (
                <p className="text-sm text-primary-fixed/90">目前沒有待辦項目</p>
              ) : (
                <ul className="space-y-4">
                  {todos.map((item) => (
                    <li key={item.id} className="flex gap-3">
                      <div className="mt-1.5 w-2 h-2 rounded-full bg-secondary-container shrink-0" />
                      <div className="min-w-0">
                        <Link href={item.href || '/back-panel'} className="font-bold text-sm leading-tight hover:underline">
                          {item.title}
                        </Link>
                        {item.timeLabel ? (
                          <p className="font-mono text-[11px] text-primary-fixed/80 mt-1">{item.timeLabel}</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="bg-surface-containerLowest rounded-xl p-6 shadow-sm border border-outline-variant/40">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-display text-lg font-bold text-on-surface flex items-center gap-2">
                最新消息
                {!newsLoading && news.length > 0 ? (
                  <span className="bg-error text-on-primary text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {news.length}
                  </span>
                ) : null}
              </h3>
            </div>

            {newsLoading ? (
              <p className="text-sm text-on-surfaceVariant">載入中…</p>
            ) : news.length === 0 ? (
              <p className="text-sm text-on-surfaceVariant">目前沒有新消息</p>
            ) : (
              <div className="space-y-3">
                {news.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-surface rounded-lg border border-surface-variant hover:border-primary/30 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-1 gap-2">
                      <span className="font-mono text-[10px] uppercase text-on-surfaceVariant truncate">
                        {item.courseName || item.type || '課程動態'}
                      </span>
                      <span className="text-[10px] text-outline shrink-0 whitespace-nowrap">
                        {relativeTime(item.at) || formatActivityDateTime(item.at)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-on-surface line-clamp-1 mb-0.5">
                      {item.title}
                    </p>
                    {item.message ? (
                      <p className="text-xs text-on-surfaceVariant line-clamp-2 mb-2">{item.message}</p>
                    ) : null}
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="text-primary font-mono text-[11px] uppercase tracking-wider hover:underline"
                      >
                        查看
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            <Link
              href="/back-panel/teacher-courses"
              className="block w-full mt-4 py-2 bg-surface-container text-on-surface font-mono text-xs uppercase tracking-wider text-center rounded-lg hover:bg-surface-containerHigh transition-colors"
            >
              查看全部消息
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
