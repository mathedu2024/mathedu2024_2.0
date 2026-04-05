'use client';

import { useState } from 'react';
import Link from 'next/link';
// 使用 @/ 別名引用
import { setSession } from '@/utils/session';
import alerts from '@/utils/alerts';
import LoadingSpinner from '@/components/LoadingSpinner';
import Dropdown from '@/components/ui/Dropdown';

export default function LoginPage() {
  const [formData, setFormData] = useState({
    role: 'teacher',
    account: '',
    password: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRoleChange = (value: string) => {
    setFormData({ ...formData, role: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account: formData.account,
          password: formData.password,
          loginType: formData.role,
        }),
      });

      let data = null;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
        } else {
          throw new Error('伺服器回傳格式錯誤');
        }
      } catch {
        throw new Error('伺服器錯誤，請稍後再試');
      }

      if (!response.ok) {
        throw new Error((data && data.error) || '登入失敗');
      }

      const sessionData = { ...data, currentRole: formData.role };
      setSession(sessionData);

      if (data.role.includes('student')) {
        window.location.href = '/student';
      } else {
        window.location.href = '/back-panel';
      }
    } catch (err: unknown) {
      console.error('Login error:', err);
      const message = err instanceof Error ? err.message : '發生未知錯誤';
      
      if (message.includes('Invalid password') || message.includes('密碼')) {
        alerts.showError('登入失敗', '密碼錯誤，請檢查後再試。');
      } else if (message.includes('Account not found') || message.includes('查無') || message.includes('not found')) {
        alerts.showError('登入失敗', '查無此帳號，請確認輸入是否正確。');
      } else if (message.includes('伺服器錯誤')) {
        alerts.showError('系統錯誤', '伺服器發生錯誤 (500)，請稍後再試。');
      } else {
        alerts.showError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // 1. 背景：統一使用 cubes 紋理 + 淺灰底色
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] px-4">
      
      {/* 2. 卡片：資料庫風格 */}
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl w-full max-w-md text-center border-t-4 border-indigo-600 animate-fade-in relative">
        
        {/* 3. 圖示：管理員/老師專用 Icon (盾牌/人像) */}
        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">網站管理登入</h1>
        <p className="text-gray-500 mb-8 text-sm">老師與管理員專用後台</p>

        <form onSubmit={handleSubmit} className="space-y-5 text-left">
          
          {/* 身分選擇 */}
          <div>
            <label htmlFor="role" className="block text-sm font-semibold text-gray-700 mb-1">
              登入身分
            </label>
            <Dropdown
              value={formData.role}
              onChange={handleRoleChange}
              options={[{ value: 'teacher', label: '老師' }, { value: 'admin', label: '管理員' }]} 
              placeholder="請選擇身分"
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor="account" className="block text-sm font-semibold text-gray-700 mb-1">
              帳號
            </label>
            <input
              id="account"
              name="account"
              type="text"
              autoComplete="username"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="請輸入帳號"
              value={formData.account}
              onChange={handleChange}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-1">
              密碼
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="請輸入密碼"
                value={formData.password}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all pr-10"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-indigo-600 focus:outline-none transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center mt-6 ${isLoading ? 'opacity-80 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
          >
            {isLoading ? (
              <>
                <LoadingSpinner size={20} color="white" />
                <span className="ml-2">驗證中...</span>
              </>
            ) : (
              '登入後台'
            )}
          </button>
        </form>
        
        <div className="mt-8 border-t border-gray-100 pt-6">
          <Link href="/student-login" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            切換至學生登入
          </Link>
        </div>

      </div>
    </div>
  );
}