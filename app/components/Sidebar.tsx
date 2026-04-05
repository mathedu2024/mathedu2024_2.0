'use client';

import React, { useState, useEffect } from 'react';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserCircleIcon } from '@heroicons/react/24/outline';

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
  
}

export default function Sidebar({
  sidebarOpen,
  onToggleSidebar,
  userInfo,
  menuItems,
  activeTab,
  onTabChange,
  onLogout,
  dashboardHref
}: SidebarProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // 修正：僅在組件初次掛載時執行初始化檢查
    // 移除 sidebarOpen 依賴，避免每次打開選單時又觸發自動關閉邏輯
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      if (sidebarOpen) onToggleSidebar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 當點選功能時自動關閉側邊欄
  const handleTabChange = (tab: string | null) => {
    onTabChange(tab);
    // 如果是手機版或側邊欄是展開狀態，點選後關閉
    if (window.innerWidth < 768 && sidebarOpen) {
      onToggleSidebar();
    }
  };
  // 判斷用戶角色
  const getUserRole = (): string => {
    if (!userInfo) return '學生';
    
    if (userInfo.currentRole) {
      if (userInfo.currentRole === 'admin') return '管理員';
      if (userInfo.currentRole === 'teacher') return '老師';
    }
    
    if (Array.isArray(userInfo.role)) {
      if (userInfo.role.map(r => r.toLowerCase()).includes('admin')) return '管理員';
      if (userInfo.role.map(r => r.toLowerCase()).includes('teacher')) return '老師';
      return '學生';
    }
    
    // 處理字串角色
    const role = userInfo.role?.toLowerCase();
    if (role === 'admin' || role === '管理員') return '管理員';
    if (role === 'teacher' || role === '老師') return '老師';
    return '學生';
  };

  const userRole = getUserRole();

  // 獲取用戶顯示資訊
  const getUserDisplayInfo = () => {
    if (!userInfo) return { name: '', id: '', role: '學生' };
    
    return {
      name: userInfo.name || '',
      id: userInfo.studentId || userInfo.account || '',
      role: userRole
    };
  };

  const displayInfo = getUserDisplayInfo();

  const sidebarClasses = clsx(
    'flex flex-col z-[60] bg-white border-r border-gray-200 shadow-sm',
    'transition-all duration-300 ease-in-out',
    'fixed top-16 left-0 h-[calc(100vh-64px)]',
    {
      'w-64': sidebarOpen,
      'w-0 md:w-20': !sidebarOpen, // 手機版關閉時寬度設為 0，避免影響佈局計算
      '-translate-x-full md:translate-x-0': !sidebarOpen, // 手機隱藏，桌機縮小
      'translate-x-0': sidebarOpen, // Show when open
      'max-md:hidden': !sidebarOpen, // 手機關閉時完全不渲染佔位，避免任何殘影
    }
  );

  return (
    <>
      {/* 手機版開關按鈕：確保只有在「手機版」且「選單關閉」時才顯示 */}
      {mounted && !sidebarOpen && (
        <button
          onClick={onToggleSidebar}
          className="md:hidden fixed bottom-6 left-6 z-50 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all active:scale-90"
          aria-label="展開側邊欄"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {/* 統一的側邊欄 */}
      <aside className={sidebarClasses}>
        <div className={`p-4 border-b border-gray-100 ${!sidebarOpen ? 'flex justify-center' : ''}`}>
          {mounted && userInfo && (
            <div className={`flex items-center gap-3 transition-all duration-300 ${!sidebarOpen ? 'justify-center' : ''}`}>
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0 shadow-sm">
                {displayInfo.name?.[0] || '?'}
              </div>
              {sidebarOpen && (
                <div className="overflow-hidden">
                  <div className="font-bold text-gray-900 text-sm truncate">{displayInfo.name}</div>
                  <div className="text-xs text-indigo-500 font-medium flex items-center mt-0.5">
                    <span className="bg-indigo-50 px-1.5 py-0.5 rounded text-[10px] mr-1 border border-indigo-100">{displayInfo.role}</span>
                    <span className="truncate">{displayInfo.id}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <nav className="flex flex-col flex-1 p-3 gap-1 overflow-y-auto custom-scrollbar">
            {dashboardHref ? (
              <Link
                href={dashboardHref}
                onClick={() => handleTabChange(null)}
                className={clsx(
                    'flex items-center h-12 rounded-xl select-none w-full transition-all duration-200 group',
                    activeTab === null 
                        ? 'bg-indigo-50 text-indigo-600 font-bold shadow-sm' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600',
                    !sidebarOpen ? 'justify-center px-0' : 'px-3'
                )}
                title="儀表板"
            >
                <span className="flex items-center justify-center w-6 h-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className={clsx("h-6 w-6 flex-shrink-0 transition-colors", activeTab === null ? "text-indigo-600" : "text-gray-400 group-hover:text-indigo-600")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4.5 10.5V21a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0011.25 21V15h1.5v6a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0019.5 21V10.5" />
                    </svg>
                </span>
                {sidebarOpen && (
                    <span className="ml-3 text-sm flex-shrink-0">儀表板</span>
                )}
              </Link>
            ) : (
              <button
                  onClick={() => handleTabChange(null)}
                  className={clsx(
                      'flex items-center h-12 rounded-xl select-none w-full transition-all duration-200 group',
                      activeTab === null 
                          ? 'bg-indigo-50 text-indigo-600 font-bold shadow-sm' 
                          : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600',
                      !sidebarOpen ? 'justify-center px-0' : 'px-3'
                  )}
                  title="儀表板"
              >
                  <span className="flex items-center justify-center w-6 h-6">
                      <svg xmlns="http://www.w3.org/2000/svg" className={clsx("h-6 w-6 flex-shrink-0 transition-colors", activeTab === null ? "text-indigo-600" : "text-gray-400 group-hover:text-indigo-600")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4.5 10.5V21a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0011.25 21V15h1.5v6a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0019.5 21V10.5" />
                      </svg>
                  </span>
                  {sidebarOpen && (
                      <span className="ml-3 text-sm flex-shrink-0">儀表板</span>
                  )}
              </button>
            )}

            {menuItems.map(item => {
                if (item.id.startsWith('divider')) {
                    return <div key={item.id} className={`border-t border-gray-100 mx-2 my-2 ${!sidebarOpen ? 'hidden' : ''}`} />;
                }

                // Special handling: Replace 'change-password' with 'information'
                const isChangePassword = item.id === 'change-password';
                const displayItem = isChangePassword ? {
                    ...item,
                    id: 'information',
                    title: '個人資料',
                    icon: <UserCircleIcon />
                } : item;

                if (displayItem.href && !displayItem.disabled) {
                  return (
                    <Link
                        key={item.id}
                        href={displayItem.href}
                        onClick={() => {
                            if (window.innerWidth < 768 && sidebarOpen) {
                                onToggleSidebar();
                            }
                        }}
                        className={clsx(
                            'flex items-center h-12 rounded-xl select-none w-full transition-all duration-200 group',
                            activeTab === displayItem.id 
                                ? 'bg-indigo-50 text-indigo-600 font-bold shadow-sm' 
                                : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600',
                            displayItem.disabled && 'opacity-50 cursor-not-allowed pointer-events-none bg-gray-50',
                            !sidebarOpen ? 'justify-center px-0' : 'px-3'
                        )}
                        title={!sidebarOpen ? displayItem.title : ''}
                    >
                        <span className="flex items-center justify-center w-6 h-6">
                            {React.cloneElement(displayItem.icon as React.ReactElement<{ className?: string }>, {
                                className: clsx(
                                    "h-6 w-6 flex-shrink-0 transition-colors",
                                    activeTab === displayItem.id ? "text-indigo-600" : (displayItem.disabled ? "text-gray-300" : "text-gray-400 group-hover:text-indigo-600")
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
                                    router.push('/student/information');
                                    if (window.innerWidth < 768 && sidebarOpen) {
                                        onToggleSidebar();
                                    }
                                } else {
                                    handleTabChange(displayItem.id);
                                }
                            }
                        }}
                        disabled={displayItem.disabled}
                        className={clsx(
                            'flex items-center h-12 rounded-xl select-none w-full transition-all duration-200 group',
                            activeTab === displayItem.id 
                                ? 'bg-indigo-50 text-indigo-600 font-bold shadow-sm' 
                                : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600',
                            displayItem.disabled && 'opacity-50 cursor-not-allowed pointer-events-none bg-gray-50',
                            !sidebarOpen ? 'justify-center px-0' : 'px-3'
                        )}
                        title={!sidebarOpen ? displayItem.title : ''}
                    >
                        <span className="flex items-center justify-center w-6 h-6">
                            {React.cloneElement(displayItem.icon as React.ReactElement<{ className?: string }>, {
                                className: clsx(
                                    "h-6 w-6 flex-shrink-0 transition-colors",
                                    activeTab === displayItem.id ? "text-indigo-600" : (displayItem.disabled ? "text-gray-300" : "text-gray-400 group-hover:text-indigo-600")
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
            onClick={onLogout}
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
      
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
            onClick={onToggleSidebar}
        />
      )}
    </>
  );
}