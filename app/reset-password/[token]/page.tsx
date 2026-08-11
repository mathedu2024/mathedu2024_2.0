'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function ResetPasswordPage() {
  const params = useParams();
  const token = String(params?.token || '');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState('');
  const [loginPath, setLoginPath] = useState('/login');
  const [forgotPath, setForgotPath] = useState('/forgot-password');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('缺少重設代碼');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/reset-password/${token}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || '連結無效');
        if (!cancelled) {
          setAccount(data.account || '');
          const isTeacher = data.userType === 'teacher';
          setLoginPath(isTeacher ? '/login?role=teacher' : '/login');
          setForgotPath(isTeacher ? '/panel/forgot-password' : '/forgot-password');
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : '載入失敗');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('兩次輸入的密碼不一致');
      return;
    }
    if (password.length < 6) {
      setError('新密碼至少需 6 個字元');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/reset-password/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '重設失敗');
      setLoginPath(data.loginPath || loginPath);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重設失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] px-3 sm:px-4 py-6">
      <div className="bg-white p-6 sm:p-8 md:p-10 rounded-2xl shadow-xl w-full max-w-md border-t-4 border-primary">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">重設密碼</h1>
        <p className="text-gray-500 mb-6 text-sm text-center">請輸入您的新密碼</p>

        {loading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size={28} color="blue" />
          </div>
        ) : done ? (
          <div className="space-y-4 text-center">
            <p className="text-emerald-700 text-sm bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
              密碼已更新，請使用新密碼登入。
            </p>
            <Link
              href={loginPath}
              className="block w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl"
            >
              前往登入
            </Link>
          </div>
        ) : error && !account ? (
          <div className="text-center space-y-4">
            <p className="text-red-600 text-sm">{error}</p>
            <Link href={forgotPath} className="text-primary text-sm hover:underline">
              重新申請重設連結
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {account && (
              <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                帳號：<span className="font-mono font-semibold">{account}</span>
              </p>
            )}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">新密碼</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="至少 6 個字元"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">確認新密碼</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="再次輸入新密碼"
              />
            </div>
            {error && <p className="text-sm text-red-600 text-center">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl flex items-center justify-center disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <LoadingSpinner size={18} color="white" />
                  <span className="ml-2">更新中...</span>
                </>
              ) : (
                '確認重設'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
