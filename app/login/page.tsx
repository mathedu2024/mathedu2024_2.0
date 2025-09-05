'use client';

import { useState } from 'react';
import Link from 'next/link';
import { setSession } from '../utils/session';
import alerts from '../utils/alerts';
import LoadingSpinner from '../components/LoadingSpinner';

export default function StudentLoginPage() {
  // Removed unused router variable
  const [formData, setFormData] = useState({
    account: '', // This will be treated as account
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (error) {
      setError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, loginType: 'student' }),
        credentials: 'include',
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
      
      setSession({
        id: data.id,
        name: data.name,
        role: 'student',
        account: formData.account,
      });

      window.location.href = '/student';
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '發生未知錯誤';
      setError(message);
      
      // 根據錯誤類型顯示對應的 SweetAlert2 對話框
      if (message.includes('Invalid password') || message.includes('密碼')) {
        alerts.showPasswordError();
      } else if (message.includes('Account not found') || message.includes('查無') || message.includes('not found')) {
        alerts.showAccountNotFound();
      } else if (message.includes('伺服器錯誤') || message.includes('伺服器回傳格式錯誤')) {
        alerts.showErrorCode('500');
      } else {
        alerts.showError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl flex flex-row bg-white shadow-2xl rounded-2xl overflow-hidden">
        {/* Left Panel - Decorative */}
        <div className="w-1/2 bg-blue-600 p-12 text-white hidden md:flex flex-col justify-center items-center text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M12 14l9-5-9-5-9 5 9 5z" />
              <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
              <path d="M12 14l9-5-9-5-9 5 9 5zm0 0v6" />
            </svg>
            <h1 className="text-4xl font-bold mb-3">歡迎回來！</h1>
            <p className="text-xl">登入以繼續您的學習旅程</p>
        </div>

        {/* Right Panel - Login Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">學生登入</h2>
              <p className="text-gray-600 text-lg">請輸入您的帳號和密碼</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label
                  htmlFor="account"
                  className="block text-sm font-medium text-gray-700"
                >
                  學號
                </label>
                <div className="mt-1">
                  <input
                    id="account"
                    name="account"
                    type="text"
                    autoComplete="account"
                    required
                    value={formData.account}
                    onChange={handleChange}
                    className="block w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    placeholder="請輸入您的學號"
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-base font-medium text-gray-700 mb-2">密碼</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="請輸入您的密碼"
                    value={formData.password}
                    onChange={handleChange}
                    className="block w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition pr-10"
                    required
                    autoComplete="current-password"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-600 focus:outline-none hover:text-gray-800"
                    tabIndex={-1}
                    disabled={isLoading}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12.001C3.226 16.273 7.24 19.5 12 19.5c1.658 0 3.237-.336 4.646-.94M21 12.001c-.362-1.007-.893-1.957-1.573-2.803M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              
              {error && (
                <div className="text-red-600 text-sm font-medium text-center bg-red-50 border border-red-200 rounded-lg py-2 px-4">
                  {error}
                </div>
              )}
              
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 mt-2 btn-primary text-lg"
              >
                {isLoading ? (
                  <LoadingSpinner size={20} color="white" text="登入中..." />
                ) : (
                  '登入'
                )}
              </button>
            </form>

            <div className="mt-6 text-center">
              <Link 
                href="/panel" 
                className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                老師/管理員登入
              </Link>
            </div>
        </div>
      </div>
    </div>
  );
}
