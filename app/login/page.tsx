'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { setSession } from '../utils/session'; // 維持相對路徑
import alerts from '../utils/alerts';
import LoadingSpinner from '../components/LoadingSpinner';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';

export default function StudentLoginPage() {
  const [formData, setFormData] = useState({
    account: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  // 為了避免畫面閃爍，初始值設為 true，useEffect 檢查完後設為 false
  const [authChecking, setAuthChecking] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  // 1. 自動檢查登入狀態
  useEffect(() => {
    // 修正：不再自動跳轉，避免無窮迴圈
    setAuthChecking(false);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
        body: JSON.stringify({ ...formData, loginType: 'student' }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '登入失敗');
      }

      // 2. 設定 Session
      setSession({
        id: data.id,
        name: data.name,
        role: 'student',
        account: formData.account,
      });
      if (data.token) {
        await signInWithCustomToken(auth, data.token);
      }

      // 3. 移除 SweetAlert 成功提示，直接導向至學生首頁
      window.location.href = '/student';

    } catch (err) {
      const message = (err as Error).message || '發生未知錯誤';
      
      // 錯誤處理
      if (message.includes('密碼')) {
        alerts.showError('登入失敗', '密碼錯誤，請檢查後再試。');
      } else if (message.includes('查無') || message.includes('not found')) {
        alerts.showError('登入失敗', '查無此帳號，請確認輸入是否正確。');
      } else if (message.includes('伺服器錯誤')) {
        alerts.showError('系統錯誤', '伺服器發生錯誤 (500)，請稍後再試。');
      } else {
        alerts.showError('登入失敗', message);
      }
      setIsLoading(false);
    }
  };

  if (authChecking) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    // 1. 背景：統一使用 cubes 紋理 + 淺灰底色
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] px-4">
      
      {/* 2. 卡片：比照老師端樣式 (Padding, Shadow, Rounded) */}
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-xl w-full max-w-md text-center border-t-4 border-indigo-600 animate-fade-in relative">
        
        
        {/* 3. 圖示：學生專用 Icon (學士帽)，使用靛藍色系 */}
        <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl shadow-sm border border-indigo-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M12 14l9-5-9-5-9 5 9 5z" />
            <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0v6" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">學生學習登入</h1>
        <p className="text-gray-500 mb-8 text-sm">歡迎回來，請輸入學號與密碼</p>

        <form onSubmit={handleSubmit} className="space-y-5 text-left">
          
          {/* 學號輸入框 */}
          <div>
            <label htmlFor="account" className="block text-sm font-semibold text-gray-700 mb-1">
              學號
            </label>
            <input
              id="account"
              name="account"
              type="text"
              autoComplete="username"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              placeholder="請輸入您的學號"
              value={formData.account}
              onChange={handleChange}
            />
          </div>

          {/* 密碼輸入框 (含顯示/隱藏功能) */}
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

          {/* 登入按鈕 */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center mt-6 ${isLoading ? 'opacity-80 cursor-not-allowed' : 'hover:-translate-y-0.5'}`}
          >
            {isLoading ? (
              <>
                <LoadingSpinner size={20} color="white" />
                <span className="ml-2">登入中...</span>
              </>
            ) : (
              '登入'
            )}
          </button>
        </form>
        
        {/* 底部切換連結 (樣式統一，Icon 變更為藍色互動效果) */}
        <div className="mt-8 border-t border-gray-100 pt-6">
          <Link href="/panel" className="text-sm text-gray-500 hover:text-indigo-600 transition-colors flex items-center justify-center group">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 group-hover:text-indigo-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            切換至老師/管理員登入
          </Link>
        </div>

      </div>
    </div>
  );
}