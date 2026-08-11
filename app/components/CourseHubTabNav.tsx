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
  lessons: { label: '課程大綱', studentLabel: '課程清單', Icon: BookOpenIcon },
  announcements: { label: '公告管理', studentLabel: '課程公告', Icon: MegaphoneIcon },
  attendance: { label: '線上點名', Icon: ClockIcon },
  exams: { label: '測驗設定', studentLabel: '線上測驗', Icon: ClipboardDocumentCheckIcon },
  surveys: { label: '問卷分析', studentLabel: '課程問卷', Icon: ClipboardDocumentListIcon },
  grades: { label: '學習數據', studentLabel: '課程成績', Icon: ChartBarIcon },
};

/** 老師端可見分頁（無課程資訊）；順序對齊課程工作區草稿 */
export const TEACHER_COURSE_HUB_TAB_IDS = [
  'lessons',
  'grades',
  'announcements',
  'exams',
  'surveys',
  'attendance',
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

/** 課程 Hub 功能清單：連成一組的列表外框／列 */
export const courseHubFeatureListStyles = {
  shell:
    'bg-surface-containerLowest border border-outline-variant/50 rounded-xl shadow-sm overflow-hidden divide-y divide-outline-variant/40',
  row: 'w-full text-left p-5 bg-surface-containerLowest hover:bg-primary/5 transition-colors group',
  rowDragging: 'shadow-lg ring-2 ring-primary/40 relative z-10 bg-surface-containerLowest',
  rowMuted: 'bg-amber-50/40 hover:bg-amber-50/70',
} as const;

interface CourseHubTabNavProps {
  tabs: readonly CourseHubTabId[];
  active: CourseHubTabId;
  audience: 'teacher' | 'student';
  onChange: (tab: CourseHubTabId) => void;
  /** 水平頂欄（預設）或課程內左側垂直選單 */
  orientation?: 'horizontal' | 'vertical';
}

export default function CourseHubTabNav({
  tabs,
  active,
  audience,
  onChange,
  orientation = 'horizontal',
}: CourseHubTabNavProps) {
  if (orientation === 'vertical') {
    return (
      <nav className="flex flex-col gap-1.5 px-2">
        {tabs.map((id) => {
          const isActive = active === id;
          const Icon = TAB_META[id].Icon;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={`flex items-center gap-3 w-full rounded-xl px-4 py-3 text-left transition-all ${
                isActive
                  ? 'bg-primary-container text-on-primary font-bold shadow-sm'
                  : 'text-on-surfaceVariant hover:bg-surface-containerHigh hover:text-primary font-medium'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0" aria-hidden />
              <span className="text-sm md:text-base">{getCourseHubTabLabel(id, audience)}</span>
            </button>
          );
        })}
      </nav>
    );
  }

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
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surfaceVariant hover:text-on-surface'
            }`}
          >
            {getCourseHubTabLabel(id, audience)}
          </button>
        );
      })}
    </nav>
  );
}
