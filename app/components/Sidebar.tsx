'use client';

import React from 'react';
import clsx from 'clsx';

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
  
}

export default function Sidebar({
  sidebarOpen,
  onToggleSidebar,
  userInfo,
  menuItems,
  activeTab,
  onTabChange,
  onLogout
}: SidebarProps) {
  // 當點選功能時自動關閉側邊欄
  const handleTabChange = (tab: string | null) => {
    onTabChange(tab);
    // 如果是手機版或側邊欄是展開狀態，點選後關閉
    if (sidebarOpen) {
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
    'flex flex-col z-50 bg-white border-r',
    'transition-all duration-300 ease-in-out',
    'fixed top-16 left-0 h-[calc(100vh-64px)]',
    {
      'w-64': !sidebarOpen,
      'w-16': sidebarOpen,
    }
  );

  return (
    <>
      {/* 統一的側邊欄 */}
      <aside className={sidebarClasses}>
        <div className={`p-4 ${sidebarOpen ? 'flex justify-center' : ''}`}>
          {userInfo && (
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                {displayInfo.name?.[0] || '?'}
              </div>
              {!sidebarOpen && (
                <div>
                  <div className="font-normal text-base">{displayInfo.name} ({displayInfo.role})</div>
                  <div className="text-xs text-gray-500 font-light">
                    {userRole === '學生' ? '學號：' : '帳號：'}{displayInfo.id}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-2">
          <button
            onClick={onToggleSidebar}
            className={clsx(
              'flex items-center h-12 rounded-lg w-full hover:bg-gray-100 text-gray-700',
              sidebarOpen ? 'pl-3' : 'px-3'
            )}
            aria-label={sidebarOpen ? "展開選單" : "收合選單"}
          >
            <span className="flex items-center justify-center w-8 h-8">
              {sidebarOpen ? (
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              ) : (
                <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              )}
            </span>
            {!sidebarOpen && <span className="ml-3 text-base">收合選單</span>}
          </button>
          <button
            onClick={onLogout}
            className={clsx(
              'flex items-center h-12 rounded-lg w-full text-red-600 hover:bg-red-50',
              sidebarOpen ? 'justify-center' : 'px-3'
            )}
          >
            <span className="flex items-center justify-center w-8 h-8">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </span>
            {!sidebarOpen && <span className="ml-3 text-base">登出</span>}
          </button>
        </div>

                <nav className="flex flex-col flex-1 p-2 gap-2">

                  <button

                    onClick={() => handleTabChange(null)}

                    className={clsx(

                      'flex items-center h-12 rounded-lg select-none w-full',

                      activeTab === null ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700',
                      
                      sidebarOpen ? 'justify-center' : 'px-3'

                    )}

                  >

                    <span className="flex items-center justify-center w-8 h-8">

                      <svg className="h-6 w-6 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>

                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4.5 10.5V21a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0011.25 21V15h1.5v6a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0019.5 21V10.5" />

                      </svg>

                    </span>

                    {!sidebarOpen && (

                      <span className="ml-3 text-base flex-shrink-0">儀表板</span>

                    )}

                  </button>

        

                  {menuItems.map(item => {

                    if (item.id.startsWith('divider')) {

                      return <div key={item.id} className={`border-t border-gray-200 mx-4 my-2 ${ sidebarOpen ? 'hidden' : ''}`} />;
                    }

                    return (

                      <button

                        key={item.id}

                        onClick={() => {

                          if (!item.disabled) {

                            handleTabChange(item.id);

                          }

                        }}

                        disabled={item.disabled}

                        className={clsx(

                          'flex items-center h-12 rounded-lg select-none w-full',

                          activeTab === item.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700',

                          item.disabled && 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60 pointer-events-none',

                          sidebarOpen ? 'justify-center' : 'px-3'

                        )

                      }>

                        <span className="flex items-center justify-center w-8 h-8">

                          {React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, {

                            className: `h-6 w-6 flex-shrink-0 ${item.disabled ? 'text-gray-400' : 'text-blue-600'}`

                          })}

                        </span>

                        {!sidebarOpen && (

                          <span className="ml-3 text-base flex-shrink-0">{item.title}</span>

                        )}

                      </button>

                    );

                  })}

                </nav>

      </aside>
    </>
  );
} 