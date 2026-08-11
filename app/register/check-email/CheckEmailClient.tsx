'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import LoadingSpinner from '@/components/LoadingSpinner';

export default function CheckEmailClient() {
  const searchParams = useSearchParams();
  const email = useMemo(() => String(searchParams.get('email') || '').trim(), [searchParams]);
  const sendFailed = searchParams.get('sendFailed') === '1';

  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    sendFailed ? '驗證信寄送失敗，請點下方按鈕重試。' : ''
  );
  const [error, setError] = useState('');

  const resend = async () => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '重寄失敗');
      setMessage(data.message || '驗證信已寄出');
    } catch (err) {
      setError(err instanceof Error ? err.message : '重寄失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-surface text-on-surface">
      <div className="w-full max-w-md rounded-2xl border border-outline-variant/40 bg-surface-containerLowest p-8 shadow-elevate text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary text-2xl">
          <i className="fas fa-envelope-open-text" aria-hidden />
        </div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight mb-2">請驗證您的信箱</h1>
        <p className="text-on-surfaceVariant mb-6">
          帳號已建立。我們已寄出驗證信
          {email ? (
            <>
              至 <span className="font-semibold text-on-surface">{email}</span>
            </>
          ) : null}
          ，請點信中連結完成驗證後再使用輔導預約等功能。
        </p>

        {message ? <p className="mb-4 text-sm text-secondary">{message}</p> : null}
        {error ? <p className="mb-4 text-sm text-error">{error}</p> : null}

        <div className="space-y-3">
          <button
            type="button"
            disabled={busy}
            onClick={resend}
            className="w-full py-3 rounded-full font-bold text-on-primary bg-primary-container hover:bg-primary transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {busy ? (
              <>
                <LoadingSpinner size={18} color="white" />
                寄送中...
              </>
            ) : (
              '重寄驗證信'
            )}
          </button>
          <Link
            href="/student"
            className="block w-full py-3 rounded-full border border-outline-variant font-semibold text-on-surface hover:bg-surface-containerLow transition-colors"
          >
            稍後再驗證，先進入平台
          </Link>
          <Link href="/login" className="block text-sm text-primary hover:underline pt-2">
            返回登入
          </Link>
        </div>
      </div>
    </div>
  );
}
