'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '@/lib/firebase-client';
import { setSession } from '@/utils/session';
import alerts from '@/utils/alerts';
import LoadingSpinner from '@/components/LoadingSpinner';
import Dropdown from '@/components/ui/Dropdown';
import { signInWithSessionToken } from '@/utils/firebaseSessionAuth';
import { INDUSTRY_ID_PREFIX, PARTNER_SCHOOLS, REGISTER_GRADES } from '@/data/partnerSchools';
import {
  buildIndustryStudentId,
  buildSchoolStudentId,
  buildVisitorStudentId,
  getCurrentRocAcademicYear,
  getEntryYearPrefix,
  isValidCustomAccount,
} from '@/utils/studentRegistration';

type RegistrantType = 'school' | 'visitor' | 'professional';
type StepId = 'type' | 'profile' | 'name' | 'account' | 'email' | 'secure';

const STEPS: StepId[] = ['type', 'profile', 'name', 'account', 'email', 'secure'];

const TYPE_CARDS: {
  value: RegistrantType;
  title: string;
  desc: string;
  icon: string;
}[] = [
  {
    value: 'school',
    title: '合作學校學生',
    desc: '使用校內學號註冊，帳號與學號自動對應，只限用於校內課程',
    icon: 'fa-school',
  },
  {
    value: 'visitor',
    title: '校外在學',
    desc: '仍在就學、但不屬合作學校',
    icon: 'fa-user-graduate',
  },
  {
    value: 'professional',
    title: '業界人士',
    desc: '畢業生或社會人士',
    icon: 'fa-briefcase',
  },
];

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
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

const inputClass =
  'w-full px-4 py-3.5 bg-surface-containerLowest border border-outline-variant rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all outline-none text-on-surface placeholder:text-outline-variant text-base';

const labelClass = 'block text-sm font-semibold text-on-surface mb-2';

function stepTitle(step: StepId, type: RegistrantType): { title: string; subtitle: string } {
  switch (step) {
    case 'type':
      return { title: '建立您的帳號', subtitle: '先告訴我們您的身分，我們會引導後續步驟' };
    case 'profile':
      if (type === 'school') return { title: '學校資料', subtitle: '請填寫合作學校與校內資料' };
      if (type === 'visitor') return { title: '就學資料', subtitle: '請選擇目前年級，系統會編排學號' };
      return { title: '業界資料', subtitle: '選填服務單位，方便後續帳號管理' };
    case 'name':
      return { title: '您的姓名', subtitle: '請使用真實姓名，方便老師辨識' };
    case 'account':
      if (type === 'school') return { title: '確認帳號', subtitle: '合作學校學生的帳號即為平台學號' };
      return { title: '選擇登入帳號', subtitle: '之後請用這個帳號登入（不是 Email）' };
    case 'email':
      return { title: '電子郵件', subtitle: '用於通知與帳號找回；Google 註冊則以 Google 信箱為準' };
    case 'secure':
      return { title: '完成註冊', subtitle: '設定密碼，或直接使用 Google 完成' };
    default:
      return { title: '', subtitle: '' };
  }
}

