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
      } catch (e) {}
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
        } catch (e) {}
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
    }
    
    if (Array.isArray(currentInfo.role)) {
      if (currentInfo.role.map(r => r.toLowerCase()).includes('admin')) return '管理員';
      if (currentInfo.role.map(r => r.toLowerCase()).includes('teacher')) return '老師';
      return '學生';
    }
    
    // 處理字串角色
    const role = currentInfo.role?.toLowerCase();
    if (role === 'admin' || role === '管理員') return '管理員';
    if (role === 'teacher' || role === '老師') return '老師';
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

  const sidebarClasses = clsx(
    'flex flex-col z-[60] bg-white border-r border-gray-200 shadow-sm',
    'transition-all duration-300 ease-in-out',
    'fixed top-16 left-0 h-[calc(100vh-64px)]',
    isCompactNav && 'hidden',
    !isCompactNav && {
      'w-64': sidebarOpen,
      'w-0 md:w-20': !sidebarOpen,
      '-translate-x-full md:translate-x-0': !sidebarOpen,
      'translate-x-0': sidebarOpen,
    }
  );

  const navItemBase = 'flex items-center h-12 rounded-xl select-none w-full transition-all duration-200 group';
  const navItemActive = 'bg-indigo-50 text-indigo-600 shadow-sm';
  const navItemInactive = 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600';

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
        <div className={`p-4 border-b border-gray-100 ${!sidebarOpen ? 'flex justify-center' : ''}`}>
          <div className={`flex items-center gap-3 transition-all duration-300 ${!sidebarOpen ? 'justify-center' : ''}`}>
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm">
              {safeDisplayInfo.name?.[0] || '?'}
            </div>
            {sidebarOpen && (
              <div className="overflow-hidden">
                <div className="font-bold text-gray-900 text-sm truncate">{safeDisplayInfo.name || '\u00A0'}</div>
                <div className="text-xs text-indigo-500 font-medium flex items-center mt-0.5">
                  <span className="bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] mr-1 border border-indigo-100">{safeDisplayInfo.role}</span>
                  <span className="truncate">{safeDisplayInfo.id || '\u00A0'}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex flex-col flex-1 p-3 gap-1 overflow-y-auto custom-scrollbar">
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
                    <svg xmlns="http://www.w3.org/2000/svg" className={clsx("h-6 w-6 flex-shrink-0 transition-colors", optimisticTab === null ? "text-indigo-600" : "text-gray-400 group-hover:text-indigo-600")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
                      <svg xmlns="http://www.w3.org/2000/svg" className={clsx("h-6 w-6 flex-shrink-0 transition-colors", optimisticTab === null ? "text-indigo-600" : "text-gray-400 group-hover:text-indigo-600")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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
                                    optimisticTab === displayItem.id ? "text-indigo-600" : (displayItem.disabled ? "text-gray-300" : "text-gray-400 group-hover:text-indigo-600")
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
                                    optimisticTab === displayItem.id ? "text-indigo-600" : (displayItem.disabled ? "text-gray-300" : "text-gray-400 group-hover:text-indigo-600")
                                )
                            })}
                        </span>
                        {sidebarOpen && (
                            <span className="ml-3 text-sm flex-shrink-0">{displayItem.title}</span>
                        )}
                    </button>
                );
            })}
        </nav>

        <div className="p-3 border-t border-gray-100 bg-gray-50/50 space-y-1">
          <button
            onClick={onToggleSidebar}
            className={clsx(
              'flex items-center h-10 rounded-xl w-full text-gray-500 hover:bg-white hover:text-indigo-600 hover:shadow-sm transition-all duration-200',
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
              'flex items-center h-10 rounded-xl w-full text-red-500 hover:bg-red-50 hover:text-red-600 transition-all duration-200',
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