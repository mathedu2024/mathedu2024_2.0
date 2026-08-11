'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import SiteFooter from '@/components/site/SiteFooter';

interface Course {
  id: string;
  name: string;
  code: string;
  teachingMethod: '實體上課' | '線上上課' | '非同步線上上課' | '實體與線上同步上課';
  teachers: string[] | Record<string, unknown> | Teacher[];
  startDate: string;
  endDate: string;
  status: '未開課' | '報名中' | '開課中' | '已額滿' | '已結束' | '已封存' | '資料建置中...';
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
  gradeTagsDisplay?: string;
}

interface Teacher {
  id: string;
  name: string;
  uid?: string;
  _id?: string;
}

type SortKey = 'code' | 'name' | 'newest' | 'status';

const grades = ['國一', '國二', '國三', '高一', '高二', '高三', '職一', '職二', '職三', '大一', '進修'];
const subjects = ['數學', '理化', '物理', '化學', '生物'];
const courseNatures = ['進度課程', '升學考試複習', '檢定/考試訓練班'];
const statuses = ['未開課', '報名中', '開課中', '已額滿', '已結束'];

const statusBadgeClass = (status: string) => {
  switch (status) {
    case '報名中':
      return 'bg-secondary-container text-secondary';
    case '開課中':
      return 'bg-primary text-on-primary';
    case '已額滿':
      return 'bg-rose-100 text-rose-800';
    case '未開課':
      return 'bg-tertiary-container text-white';
    case '已結束':
      return 'bg-surface-containerHigh text-on-surfaceVariant';
    default:
      return 'bg-surface-containerHigh text-on-surfaceVariant';
  }
};

function FilterCheckboxGroup({
  title,
  values,
  options,
  onChange,
}: {
  title: string;
  values: string[];
  options: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (opt: string) => {
    if (values.includes(opt)) {
      onChange(values.filter((v) => v !== opt));
    } else {
      onChange([...values, opt]);
    }
  };

  return (
    <div className="mb-8 last:mb-2">
      <h3 className="text-base font-bold text-on-surfaceVariant mb-4">{title}</h3>
      <div className="flex flex-col gap-3">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              className="h-4 w-4 rounded text-primary border-outline-variant focus:ring-primary focus:ring-2"
              checked={values.includes(opt)}
              onChange={() => toggle(opt)}
            />
            <span className="text-sm text-on-surface group-hover:text-primary transition-colors">
              {opt}
            </span>
          </label>
        ))}
      </div>
      {values.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-3 text-xs text-primary hover:underline"
        >
          清除此項
        </button>
      )}
    </div>
  );
}