export default function RegisterPage() {
  const [stepIndex, setStepIndex] = useState(0);
  const [registrantType, setRegistrantType] = useState<RegistrantType | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    schoolCode: PARTNER_SCHOOLS[0]?.code || '',
    schoolStudentNo: '',
    className: '',
    seatNumber: '',
    grade: '高一',
    customAccount: '',
    organization: '',
    jobTitle: '',
    agreeTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [stepError, setStepError] = useState('');

  const step = STEPS[stepIndex];
  const type = registrantType || 'school';

  const schoolOptions = useMemo(
    () => PARTNER_SCHOOLS.map((s) => ({ value: s.code, label: `${s.name}（${s.code}）` })),
    []
  );
  const gradeOptions = useMemo(
    () => REGISTER_GRADES.map((g) => ({ value: g, label: g })),
    []
  );

  const previewSchoolId =
    type === 'school' && form.schoolCode && form.schoolStudentNo.trim()
      ? buildSchoolStudentId(form.schoolCode, form.schoolStudentNo)
      : '';

  const previewVisitorId =
    type === 'visitor' && form.grade
      ? buildVisitorStudentId(getEntryYearPrefix(form.grade), 1).replace(/001$/, '***')
      : '';

  const previewIndustryId =
    type === 'professional'
      ? buildIndustryStudentId(getCurrentRocAcademicYear(), 1).replace(/001$/, '***')
      : '';

  const { title, subtitle } = stepTitle(step, type);
  const progress = ((stepIndex + 1) / STEPS.length) * 100;

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type: inputType, checked } = e.target;
    setForm((prev) => ({ ...prev, [name]: inputType === 'checkbox' ? checked : value }));
    setStepError('');
  };

  const registrationPayload = () => ({
    registrantType: type,
    name: form.name.trim(),
    email: form.email.trim(),
    password: form.password,
    agreeTerms: form.agreeTerms,
    schoolCode: form.schoolCode,
    schoolStudentNo: form.schoolStudentNo.trim(),
    className: form.className.trim(),
    seatNumber: form.seatNumber.trim(),
    grade: form.grade,
    customAccount: form.customAccount.trim(),
    organization: form.organization.trim(),
    jobTitle: form.jobTitle.trim(),
  });

  const finishRegister = async (data: {
    id: string;
    name: string;
    account: string;
    token?: string;
    needsEmailVerification?: boolean;
    emailSendFailed?: boolean;
  }) => {
    setSession({
      id: data.id,
      name: data.name,
      role: 'student',
      account: data.account,
    });
    if (data.token) await signInWithSessionToken(data.token);
    if (data.needsEmailVerification) {
      const q = new URLSearchParams();
      if (form.email.trim()) q.set('email', form.email.trim());
      if (data.emailSendFailed) q.set('sendFailed', '1');
      window.location.href = `/register/check-email?${q.toString()}`;
      return;
    }
    window.location.href = '/student';
  };

  const validateStep = (): boolean => {
    setStepError('');
    if (step === 'type') {
      if (!registrantType) {
        setStepError('請選擇一種身分繼續');
        return false;
      }
      return true;
    }
    if (step === 'profile') {
      if (type === 'school') {
        if (!form.schoolCode) {
          setStepError('請選擇合作學校');
          return false;
        }
        if (!form.schoolStudentNo.trim()) {
          setStepError('請填寫學校學號');
          return false;
        }
        if (!form.className.trim()) {
          setStepError('請填寫班級');
          return false;
        }
        if (!form.seatNumber.trim() || Number.isNaN(Number(form.seatNumber))) {
          setStepError('請填寫有效座號');
          return false;
        }
        if (!form.grade) {
          setStepError('請選擇年級');
          return false;
        }
      } else if (type === 'visitor') {
        if (!form.grade) {
          setStepError('請選擇年級');
          return false;
        }
      }
      // professional: org/title optional
      return true;
    }
    if (step === 'name') {
      if (!form.name.trim()) {
        setStepError('請填寫姓名');
        return false;
      }
      return true;
    }
    if (step === 'account') {
      if (type === 'school') return true;
      if (!isValidCustomAccount(form.customAccount.trim())) {
        setStepError('帳號需為 3～32 碼英數，可含 . _ -');
        return false;
      }
      return true;
    }
    if (step === 'email') {
      const email = form.email.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setStepError('請輸入有效的電子郵件');
        return false;
      }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep()) return;
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setStepError('');
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const onPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.agreeTerms) {
      setStepError('請先同意服務條款與隱私權政策');
      return;
    }
    if (form.password.length < 8) {
      setStepError('密碼至少需要 8 個字元');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setStepError('兩次輸入的密碼不一致');
      return;
    }
    setLoading(true);
    setStepError('');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registrationPayload()),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '註冊失敗');
      await finishRegister(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '註冊失敗';
      setStepError(message);
      alerts.showError('註冊失敗', message);
      setLoading(false);
    }
  };

  const onGoogleRegister = async () => {
    if (!form.agreeTerms) {
      setStepError('請先同意服務條款與隱私權政策');
      return;
    }
    setGoogleLoading(true);
    setStepError('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();

      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken,
          ...registrationPayload(),
          email: result.user.email || form.email,
          agreeTerms: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Google 註冊失敗');
      await finishRegister(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Google 註冊失敗';
      if (!message.includes('popup-closed') && !message.includes('cancelled')) {
        setStepError(message);
        alerts.showError('Google 註冊失敗', message);
      }
      setGoogleLoading(false);
    }
  };

  const busy = loading || googleLoading;

  const onStepKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && step !== 'secure') {
      e.preventDefault();
      goNext();
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 relative overflow-hidden bg-surface text-on-surface">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(at 40% 20%, hsla(223,100%,74%,0.15) 0px, transparent 50%), radial-gradient(at 80% 0%, hsla(189,100%,56%,0.15) 0px, transparent 50%), radial-gradient(at 0% 50%, hsla(239,100%,70%,0.15) 0px, transparent 50%)',
        }}
      />

      <div className="relative w-full max-w-xl rounded-2xl overflow-hidden border border-outline-variant/40 bg-surface-containerLowest shadow-elevate">
        {/* Progress */}
        <div className="h-1 bg-surface-containerLow">
          <div
            className="h-full bg-primary-container transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="p-8 md:p-10">
          <div className="mb-2 flex items-center justify-between text-xs font-mono text-on-surfaceVariant tracking-wider">
            <span>
              步驟 {stepIndex + 1}／{STEPS.length}
            </span>
            <Link href="/login" className="text-primary hover:underline font-sans font-semibold tracking-normal">
              已有帳號？登入
            </Link>
          </div>

          <h1 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight text-on-surface mb-2">
            {title}
          </h1>
          <p className="text-on-surfaceVariant mb-8">{subtitle}</p>

          <div className="min-h-[280px]" onKeyDown={onStepKeyDown}>
            {/* Step: type */}
            {step === 'type' ? (
              <div className="space-y-3">
                {TYPE_CARDS.map((card) => {
                  const selected = registrantType === card.value;
                  return (
                    <button
                      key={card.value}
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setRegistrantType(card.value);
                        setStepError('');
                      }}
                      className={`w-full text-left rounded-xl border-2 p-4 transition-all flex gap-4 items-start ${
                        selected
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-outline-variant hover:border-primary/40 hover:bg-surface-containerLow/60'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          selected ? 'bg-primary-container text-on-primary' : 'bg-surface-containerLow text-primary'
                        }`}
                      >
                        <i className={`fas ${card.icon}`} aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-on-surface">{card.title}</span>
                        <span className="block text-sm text-on-surfaceVariant mt-0.5">{card.desc}</span>
                      </span>
                      {selected ? (
                        <i className="fas fa-check-circle text-primary ml-auto mt-1" aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {/* Step: profile */}
            {step === 'profile' && type === 'school' ? (
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>合作學校</label>
                  <Dropdown
                    value={form.schoolCode}
                    onChange={(v) => {
                      setForm((prev) => ({ ...prev, schoolCode: v }));
                      setStepError('');
                    }}
                    options={schoolOptions}
                    placeholder="請選擇學校"
                    className="w-full"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="schoolStudentNo">
                    學校學號
                  </label>
                  <input
                    id="schoolStudentNo"
                    name="schoolStudentNo"
                    autoFocus
                    value={form.schoolStudentNo}
                    onChange={onChange}
                    disabled={busy}
                    className={inputClass}
                    placeholder="請輸入校內學號"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass} htmlFor="className">
                      班級
                    </label>
                    <input
                      id="className"
                      name="className"
                      value={form.className}
                      onChange={onChange}
                      disabled={busy}
                      className={inputClass}
                      placeholder="例：301"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="seatNumber">
                      座號
                    </label>
                    <input
                      id="seatNumber"
                      name="seatNumber"
                      value={form.seatNumber}
                      onChange={onChange}
                      disabled={busy}
                      className={inputClass}
                      placeholder="例：15"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>年級</label>
                  <Dropdown
                    value={form.grade}
                    onChange={(v) => setForm((prev) => ({ ...prev, grade: v }))}
                    options={gradeOptions}
                    placeholder="請選擇年級"
                    className="w-full"
                  />
                </div>
              </div>
            ) : null}

            {step === 'profile' && type === 'visitor' ? (
              <div className="space-y-5">
                <div>
                  <label className={labelClass}>目前年級</label>
                  <Dropdown
                    value={form.grade}
                    onChange={(v) => setForm((prev) => ({ ...prev, grade: v }))}
                    options={gradeOptions}
                    placeholder="請選擇年級"
                    className="w-full"
                  />
                  <p className="mt-3 text-sm text-on-surfaceVariant">
                    系統將依台灣學制推算入學年，學號格式約為{' '}
                    <span className="font-mono text-primary">{previewVisitorId || '—'}</span>
                  </p>
                </div>
              </div>
            ) : null}

            {step === 'profile' && type === 'professional' ? (
              <div className="space-y-5">
                <div>
                  <label className={labelClass} htmlFor="organization">
                    服務單位／公司（選填）
                  </label>
                  <input
                    id="organization"
                    name="organization"
                    autoFocus
                    value={form.organization}
                    onChange={onChange}
                    disabled={busy}
                    className={inputClass}
                    placeholder="例：○○科技、自由接案"
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="jobTitle">
                    職稱（選填）
                  </label>
                  <input
                    id="jobTitle"
                    name="jobTitle"
                    value={form.jobTitle}
                    onChange={onChange}
                    disabled={busy}
                    className={inputClass}
                    placeholder="例：工程師、教師"
                  />
                </div>
                <p className="text-sm text-on-surfaceVariant">
                  系統學號將獨立編排為{' '}
                  <span className="font-mono text-primary">{previewIndustryId}</span>
                  （前綴 <span className="font-mono">{INDUSTRY_ID_PREFIX}</span>）
                </p>
              </div>
            ) : null}

            {/* Step: name */}
            {step === 'name' ? (
              <div>
                <label className={labelClass} htmlFor="name">
                  姓名
                </label>
                <input
                  id="name"
                  name="name"
                  autoFocus
                  value={form.name}
                  onChange={onChange}
                  disabled={busy}
                  className={inputClass}
                  placeholder="請輸入您的全名"
                  autoComplete="name"
                />
              </div>
            ) : null}

            {/* Step: account */}
            {step === 'account' && type === 'school' ? (
              <div className="rounded-xl bg-surface-containerLow border border-outline-variant/50 p-6 text-center">
                <p className="text-sm text-on-surfaceVariant mb-2">您的平台帳號／學號</p>
                <p className="font-mono text-2xl md:text-3xl font-bold text-primary tracking-wide">
                  {previewSchoolId || '—'}
                </p>
                <p className="mt-4 text-sm text-on-surfaceVariant">之後請用此帳號登入（亦可使用 Email）</p>
              </div>
            ) : null}

            {step === 'account' && type !== 'school' ? (
              <div>
                <label className={labelClass} htmlFor="customAccount">
                  自訂帳號
                </label>
                <input
                  id="customAccount"
                  name="customAccount"
                  autoFocus
                  value={form.customAccount}
                  onChange={onChange}
                  disabled={busy}
                  className={inputClass}
                  placeholder="3～32 碼英數，可含 . _ -"
                  autoComplete="username"
                />
                <p className="mt-2 text-sm text-on-surfaceVariant">
                  {type === 'visitor'
                    ? `學號將約為 ${previewVisitorId || '—'}`
                    : `學號將約為 ${previewIndustryId}`}
                </p>
              </div>
            ) : null}

            {/* Step: email */}
            {step === 'email' ? (
              <div>
                <label className={labelClass} htmlFor="email">
                  電子郵件
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoFocus
                  value={form.email}
                  onChange={onChange}
                  disabled={busy}
                  className={inputClass}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>
            ) : null}

            {/* Step: secure */}
            {step === 'secure' ? (
              <form className="space-y-5" onSubmit={onPasswordSubmit}>
                <div>
                  <label className={labelClass} htmlFor="password">
                    密碼
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoFocus
                      minLength={8}
                      value={form.password}
                      onChange={onChange}
                      disabled={busy}
                      className={`${inputClass} pr-11`}
                      placeholder="至少 8 個字元"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute inset-y-0 right-0 pr-3 text-outline-variant"
                      onClick={() => setShowPassword((v) => !v)}
                      tabIndex={-1}
                    >
                      <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} aria-hidden />
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelClass} htmlFor="confirmPassword">
                    確認密碼
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? 'text' : 'password'}
                    minLength={8}
                    value={form.confirmPassword}
                    onChange={onChange}
                    disabled={busy}
                    className={inputClass}
                    placeholder="再輸入一次"
                    autoComplete="new-password"
                  />
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    id="agreeTerms"
                    name="agreeTerms"
                    type="checkbox"
                    checked={form.agreeTerms}
                    onChange={onChange}
                    disabled={busy}
                    className="mt-1 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-on-surfaceVariant leading-relaxed">
                    我同意本站服務條款與隱私權政策，並確認所填資料正確。
                  </span>
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className={`w-full py-3.5 px-4 rounded-full font-bold text-on-primary bg-primary-container hover:bg-primary transition-colors flex justify-center items-center gap-2 ${
                    busy ? 'opacity-80 cursor-not-allowed' : ''
                  }`}
                >
                  {loading ? (
                    <>
                      <LoadingSpinner size={20} color="white" />
                      <span>建立中...</span>
                    </>
                  ) : (
                    '建立帳號'
                  )}
                </button>

                <div className="relative flex items-center py-1">
                  <div className="flex-grow border-t border-outline-variant" />
                  <span className="flex-shrink-0 mx-4 text-xs font-mono uppercase tracking-wider text-outline">
                    或
                  </span>
                  <div className="flex-grow border-t border-outline-variant" />
                </div>

                <button
                  type="button"
                  disabled={busy}
                  onClick={onGoogleRegister}
                  className={`w-full py-3.5 px-4 rounded-full bg-surface-containerLowest border border-outline-variant text-on-surface flex justify-center items-center gap-2 hover:bg-surface-containerLow transition-colors ${
                    busy ? 'opacity-80 cursor-not-allowed' : ''
                  }`}
                >
                  {googleLoading ? (
                    <>
                      <LoadingSpinner size={20} />
                      <span>Google 註冊中...</span>
                    </>
                  ) : (
                    <>
                      <GoogleIcon />
                      使用 Google 完成註冊
                    </>
                  )}
                </button>
              </form>
            ) : null}

            {stepError ? (
              <p className="mt-4 text-sm text-error" role="alert">
                {stepError}
              </p>
            ) : null}
          </div>

          {/* Footer nav — Google-like */}
          {step !== 'secure' ? (
            <div className="mt-10 flex items-center justify-between gap-4">
              {stepIndex > 0 ? (
                <button
                  type="button"
                  onClick={goBack}
                  disabled={busy}
                  className="px-4 py-2.5 text-primary font-semibold hover:bg-primary/5 rounded-full transition-colors"
                >
                  返回
                </button>
              ) : (
                <span />
              )}
              <button
                type="button"
                onClick={goNext}
                disabled={busy}
                className="ml-auto px-8 py-2.5 rounded-full font-bold text-on-primary bg-primary-container hover:bg-primary transition-colors"
              >
                下一步
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <button
                type="button"
                onClick={goBack}
                disabled={busy}
                className="px-4 py-2.5 text-primary font-semibold hover:bg-primary/5 rounded-full transition-colors"
              >
                返回
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
