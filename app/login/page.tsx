'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { setSession } from '@/utils/session';
import alerts from '@/utils/alerts';
import LoadingSpinner from '@/components/LoadingSpinner';
import Dropdown from '@/components/ui/Dropdown';
import { signInWithSessionToken } from '@/utils/firebaseSessionAuth';
import {
  STUDENT_LOGIN_NEXT_KEY,
  consumeStudentLoginNext,
  isSafeStudentNextPath,
  rememberStudentLoginNext,
  sanitizeStudentLoginNext,
} from '@/utils/studentLoginRedirect';

type LoginRole = 'student' | 'teacher' | 'admin' | 'author';

const ROLE_OPTIONS: { value: LoginRole; label: string }[] = [
  { value: 'student', label: '學生' },
  { value: 'teacher', label: '老師' },
  { value: 'admin', label: '管理員' },
  { value: 'author', label: '作者' },
];

function parseRoleParam(raw: string | null): LoginRole | null {
  if (!raw) return null;
  const v = raw.toLowerCase();
  if (v === 'student' || v === '學生') return 'student';
  if (v === 'teacher' || v === '老師') return 'teacher';
  if (v === 'admin' || v === '管理員') return 'admin';
  if (v === 'author' || v === '作者') return 'author';
  if (v === 'panel' || v === 'staff' || v === 'manage') return 'teacher';
  return null;
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function UnifiedLoginPage() {
  const [formData, setFormData] = useState({
    role: 'student' as LoginRole,
    account: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roleFromQuery = parseRoleParam(params.get('role'));
    if (roleFromQuery) {
      setFormData((prev) => ({ ...prev, role: roleFromQuery }));
    }

    const fromQuery = params.get('next');
    if (isSafeStudentNextPath(fromQuery)) {
      rememberStudentLoginNext(fromQuery as string);
      return;
    }
    if (!roleFromQuery || roleFromQuery === 'student') {
      if (!isSafeStudentNextPath(fromQuery)) {
        try {
          sessionStorage.removeItem(STUDENT_LOGIN_NEXT_KEY);
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const isStudent = formData.role === 'student';

  const forgotHref = isStudent ? '/forgot-password' : '/panel/forgot-password';

  const accountPlaceholder = isStudent ? '請輸入帳號（學號或 Email）' : '請輸入帳號';

  const resolveStudentPostLoginPath = () => {
    if (typeof window === 'undefined') return '/student';
    const fromQuery = new URLSearchParams(window.location.search).get('next');
    const fromStorage = consumeStudentLoginNext();
    const preferred = isSafeStudentNextPath(fromQuery) ? fromQuery : fromStorage;
    return sanitizeStudentLoginNext(preferred, '/student');
  };

  const finishLogin = async (data: {
    id: string;
    name: string;
    role: string | string[];
    account: string;
    token?: string;
    currentRole?: string;
  }) => {
    if (formData.role === 'student' || data.currentRole === 'student') {
      setSession({
        id: data.id,
        name: data.name,
        role: 'student',
        account: data.account,
      });
      if (data.token) await signInWithSessionToken(data.token);
      window.location.href = resolveStudentPostLoginPath();
      return;
    }

    setSession({
      id: data.id,
      name: data.name,
      role: data.role,
      account: data.account,
      currentRole: formData.role,
    });
    if (data.token) await signInWithSessionToken(data.token);
    window.location.href = '/back-panel';
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value: string) => {
    setFormData((prev) => ({ ...prev, role: value as LoginRole }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account: formData.account,
          password: formData.password,
          loginType: formData.role,
        }),
      });

      let data: {
        error?: string;
        id?: string;
        name?: string;
        role?: string | string[];
        account?: string;
        token?: string;
        currentRole?: string;
      } | null = null;

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

      await finishLogin({
        id: data!.id!,
        name: data!.name!,
        role: data!.role!,
        account: data!.account || formData.account,
        token: data!.token,
        currentRole: data!.currentRole,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '發生未知錯誤';
      if (message.includes('Invalid password') || message.includes('密碼')) {
        alerts.showError('登入失敗', '密碼錯誤，請檢查後再試。');
      } else if (
        message.includes('Account not found') ||
        message.includes('查無') ||
        message.includes('不存在') ||
        message.includes('not found')
      ) {
        alerts.showError('登入失敗', '查無此帳號，請確認輸入是否正確。');
      } else if (message.includes('Google')) {
        alerts.showError('登入失敗', message);
      } else if (message.includes('伺服器錯誤')) {
        alerts.showError('系統錯誤', '伺服器發生錯誤，請稍後再試。');
      } else {
        alerts.showError('登入失敗', message);
      }
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Google 登入失敗');
      }

      setFormData((prev) => ({ ...prev, role: 'student' }));
      await finishLogin({
        id: data.id,
        name: data.name,
        role: data.role,
        account: data.account,
        token: data.token,
        currentRole: 'student',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google 登入失敗';
      if (!message.includes('popup-closed') && !message.includes('cancelled')) {
        if (message.includes('註冊頁')) {
          alerts.showError(
            '尚未註冊',
            '此 Google 帳號尚無學生資料。請先至註冊頁填寫學校或訪客資料後再完成註冊。'
          );
        } else {
          alerts.showError('Google 登入失敗', message);
        }
      }
      setGoogleLoading(false);
    }
  };

  const busy = isLoading || googleLoading;

  return (
    <div className="min-h-[calc(100vh-64px)] flex flex-col relative overflow-hidden bg-surface text-on-surface">
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[60%] bg-surface-containerHigh rounded-full blur-[120px] opacity-60" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[50%] bg-surface-variant rounded-full blur-[100px] opacity-40" />
      </div>

      <main className="flex-grow flex items-center justify-center p-4 md:p-10 z-10 relative">
        <div className="w-full max-w-md bg-surface-containerLowest rounded-xl shadow-card border border-outline-variant overflow-hidden">
          <div className="p-8 pb-6 text-center border-b border-outline-variant/30">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-surface-containerLow mb-4 text-primary text-3xl">
              <i className="fas fa-square-root-alt" aria-hidden />
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-extrabold text-on-surface mb-2 tracking-tight">
              高中學習資源教育網 2.0
            </h1>
            <p className="text-on-surfaceVariant text-base md:text-lg">歡迎回來，準備好繼續學習了嗎？</p>
          </div>

          <div className="p-8 pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-on-surface mb-2" htmlFor="role">
                  登入身分
                </label>
                <Dropdown
                  value={formData.role}
                  onChange={handleRoleChange}
                  options={ROLE_OPTIONS}
                  placeholder="請選擇身分"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-on-surface mb-2" htmlFor="account">
                  帳號
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline-variant">
                    <i className="fas fa-user" aria-hidden />
                  </div>
                  <input
                    id="account"
                    name="account"
                    type="text"
                    autoComplete="username"
                    required
                    className="block w-full pl-10 pr-3 py-3 border border-outline-variant rounded-lg bg-surface text-on-surface placeholder:text-on-surfaceVariant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    placeholder={accountPlaceholder}
                    value={formData.account}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-on-surface" htmlFor="password">
                    密碼
                  </label>
                  <Link
                    href={forgotHref}
                    className="text-sm text-primary hover:text-primary-hover transition-colors"
                  >
                    忘記密碼？
                  </Link>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-outline-variant">
                    <i className="fas fa-lock" aria-hidden />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-10 py-3 border border-outline-variant rounded-lg bg-surface text-on-surface placeholder:text-on-surfaceVariant/50 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-outline-variant hover:text-on-surface transition-colors"
                    tabIndex={-1}
                    aria-label={showPassword ? '隱藏密碼' : '顯示密碼'}
                  >
                    <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className={`w-full flex justify-center items-center py-3 px-4 rounded-lg font-semibold text-on-primary bg-primary-container hover:bg-primary shadow-sm hover:shadow-elevate transition-all duration-200 ${
                  busy ? 'opacity-80 cursor-not-allowed' : 'hover:-translate-y-0.5'
                }`}
              >
                {isLoading ? (
                  <>
                    <LoadingSpinner size={20} color="white" />
                    <span className="ml-2">登入中...</span>
                  </>
                ) : (
                  <>
                    登入
                    <i className="fas fa-arrow-right ml-2 text-sm" aria-hidden />
                  </>
                )}
              </button>
            </form>

            {isStudent && (
              <div className="mt-8">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-outline-variant" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-surface-containerLowest text-on-surfaceVariant">
                      或使用其他方式登入
                    </span>
                  </div>
                </div>
                <div className="mt-6">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleGoogleLogin()}
                    className="w-full flex justify-center items-center py-3 px-4 border border-outline-variant rounded-lg bg-surface text-on-surface hover:bg-surface-containerLow transition-colors disabled:opacity-70"
                  >
                    {googleLoading ? (
                      <>
                        <LoadingSpinner size={18} color="blue" />
                        <span className="ml-2">連接 Google 中...</span>
                      </>
                    ) : (
                      <>
                        <GoogleIcon />
                        使用 Google 帳號登入
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 bg-surface-containerLow border-t border-outline-variant/30 text-center">
            <p className="text-on-surfaceVariant text-sm md:text-base">
              還沒有帳號嗎？{' '}
              <Link href="/register" className="font-bold text-primary hover:text-primary-hover hover:underline">
                立即註冊
              </Link>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
