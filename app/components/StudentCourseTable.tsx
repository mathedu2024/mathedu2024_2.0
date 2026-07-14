'use client';

import React, { useMemo, useState } from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import { tableActionRow } from './ui';
import CourseFilter from './CourseFilter';
import { dedupeCoursesByDisplayKey, type CourseShortInfo } from './StudentCourseSelector';
import { isCourseArchived } from '@/services/courseArchive';
import {
  courseListTableStyles,
  defaultCourseListFilterState,
  filterAndSortCoursesForList,
  getCourseDisplayStatus,
  getCourseStatusColor,
  sortStudentCoursesForList,
  type CourseListFilterMode,
} from './studentCourseListShared';

interface ClassTime {
  day: string;
  startTime: string;
  endTime: string;
}

export interface StudentCourseTableItem extends CourseShortInfo {
  id?: string;
  status?: string;
  teacherName?: string;
  gradeTags?: string[];
  subjectTag?: string;
  courseNature?: string;
  classTimes?: ClassTime[];
  liveStreamURL?: string;
}

export interface StudentCourseTableProps {
  courses: StudentCourseTableItem[];
  loading?: boolean;
  onSelectCourse: (course: StudentCourseTableItem) => void;
  /** 操作欄按鈕文字，例如「進入課程」「查看成績」 */
  actionLabel?: string;
  /** 封存課程按鈕文字 */
  archivedActionLabel?: string;
  /** 是否顯示上課時間欄 */
  showClassTimes?: boolean;
  /** 是否顯示篩選列 */
  showFilter?: boolean;
  /** 篩選列樣式：學生端僅科目＋狀態 */
  filterVariant?: CourseListFilterMode;
  /** 封存課程是否禁止進入（課程頁為 true，成績頁為 false） */
  blockArchivedEntry?: boolean;
  /** 篩選後無結果時的提示文字 */
  emptyFilteredMessage?: string;
  error?: string | null;
  onErrorClear?: () => void;
}

