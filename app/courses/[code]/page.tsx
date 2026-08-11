'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import SiteFooter from '@/components/site/SiteFooter';
import {
  findSiteTeacherByAuthorName,
  siteTeacherProfileHref,
  type SiteTeacher,
} from '@/data/siteTeachers';

interface Teacher {
  id: string;
  name: string;
  uid?: string;
  _id?: string;
}

interface Course {
  id: string;
  name: string;
  code: string;
  teachingMethod: string;
  teachers: string[] | Record<string, unknown> | Teacher[];
  startDate: string;
  endDate: string;
  status: string;
  gradeTags: string[];
  subjectTag: string;
  courseNature: string;
  showInIntroduction: boolean;
  archived: boolean;
  description?: string;
  coverImageURL?: string;
  location?: string;
  liveStreamURL?: string;
  classTimes?: string[] | Record<string, string>[];
  teacherNamesDisplay?: string;
  teacherNameList?: string[];
  gradeTagsDisplay?: string;
}

function formatDate(dateString: string) {
  if (!dateString) return '未設定';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function formatClassTime(time: string | Record<string, string>) {
  if (typeof time === 'object' && time !== null) {
    return `${time.day || ''} ${time.startTime || ''} ~ ${time.endTime || ''}`.trim();
  }
  return String(time);
}

function resolveTeachers(
  course: Course,
  teacherMap: Record<string, string>
): { names: string[]; display: string } {
  const teacherData = course.teachers;
  let items: (string | Teacher)[] = [];
  if (Array.isArray(teacherData)) items = teacherData;
  else if (typeof teacherData === 'object' && teacherData !== null) items = Object.keys(teacherData);
  else if (typeof teacherData === 'string') items = [teacherData];

  const names = items
    .map((item) => {
      if (typeof item === 'object' && item !== null && (item as Teacher).name) {
        return (item as Teacher).name;
      }
      const id = String(item);
      return teacherMap[id] || id;
    })
    .filter(Boolean);

  return {
    names,
    display: names.length > 0 ? names.join('、') : '未指定老師',
  };
}

export default function CourseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const codeParam = decodeURIComponent(String(params?.code || ''));

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!codeParam) {
        setNotFound(true);
        setLoading(false);
        return;
      }

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
          const teachersList = Array.isArray(data)
            ? data
            : data.data || data.teachers || data.users || [];
          teachersList.forEach((t: Teacher) => {
            if (t.id) teacherMap[t.id] = t.name;
            if (t.uid) teacherMap[t.uid] = t.name;
            if (t._id) teacherMap[t._id] = t.name;
          });
        }

        if (!coursesRes.ok) throw new Error('failed to load courses');
        const data = await coursesRes.json();
        const coursesList: Course[] = Array.isArray(data)
          ? data
          : data.data || data.courses || [];

        const found = coursesList.find(
          (c) => String(c.code).toLowerCase() === codeParam.toLowerCase()
        );

        if (!found || cancelled) {
          if (!cancelled) {
            setNotFound(true);
            setLoading(false);
          }
          return;
        }

        const resolved = resolveTeachers(found, teacherMap);
        if (!cancelled) {
          setCourse({
            ...found,
            teacherNamesDisplay: resolved.display,
            teacherNameList: resolved.names,
            gradeTagsDisplay: Array.isArray(found.gradeTags)
              ? found.gradeTags.join('、')
              : '',
          });
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setNotFound(true);
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [codeParam]);

  const siteTeachers = useMemo(() => {
    if (!course?.teacherNameList?.length) return [] as SiteTeacher[];
    const matched: SiteTeacher[] = [];
    const seen = new Set<string>();
    for (const name of course.teacherNameList) {
      const t = findSiteTeacherByAuthorName(name);
      if (t && !seen.has(t.name)) {
        seen.add(t.name);
        matched.push(t);
      }
    }
    return matched;
  }, [course]);

  const learnItems = useMemo(() => {
    if (!course) return [];
    const items: string[] = [];
    if (course.subjectTag) items.push(`科目：${course.subjectTag}`);
    if (course.gradeTagsDisplay) items.push(`適用對象：${course.gradeTagsDisplay}`);
    if (course.courseNature) items.push(`課程性質：${course.courseNature}`);
    if (course.teachingMethod) items.push(`上課方式：${course.teachingMethod}`);
    if (course.location) items.push(`上課地點：${course.location}`);
    if (course.startDate || course.endDate) {
      items.push(`課程期間：${formatDate(course.startDate)} ~ ${formatDate(course.endDate)}`);
    }
    return items;
  }, [course]);

  const canEnroll = course?.status === '報名中';
  const primaryTeacher = siteTeachers[0] || null;
  const primaryTeacherName =
    primaryTeacher?.name || course?.teacherNameList?.[0] || course?.teacherNamesDisplay || '授課老師';

  if (loading) {
    return (
      <div className="min-h-full flex flex-col bg-surface">
        <div className="page-shell py-10 flex-1 w-full space-y-6">
          <div className="h-5 w-64 bg-surface-container animate-pulse rounded" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <div className="aspect-video rounded-xl bg-surface-container animate-pulse" />
              <div className="h-12 w-3/4 bg-surface-container animate-pulse rounded" />
              <div className="h-20 bg-surface-container animate-pulse rounded" />
            </div>
            <div className="lg:col-span-4">
              <div className="h-96 rounded-xl bg-surface-container animate-pulse" />
            </div>
          </div>
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (notFound || !course) {
    return (
      <div className="min-h-full flex flex-col bg-surface">
        <div className="page-shell py-20 flex-1 w-full text-center">
          <div className="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4 text-outline-variant text-3xl">
            <i className="fas fa-book-open" />
          </div>
          <h1 className="font-display text-2xl font-bold text-on-surface mb-2">找不到此課程</h1>
          <p className="text-on-surfaceVariant mb-6">課程可能已下架或不在公開介紹清單中。</p>
          <Link
            href="/courses"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-lg font-bold hover:bg-primary-container transition-colors"
          >
            返回課程介紹
          </Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col bg-surface text-on-surface">
      <main className="page-shell flex-grow flex flex-col pt-8 pb-16 w-full gap-6">
        <nav className="flex flex-wrap items-center text-on-surfaceVariant text-sm md:text-base mb-1">
          <Link href="/courses" className="hover:text-primary transition-colors">
            課程介紹
          </Link>
          {course.subjectTag && (
            <>
              <span className="mx-2">/</span>
              <Link
                href={`/courses?subject=${encodeURIComponent(course.subjectTag)}`}
                className="hover:text-primary transition-colors"
              >
                {course.subjectTag}
              </Link>
            </>
          )}
          <span className="mx-2">/</span>
          <span className="text-on-surface line-clamp-1">{course.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="relative w-full aspect-video bg-surface-containerHighest rounded-xl overflow-hidden shadow-sm group">
              {course.coverImageURL ? (
                <Image
                  src={course.coverImageURL}
                  alt={course.name}
                  fill
                  className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  sizes="(max-width: 1024px) 100vw, 66vw"
                  unoptimized
                  priority
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-surface to-surface-container text-outline-variant">
                  <i className="fas fa-image text-4xl mb-2" />
                  <span className="text-sm">尚無封面</span>
                </div>
              )}
              <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center gap-3">
                <span className="font-mono text-[11px] font-semibold tracking-wider uppercase bg-on-surface/70 text-white px-2 py-1 rounded">
                  {course.code}
                </span>
                <span className="font-mono text-[11px] font-semibold tracking-wider uppercase bg-on-surface/70 text-white px-2 py-1 rounded">
                  {course.status}
                </span>
              </div>
            </div>

            <div>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-on-surface mb-4 tracking-tight leading-snug">
                {course.name}
              </h1>
              <p className="text-lg leading-relaxed text-on-surfaceVariant whitespace-pre-line">
                {course.description?.trim() ||
                  `${course.subjectTag || '本課程'}｜${course.courseNature || '課程介紹'}｜${course.teachingMethod || ''}`}
              </p>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="sticky top-28 bg-surface-containerLowest rounded-xl shadow-md border border-outline-variant p-6 flex flex-col gap-6">
              <div className="flex justify-between items-end border-b border-outline-variant pb-4 gap-3">
                <div>
                  <span className="font-mono text-[11px] font-semibold tracking-wider uppercase text-primary block mb-1">
                    課程狀態
                  </span>
                  <span className="font-display text-2xl font-bold text-on-surface">{course.status}</span>
                </div>
                <span className="text-on-surfaceVariant text-sm shrink-0">{course.teachingMethod}</span>
              </div>

              <ul className="flex flex-col gap-3 text-on-surfaceVariant text-sm md:text-base">
                <li className="flex items-start gap-3">
                  <i className="fas fa-calendar-alt text-primary mt-1 w-5 text-center" />
                  <span>
                    {formatDate(course.startDate)} ~ {formatDate(course.endDate)}
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-map-marker-alt text-primary mt-1 w-5 text-center" />
                  <span>{course.location || '地點未指定'}</span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="fas fa-chalkboard-teacher text-primary mt-1 w-5 text-center" />
                  <span>{course.teacherNamesDisplay}</span>
                </li>
                {course.gradeTagsDisplay && (
                  <li className="flex items-start gap-3">
                    <i className="fas fa-user-graduate text-primary mt-1 w-5 text-center" />
                    <span>
                      {course.gradeTagsDisplay}
                      {course.subjectTag ? `（${course.subjectTag}）` : ''}
                    </span>
                  </li>
                )}
                {course.courseNature && (
                  <li className="flex items-start gap-3">
                    <i className="fas fa-bookmark text-primary mt-1 w-5 text-center" />
                    <span>{course.courseNature}</span>
                  </li>
                )}
              </ul>

              {Array.isArray(course.classTimes) && course.classTimes.length > 0 && (
                <div className="rounded-lg border border-outline-variant/60 overflow-hidden">
                  <div className="px-3 py-2 bg-surface-containerLow text-xs font-bold text-on-surfaceVariant uppercase tracking-wider">
                    上課時間
                  </div>
                  {course.classTimes.map((time, idx) => (
                    <div
                      key={idx}
                      className="px-3 py-2.5 border-t border-outline-variant/40 text-sm text-on-surface flex items-center gap-2"
                    >
                      <i className="far fa-clock text-on-surfaceVariant" />
                      {formatClassTime(time)}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3 mt-1">
                {canEnroll ? (
                  <button
                    type="button"
                    onClick={() => router.push(`/signup?courseId=${course.id}`)}
                    className="w-full bg-primary text-on-primary py-3 rounded-lg font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all"
                  >
                    立即報名
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="w-full bg-surface-container text-on-surfaceVariant py-3 rounded-lg font-bold cursor-not-allowed"
                  >
                    目前無法報名
                  </button>
                )}
                <Link
                  href="/courses"
                  className="w-full text-center bg-surface-containerLow text-primary border border-primary/20 py-3 rounded-lg font-bold hover:bg-surface-container transition-colors"
                >
                  返回課程列表
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-2">
          <div className="lg:col-span-2 bg-surface-containerLowest rounded-xl shadow-sm border border-outline-variant p-6 md:p-8">
            <h2 className="font-display text-2xl font-bold text-on-surface mb-6">課程資訊</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {learnItems.map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <i className="fas fa-check-circle text-secondary mt-1" />
                  <p className="text-on-surfaceVariant leading-relaxed">{item}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface-containerLow rounded-xl shadow-sm p-6 md:p-8 flex flex-col items-center text-center">
            {primaryTeacher?.photo ? (
              <div className="w-24 h-24 rounded-full overflow-hidden mb-4 border-4 border-surface-containerLowest shadow-sm relative">
                <Image
                  src={primaryTeacher.photo}
                  alt={primaryTeacherName}
                  fill
                  className="object-cover"
                  sizes="96px"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full mb-4 border-4 border-surface-containerLowest shadow-sm bg-surface-containerHighest flex items-center justify-center text-outline-variant text-3xl">
                <i className="fas fa-user" />
              </div>
            )}
            <h3 className="font-display text-xl font-bold text-on-surface">{primaryTeacherName}</h3>
            <p className="text-primary mb-4">
              {primaryTeacher?.subject || course.subjectTag || '授課老師'}
            </p>
            {primaryTeacher?.expertise?.[0] && (
              <p className="text-sm text-on-surfaceVariant mb-6 line-clamp-3">
                {primaryTeacher.expertise.slice(0, 2).join('・')}
              </p>
            )}
            {course.teacherNameList && course.teacherNameList.length > 1 && (
              <p className="text-sm text-on-surfaceVariant mb-4">
                協同授課：{course.teacherNameList.slice(1).join('、')}
              </p>
            )}
            {primaryTeacher ? (
              <Link
                href={siteTeacherProfileHref(primaryTeacher)}
                className="text-primary border border-primary rounded-lg px-4 py-2 hover:bg-primary hover:text-on-primary transition-colors font-medium"
              >
                查看老師介紹
              </Link>
            ) : (
              <Link
                href="/teacher"
                className="text-primary border border-primary rounded-lg px-4 py-2 hover:bg-primary hover:text-on-primary transition-colors font-medium"
              >
                瀏覽老師介紹
              </Link>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
