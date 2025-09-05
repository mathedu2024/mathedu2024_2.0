'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { setSession } from '../utils/session';
import alerts from '../utils/alerts';
import LoadingSpinner from '../components/LoadingSpinner';

export default function PanelLoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    role: 'teacher', // Default, though API will determine final role
    account: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    console.log('Panel - Starting login process...');

    try {
      console.log('Panel - Sending login request with:', { account: formData.account, password: formData.password, loginType: 'admin' });
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account: formData.account,
          password: formData.password,
          loginType: 'admin', // Use a single type for panel login
        }),
      });

      console.log('Panel - Response status:', response.status);
      console.log('Panel - Response headers:', response.headers);

      let data = null;
      try {
        const contentType = response.headers.get('content-type');
        console.log('Panel - Content-Type:', contentType);
        if (contentType && contentType.includes('application/json')) {
          data = await response.json();
          console.log('Panel - Response data:', data);
        } else {
          const textResponse = await response.text();
          console.log('Panel - Non-JSON response:', textResponse);
          throw new Error('伺服器回傳格式錯誤');
        }
      } catch (e) {
        console.error('Panel - Error parsing response:', e);
        throw new Error('伺服器錯誤，請稍後再試');
      }

      if (!response.ok) {
        console.error('Panel - Login failed:', data);
        throw new Error((data && data.error) || '登入失敗');
      }

      console.log('Panel - Login successful, data:', data);

      // The API returns the authoritative role
      if (data.role.includes('student')) {
         throw new Error('學生帳號請由學生登入頁面登入。');
      }

      const sessionData = {
        id: data.id,
        name: data.name,
        role: data.role,
        account: formData.account,
        currentRole: formData.role,
      };
      console.log('Panel - Setting session:', sessionData);
      setSession(sessionData);

      console.log('Panel - Session set, checking localStorage...');
      const storedSession = localStorage.getItem('user_session');
      console.log('Panel - Stored session:', storedSession);

      console.log('Panel - Redirecting to /back-panel');
      router.push('/back-panel');
    } catch (err: unknown) {
      console.error('Panel - Login error:', err);
      const message = err instanceof Error ? err.message : '發生未知錯誤';
      setError(message);
      
      // 根據錯誤類型顯示對應的 SweetAlert2 對話框
      if (message.includes('Invalid password') || message.includes('密碼')) {
        alerts.showPasswordError();
      } else if (message.includes('Account not found') || message.includes('查無') || message.includes('not found')) {
        alerts.showAccountNotFound();
      } else if (message.includes('學生帳號請由學生登入頁面登入')) {
        alerts.showError(message);
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
        {/* Left Panel */}
        <div className="w-1/2 bg-blue-600 p-12 text-white hidden md:flex flex-col justify-center items-center text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mb-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0112 20.055a11.952 11.952 0 01-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0v6" />
            </svg>
            <h1 className="text-4xl font-bold mb-3">高中學習資源教育網</h1>
            <p className="text-xl">管理後台</p>
        </div>

        {/* Right Panel - Login Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">管理員/老師登入</h2>
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="role" className="block text-base font-medium text-gray-700 mb-2">
                身分
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="block w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
              >
                <option value="teacher">老師</option>
                <option value="admin">管理員</option>
              </select>
            </div>
            
            <div>
              <label htmlFor="account" className="block text-base font-medium text-gray-700 mb-2">
                帳號
              </label>
              <div className="mt-1">
                <input
                  id="account"
                  name="account"
                  type="text"
                  autoComplete="account"
                  required
                  className="block w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  placeholder="請輸入您的帳號"
                  value={formData.account}
                  onChange={handleChange}
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="password" className="block text-base font-medium text-gray-700 mb-2">
                密碼
              </label>
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
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-600 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12.001C3.226 16.273 7.24 19.5 12 19.5c1.658 0 3.237-.336 4.646-.94M21 12.001c-.362-1.007-.893-1.957-1.573-2.803M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12s3.75-7.5 9.75-7.5 9.75 7.5 9.75 7.5-3.75 7.5-9.75 7.5S2.25 12 2.25 12z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && <div className="text-red-500 text-center text-sm font-semibold border border-red-200 bg-red-50 py-2 rounded-lg">{error}</div>}
            
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 mt-2 btn-primary text-lg"
            >
              {isLoading ? (
                <LoadingSpinner size={20} color="white" text="載入中..." />
              ) : '登入'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