export default function StudentCourseTable({
  courses,
  loading = false,
  onSelectCourse,
  actionLabel = '進入課程',
  archivedActionLabel = '已封存',
  showClassTimes = true,
  showFilter = false,
  filterVariant = 'student',
  blockArchivedEntry = false,
  emptyFilteredMessage = '沒有符合條件的課程',
  error,
  onErrorClear,
}: StudentCourseTableProps) {
  const [filters, setFilters] = useState(defaultCourseListFilterState);
  const activeCourses = dedupeCoursesByDisplayKey(courses);
  const styles = courseListTableStyles;

  const displayedCourses = useMemo(() => {
    if (!showFilter) return sortStudentCoursesForList(activeCourses);
    return filterAndSortCoursesForList(activeCourses, filters, filterVariant);
  }, [activeCourses, filters, showFilter, filterVariant]);

  if (loading && activeCourses.length === 0) {
    return <PageLoadingArea />;
  }

  if (activeCourses.length === 0) {
    return null;
  }

  const getTeacherDisplay = (course: StudentCourseTableItem) =>
    course.teacherName?.trim() || '未指定';

  const getTeacherInitial = (course: StudentCourseTableItem) =>
    getTeacherDisplay(course)[0] || '師';

  const resetFilters = () => setFilters(defaultCourseListFilterState);

  const isEntryBlocked = (course: StudentCourseTableItem) =>
    blockArchivedEntry && isCourseArchived(course);

  const renderActionButton = (course: StudentCourseTableItem, className: string) => {
    const blocked = isEntryBlocked(course);
    return (
      <button
        type="button"
        className={blocked ? styles.desktop.actionDisabled : className}
        disabled={blocked}
        onClick={() => {
          if (!blocked) onSelectCourse(course);
        }}
      >
        {blocked ? archivedActionLabel : actionLabel}
      </button>
    );
  };

  const tableContent =
    displayedCourses.length === 0 ? (
      <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
        <h3 className="mt-2 text-xl font-bold text-gray-900">{emptyFilteredMessage}</h3>
      </div>
    ) : (
      <>
        <div className={styles.desktop.wrapper}>
          <table className={styles.desktop.table}>
            <thead className={styles.desktop.thead}>
              <tr>
                <th className={`${styles.desktop.th} min-w-[200px]`}>課程名稱</th>
                <th className={`${styles.desktop.th} min-w-[150px]`}>授課老師</th>
                {showClassTimes && (
                  <th className={`${styles.desktop.th} min-w-[180px]`}>上課時間</th>
                )}
                <th className={`${styles.desktop.th} text-center whitespace-nowrap`}>狀態</th>
                <th className={`${styles.desktop.th} text-right min-w-[180px]`}>操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedCourses.map((course) => {
                const teacherDisplay = getTeacherDisplay(course);
                const blocked = isEntryBlocked(course);
                const displayStatus = getCourseDisplayStatus(course);
                return (
                  <tr
                    key={course.id || course.code}
                    className={`${styles.desktop.row}${blocked ? ' opacity-80' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div
                        className={`${styles.desktop.courseName} whitespace-nowrap overflow-hidden text-ellipsis`}
                      >
                        {course.name}
                      </div>
                      <div className={styles.desktop.courseCode}>{course.code}</div>
                    </td>
                    <td className="px-6 py-4 max-w-[200px]">
                      <div className="flex items-center w-full">
                        <div className={styles.desktop.teacherAvatar}>
                          {getTeacherInitial(course)}
                        </div>
                        <div className={styles.desktop.teacherName} title={teacherDisplay}>
                          {teacherDisplay}
                        </div>
                      </div>
                    </td>
                    {showClassTimes && (
                      <td className={styles.desktop.classTimesCell}>
                        <div className={styles.desktop.classTimes}>
                          {(course.classTimes || []).map((ct, i) => (
                            <div key={i}>{`${ct.day} ${ct.startTime}-${ct.endTime}`}</div>
                          ))}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span
                        className={`${styles.desktop.statusBadge} ${getCourseStatusColor(displayStatus)}`}
                      >
                        {displayStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className={styles.desktop.actionRow}>
                        {renderActionButton(course, styles.desktop.actionPrimary)}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.mobile.wrapper}>
          {displayedCourses.map((course) => {
            const blocked = isEntryBlocked(course);
            const displayStatus = getCourseDisplayStatus(course);
            return (
              <div
                key={course.id || course.code}
                className={`${styles.mobile.card}${blocked ? ' opacity-80' : ''}`}
              >
                <div className="mb-2">
                  <div className={styles.mobile.courseName}>{course.name}</div>
                </div>
                <div className={styles.mobile.courseCode}>{course.code}</div>
                <div className="mb-4">
                  <span
                    className={`${styles.mobile.statusBadge} ${getCourseStatusColor(displayStatus)}`}
                  >
                    {displayStatus}
                  </span>
                </div>
                <div className={tableActionRow}>
                  <button
                    type="button"
                    className={blocked ? styles.desktop.actionDisabled : styles.desktop.actionPrimary}
                    disabled={blocked}
                    onClick={() => {
                      if (!blocked) onSelectCourse(course);
                    }}
                  >
                    {blocked ? archivedActionLabel : actionLabel}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </>
    );

  return (
    <>
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start">
          <ExclamationCircleIcon className="w-5 h-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-700 text-sm font-medium">{error}</p>
            {onErrorClear && (
              <button
                type="button"
                onClick={onErrorClear}
                className="mt-1 text-red-500 hover:text-red-700 text-xs font-semibold underline"
              >
                關閉訊息
              </button>
            )}
          </div>
        </div>
      )}

      {showFilter && (
        <CourseFilter
          variant={filterVariant}
          searchTerm={filters.searchTerm}
          onSearchChange={(searchTerm) => setFilters((prev) => ({ ...prev, searchTerm }))}
          selectedGrade={filters.selectedGrade}
          onGradeChange={(selectedGrade) => setFilters((prev) => ({ ...prev, selectedGrade }))}
          selectedSubject={filters.selectedSubject}
          onSubjectChange={(selectedSubject) => setFilters((prev) => ({ ...prev, selectedSubject }))}
          selectedNature={filters.selectedNature}
          onNatureChange={(selectedNature) => setFilters((prev) => ({ ...prev, selectedNature }))}
          selectedStatus={filters.selectedStatus}
          onStatusChange={(selectedStatus) => setFilters((prev) => ({ ...prev, selectedStatus }))}
          onReset={resetFilters}
        />
      )}

      {tableContent}
    </>
  );
}
