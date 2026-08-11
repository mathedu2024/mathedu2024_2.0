'use client';

import Image from 'next/image';
import Link from 'next/link';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  SITE_TEACHERS,
  findSiteTeacherByAuthorName,
  normalizeTeacherName,
  siteTeacherProfileHref,
  type SiteTeacher,
} from '@/data/siteTeachers';
import SiteFooter from '@/components/site/SiteFooter';

type Teacher = SiteTeacher;

type PublicCourse = {
  id: string;
  name: string;
  code: string;
  description?: string;
  coverImageURL?: string;
  subjectTag?: string;
  status?: string;
  teachers?: unknown;
};

type ApiTeacher = { id?: string; name?: string; uid?: string; _id?: string };

function teacherBlurb(teacher: Teacher) {
  if (teacher.introduction?.trim()) return teacher.introduction.trim();
  if (teacher.expertise?.[0]) return teacher.expertise[0];
  if (teacher.experience?.[0]) return teacher.experience[0];
  return '點擊查看完整學經歷與授課資訊。';
}

function teacherTags(teacher: Teacher) {
  const fromExpertise = teacher.expertise?.slice(0, 3) || [];
  if (fromExpertise.length > 0) return fromExpertise;
  return teacher.courses?.slice(0, 3) || [];
}

function resolveTeacher(nameParam: string | null): Teacher | null {
  if (!nameParam) return null;
  return (
    findSiteTeacherByAuthorName(nameParam) ||
    SITE_TEACHERS.find((t) => normalizeTeacherName(t.name) === normalizeTeacherName(nameParam)) ||
    null
  );
}

function courseMatchesTeacher(
  course: PublicCourse,
  teacher: Teacher,
  teacherMap: Record<string, string>
): boolean {
  const target = normalizeTeacherName(teacher.name);
  const teacherData = course.teachers;
  let items: (string | ApiTeacher)[] = [];
  if (Array.isArray(teacherData)) items = teacherData as (string | ApiTeacher)[];
  else if (typeof teacherData === 'object' && teacherData !== null) items = Object.keys(teacherData);
  else if (typeof teacherData === 'string') items = [teacherData];

  const names = items
    .map((item) => {
      if (typeof item === 'object' && item !== null && item.name) return item.name;
      const id = String(item);
      return teacherMap[id] || id;
    })
    .filter(Boolean);

  if (
    names.some((n) => {
      const key = normalizeTeacherName(n);
      return key === target || key.includes(target) || target.includes(key);
    })
  ) {
    return true;
  }

  return (teacher.courses || []).some((label) => {
    const a = normalizeTeacherName(label);
    const b = normalizeTeacherName(course.name);
    return Boolean(a && b && (a.includes(b) || b.includes(a)));
  });
}