export default function CoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('code');

  const [selectedGrades, setSelectedGrades] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedNatures, setSelectedNatures] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    try {
      const subject = new URLSearchParams(window.location.search).get('subject');
      if (subject && subjects.includes(subject)) {
        setSelectedSubjects([subject]);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
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
          const teachersList = Array.isArray(data) ? data : (data.data || data.teachers || data.users || []);
          teachersList.forEach((t: Teacher) => {
            if (t.id) teacherMap[t.id] = t.name;
            if (t.uid) teacherMap[t.uid] = t.name;
            if (t._id) teacherMap[t._id] = t.name;
          });
        }

        if (coursesRes.ok) {
          const data = await coursesRes.json();
          let coursesList: Course[] = Array.isArray(data) ? data : (data.data || data.courses || []);

          coursesList = coursesList.map((course) => {
            const teacherData = course.teachers;
            let items: (string | Teacher)[] = [];
            if (Array.isArray(teacherData)) items = teacherData;
            else if (typeof teacherData === 'object' && teacherData !== null) items = Object.keys(teacherData);
            else if (typeof teacherData === 'string') items = [teacherData];

            const names =
              items
                .map((item) => {
                  if (typeof item === 'object' && item !== null && (item as Teacher).name) {
                    return (item as Teacher).name;
                  }
                  const id =
                    typeof item === 'string'
                      ? item
                      : (item as Teacher).id || (item as Teacher).uid || (item as Teacher)._id;
                  return id && teacherMap[id] ? teacherMap[id] : null;
                })
                .filter(Boolean)
                .join(', ') || '未指定';

            const gradeTagsStr =
              course.gradeTags && Array.isArray(course.gradeTags) ? course.gradeTags.join(', ') : '未指定';

            return { ...course, teacherNamesDisplay: names, gradeTagsDisplay: gradeTagsStr };
          });

          setCourses(coursesList);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = courses.filter((course) => {
      const matchesGrade =
        selectedGrades.length === 0 ||
        (Array.isArray(course.gradeTags) &&
          course.gradeTags.some((g) => selectedGrades.includes(g)));
      const matchesSubject =
        selectedSubjects.length === 0 || selectedSubjects.includes(course.subjectTag);
      const matchesNature =
        selectedNatures.length === 0 || selectedNatures.includes(course.courseNature);
      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(course.status);
      const matchesSearch =
        !q ||
        course.name?.toLowerCase().includes(q) ||
        course.code?.toLowerCase().includes(q) ||
        course.teacherNamesDisplay?.toLowerCase().includes(q) ||
        course.subjectTag?.toLowerCase().includes(q);

      return (
        !course.archived &&
        course.showInIntroduction &&
        matchesGrade &&
        matchesSubject &&
        matchesNature &&
        matchesStatus &&
        matchesSearch
      );
    });

    return list.sort((a, b) => {
      if (sortKey === 'name') {
        return (a.name || '').localeCompare(b.name || '', 'zh-TW');
      }
      if (sortKey === 'newest') {
        return (b.startDate || '').localeCompare(a.startDate || '');
      }
      if (sortKey === 'status') {
        return (a.status || '').localeCompare(b.status || '', 'zh-TW');
      }
      const codeCompare = (a.code || '').localeCompare(b.code || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (codeCompare !== 0) return codeCompare;
      return (a.name || '').localeCompare(b.name || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }, [
    courses,
    selectedGrades,
    selectedSubjects,
    selectedNatures,
    selectedStatuses,
    search,
    sortKey,
  ]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '未設定';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const openCourseDetail = (course: Course) => {
    router.push(`/courses/${encodeURIComponent(course.code)}`);
  };

  const clearFilters = () => {
    setSelectedGrades([]);
    setSelectedSubjects([]);
    setSelectedNatures([]);
    setSelectedStatuses([]);
    setSearch('');
  };

  const activeFilterCount =
    selectedGrades.length +
    selectedSubjects.length +
    selectedNatures.length +
    selectedStatuses.length;

  const filterPanel = (
    <>
      <FilterCheckboxGroup
        title="科目"
        values={selectedSubjects}
        options={subjects}
        onChange={setSelectedSubjects}
      />
      <FilterCheckboxGroup
        title="年級"
        values={selectedGrades}
        options={grades}
        onChange={setSelectedGrades}
      />
      <FilterCheckboxGroup
        title="課程性質"
        values={selectedNatures}
        options={courseNatures}
        onChange={setSelectedNatures}
      />
      <FilterCheckboxGroup
        title="狀態"
        values={selectedStatuses}
        options={statuses}
        onChange={setSelectedStatuses}
      />
      <button
        type="button"
        onClick={clearFilters}
        className="w-full mt-2 py-2.5 text-sm font-medium text-on-surfaceVariant bg-surface-container rounded-lg hover:bg-surface-containerHigh transition-colors"
      >
        清除全部篩選
      </button>
      {activeFilterCount > 0 && (
        <p className="mt-3 text-xs text-on-surfaceVariant text-center">
          已選 {activeFilterCount} 項條件
        </p>
      )}
    </>
  );

  return (
    <div className="min-h-full flex flex-col bg-surface">
      <div className="page-shell py-8 flex-1 w-full flex flex-col lg:flex-row gap-6 lg:gap-8 min-w-0">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-24 bg-surface-containerLowest rounded-xl p-6 shadow-card border border-outline-variant">
            <h2 className="font-display text-xl font-bold text-on-surface mb-6">篩選條件</h2>
            {filterPanel}
          </div>
        </aside>

        <main className="flex-1 min-w-0">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4 mb-6 sm:mb-8">
            <div>
              <h1 className="font-display text-3xl md:text-4xl font-extrabold text-on-surface mb-2 tracking-tight">
                課程介紹
              </h1>
              <p className="text-base sm:text-lg text-on-surfaceVariant">
                找到適合您的學習計畫，開啟知識之旅
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-on-surfaceVariant">排序：</span>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="bg-surface-containerLowest border border-outline-variant rounded-lg px-4 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
              >
                <option value="code">課程代碼</option>
                <option value="name">課程名稱</option>
                <option value="newest">開課日期（新→舊）</option>
                <option value="status">狀態</option>
              </select>
            </div>
          </div>

          {/* Search */}
          <div className="mb-4 flex items-center bg-surface-containerLow rounded-full px-4 py-2.5 border border-outline-variant focus-within:border-primary transition-colors">
            <i className="fas fa-search text-on-surfaceVariant mr-2" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜尋課程名稱、代碼或老師…"
              className="bg-transparent border-none focus:ring-0 text-sm text-on-surface placeholder:text-on-surfaceVariant w-full outline-none"
            />
          </div>

          {/* Mobile filters */}
          <div
            className={`lg:hidden mb-6 bg-surface-containerLowest rounded-xl shadow-sm border border-outline-variant ${
              isFilterOpen ? 'overflow-visible' : 'overflow-hidden'
            }`}
          >
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="w-full px-5 py-4 flex justify-between items-center hover:bg-surface-containerLow transition-colors"
            >
              <span className="font-semibold text-on-surface flex items-center gap-2">
                <i className="fas fa-filter text-primary" />
                篩選條件
                <span className="text-xs font-normal text-on-surfaceVariant">
                  （{filteredCourses.length} 筆）
                </span>
              </span>
              <i
                className={`fas fa-chevron-down text-on-surfaceVariant transition-transform ${
                  isFilterOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            <div
              className={`transition-all duration-300 ${
                isFilterOpen
                  ? 'max-h-[1200px] opacity-100 overflow-visible'
                  : 'max-h-0 opacity-0 overflow-hidden'
              }`}
            >
              <div className="px-5 pb-5">{filterPanel}</div>
            </div>
          </div>

          <p className="hidden lg:block text-sm text-on-surfaceVariant mb-4">
            共 {filteredCourses.length} 門課程
          </p>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-80 rounded-xl bg-surface-container animate-pulse" />
              ))}
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-24 bg-surface-containerLowest rounded-2xl border border-dashed border-outline-variant">
              <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mx-auto mb-4 text-outline-variant text-3xl">
                <i className="fas fa-book-open" />
              </div>
              <h3 className="text-lg font-medium text-on-surface mb-1">沒有找到相關課程</h3>
              <p className="text-on-surfaceVariant text-sm">請嘗試調整篩選或搜尋條件</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCourses.map((course) => (
                <article
                  key={course.id}
                  className="group bg-surface-containerLowest rounded-xl overflow-hidden shadow-card border border-outline-variant flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-elevate cursor-pointer"
                  onClick={() => openCourseDetail(course)}
                >
                  <div className="relative h-48 w-full bg-surface-container">
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
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-outline-variant bg-gradient-to-br from-surface to-surface-container">
                        <i className="fas fa-image text-3xl mb-2" />
                        <span className="text-xs">尚無圖片</span>
                      </div>
                    )}
                    <div
                      className={`absolute top-4 right-4 font-mono text-[10px] font-bold tracking-widest uppercase px-3 py-1 rounded-full ${statusBadgeClass(
                        course.status
                      )}`}
                    >
                      {course.status}
                    </div>
                  </div>

                  <div className="p-5 sm:p-6 flex flex-col flex-1">
                    <div className="flex flex-wrap gap-2 mb-3">
                      {course.subjectTag && (
                        <span className="bg-surface-containerHigh text-on-surfaceVariant px-2 py-1 rounded-md font-mono text-[10px] uppercase font-bold">
                          {course.subjectTag}
                        </span>
                      )}
                      {course.courseNature && (
                        <span className="bg-surface-containerHigh text-on-surfaceVariant px-2 py-1 rounded-md font-mono text-[10px] font-bold">
                          {course.courseNature}
                        </span>
                      )}
                      {course.gradeTags?.slice(0, 2).map((g) => (
                        <span
                          key={g}
                          className="bg-surface-containerHigh text-on-surfaceVariant px-2 py-1 rounded-md font-mono text-[10px] font-bold"
                        >
                          {g}
                        </span>
                      ))}
                    </div>

                    <h3 className="font-display text-lg sm:text-xl font-bold text-on-surface mb-2 line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                      {course.name}
                    </h3>
                    <p className="text-sm text-on-surfaceVariant mb-4 line-clamp-1">
                      {course.teacherNamesDisplay}
                    </p>

                    <div className="mt-auto flex items-end justify-between gap-3 pt-2">
                      <div className="min-w-0">
                        <p className="font-mono text-xs text-outline truncate">{course.code}</p>
                        <p className="text-xs text-on-surfaceVariant mt-0.5 truncate">
                          {formatDate(course.startDate)}
                          {course.endDate ? ` ~ ${formatDate(course.endDate)}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="shrink-0 text-sm font-bold text-primary hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCourseDetail(course);
                        }}
                      >
                        詳情
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>
      </div>

      <SiteFooter />
    </div>
  );
}
