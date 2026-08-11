'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';
import { DEFAULT_ACCOUNT_PASSWORD } from '@/utils/accountDefaults';

export default function TeacherInviteClaimPage() {
  const params = useParams();
  const token = String(params?.token || '');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ name: string; email: string; roles: string[] } | null>(null);
  const [account, setAccount] = useState('');
  const [done, setDone] = useState<{ account: string; defaultPassword: string } | null>(null);

  useEffect(() => {
    if (!token) {
      setError('缺少邀請代碼');
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/invite/teacher/${token}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || '無法載入邀請');
        if (!cancelled) setInvite({ name: data.name, email: data.email, roles: data.roles || [] });
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
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/invite/teacher/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, account: account.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '開通失敗');
      setDone({
        account: data.account,
        defaultPassword: data.defaultPassword || DEFAULT_ACCOUNT_PASSWORD,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '開通失敗');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center bg-gray-50 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] px-3 sm:px-4 py-6">
      <div className="bg-white p-6 sm:p-8 md:p-10 rounded-2xl shadow-xl w-full max-w-md border-t-4 border-primary">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">教師帳號開通</h1>
        <p className="text-gray-500 mb-6 text-sm text-center">請設定您的登入帳號名稱</p>

        {loading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner size={28} color="blue" />
          </div>
        ) : done ? (
          <div className="space-y-4 text-left">
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-emerald-900 text-sm">
              <p className="font-bold mb-2">開通成功！</p>
              <p>您的登入帳號：<span className="font-mono font-semibold">{done.account}</span></p>
              <p className="mt-2">
                預設密碼為：
                <span className="font-mono font-bold text-emerald-800"> {done.defaultPassword}</span>
              </p>
              <p className="mt-2 text-emerald-800/90">請立即登入後台並修改密碼。</p>
            </div>
            <Link
              href="/login?role=teacher"
              className="block w-full text-center bg-primary hover:bg-primary-hover text-white font-bold py-3 rounded-xl"
            >
              前往登入
            </Link>
          </div>
        ) : error && !invite ? (
          <div className="text-center space-y-4">
            <p className="text-red-600 text-sm">{error}</p>
            <Link href="/login?role=teacher" className="text-primary text-sm hover:underline">
              返回登入頁
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm text-slate-700 space-y-1">
              <p>
                姓名：<span className="font-semibold">{invite?.name}</span>
              </p>
              <p>
                信箱：<span className="font-mono">{invite?.email}</span>
              </p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">登入帳號名稱</label>
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                required
                pattern="[A-Za-z0-9]+"
                title="僅限英文字母與數字"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                placeholder="請輸入英數組合帳號"
              />
              <p className="text-xs text-gray-500 mt-1">僅限英文字母與數字，開通後不可自行更改。</p>
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
                  <span className="ml-2">開通中...</span>
                </>
              ) : (
                '確認開通'
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
