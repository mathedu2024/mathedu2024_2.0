'use client';

import React from 'react';
import {
  BookOpenIcon,
  ChartBarIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  InformationCircleIcon,
  MegaphoneIcon,
} from '@heroicons/react/24/outline';

export type CourseHubTabId =
  | 'info'
  | 'lessons'
  | 'announcements'
  | 'attendance'
  | 'exams'
  | 'surveys'
  | 'grades';

type TabIcon = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const TAB_META: Record<
  CourseHubTabId,
  { label: string; studentLabel?: string; Icon: TabIcon }
> = {
  info: { label: '課程資訊', Icon: InformationCircleIcon },
  lessons: { label: '課程清單', Icon: BookOpenIcon },
  announcements: { label: '課程公告', Icon: MegaphoneIcon },
  attendance: { label: '線上點名', Icon: ClockIcon },
  exams: { label: '線上測驗', Icon: ClipboardDocumentCheckIcon },
  surveys: { label: '課程問卷', Icon: ClipboardDocumentListIcon },
  grades: { label: '成績管理', studentLabel: '課程成績', Icon: ChartBarIcon },
};

/** 老師端可見分頁（無課程資訊） */
export const TEACHER_COURSE_HUB_TAB_IDS = [
  'lessons',
  'announcements',
  'attendance',
  'exams',
  'surveys',
  'grades',
] as const satisfies readonly CourseHubTabId[];

/** 學生端可見分頁 */
export const STUDENT_COURSE_HUB_TAB_IDS = [
  'info',
  'lessons',
  'announcements',
  'attendance',
  'exams',
  'surveys',
  'grades',
] as const satisfies readonly CourseHubTabId[];

export function getCourseHubTabLabel(id: CourseHubTabId, audience: 'teacher' | 'student'): string {
  const meta = TAB_META[id];
  if (audience === 'student' && meta.studentLabel) return meta.studentLabel;
  return meta.label;
}

/** 功能卡片前方統一 icon（老師／學生端共用） */
export function getCourseHubFeatureIcon(id: CourseHubTabId): TabIcon {
  return TAB_META[id].Icon;
}

export function CourseHubFeatureIcon({
  id,
  className = 'w-5 h-5',
}: {
  id: CourseHubTabId;
  className?: string;
}) {
  const Icon = getCourseHubFeatureIcon(id);
  return <Icon className={className} aria-hidden />;
}

interface CourseHubTabNavProps {
  tabs: readonly CourseHubTabId[];
  active: CourseHubTabId;
  audience: 'teacher' | 'student';
  onChange: (tab: CourseHubTabId) => void;
}

export default function CourseHubTabNav({
  tabs,
  active,
  audience,
  onChange,
}: CourseHubTabNavProps) {
  return (
    <nav className="mobile-scroll-tabs gap-3 sm:gap-5 md:gap-6 -mx-0 px-0">
      {tabs.map((id) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            className={`shrink-0 pt-3 pb-1.5 sm:pt-4 sm:pb-2 font-bold text-sm sm:text-base md:text-lg transition-all border-b-2 whitespace-nowrap ${
              isActive
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-400 hover:text-gray-600'
            }`}
          >
            {getCourseHubTabLabel(id, audience)}
          </button>
        );
      })}
    </nav>
  );
}
