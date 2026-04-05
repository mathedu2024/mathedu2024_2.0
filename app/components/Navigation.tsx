'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { getSession } from '../utils/session';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

export default function Navigation() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [session, setSession] = useState<unknown>(null);

  useEffect(() => {
    setIsClient(true);
    setSession(getSession() as unknown);
  }, []);

  const isActive = (path: string) => {
    return pathname === path;
  };

  const navLinks = [
    { href: '/', label: '網站首頁' },
    { href: '/courses', label: '課程介紹' },
    { href: '/teacher', label: '老師介紹' },
    { href: '/fqa', label: '常見問題' },
  ];

  return (
    <nav className="bg-white sticky top-0 z-50 shadow-sm border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-1 flex items-center min-w-0">
            <Link href="/" className="flex items-center gap-2 text-xl md:text-2xl font-bold text-gray-900 hover:text-indigo-600 transition-colors truncate group">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white shadow-sm group-hover:bg-indigo-700 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
                </svg>
              </div>
              <span>高中學習資源教育網 2.0</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:space-x-1">
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
            {isClient && (
              <>
                <Link
                  href={
                    session &&
                    typeof session === 'object' &&
                    session !== null &&
                    'role' in session &&
                    ((session as { role?: string }).role === 'admin' ||
                      (session as { role?: string }).role === 'teacher' ||
                      (session as { role?: string }).role === '管理員' ||
                      (session as { role?: string }).role === '老師')
                      ? '/back-panel'
                      : '/panel'
                  }
                  className={`ml-2 inline-flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive('/panel')
                      ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-indigo-600'
                  }`}
                >
                  網站管理
                </Link>
                <Link
                  href={
                    session &&
                    typeof session === 'object' &&
                    session !== null &&
                    'role' in session &&
                    ((session as { role?: string }).role === 'student' ||
                      (session as { role?: string }).role === '學生')
                      ? '/student'
                      : '/login'
                  }
                  className="ml-4 inline-flex items-center px-5 py-2 border border-transparent text-sm font-bold rounded-xl text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm hover:shadow-md transition-all transform hover:-translate-y-0.5"
                >
                  登入課程
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center flex-shrink-0">
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
      <div className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out ${isMenuOpen ? 'max-h-screen opacity-100' : 'max-h-0 opacity-0'}`}>
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
          {isClient && (
            <>
              <Link
                href={
                  session &&
                  typeof session === 'object' &&
                  session !== null &&
                  'role' in session &&
                  ((session as { role?: string }).role === 'admin' ||
                    (session as { role?: string }).role === 'teacher' ||
                    (session as { role?: string }).role === '管理員' ||
                    (session as { role?: string }).role === '老師')
                    ? '/back-panel'
                    : '/panel'
                }
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
                href={
                  session &&
                  typeof session === 'object' &&
                  session !== null &&
                  'role' in session &&
                  ((session as { role?: string }).role === 'student' ||
                    (session as { role?: string }).role === '學生')
                    ? '/student'
                    : '/login'
                }
                className="block px-4 py-3 mt-4 text-center rounded-xl text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors"
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