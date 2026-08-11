'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const [session, setSessionState] = useState<SessionData | null>(null);
  type SidebarMenuItem = { id: string; title?: string; href?: string; disabled?: boolean };
  type SidebarSyncDetail = {
    menuItems: SidebarMenuItem[];
    dashboardHref?: string;
    activeTab?: string | null;
    boldNavLabels?: boolean;
  };
  const [sidebarData, setSidebarData] = useState<SidebarSyncDetail | null>(null);

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
    const handleSidebarSync = (e: CustomEvent<SidebarSyncDetail>) => {
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
    if (path === '/') return pathname === '/';
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  const mobileNavFont = (isActiveItem: boolean) =>
    sidebarData?.boldNavLabels || isActiveItem ? 'font-bold' : 'font-medium';

  const isManagementRole = (sessionData: SessionData | null) => {
    if (!sessionData) return false;
    const role = sessionData.currentRole || sessionData.role;
    if (Array.isArray(role)) {
      const roles = role.map((r: string) => r.toLowerCase());
      return roles.includes('admin') || roles.includes('管理員') || roles.includes('teacher') || roles.includes('老師') || roles.includes('author');
    }
    if (typeof role === 'string') {
      const r = role.toLowerCase();
      return r === 'admin' || r === '管理員' || r === 'teacher' || r === '老師' || r === 'author';
    }
    return false;
  };

  const getPrimaryAuthHref = () => {
    if (!session) return '/login';
    if (isManagementRole(session)) return '/back-panel';
    return '/student';
  };

  const getSettingsHref = () => {
    if (!session) return '/login';
    if (isManagementRole(session)) return '/back-panel/password';
    return '/student/information';
  };

  const getDashboardLabel = () => {
    if (!session) return '登入';
    if (isManagementRole(session)) return '管理後台';
    return '學習中心';
  };

  const getUserRoleDisplay = (sessionData: SessionData | null) => {
    if (!sessionData) return '學生';
    const role = sessionData.currentRole || sessionData.role;
    if (Array.isArray(role)) {
      const roles = role.map((r: string) => String(r).toLowerCase());
      if (roles.includes('admin') || roles.includes('管理員')) return '管理員';
      if (roles.includes('teacher') || roles.includes('老師')) return '老師';
      if (roles.includes('author') || roles.includes('作者')) return '作者';
    } else if (typeof role === 'string') {
      const r = role.toLowerCase();
      if (r === 'admin' || r === '管理員') return '管理員';
      if (r === 'teacher' || r === '老師') return '老師';
      if (r === 'author' || r === '作者') return '作者';
    }
    return '學生';
  };

  const navLinks = [
    { href: '/', label: '網站首頁' },
    { href: '/courses', label: '課程介紹' },
    { href: '/blog', label: '線上文章' },
    { href: '/teacher', label: '老師介紹' },
    { href: '/faq', label: '常見問題' },
  ];

  const examFocusMode = useExamFocusMode();
  const isDashboardRoute =
    pathname.startsWith('/student') ||
    pathname.startsWith('/back-panel') ||
    pathname.startsWith('/panel');
  /**
   * 儀表板桌面：整條頂欄不渲染、不占空間。
   * 依 pathname／compact 判斷（不依賴 session），避免 hydration mismatch。
   */
  const hideChromeNav = isDashboardRoute && !isCompactNav;

  useEffect(() => {
    if (!accountOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAccountOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [accountOpen]);

  if (examFocusMode || hideChromeNav) return null;

  const avatarInitial = (session?.name?.trim()?.[0] || '?').toUpperCase();

  const linkClass = (active: boolean) =>
    `inline-flex items-center px-3.5 py-2 rounded-md text-base transition-all duration-200 ${
      active
        ? 'bg-primary/5 text-primary font-semibold'
        : 'text-on-surfaceVariant hover:text-primary hover:bg-primary/5 font-medium'
    }`;

  return (
    <nav className="sticky top-0 z-50 h-16 box-border bg-surface/90 shadow-sm backdrop-blur-md border-b border-outline-variant/40">
      <div className="page-shell h-full">
        <div className="flex justify-between items-center h-full gap-4">
          <div className="flex-1 flex items-center min-w-0 gap-8">
            <Link href="/" className="flex items-center gap-2 min-w-0 group">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white shadow-btn group-hover:bg-primary-hover transition-colors shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              </div>
              <span className="font-display font-extrabold text-primary truncate text-base sm:text-lg md:text-xl tracking-tight">
                <span className="sm:hidden">學習資源網</span>
                <span className="hidden sm:inline md:hidden">高中學習資源網</span>
                <span className="hidden md:inline">高中學習資源教育網 2.0</span>
              </span>
            </Link>

            <div className={`${isCompactNav ? 'hidden' : 'hidden md:flex'} items-center gap-1`}>
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href} className={linkClass(isActive(link.href))}>
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div className={`${isCompactNav ? 'hidden' : 'hidden md:flex'} items-center gap-3 shrink-0`}>
            {session ? (
              <div className="relative" ref={accountRef}>
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2 border-outline-variant bg-primary text-sm font-bold text-on-primary transition-colors hover:border-primary"
                  title={session.name || '帳號'}
                  aria-expanded={accountOpen}
                  aria-haspopup="menu"
                >
                  {avatarInitial}
                </button>
                {accountOpen ? (
                  <div
                    className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-outline-variant/50 bg-surface-containerLowest shadow-elevate"
                    role="menu"
                  >
                    <div className="border-b border-outline-variant/40 px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-on-primary">
                          {avatarInitial}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-on-surface">{session.name}</p>
                          <p className="truncate text-xs text-on-surfaceVariant">{session.account || '—'}</p>
                          <span className="mt-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                            {getUserRoleDisplay(session)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <Link
                        href={getPrimaryAuthHref()}
                        role="menuitem"
                        onClick={() => setAccountOpen(false)}
                        className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-containerLow"
                      >
                        {getDashboardLabel()}
                      </Link>
                      <Link
                        href={getSettingsHref()}
                        role="menuitem"
                        onClick={() => setAccountOpen(false)}
                        className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-containerLow"
                      >
                        個人設定
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={async () => {
                          setAccountOpen(false);
                          try {
                            window.dispatchEvent(new Event('auth-logout'));
                            sessionStorage.removeItem('sidebar_user_info');
                            await logoutClient('/');
                          } catch {
                            window.location.href = '/';
                          }
                        }}
                        className="flex w-full items-center rounded-xl px-3 py-2.5 text-sm font-medium text-error transition-colors hover:bg-error/10"
                      >
                        登出
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <Link
                href="/login"
                className="inline-flex items-center px-6 py-2.5 rounded-full text-sm font-semibold tracking-wide text-white bg-primary hover:bg-primary-container shadow-btn active:scale-95 transition-transform"
              >
                登入
              </Link>
            )}
          </div>

          <div className={`${isCompactNav ? 'flex' : 'md:hidden flex'} items-center flex-shrink-0`}>
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-xl text-on-surfaceVariant hover:text-primary hover:bg-primary/5 focus:outline-none transition-colors"
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

      <div className={`${isCompactNav ? 'block' : 'md:hidden'} overflow-y-auto custom-scrollbar transition-all duration-300 ease-in-out ${isMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 pt-2 pb-4 space-y-2 bg-surface-containerLow border-t border-outline-variant/50 shadow-inner">
          {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block px-4 py-3 rounded-xl text-lg transition-colors ${
                    isActive(link.href)
                      ? 'bg-surface-containerLowest text-primary shadow-sm font-bold'
                      : 'text-on-surfaceVariant hover:bg-surface-containerLowest hover:text-primary font-medium'
                  }`}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}

          {session ? (
            <div className="mt-4 pt-4 border-t border-outline-variant/60">
              <div className="flex items-center px-4 mb-4">
                <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white font-bold shadow-sm">
                  {session.name?.[0] || '?'}
                </div>
                <div className="ml-3">
                  <div className="text-base font-bold text-on-surface">{session.name}</div>
                  <div className="text-sm font-medium text-on-surfaceVariant">
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
                        isActive(sidebarData.dashboardHref) ? 'bg-primary/10 text-primary' : 'text-on-surfaceVariant hover:bg-surface-containerLowest hover:text-primary'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                    >
                      儀表板
                    </Link>
                  ) : (
                    <button
                      className={`block w-full text-left px-4 py-3 rounded-xl text-base ${mobileNavFont(sidebarData.activeTab === null)} transition-colors ${
                        sidebarData.activeTab === null ? 'bg-primary/10 text-primary' : 'text-on-surfaceVariant hover:bg-surface-containerLowest hover:text-primary'
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

                  {sidebarData.menuItems.map((item) => {
                    if (item.id.startsWith('divider')) {
                      return <div key={item.id} className="border-t border-outline-variant/40 mx-4 my-2" />;
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
                            isActive(displayItem.href) ? 'bg-primary/10 text-primary' : 'text-on-surfaceVariant hover:bg-surface-containerLowest hover:text-primary'
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
                          className="block px-4 py-3 rounded-xl text-base font-medium text-outline opacity-50 cursor-not-allowed bg-surface-container"
                        >
                          {displayItem.title}
                        </div>
                      );
                    }

                    return (
                      <button
                        key={displayItem.id}
                        className={`block w-full text-left px-4 py-3 rounded-xl text-base ${mobileNavFont(sidebarData.activeTab === displayItem.id)} transition-colors ${
                          sidebarData.activeTab === displayItem.id ? 'bg-primary/10 text-primary' : 'text-on-surfaceVariant hover:bg-surface-containerLowest hover:text-primary'
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
                    className="block px-4 py-3 rounded-xl text-base font-medium transition-colors text-on-surfaceVariant hover:bg-surface-containerLowest hover:text-primary"
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
                      window.dispatchEvent(new Event('request-logout'));
                    } else {
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
                className="block w-full text-left px-4 py-3 mt-2 rounded-xl text-base font-medium text-error hover:bg-error/10 transition-colors"
              >
                登出
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="block px-4 py-3 mt-4 text-center rounded-full text-base font-bold text-white bg-primary hover:bg-primary-container shadow-btn transition-colors"
              onClick={() => setIsMenuOpen(false)}
            >
              登入
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
