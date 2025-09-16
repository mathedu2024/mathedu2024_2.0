'use client';

import React from 'react';

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
  
  // 手機版控制
  isMobile?: boolean;
}

export default function Sidebar({
  sidebarOpen,
  onToggleSidebar,
  userInfo,
  menuItems,
  activeTab,
  onTabChange,
  onLogout,
  isMobile = false
}: SidebarProps) {
  // 當點選功能時自動關閉側邊欄
  const handleTabChange = (tab: string | null) => {
    onTabChange(tab);
    // 如果是手機版或側邊欄是展開狀態，點選後關閉
    if (isMobile || sidebarOpen) {
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

  return (
    <>
      {/* 桌面版側邊欄 */}
      <aside
        className={`hidden md:flex flex-col z-40 transition-all duration-300 bg-white border-r ${sidebarOpen ? 'w-16' : 'w-64'}`}
        style={{
          position: 'fixed',
          top: 64,
          left: 0,
          height: 'calc(100vh - 64px)'
        }}
      >
        <div className={`mt-4 flex flex-col ${sidebarOpen ? 'items-center' : 'items-start pl-4'}`}>
          {/* 用戶資料區塊 */}
          {userInfo && (
            <>
              <div className="flex items-center gap-2 pb-2">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  {displayInfo.name?.[0] || '?'}
                </div>
                <div>
                  {!sidebarOpen && <div className="font-normal text-base">{displayInfo.name} ({displayInfo.role})</div>}
                  {!sidebarOpen && (
                    <div className="text-xs text-gray-500 font-light">
                      {userRole === '學生' ? '學號：' : '帳號：'}{displayInfo.id}
                    </div>
                  )}
                </div>
              </div>
              <div className="pb-2 w-full">
                <button
                  onClick={onLogout}
                  className={sidebarOpen
                    ? 'flex items-center justify-center w-12 h-12 rounded-full transition-colors text-red-600 hover:bg-red-50'
                    : 'flex items-center w-full h-12 rounded-lg transition-colors text-red-600 hover:bg-red-50'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  {!sidebarOpen && <span className="ml-3">登出</span>}
                </button>
              </div>
              {/* 收合/展開按鈕 */}
              <div className="pt-0 pb-0 w-full"> 
                <button
                  onClick={onToggleSidebar}
                  className={
                    sidebarOpen
                      ? "flex items-center justify-center w-12 h-12 rounded-full transition-colors hover:rounded-lg hover:bg-gray-100 text-gray-700"
                      : "flex items-center w-full h-12 rounded-lg transition-colors hover:bg-gray-100 text-gray-700"
                  }
                  aria-label={sidebarOpen ? "展開選單" : "收合選單"}
                >
                  <span className="flex items-center justify-center w-8 h-8">
                    {sidebarOpen ? (
                      // 收合狀態顯示「>」
                      <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    ) : (
                      // 展開狀態顯示「<」
                      <svg className="w-6 h-6 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    )}
                  </span>
                  {!sidebarOpen && <span className="ml-3 text-base">收合選單</span>}
                </button>
              </div>
            </>
          )}
        </div>
        {/* 功能選單 */}
        <nav className={`flex-1 py-4 flex flex-col gap-2 overflow-y-auto min-h-0 w-full ${sidebarOpen ? 'items-center' : ''}`}>
          {/* 儀表板按鈕 */}
          <button
            onClick={() => handleTabChange(null)}
            className={`flex items-center w-full h-12 px-3 py-2 rounded-lg transition-colors select-none ${activeTab === null ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}`}
          >
            <span className="flex items-center justify-center w-8 h-8">
              <svg className="h-6 w-6 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4.5 10.5V21a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0011.25 21V15h1.5v6a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0019.5 21V10.5" />
              </svg>
            </span>
            {!sidebarOpen && (
              <span className="ml-3 text-base truncate">儀表板</span>
            )}
          </button>
                      {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => {
                  if (!item.disabled) {
                    handleTabChange(item.id);
                  }
                }}
                disabled={item.disabled}
                className={`flex items-center w-full h-12 px-3 py-2 rounded-lg transition-colors select-none
                  ${activeTab === item.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}
                  ${item.disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60 pointer-events-none' : ''}`}
              >
              <span className="flex items-center justify-center w-8 h-8">
                {React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, { 
                  className: `h-6 w-6 flex-shrink-0 ${item.disabled ? 'text-gray-400' : 'text-blue-600'}` 
                })}
              </span>
              {!sidebarOpen && (
                <span className="ml-3 text-base truncate">{item.title}</span>
              )}
            </button>
          ))}
        </nav>
      </aside>

      {/* 手機版側邊欄 */}
      {sidebarOpen && (
        <aside className="fixed top-0 left-0 w-64 h-full z-50 bg-white flex flex-col md:hidden transition-all duration-300">
          {/* 頂部：只保留關閉按鈕 */}
          <div className="border-b px-2 pt-4 pb-2" />
          {/* 功能選單 */}
          <nav className="flex-1 py-4 flex flex-col gap-2 px-0 overflow-y-auto">
            {/* 儀表板按鈕 */}
            <button
              onClick={() => handleTabChange(null)}
              className={`flex items-center w-full h-12 px-3 py-2 rounded-lg transition-colors select-none ${activeTab === null ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}`}
            >
              <span className="flex items-center justify-center w-8 h-8">
                <svg className="h-6 w-6 flex-shrink-0 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l9-9 9 9M4.5 10.5V21a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0011.25 21V15h1.5v6a1.5 1.5 0 001.5 1.5h3.75A1.5 1.5 0 0019.5 21V10.5" />
                </svg>
              </span>
              <span className="ml-3 text-base truncate">儀表板</span>
            </button>
            {menuItems.map(item => (
              <button
                key={item.id}
                onClick={() => { if (!item.disabled) { handleTabChange(item.id); } }}
                disabled={item.disabled}
                className={`flex items-center w-full h-12 px-3 py-2 rounded-lg transition-colors select-none
                  ${activeTab === item.id ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100 text-gray-700'}
                  ${item.disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-60 pointer-events-none' : ''}`}
              >
                <span className="flex items-center justify-center w-8 h-8">
                  {React.cloneElement(item.icon as React.ReactElement<{ className?: string }>, { 
                    className: `h-6 w-6 flex-shrink-0 ${item.disabled ? 'text-gray-400' : 'text-blue-600'}` 
                  })}
                </span>
                <span className="ml-3 text-base truncate">{item.title}</span>
              </button>
            ))}
          </nav>
          {/* 登出按鈕 */}
          <div className="px-2 pb-2 border-t bg-white">
            <button
              onClick={() => { onLogout(); onToggleSidebar(); }}
              className="flex items-center w-full h-12 px-3 py-2 rounded-lg transition-colors hover:bg-red-50 text-red-600"
            >
              <span className="flex items-center justify-center w-8 h-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </span>
              <span className="ml-3 text-base">登出</span>
            </button>
          </div>
          {/* 關閉按鈕 */}
          <div className="px-2 pb-2 border-t bg-white">
            <button
              onClick={onToggleSidebar}
              className="flex items-center w-full h-12 px-3 py-2 rounded-lg transition-colors hover:bg-gray-100 text-gray-700"
            >
              <span className="flex items-center justify-center w-8 h-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
              <span className="ml-3 text-base">收合選單</span>
            </button>
          </div>
        </aside>
      )}
    </>
  );
} 