function TeacherProfile({ teacher }: { teacher: Teacher }) {
  const affiliation = teacher.education?.[teacher.education.length - 1] || teacher.subject;
  const introduction = teacher.introduction?.trim() || '';
  const shortName = teacher.name.replace(/\s*老師\s*$/, '');

  const [relatedCourses, setRelatedCourses] = useState<PublicCourse[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCoursesLoading(true);
      try {
        const [coursesRes, teachersRes] = await Promise.all([
          fetch('/api/courses/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          }),
          fetch('/api/teacher/list'),
        ]);

        const teacherMap: Record<string, string> = {};
        if (teachersRes.ok) {
          const data = await teachersRes.json();
          const list: ApiTeacher[] = Array.isArray(data)
            ? data
            : data.data || data.teachers || data.users || [];
          list.forEach((t) => {
            if (t.id && t.name) teacherMap[t.id] = t.name;
            if (t.uid && t.name) teacherMap[t.uid] = t.name;
            if (t._id && t.name) teacherMap[t._id] = t.name;
          });
        }

        if (!coursesRes.ok) {
          if (!cancelled) setRelatedCourses([]);
          return;
        }

        const data = await coursesRes.json();
        const list: PublicCourse[] = Array.isArray(data) ? data : data.data || data.courses || [];
        const matched = list.filter((c) => courseMatchesTeacher(c, teacher, teacherMap));
        if (!cancelled) setRelatedCourses(matched);
      } catch {
        if (!cancelled) setRelatedCourses([]);
      } finally {
        if (!cancelled) setCoursesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [teacher]);

  return (
    <main className="page-shell flex-grow w-full py-8 md:py-12">
      <Link
        href="/teacher"
        className="inline-flex items-center gap-2 text-sm text-on-surfaceVariant hover:text-primary mb-6 transition-colors"
      >
        <i className="fas fa-arrow-left" aria-hidden />
        返回老師介紹
      </Link>

      <div className="grid grid-cols-1 gap-8 mb-10">
        <div className="bg-surface-containerLowest rounded-2xl p-8 md:p-12 shadow-sm border border-outline-variant/30 relative overflow-hidden group flex flex-col md:flex-row gap-10 md:gap-12 items-center md:items-start">
          <div className="absolute inset-0 bg-gradient-to-br from-primary-fixed/20 to-transparent opacity-50 z-0 pointer-events-none" />

          <div className="flex flex-col items-center flex-shrink-0 z-10 w-full md:w-1/3">
            <div className="relative w-40 h-40 md:w-48 md:h-48 rounded-full overflow-hidden mb-6 border-4 border-surface-containerLowest shadow-lg bg-surface-container">
              {teacher.photo ? (
                <Image
                  src={teacher.photo}
                  alt={teacher.name}
                  fill
                  className="object-cover object-top transition-transform duration-500 group-hover:scale-105"
                  sizes="192px"
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-outline-variant text-5xl">
                  <i className="fas fa-user" aria-hidden />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col flex-1 z-10 min-w-0 w-full">
            <h1 className="font-display text-2xl md:text-3xl font-extrabold text-on-surface mb-2 tracking-tight">
              {teacher.name}
            </h1>
            <p className="font-display text-lg md:text-xl font-bold text-primary mb-2">{teacher.subject}</p>
            <p className="text-on-surfaceVariant mb-8 flex items-start gap-2 leading-relaxed">
              <i className="fas fa-graduation-cap text-outline mt-1" aria-hidden />
              <span>{affiliation}</span>
            </p>

            <h2 className="font-display text-xl font-bold mb-4 flex items-center gap-2">
              <i className="fas fa-user text-primary" aria-hidden />
              關於 {shortName}
            </h2>
            {introduction ? (
              <p className="text-on-surfaceVariant leading-relaxed whitespace-pre-line">{introduction}</p>
            ) : (
              <p className="text-on-surfaceVariant/70 italic leading-relaxed">老師尚未填寫自我介紹。</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          <div className="bg-primary-container text-on-primary rounded-2xl p-6 md:p-8 shadow-sm flex flex-col">
            <h3 className="font-display text-xl md:text-2xl font-bold mb-5 flex items-center gap-2">
              <i className="fas fa-lightbulb" aria-hidden />
              教學專長
            </h3>
            {(teacher.expertise?.length || 0) > 0 ? (
              <ul className="flex flex-col gap-3">
                {teacher.expertise.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-base md:text-lg leading-relaxed">
                    <i className="fas fa-check-circle mt-1 shrink-0 opacity-90" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-base opacity-90 italic">尚未填寫</p>
            )}
          </div>

          <div className="bg-surface-containerLowest rounded-2xl p-8 shadow-sm border border-outline-variant/30 flex items-center justify-around gap-4">
            <div className="text-center">
              <p className="font-mono text-4xl md:text-5xl font-bold text-primary mb-2 tabular-nums">
                {coursesLoading
                  ? '—'
                  : relatedCourses.length > 0
                    ? relatedCourses.length
                    : teacher.courses?.length || 0}
              </p>
              <p className="text-sm text-on-surfaceVariant">授課課程</p>
            </div>
            <div className="w-px h-20 md:h-24 bg-outline-variant/50" />
            <div className="text-center">
              <p className="font-mono text-4xl md:text-5xl font-bold text-primary mb-2 tabular-nums">
                {teacher.experience?.length || 0}
              </p>
              <p className="text-sm text-on-surfaceVariant">經歷項目</p>
            </div>
          </div>
        </div>

        {(teacher.education?.length > 0 || teacher.experience?.length > 0) && (
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-containerLowest rounded-2xl p-6 md:p-8 border border-outline-variant/30 shadow-sm">
              <h3 className="font-display text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
                <i className="fas fa-graduation-cap text-primary" aria-hidden />
                學歷
              </h3>
              {teacher.education?.length ? (
                <ul className="space-y-2">
                  {teacher.education.map((edu) => (
                    <li key={edu} className="flex items-start text-sm text-on-surfaceVariant">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 mr-2 shrink-0" />
                      {edu}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-on-surfaceVariant">尚未填寫</p>
              )}
            </div>

            <div className="bg-surface-containerLowest rounded-2xl p-6 md:p-8 border border-outline-variant/30 shadow-sm">
              <h3 className="font-display text-lg font-bold text-on-surface mb-4 flex items-center gap-2">
                <i className="fas fa-briefcase text-secondary" aria-hidden />
                經歷
              </h3>
              {teacher.experience?.length ? (
                <ul className="space-y-2">
                  {teacher.experience.map((exp) => (
                    <li key={exp} className="flex items-start text-sm text-on-surfaceVariant">
                      <span className="w-1.5 h-1.5 bg-secondary rounded-full mt-1.5 mr-2 shrink-0" />
                      {exp}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-on-surfaceVariant">尚未填寫</p>
              )}
            </div>
          </section>
        )}
      </div>

      <section className="mb-4">
        <div className="flex justify-between items-end gap-4 mb-8">
          <h2 className="font-display text-xl md:text-2xl font-bold text-on-surface">
            {shortName} 的課程
          </h2>
          <Link
            href="/courses"
            className="font-mono text-[11px] font-semibold tracking-wider uppercase text-primary hover:underline inline-flex items-center gap-1 shrink-0"
          >
            查看全部 <i className="fas fa-arrow-right text-[10px]" aria-hidden />
          </Link>
        </div>

        {coursesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="h-72 rounded-2xl bg-surface-container animate-pulse" />
            ))}
          </div>
        ) : relatedCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {relatedCourses.map((course) => (
              <Link
                key={course.id || course.code}
                href={`/courses/${encodeURIComponent(course.code)}`}
                className="bg-surface-containerLowest rounded-2xl overflow-hidden shadow-sm border border-outline-variant/30 hover:shadow-elevate transition-all duration-300 group flex flex-col"
              >
                <div className="h-40 bg-surface-container relative overflow-hidden flex-shrink-0">
                  {course.coverImageURL ? (
                    <Image
                      src={course.coverImageURL}
                      alt={course.name}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-110"
                      sizes="(max-width: 768px) 100vw, 33vw"
                      unoptimized
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-container to-primary-container/30">
                      <i className="fas fa-book-open text-4xl text-primary/40" aria-hidden />
                    </div>
                  )}
                  {course.status && (
                    <div className="absolute top-4 right-4 bg-primary text-on-primary font-mono text-[10px] font-semibold tracking-wider px-3 py-1 rounded-full shadow-sm">
                      {course.status}
                    </div>
                  )}
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex flex-wrap gap-2 mb-4">
                    {course.subjectTag && (
                      <span className="text-[11px] font-mono font-semibold bg-surface-container text-on-surface px-2 py-1 rounded">
                        {course.subjectTag}
                      </span>
                    )}
                    <span className="text-[11px] font-mono font-semibold bg-surface-container text-on-surfaceVariant px-2 py-1 rounded">
                      {course.code}
                    </span>
                  </div>
                  <h3 className="font-display text-lg font-bold mb-3 group-hover:text-primary transition-colors line-clamp-2">
                    {course.name}
                  </h3>
                  {course.description?.trim() ? (
                    <p className="text-sm text-on-surfaceVariant mb-6 line-clamp-3 flex-1 leading-relaxed">
                      {course.description}
                    </p>
                  ) : (
                    <div className="flex-1 mb-6" />
                  )}
                  <span className="block w-full text-center border border-primary text-primary group-hover:bg-primary/5 text-sm font-bold py-3 rounded-lg transition-colors mt-auto">
                    查看課程介紹
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (teacher.courses?.length || 0) > 0 ? (
          <div className="bg-surface-containerLowest rounded-2xl border border-outline-variant/30 p-6 md:p-8">
            <p className="text-sm text-on-surfaceVariant mb-4">
              目前公開課表尚無對應課程，以下為授課方向：
            </p>
            <div className="flex flex-wrap gap-2">
              {teacher.courses.map((c) => (
                <span
                  key={c}
                  className="px-3 py-1.5 rounded-full bg-surface-container text-on-surface text-sm font-medium"
                >
                  {c}
                </span>
              ))}
            </div>
            <Link href="/courses" className="inline-flex mt-6 text-sm font-medium text-primary hover:underline">
              前往課程介紹
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-outline-variant bg-surface-containerLowest p-10 text-center text-on-surfaceVariant">
            目前尚未公布授課課程
          </div>
        )}
      </section>
    </main>
  );
}

function TeacherList({ onOpen }: { onOpen: (teacher: Teacher) => void }) {
  return (
    <main className="page-shell flex-grow flex flex-col w-full py-12 md:py-16">
      <div className="text-center mb-12 md:mb-16">
        <h1 className="font-display text-3xl md:text-4xl font-extrabold text-primary mb-4 tracking-tight">
          老師介紹
        </h1>
        <p className="text-lg text-on-surfaceVariant max-w-2xl mx-auto leading-relaxed">
          認識我們的教學團隊，了解專長領域與授課方向。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SITE_TEACHERS.map((teacher) => {
          const tags = teacherTags(teacher).slice(0, 2);
          return (
            <article
              key={teacher.name}
              id={`teacher-${normalizeTeacherName(teacher.name)}`}
              className="bg-surface-containerLowest rounded-xl shadow-card hover:shadow-elevate hover:-translate-y-1 transition-all duration-300 flex flex-col overflow-hidden border border-outline-variant/30 scroll-mt-24"
            >
              <div className="relative w-full aspect-[4/3] bg-surface-container overflow-hidden">
                {teacher.photo ? (
                  <Image
                    src={teacher.photo}
                    alt={teacher.name}
                    fill
                    className="object-cover object-top"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-outline-variant">
                    <i className="fas fa-user text-5xl" aria-hidden />
                  </div>
                )}
              </div>

              <div className="p-6 flex-grow flex flex-col">
                <h2 className="font-display text-xl font-bold text-on-surface mb-1">{teacher.name}</h2>
                <p className="text-primary mb-4">{teacher.subject}</p>

                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-surface-containerHighest text-on-surface px-3 py-1.5 rounded-full text-sm font-semibold"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <p className="text-on-surfaceVariant mb-6 flex-grow leading-relaxed line-clamp-3">
                  {teacherBlurb(teacher)}
                </p>

                <button
                  type="button"
                  onClick={() => onOpen(teacher)}
                  className="w-full border-2 border-primary text-primary hover:bg-primary/5 font-bold py-3 rounded-lg transition-colors mt-auto"
                >
                  查看詳細資料
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}

export default function TeacherPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface" />}>
      <TeacherPageContent />
    </Suspense>
  );
}

function TeacherPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nameParam = searchParams.get('name');
  const profileTeacher = resolveTeacher(nameParam);

  const openTeacher = (teacher: Teacher) => {
    router.push(siteTeacherProfileHref(teacher));
  };

  if (nameParam && !profileTeacher) {
    return (
      <div className="min-h-full flex flex-col bg-surface text-on-surface">
        <main className="page-shell flex-grow py-20 text-center">
          <h1 className="font-display text-2xl font-bold mb-2">找不到這位老師</h1>
          <p className="text-on-surfaceVariant mb-6">請返回老師介紹列表再試一次。</p>
          <Link
            href="/teacher"
            className="inline-flex px-6 py-3 bg-primary text-on-primary rounded-lg font-bold hover:bg-primary-hover transition-colors"
          >
            返回老師介紹
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-surface text-on-surface">
      {profileTeacher ? (
        <TeacherProfile teacher={profileTeacher} />
      ) : (
        <TeacherList onOpen={openTeacher} />
      )}
      <SiteFooter />
    </div>
  );
}
