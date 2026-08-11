'use client';

import React, { useState, useEffect, useCallback } from 'react';
import clsx from 'clsx';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { UserCircleIcon } from '@heroicons/react/24/outline';
import { useHydrated } from '@/utils/useHydrated';
import { isCompactNavMode, useCompactNav } from '@/utils/useCompactNav';
import { getSession } from '@/utils/session';
import {
  clearSidebarCache,
  getCachedActiveTab,
  getCachedMenuItems,
  getCachedUserInfo,
  setCachedActiveTab,
  setCachedMenuItems,
  setCachedUserInfo,
} from '@/utils/sidebarCache';
import {
  CourseHubFeatureIcon,
  TEACHER_COURSE_HUB_TAB_IDS,
  getCourseHubTabLabel,
  type CourseHubTabId,
} from '@/components/CourseHubTabNav';
import { teacherCourseHubPath, type TeacherCourseHubTab } from '@/utils/teacherCourseHub';

interface UserInfo {
  id: string;
  name: string;
  account?: string;
  studentId?: string;
  role: string | string[];
  currentRole?: string;
}

interface MenuItem {
  id: string;
  title: string;
  icon: React.ReactElement;
  disabled?: boolean;
  href?: string;
}

/** 進入單一課程後：側欄改顯示課程內選單（替換後台全域選單） */
export type CourseWorkspaceSidebar = {
  courseCode: string;
  courseName: string;
  subjectLabel?: string;
  activeTab: CourseHubTabId;
};

interface SidebarProps {
  // 狀態控制
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  
  // 用戶資訊
  userInfo: UserInfo | null;
  
  // 導航項目
  menuItems: MenuItem[];
  
  // 當前選中的項目
  activeTab: string | null;
  onTabChange: (tab: string | null) => void;
  
  // 登出處理
  onLogout: () => void;
  dashboardHref?: string;
  /** 學生端：所有選單文字粗體；教師端：僅選中項目粗體 */
  boldNavLabels?: boolean;
  /** 老師課程工作區：側欄內容改為課程選單 */
  courseWorkspace?: CourseWorkspaceSidebar | null;
}

