'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function VerifyEmailPage() {
  const params = useParams();
  const token = String(params?.token || '');
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('正在驗證信箱...');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('缺少驗證代碼');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/auth/verify-email/${token}`, { method: 'POST' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || '驗證失敗');
        if (!cancelled) {
          setStatus('ok');
          setMessage(data.message || '信箱驗證成功');
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setMessage(err instanceof Error ? err.message : '驗證失敗');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-surface text-on-surface">
      <div className="w-full max-w-md rounded-2xl border border-outline-variant/40 bg-surface-containerLowest p-8 shadow-elevate text-center">
        {status === 'loading' ? (
          <div className="flex flex-col items-center gap-4">
            <LoadingSpinner size={32} />
            <p className="text-on-surfaceVariant">{message}</p>
          </div>
        ) : null}

        {status === 'ok' ? (
          <>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-secondary/15 text-secondary text-2xl">
              <i className="fas fa-check" aria-hidden />
            </div>
            <h1 className="font-display text-2xl font-extrabold mb-2">驗證完成</h1>
            <p className="text-on-surfaceVariant mb-6">{message}</p>
            <Link
              href="/student"
              className="inline-flex w-full justify-center py-3 rounded-full font-bold text-on-primary bg-primary-container hover:bg-primary transition-colors"
            >
              進入學生平台
            </Link>
            <Link href="/login" className="block mt-3 text-sm text-primary hover:underline">
              或前往登入
            </Link>
          </>
        ) : null}

        {status === 'error' ? (
          <>
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-error/10 text-error text-2xl">
              <i className="fas fa-exclamation" aria-hidden />
            </div>
            <h1 className="font-display text-2xl font-extrabold mb-2">驗證失敗</h1>
            <p className="text-on-surfaceVariant mb-6">{message}</p>
            <Link
              href="/register/check-email"
              className="inline-flex w-full justify-center py-3 rounded-full font-bold text-on-primary bg-primary-container hover:bg-primary transition-colors"
            >
              重寄驗證信
            </Link>
            <Link href="/login" className="block mt-3 text-sm text-primary hover:underline">
              返回登入
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
