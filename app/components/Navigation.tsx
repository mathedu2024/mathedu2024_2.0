'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSession, type SessionData } from '../utils/session';
import { useCompactNav } from '../utils/useCompactNav';
import { useExamFocusMode } from '@/utils/useExamFocusMode';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { logoutClient } from '../utils/logoutClient';

export default function Navigation() {
  const pathname = usePathname();
  const isCompactNav = useCompactNav();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [session, setSessionState] = useState<SessionData | null>(null);
  const [sidebarData, setSidebarData] = useState<{
    menuItems: any[];
    dashboardHref?: string;
    activeTab?: string | null;
    boldNavLabels?: boolean;
  } | null>(null);

  const refreshSession = useCallback(() => {
    const next = getSession();
    setSessionState(next);
    if (!next) {
      setSidebarData(null);
      setIsMenuOpen(false);
    }
  }, []);

  useEffect(() => {
    refreshSession();
  }, [pathname, refreshSession]);

  // 當使用者跳出儀表板頁面時，清空側邊欄選單資料
  // 確保手機版選單不殘留上一次的功能上色，並改為顯示「回到儀表板」
  useEffect(() => {
    const isDashboardRoute = pathname.startsWith('/student') || pathname.startsWith('/back-panel') || pathname.startsWith('/panel');
    if (!isDashboardRoute) {
      setSidebarData(null);
    }
  }, [pathname]);

  useEffect(() => {
    const handleAuthLogout = () => {
      setSessionState(null);
      setSidebarData(null);
      setIsMenuOpen(false);
    };
    const handleStorage = () => {
      refreshSession();
    };
    window.addEventListener('auth-logout', handleAuthLogout);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('auth-logout', handleAuthLogout);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refreshSession]);

  useEffect(() => {
    const handleSidebarSync = (e: CustomEvent<{ menuItems: unknown[]; dashboardHref?: string; activeTab?: string | null; boldNavLabels?: boolean }>) => {
      if (!getSession()) return;
      setSidebarData(e.detail);
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('sidebar-sync', handleSidebarSync);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('sidebar-sync', handleSidebarSync);
      }
    };
  }, []);

  const isActive = (path: string) => {
    return pathname === path;
  };

  const mobileNavFont = (isActiveItem: boolean) =>
    sidebarData?.boldNavLabels || isActiveItem ? 'font-bold' : 'font-medium';

  const isManagementRole = (sessionData: any) => {
    if (!sessionData) return false;
    const role = sessionData.currentRole || sessionData.role;
    if (Array.isArray(role)) {
      const roles = role.map((r: string) => r.toLowerCase());
      return roles.includes('admin') || roles.includes('管理員') || roles.includes('teacher') || roles.includes('老師');
    }
    if (typeof role === 'string') {
      const r = role.toLowerCase();
      return r === 'admin' || r === '管理員' || r === 'teacher' || r === '老師';
    }
    return false;
  };

  const getCourseLoginHref = () => {
    if (!session) return '/login';
    if (!isManagementRole(session)) return '/student';
    return '/login';
  };

  const getPanelHref = () => {
    if (!session) return '/panel';
    if (isManagementRole(session)) return '/back-panel';
    return '/panel';
  };

  const getUserRoleDisplay = (sessionData: any) => {
    if (!sessionData) return '學生';
    const role = sessionData.currentRole || sessionData.role;
    if (Array.isArray(role)) {
      const roles = role.map((r: string) => r.toLowerCase());
      if (roles.includes('admin') || roles.includes('管理員')) return '管理員';
      if (roles.includes('teacher') || roles.includes('老師')) return '老師';
    } else if (typeof role === 'string') {
      const r = role.toLowerCase();
      if (r === 'admin' || r === '管理員') return '管理員';
      if (r === 'teacher' || r === '老師') return '老師';
    }
    return '學生';
  };

  const navLinks = [
    { href: '/', label: '網站首頁' },
    { href: '/courses', label: '課程介紹' },
    { href: '/teacher', label: '老師介紹' },
    { href: '/faq', label: '常見問題' },
  ];

  const examFocusMode = useExamFocusMode();
  if (examFocusMode) return null;

  return (
    <nav className="bg-white sticky top-0 z-50 h-16 box-border border-b border-gray-100">
      <div className="page-shell h-full">
        <div className="flex justify-between items-center h-full">
          {/* Logo */}
          <div className="flex-1 flex items-center min-w-0">
            <Link href="/" className="flex items-center gap-2 text-base sm:text-xl md:text-2xl font-bold text-gray-900 hover:text-indigo-600 transition-colors truncate group">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm group-hover:bg-indigo-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              </div>
              <span className="sm:hidden">學習資源網</span>
              <span className="hidden sm:inline md:hidden">高中學習資源網</span>
              <span className="hidden md:inline">高中學習資源教育網 2.0</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className={`${isCompactNav ? 'hidden' : 'hidden md:flex'} md:items-center md:space-x-1`}>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                  isActive(link.href)
                    ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <Link href={getPanelHref()} className={`ml-2 inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isActive('/panel') || pathname.startsWith('/back-panel') ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'}`}>
              網站管理
            </Link>
            <Link
              href={getCourseLoginHref()}
              className="ml-4 inline-flex items-center px-5 py-2 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all transform hover:-translate-y-0.5"
            >
              登入課程
            </Link>
          </div>

          {/* Mobile menu button */}
          <div className={`${isCompactNav ? 'flex' : 'md:hidden flex'} items-center flex-shrink-0`}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 focus:outline-none transition-colors"
              aria-expanded={isMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isMenuOpen ? (
                <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`${isCompactNav ? 'block' : 'md:hidden'} overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out ${isMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pt-2 pb-4 space-y-2 bg-gray-50 border-t border-gray-100 shadow-inner">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                isActive(link.href)
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-gray-600 hover:bg-white hover:text-indigo-600'
              }`}
              onClick={() => setIsMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          
          {session ? (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center px-4 mb-4">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
                  {session.name?.[0] || '?'}
                </div>
                <div className="ml-3">
                  <div className="text-base font-bold text-gray-800">{session.name}</div>
                  <div className="text-sm font-medium text-gray-500">
                    {getUserRoleDisplay(session)}
                  </div>
                </div>
              </div>

              {sidebarData ? (
                <div className="space-y-1">
                  {sidebarData.dashboardHref ? (
                    <Link
                      href={sidebarData.dashboardHref}
                      className={`block px-4 py-3 rounded-xl text-base ${mobileNavFont(isActive(sidebarData.dashboardHref))} transition-colors ${
                        isActive(sidebarData.dashboardHref) ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      儀表板
                    </Link>
                  ) : (
                    <button
                      className={`block w-full text-left px-4 py-3 rounded-xl text-base ${mobileNavFont(sidebarData.activeTab === null)} transition-colors ${
                        sidebarData.activeTab === null ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                      }`}
                      onClick={() => {
                        setIsMenuOpen(false);
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('request-tab-change', { detail: null }));
                        }
                      }}
                    >
                      儀表板
                    </button>
                  )}
                  
                  {sidebarData.menuItems.map((item: any) => {
                    if (item.id.startsWith('divider')) {
                      return <div key={item.id} className="border-t border-gray-100 mx-4 my-2" />;
                    }
                    const isPersonalInfo = item.id === 'change-password' || item.id === 'information';
                    const displayItem = isPersonalInfo ? {
                        ...item,
                        id: 'information',
                        title: '個人資料',
                        href: '/student/information',
                    } : item;

                    if (displayItem.href && !displayItem.disabled) {
                      return (
                        <Link
                          key={displayItem.id}
                          href={displayItem.href}
                          className={`block px-4 py-3 rounded-xl text-base ${mobileNavFont(isActive(displayItem.href))} transition-colors ${
                            isActive(displayItem.href) ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                          }`}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {displayItem.title}
                        </Link>
                      );
                    }
                    
                    if (displayItem.disabled) {
                      return (
                        <div
                          key={displayItem.id}
                          className="block px-4 py-3 rounded-xl text-base font-medium text-gray-400 opacity-50 cursor-not-allowed bg-gray-50"
                        >
                          {displayItem.title}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={displayItem.id}
                        className={`block w-full text-left px-4 py-3 rounded-xl text-base ${mobileNavFont(sidebarData.activeTab === displayItem.id)} transition-colors ${
                          sidebarData.activeTab === displayItem.id ? 'bg-indigo-50 text-indigo-600' : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                        }`}
                        onClick={() => {
                          setIsMenuOpen(false);
                          if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('request-tab-change', { detail: displayItem.id }));
                          }
                        }}
                      >
                        {displayItem.title}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1">
                  <Link
                    href={isManagementRole(session) ? '/back-panel' : '/student'}
                    className="block px-4 py-3 rounded-xl text-base font-medium transition-colors text-gray-600 hover:bg-gray-50 hover:text-indigo-600"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    回到儀表板
                  </Link>
                </div>
              )}
              
              <button
                onClick={async () => {
                  setIsMenuOpen(false);
                  if (typeof window !== 'undefined') {
                    if (sidebarData) {
                      // 若 Sidebar 存在，發送事件交給 Sidebar 執行完整的登出邏輯與清除快取
                      window.dispatchEvent(new Event('request-logout'));
                    } else {
                      // 防呆機制：若無 Sidebar (例如首頁)，改用統一的 logoutClient 登出邏輯
                      window.dispatchEvent(new Event('auth-logout'));
                      sessionStorage.removeItem('sidebar_user_info');
                      try {
                        await logoutClient('/');
                      } catch (error) {
                        console.error('Logout failed:', error);
                        window.location.href = '/';
                      }
                    }
                  }
                }}
                className="block w-full text-left px-4 py-3 mt-2 rounded-xl text-base font-medium text-red-500 hover:bg-red-50 transition-colors"
              >
                登出
              </button>
            </div>
          ) : (
            <>
              <Link
                href="/panel"
                className={`block px-4 py-3 rounded-xl text-base font-medium transition-colors ${
                  isActive('/panel')
                    ? 'bg-white text-indigo-600 shadow-sm'
                    : 'text-gray-600 hover:bg-white hover:text-indigo-600'
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                網站管理
              </Link>
              <Link
                href="/login"
                className="block px-4 py-3 mt-4 text-left rounded-xl text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
                onClick={() => setIsMenuOpen(false)}
              >
                登入課程
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}