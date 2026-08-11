'use client';

import { useState } from 'react';
import Link from 'next/link';
import LoadingSpinner from '@/components/LoadingSpinner';

type UserType = 'student' | 'teacher';

type Props = {
  userType: UserType;
};

export default function ForgotPasswordForm({ userType }: Props) {
  const [account, setAccount] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isStudent = userType === 'student';
  const loginHref = '/login';
  const title = isStudent ? '學生忘記密碼' : '管理端忘記密碼';
  const subtitle = isStudent
    ? '輸入學號後，我們會寄送重設連結至綁定的電子郵件'
    : '輸入帳號後，我們會寄送重設連結至綁定的電子郵件';
  const accountLabel = isStudent ? '學號' : '帳號';
  const accountPlaceholder = isStudent ? '請輸入您的學號' : '請輸入您的帳號';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: account.trim(), userType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '送出失敗');
      setMessage(data.message || '若帳號存在且已設定電子郵件，重設密碼信將寄至該信箱。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '送出失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] px-3 sm:px-4 py-6">
      <div className="bg-white p-6 sm:p-8 md:p-10 rounded-2xl shadow-xl w-full max-w-md border-t-4 border-primary">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">{title}</h1>
        <p className="text-gray-500 mb-6 text-sm text-center">{subtitle}</p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{accountLabel}</label>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              required
              autoComplete="username"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder={accountPlaceholder}
            />
          </div>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}
          {message && (
            <p className="text-sm text-emerald-700 text-center bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl flex items-center justify-center disabled:opacity-70"
          >
            {loading ? (
              <>
                <LoadingSpinner size={18} color="white" />
                <span className="ml-2">送出中...</span>
              </>
            ) : (
              '寄送重設連結'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link href={loginHref} className="text-sm text-gray-500 hover:text-primary">
            返回登入
          </Link>
        </div>
      </div>
    </div>
  );
}
