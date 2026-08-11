'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useStudentInfo } from '@/student/StudentInfoContext';
import { fetchStudentProfile } from '@/utils/studentClientApi';

/**
 * 校外／業界帳密註冊後未驗證信箱時顯示。
 * 既有帳號或 emailVerified !== false 不顯示。
 */
export default function StudentEmailVerifyBanner() {
  const { studentInfo } = useStudentInfo();
  const [needsVerify, setNeedsVerify] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const refresh = useCallback(async () => {
    if (!studentInfo?.id) {
      setNeedsVerify(false);
      return;
    }
    try {
      const profile = await fetchStudentProfile(studentInfo.id);
      const unverified = profile?.emailVerified === false;
      setNeedsVerify(Boolean(unverified));
      setEmail(String(profile?.email || studentInfo.email || ''));
    } catch {
      setNeedsVerify(false);
    }
  }, [studentInfo?.id, studentInfo?.email]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!needsVerify) return null;

  const resend = async () => {
    setBusy(true);
    setMsg('');
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || '重寄失敗');
      setMsg(data.message || '驗證信已寄出');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '重寄失敗');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-3 mt-3 md:mx-6 rounded-xl border border-amber-300/80 bg-amber-50 text-amber-950 px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 text-sm">
        <p className="font-semibold">請先驗證電子郵件</p>
        <p className="opacity-90 mt-0.5">
          未驗證前無法使用輔導預約等功能。
          {email ? <> 信箱：{email}</> : null}
          {msg ? <span className="block mt-1">{msg}</span> : null}
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          type="button"
          disabled={busy}
          onClick={resend}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {busy ? '寄送中...' : '重寄驗證信'}
        </button>
        <Link
          href={`/register/check-email${email ? `?email=${encodeURIComponent(email)}` : ''}`}
          className="px-3 py-1.5 rounded-lg text-sm font-semibold border border-amber-400 hover:bg-amber-100"
        >
          說明
        </Link>
      </div>
    </div>
  );
}
