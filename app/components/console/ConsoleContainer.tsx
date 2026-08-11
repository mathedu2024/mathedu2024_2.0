'use client';

import type { ReactNode } from 'react';
import TopAppBar from './TopAppBar';
import TeacherTopNav from './TeacherTopNav';

type Props = {
  title: string;
  subtitle?: string;
  breadcrumbs?: string[];
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  headerActions?: ReactNode;
  children: ReactNode;
  /** 儀表板等自帶標題時可不顯示 TopAppBar */
  hideTopBar?: boolean;
  /** 老師後台使用搜尋／快捷頂欄 */
  variant?: 'default' | 'teacher';
  userName?: string;
  userAccount?: string;
  userRole?: string;
  onLogout?: () => void;
  className?: string;
  /** 內容區最大寬度（預設 max-w-[1280px]） */
  contentMaxWidthClassName?: string;
};

/**
 * 後台主內容容器：頂欄 + 可捲動內容區。
 * 側欄仍由 Sidebar 提供；三角色共用此殼。
 */
export default function ConsoleContainer({
  title,
  subtitle,
  breadcrumbs,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  headerActions,
  children,
  hideTopBar = false,
  variant = 'default',
  userName,
  userAccount,
  userRole,
  onLogout,
  className = '',
  contentMaxWidthClassName = 'max-w-[1280px]',
}: Props) {
  const showTeacherNav = variant === 'teacher' && typeof onSearchChange === 'function';
  const showDefaultBar = !hideTopBar && !showTeacherNav;

  return (
    <div className={`flex flex-col flex-1 min-h-0 min-w-0 bg-surface ${className}`}>
      {showTeacherNav ? (
        <TeacherTopNav
          searchValue={searchValue ?? ''}
          onSearchChange={onSearchChange}
          searchPlaceholder={searchPlaceholder || '搜尋課程...'}
          userName={userName}
          userAccount={userAccount}
          userRole={userRole}
          onLogout={onLogout}
        />
      ) : null}
      {showDefaultBar ? (
        <TopAppBar
          title={title}
          subtitle={subtitle}
          breadcrumbs={breadcrumbs}
          searchPlaceholder={searchPlaceholder}
          searchValue={searchValue}
          onSearchChange={onSearchChange}
          actions={headerActions}
        />
      ) : null}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className={`p-4 md:p-6 lg:p-8 w-full mx-auto ${contentMaxWidthClassName}`}>{children}</div>
      </div>
    </div>
  );
}