export default function Sidebar({
  sidebarOpen,
  onToggleSidebar,
  userInfo,
  menuItems,
  activeTab,
  onTabChange,
  onLogout,
  dashboardHref,
  boldNavLabels = false,
  courseWorkspace = null,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const hydrated = useHydrated();
  const isCompactNav = useCompactNav();

  // 新增：記住上一次的 userInfo，避免換頁時因為瞬間為 null 而造成畫面文字閃爍
  const [persistedUserInfo, setPersistedUserInfo] = useState<UserInfo | null>(userInfo ?? null);
  const [persistedMenuItems, setPersistedMenuItems] = useState<MenuItem[]>(menuItems?.length > 0 ? menuItems : getCachedMenuItems() as MenuItem[]);
  const [optimisticTab, setOptimisticTab] = useState<string | null>(
    getCachedActiveTab() !== undefined ? (getCachedActiveTab() as string | null) : activeTab
  );

  const resetPersistedSidebarState = useCallback(() => {
    setPersistedUserInfo(null);
    setPersistedMenuItems([]);
    setOptimisticTab(null);
  }, []);
  
  useEffect(() => {
    // 若為 F5 重新整理，嘗試從 sessionStorage 救回使用者資訊，避免短暫空白
    if (!userInfo && !getCachedUserInfo() && typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('sidebar_user_info');
        if (stored) {
          const parsed = JSON.parse(stored);
          setCachedUserInfo(parsed);
          setPersistedUserInfo(parsed);
        }
      } catch {}
    }
  }, [userInfo]);

  useEffect(() => {
    const onAuthLogout = () => {
      clearSidebarCache();
      resetPersistedSidebarState();
    };
    window.addEventListener('auth-logout', onAuthLogout);
    return () => window.removeEventListener('auth-logout', onAuthLogout);
  }, [resetPersistedSidebarState]);

  useEffect(() => {
    if (userInfo) {
      setCachedUserInfo(userInfo);
      setPersistedUserInfo(userInfo);
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('sidebar_user_info', JSON.stringify(userInfo));
        } catch {}
      }
    }
  }, [userInfo]);

  // 新增：記住上一次的 menuItems，避免換頁時選單陣列瞬間為空造成按鈕消失
  useEffect(() => {
    if (menuItems && menuItems.length > 0) {
      setCachedMenuItems(menuItems);
      setPersistedMenuItems(menuItems);
    }
  }, [menuItems]);

  // 新增：防止換頁瞬間 parent 傳入 null 導致色塊跳動
  useEffect(() => {
    if (activeTab !== null) {
      setCachedActiveTab(activeTab);
      setOptimisticTab(activeTab);
    } else {
      const isDashboard = dashboardHref 
        ? pathname === dashboardHref 
        : (pathname === '/' || pathname === '/student' || pathname === '/panel');
      
      if (isDashboard) {
        setCachedActiveTab(null);
        setOptimisticTab(null);
      }
    }
  }, [activeTab, pathname, dashboardHref]);

  useEffect(() => {
    if (isCompactNav && sidebarOpen) {
      onToggleSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompactNav]);

  // 當點選功能時自動關閉側邊欄
  const handleTabChange = (tab: string | null) => {
    onTabChange(tab);
    // 如果是手機版或側邊欄是展開狀態，點選後關閉
    if (isCompactNavMode() && sidebarOpen) {
      onToggleSidebar();
    }
  };

  const handleTabClick = (tab: string | null) => {
    setCachedActiveTab(tab);
    setOptimisticTab(tab);
    handleTabChange(tab);
  };

  // 使用目前傳入的 userInfo，如果是 null 則退回使用上一次記住的狀態
  const currentInfo = userInfo || persistedUserInfo;
  
  // 使用目前傳入的 menuItems，如果是空陣列則退回使用上一次記住的狀態
  const currentMenuItems = menuItems && menuItems.length > 0 ? menuItems : persistedMenuItems;

  // 廣播側邊欄的選單項目，讓 Navigation 在手機版時能合併顯示
  const syncSidebar = useCallback(() => {
    if (typeof window !== 'undefined' && !getSession()) return;
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sidebar-sync', {
        detail: {
          menuItems: currentMenuItems,
          dashboardHref,
          activeTab: optimisticTab,
          boldNavLabels,
        }
      }));
    }
  }, [currentMenuItems, dashboardHref, optimisticTab, boldNavLabels]);

  useEffect(() => {
    syncSidebar();
  }, [syncSidebar]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('request-sidebar-sync', syncSidebar as EventListener);
      return () => window.removeEventListener('request-sidebar-sync', syncSidebar as EventListener);
    }
  }, [syncSidebar]);

  // 監聽來自 Navigation 手機版選單的標籤切換請求
  useEffect(() => {
    const handleTabChangeRequest = (e: Event) => {
      const customEvent = e as CustomEvent;
      const tab = customEvent.detail;
      setCachedActiveTab(tab);
      setOptimisticTab(tab);
      onTabChange(tab);
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('request-tab-change', handleTabChangeRequest);
      return () => window.removeEventListener('request-tab-change', handleTabChangeRequest);
    }
  }, [onTabChange]);

  // 當點擊登出時清除所有快取
  const handleLogoutClick = useCallback(() => {
    clearSidebarCache();
    resetPersistedSidebarState();
    if (typeof window !== 'undefined') {
      // 主動觸發全域登出事件，讓 Navigation 等元件也能立刻清空畫面
      window.dispatchEvent(new Event('auth-logout'));
    }
    onLogout();
  }, [onLogout, resetPersistedSidebarState]);

  // 監聽來自 Navigation 手機版選單的登出請求
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('request-logout', handleLogoutClick);
      return () => window.removeEventListener('request-logout', handleLogoutClick);
    }
  }, [handleLogoutClick]);

  // 判斷用戶角色
  const getUserRole = (): string => {
    if (!currentInfo) return '學生';

    if (currentInfo.currentRole) {
      if (currentInfo.currentRole === 'admin') return '管理員';
      if (currentInfo.currentRole === 'teacher') return '老師';
      if (currentInfo.currentRole === 'author') return '作者';
    }

    if (Array.isArray(currentInfo.role)) {
      const roles = currentInfo.role.map((r) => String(r).toLowerCase());
      if (roles.includes('admin') || roles.includes('管理員')) return '管理員';
      if (roles.includes('teacher') || roles.includes('老師')) return '老師';
      if (roles.includes('author') || roles.includes('作者')) return '作者';
      return '學生';
    }

    const role = String(currentInfo.role ?? '').toLowerCase();
    if (role === 'admin' || role === '管理員') return '管理員';
    if (role === 'teacher' || role === '老師') return '老師';
    if (role === 'author' || role === '作者') return '作者';
    return '學生';
  };

  const userRole = getUserRole();

  // 獲取用戶顯示資訊
  const getUserDisplayInfo = () => {
    if (!currentInfo) return { name: '', id: '', role: '學生' };
    
    return {
      name: currentInfo.name || '',
      id: currentInfo.studentId || currentInfo.account || '',
      role: userRole
    };
  };

  const displayInfo = getUserDisplayInfo();
  // hydration 完成前固定佔位，避免 SSR「?」與客戶端 session 姓名不一致
  const safeDisplayInfo = hydrated
    ? displayInfo
    : { name: '', id: '', role: displayInfo.role };

  const isDashboardRoute =
    pathname.startsWith('/student') ||
    pathname.startsWith('/back-panel') ||
    pathname.startsWith('/panel');
  /**
   * 儀表板桌面：頂欄不渲染，側欄貼齊視窗頂部。
   * 僅依 pathname／compact（不讀 session），避免 SSR／client hydration class 不一致。
   */
  const flushToViewportTop = isDashboardRoute && !isCompactNav;

  const sidebarClasses = clsx(
    'flex flex-col z-[60] bg-surface-containerLowest border-r border-outline-variant/50 shadow-sm',
    'transition-[width,transform] duration-300 ease-in-out',
    flushToViewportTop
      ? 'fixed top-0 left-0 h-screen'
      : 'fixed top-16 left-0 h-[calc(100vh-64px)]',
    isCompactNav && 'hidden',
    !isCompactNav && {
      'w-64': sidebarOpen,
      'w-0 md:w-20': !sidebarOpen,
      '-translate-x-full md:translate-x-0': !sidebarOpen,
      'translate-x-0': sidebarOpen,
    }
  );

  const navItemBase = 'flex items-center h-12 rounded-xl select-none w-full transition-all duration-200 group';
  const navItemActive = 'bg-primary/10 text-primary shadow-sm';
  const navItemInactive = 'text-on-surfaceVariant hover:bg-surface-containerLow hover:text-primary';

  const navItemClass = (isActive: boolean, layoutClass = '') =>
    clsx(
      navItemBase,
      isActive ? navItemActive : navItemInactive,
      boldNavLabels || isActive ? 'font-bold' : 'font-medium',
      layoutClass,
    );

  return (
    <>
      {/* 統一的側邊欄 */}
      <aside className={sidebarClasses}>
        {/* 與右側頂欄同高的標題列（h-16）；標題置中、字級加大 */}
        <div
          className={clsx(
            'h-16 shrink-0 box-border flex items-center justify-center',
            sidebarOpen ? 'px-3' : 'px-0',
          )}
        >
          <Link
            href="/"
            className={clsx(
              'group flex items-center justify-center text-center',
              sidebarOpen ? 'w-full min-w-0' : 'sr-only',
            )}
            tabIndex={sidebarOpen ? undefined : -1}
            aria-hidden={!sidebarOpen}
            title="高中學習資源教育網 2.0"
          >
            <span className="font-display text-lg font-extrabold text-primary tracking-tight leading-snug group-hover:text-primary-hover transition-colors">
              高中學習資源教育網 2.0
            </span>
          </Link>
        </div>

        <div className={`p-4 ${!sidebarOpen ? 'flex justify-center' : ''}`}>
          {courseWorkspace ? (
            <div className={`flex flex-col ${sidebarOpen ? 'items-center text-center' : 'items-center'}`}>
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary-container text-on-primary flex items-center justify-center shadow-sm shrink-0">
                <span className="font-display text-xl md:text-2xl font-extrabold leading-none" aria-hidden>
                  Σ
                </span>
              </div>
              {sidebarOpen && (
                <div className="mt-3 min-w-0 w-full">
                  <div className="font-display font-bold text-on-surface text-base line-clamp-2">
                    {courseWorkspace.courseName}
                  </div>
                  <div className="text-xs text-on-surfaceVariant mt-1 truncate">
                    {courseWorkspace.subjectLabel || courseWorkspace.courseCode}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className={`flex items-center gap-3 ${!sidebarOpen ? 'justify-center' : ''}`}>
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm">
                {safeDisplayInfo.name?.[0] || '?'}
              </div>
              {sidebarOpen && (
                <div className="overflow-hidden min-w-0">
                  <div className="font-bold text-on-surface text-sm truncate">{safeDisplayInfo.name || '\u00A0'}</div>
                  <div className="text-xs text-primary font-medium flex items-center mt-0.5">
                    <span className="bg-primary/10 px-1.5 py-0.5 rounded text-[10px] mr-1 border border-primary/20">{safeDisplayInfo.role}</span>
                    <span className="truncate text-on-surfaceVariant">{safeDisplayInfo.id || '\u00A0'}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="flex flex-col flex-1 p-3 gap-1 overflow-y-auto custom-scrollbar">
            {courseWorkspace ? (
              <>
                {TEACHER_COURSE_HUB_TAB_IDS.map((tabId) => {
                  const isActive = courseWorkspace.activeTab === tabId;
                  const href = teacherCourseHubPath(
                    courseWorkspace.courseCode,
                    tabId as TeacherCourseHubTab
                  );
                  const label = getCourseHubTabLabel(tabId, 'teacher');
                  return (
                    <Link
                      key={tabId}
                      href={href}
                      className={clsx(
                        navItemBase,
                        !sidebarOpen ? 'justify-center px-0' : 'px-3',
                        'font-bold',
                        isActive
                          ? 'bg-primary-container text-on-primary shadow-sm'
                          : navItemInactive,
                      )}
                      title={!sidebarOpen ? label : undefined}
                    >
                      <span className="flex items-center justify-center w-6 h-6">
                        <CourseHubFeatureIcon
                          id={tabId}
                          className={clsx(
                            'h-6 w-6 flex-shrink-0 transition-colors',
                            isActive ? 'text-on-primary' : 'text-gray-400 group-hover:text-primary'
                          )}
                        />
                      </span>
                      {sidebarOpen && (
                        <span className="ml-3 text-sm flex-shrink-0">{label}</span>
                      )}
                    </Link>
                  );
                })}
              </>
            ) : (
              <>
            {dashboardHref ? (
              <Link
                href={dashboardHref}
                onClick={() => handleTabClick(null)}
                className={navItemClass(
                  optimisticTab === null,
                  !sidebarOpen ? 'justify-center px-0' : 'px-3',
                )}
                title="儀表板"
            >
                <span className="flex items-center justify-center w-6 h-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className={clsx("h-6 w-6 flex-shrink-0 transition-colors", optimisticTab === null ? "text-primary" : "text-gray-400 group-hover:text-primary")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4.5 10.5V21a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0011.25 21V15h1.5v6a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0019.5 21V10.5" />
                    </svg>
                </span>
                {sidebarOpen && (
                    <span className="ml-3 text-sm flex-shrink-0">儀表板</span>
                )}
              </Link>
            ) : (
              <button
                  onClick={() => handleTabClick(null)}
                  className={navItemClass(
                    optimisticTab === null,
                    !sidebarOpen ? 'justify-center px-0' : 'px-3',
                  )}
                  title="儀表板"
              >
                  <span className="flex items-center justify-center w-6 h-6">
                      <svg xmlns="http://www.w3.org/2000/svg" className={clsx("h-6 w-6 flex-shrink-0 transition-colors", optimisticTab === null ? "text-primary" : "text-gray-400 group-hover:text-primary")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4.5 10.5V21a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0011.25 21V15h1.5v6a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0019.5 21V10.5" />
                      </svg>
                  </span>
                  {sidebarOpen && (
                      <span className="ml-3 text-sm flex-shrink-0">儀表板</span>
                  )}
              </button>
            )}

            {currentMenuItems.map(item => {
                if (item.id.startsWith('divider')) {
                    return <div key={item.id} className={`border-t border-gray-100 mx-2 my-2 ${!sidebarOpen ? 'hidden' : ''}`} />;
                }

                // 學生「個人資料」統一導向 /student/information
                const isPersonalInfo = item.id === 'change-password' || item.id === 'information';
                const displayItem = isPersonalInfo ? {
                    ...item,
                    id: 'information',
                    title: '個人資料',
                    icon: <UserCircleIcon />,
                    href: '/student/information',
                } : item;

                const handlePersonalInfoClick = () => {
                  setCachedActiveTab(displayItem.id);
                  setOptimisticTab(displayItem.id);
                  if (isCompactNavMode() && sidebarOpen) {
                    onToggleSidebar();
                  }
                };

                if (displayItem.href && !displayItem.disabled) {
                  return (
                    <Link
                        key={item.id}
                        href={displayItem.href}
                        onClick={() => {
                          if (displayItem.id === 'information') {
                            handlePersonalInfoClick();
                            return;
                          }
                          handleTabClick(displayItem.id);
                        }}
                        className={clsx(
                            navItemClass(
                              optimisticTab === displayItem.id,
                              !sidebarOpen ? 'justify-center px-0' : 'px-3',
                            ),
                            displayItem.disabled && 'opacity-50 cursor-not-allowed pointer-events-none bg-gray-50',
                        )}
                        title={!sidebarOpen ? displayItem.title : ''}
                    >
                        <span className="flex items-center justify-center w-6 h-6">
                            {React.cloneElement(displayItem.icon as React.ReactElement<{ className?: string }>, {
                                className: clsx(
                                    "h-6 w-6 flex-shrink-0 transition-colors",
                                    optimisticTab === displayItem.id ? "text-primary" : (displayItem.disabled ? "text-gray-300" : "text-gray-400 group-hover:text-primary")
                                )
                            })}
                        </span>
                        {sidebarOpen && (
                            <span className="ml-3 text-sm flex-shrink-0">{displayItem.title}</span>
                        )}
                    </Link>
                  );
                }

                return (
                    <button
                        key={item.id}
                        onClick={() => {
                            if (!displayItem.disabled) {
                                if (displayItem.id === 'information') {
                                    handlePersonalInfoClick();
                                    router.push('/student/information');
                                    return;
                                }
                                handleTabClick(displayItem.id);
                            }
                        }}
                        disabled={displayItem.disabled}
                        className={clsx(
                            navItemClass(
                              optimisticTab === displayItem.id,
                              !sidebarOpen ? 'justify-center px-0' : 'px-3',
                            ),
                            displayItem.disabled && 'opacity-50 cursor-not-allowed pointer-events-none bg-gray-50',
                        )}
                        title={!sidebarOpen ? displayItem.title : ''}
                    >
                        <span className="flex items-center justify-center w-6 h-6">
                            {React.cloneElement(displayItem.icon as React.ReactElement<{ className?: string }>, {
                                className: clsx(
                                    "h-6 w-6 flex-shrink-0 transition-colors",
                                    optimisticTab === displayItem.id ? "text-primary" : (displayItem.disabled ? "text-gray-300" : "text-gray-400 group-hover:text-primary")
                                )
                            })}
                        </span>
                        {sidebarOpen && (
                            <span className="ml-3 text-sm flex-shrink-0">{displayItem.title}</span>
                        )}
                    </button>
                );
            })}
              </>
            )}
        </nav>

        <div className="p-3 border-t border-outline-variant/40 bg-surface-containerLow/60 space-y-1">
          <button
            onClick={onToggleSidebar}
            className={clsx(
              'flex items-center h-10 rounded-xl w-full text-on-surfaceVariant hover:bg-surface-containerLowest hover:text-primary hover:shadow-sm transition-all duration-200',
              !sidebarOpen ? 'justify-center' : 'px-3'
            )}
            aria-label={sidebarOpen ? "收合選單" : "展開選單"}
            title={!sidebarOpen ? "展開選單" : ""}
          >
            <span className="flex items-center justify-center w-6 h-6">
              {sidebarOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                </svg>
              )}
            </span>
            {sidebarOpen && <span className="ml-3 text-sm font-medium">收合選單</span>}
          </button>
          
          <button
            onClick={handleLogoutClick}
            className={clsx(
              'flex items-center h-10 rounded-xl w-full text-error hover:bg-error/10 hover:text-error transition-all duration-200',
              !sidebarOpen ? 'justify-center' : 'px-3'
            )}
            title={!sidebarOpen ? "登出" : ""}
          >
            <span className="flex items-center justify-center w-6 h-6">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </span>
            {sidebarOpen && <span className="ml-3 text-sm font-medium">登出</span>}
          </button>
        </div>
      </aside>
    </>
  );
}