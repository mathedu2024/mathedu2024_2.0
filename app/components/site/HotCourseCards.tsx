'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface HotCourse {
  id: string;
  name: string;
  code: string;
  description?: string;
  coverImageURL?: string;
  subjectTag?: string;
  courseNature?: string;
  gradeTags?: string[];
  status?: string;
  showInIntroduction?: boolean;
  archived?: boolean;
}

function pickBadge(course: HotCourse) {
  if (course.courseNature) return course.courseNature;
  if (course.gradeTags?.[0]) return course.gradeTags[0];
  return course.status || '課程';
}

function isDisplayableHotCourse(course: HotCourse) {
  if (course.archived) return false;
  if (course.showInIntroduction === false) return false;
  const name = String(course.name || '').trim();
  const code = String(course.code || '').trim();
  // 排除尚未填寫名稱／代碼的空殼課程（首頁會出現空白卡片）
  if (!name || !code) return false;
  return true;
}

export default function HotCourseCards({ limit = 3 }: { limit?: number }) {
  const [courses, setCourses] = useState<HotCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/courses/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        });
        if (!res.ok) throw new Error('failed');
        const data = await res.json();
        const list: HotCourse[] = Array.isArray(data) ? data : (data.data || data.courses || []);
        const filtered = list.filter(isDisplayableHotCourse).slice(0, limit);
        if (!cancelled) setCourses(filtered);
      } catch {
        if (!cancelled) setCourses([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="h-80 rounded-xl bg-surface-container animate-pulse" />
        ))}
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-outline-variant bg-surface-containerLowest p-12 text-center text-on-surfaceVariant">
        目前尚無公開課程，請稍後再查看。
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {courses.map((course) => (
        <article
          key={course.id || course.code}
          className="bg-surface-containerLowest rounded-xl shadow-card hover:shadow-elevate hover:-translate-y-1 transition-all duration-300 overflow-hidden group flex flex-col"
        >
          <div className="h-44 relative overflow-hidden bg-surface-container">
            {course.coverImageURL ? (
              <Image
                src={course.coverImageURL}
                alt={course.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-primary/40">
                <i className="fas fa-book-open text-4xl" aria-hidden />
              </div>
            )}
            <div className="absolute top-3 right-3 bg-secondary-container text-secondary font-mono text-[10px] font-semibold tracking-wide px-3 py-1 rounded-full">
              {pickBadge(course)}
            </div>
          </div>
          <div className="p-5 flex flex-col flex-1">
            <div className="flex flex-wrap gap-2 mb-3">
              {course.subjectTag && (
                <span className="bg-surface-container text-on-surfaceVariant font-mono text-[10px] font-semibold px-2 py-1 rounded">
                  {course.subjectTag}
                </span>
              )}
              {course.gradeTags?.slice(0, 2).map((g) => (
                <span key={g} className="bg-surface-container text-on-surfaceVariant font-mono text-[10px] font-semibold px-2 py-1 rounded">
                  {g}
                </span>
              ))}
            </div>
            <h3 className="font-display text-lg font-bold text-on-surface mb-2 line-clamp-2">{course.name}</h3>
            <p className="text-sm text-on-surfaceVariant mb-6 line-clamp-2 flex-1">
              {course.description?.replace(/<[^>]+>/g, '') || '點擊查看課程詳細介紹與開課資訊。'}
            </p>
            <div className="flex justify-between items-center border-t border-surface-container pt-4 gap-3">
              <span className="text-xs text-outline font-mono truncate">{course.code}</span>
              <Link
                href={course.code ? `/courses/${encodeURIComponent(course.code)}` : '/courses'}
                className="shrink-0 bg-primary text-on-primary text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors shadow-btn"
              >
                查看介紹
              </Link>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
