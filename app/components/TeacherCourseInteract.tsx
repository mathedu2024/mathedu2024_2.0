'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ClockIcon,
  UserGroupIcon,
  XMarkIcon,
  ArrowPathIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import PageLoadingArea from '@/components/ui/PageLoadingArea';
import CreateAttendanceActivityForm from '@/components/CreateAttendanceActivityForm';
import AttendanceQrDisplay from '@/components/AttendanceQrDisplay';
import { collection, onSnapshot } from 'firebase/firestore';
import { db as clientDb } from '@/lib/firebase-client';

export type InteractMode = 'attendance' | 'draw';

type CourseInfo = {
  id: string;
  name: string;
  code: string;
};

type RosterStudent = {
  id: string;
  studentId: string;
  name: string;
};

type AttendanceActivity = {
  id: string;
  title: string;
  status: string;
  checkInMethod?: string;
  checkInCode?: string | null;
  displayCheckInCode?: string | null;
  endTime?: string | null;
  present?: number;
  expected?: number;
};

type AttendanceStatus = 'present' | 'late' | 'leave' | 'absent' | '';

type LiveStudentRow = {
  id: string;
  studentId: string;
  name: string;
  status: AttendanceStatus;
  leaveType?: string;
};

function normalizeLiveStatus(raw: string): AttendanceStatus {
  const s = (raw || '').trim();
  if (s === 'present' || s === '出席') return 'present';
  if (s === 'late' || s === '遲到') return 'late';
  if (s === 'leave' || s === '請假') return 'leave';
  if (s === 'absent' || s === '曠課') return 'absent';
  return '';
}

function statusRank(status: AttendanceStatus): number {
  if (status === 'present') return 0;
  if (status === 'late') return 1;
  if (status === 'leave') return 2;
  if (status === 'absent') return 3;
  return 4;
}

function statusLabel(status: AttendanceStatus, leaveType?: string): string {
  if (status === 'present') return '出席';
  if (status === 'late') return '遲到';
  if (status === 'leave') return leaveType || '請假';
  if (status === 'absent') return '曠課';
  return '未簽到';
}

function statusPillClass(status: AttendanceStatus): string {
  if (status === 'present') return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40';
  if (status === 'late') return 'bg-amber-500/20 text-amber-300 border-amber-400/40';
  if (status === 'leave') return 'bg-violet-500/20 text-violet-300 border-violet-400/40';
  if (status === 'absent') return 'bg-red-500/20 text-red-300 border-red-400/40';
  return 'bg-white/10 text-white/45 border-white/15';
}

const MODES: {
  id: InteractMode;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}[] = [
  { id: 'attendance', label: '點名', Icon: ClockIcon },
  { id: 'draw', label: '抽人', Icon: UserGroupIcon },
];

function randomPick<T>(items: T[]): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)] ?? null;
}

function AttendancePanel({ courseId }: { courseId: string }) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<AttendanceActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [baseStudents, setBaseStudents] = useState<
    Array<{ id: string; studentId: string; name: string }>
  >([]);
  const [statusById, setStatusById] = useState<
    Map<string, { status: AttendanceStatus; leaveType?: string; name?: string }>
  >(new Map());
  const [listenError, setListenError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadActivities = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/attendance/activities/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      });
      if (!res.ok) throw new Error('載入點名活動失敗');
      const data = await res.json();
      const list = (Array.isArray(data) ? data : []) as AttendanceActivity[];
      setActivities(list.filter((a) => a.status === 'active' || a.status === 'upcoming'));
    } catch (e) {
      setError(e instanceof Error ? e.message : '載入失敗');
      setActivities([]);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [courseId]);

  const active = activities.find((a) => a.status === 'active') ?? null;
  const method = String(active?.checkInMethod || '').toLowerCase();
  const isQr = method === 'qr';
  const isNumeric = method === 'numeric' || method === 'digital';
  const code = active?.displayCheckInCode || active?.checkInCode || '';

  // 班級名單只載入一次（顯示姓名用），之後不再主動抓
  useEffect(() => {
    if (!active?.id) {
      setBaseStudents([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/course-student-list/list?courseId=${encodeURIComponent(courseId)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const list = (Array.isArray(data) ? data : [])
          .map((s: { id?: string; studentId?: string; name?: string }) => ({
            id: String(s.id || s.studentId || ''),
            studentId: String(s.studentId || s.id || ''),
            name: String(s.name || '未命名'),
          }))
          .filter((s: { id: string }) => s.id);
        setBaseStudents(list);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active?.id, courseId]);

  // 被動監聽 roster：有人簽到才推送變更
  useEffect(() => {
    if (!active?.id) {
      setStatusById(new Map());
      setListenError(null);
      return;
    }

    const rosterRef = collection(
      clientDb,
      'courses',
      courseId,
      'attendance',
      active.id,
      'roster'
    );

    const unsub = onSnapshot(
      rosterRef,
      (snap) => {
        const next = new Map<
          string,
          { status: AttendanceStatus; leaveType?: string; name?: string }
        >();
        snap.forEach((docSnap) => {
          const data = docSnap.data() as {
            status?: string;
            leaveType?: string;
            name?: string;
            studentId?: string;
          };
          const status = normalizeLiveStatus(String(data.status || ''));
          const payload = {
            status,
            leaveType: typeof data.leaveType === 'string' ? data.leaveType : undefined,
            name: typeof data.name === 'string' ? data.name : undefined,
          };
          next.set(docSnap.id, payload);
          if (data.studentId && String(data.studentId) !== docSnap.id) {
            next.set(String(data.studentId), payload);
          }
        });
        setStatusById(next);
        setListenError(null);
      },
      (err) => {
        console.warn('[interact attendance] roster listen failed:', err);
        setListenError('無法即時監聽簽到（請確認登入權限）');
      }
    );

    return () => unsub();
  }, [active?.id, courseId]);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const roster: LiveStudentRow[] = useMemo(() => {
    const rows: LiveStudentRow[] = baseStudents.map((s) => {
      const hit = statusById.get(s.id) || statusById.get(s.studentId);
      return {
        id: s.id,
        studentId: s.studentId,
        name: hit?.name || s.name,
        status: hit?.status ?? '',
        leaveType: hit?.leaveType,
      };
    });
    rows.sort((a, b) => {
      const rank = statusRank(a.status) - statusRank(b.status);
      if (rank !== 0) return rank;
      return a.studentId.localeCompare(b.studentId, 'zh-Hant', { numeric: true });
    });
    return rows;
  }, [baseStudents, statusById]);

  const signedCount = roster.filter(
    (r) => r.status === 'present' || r.status === 'late'
  ).length;
  const totalCount = roster.length;

  const createModal =
    mounted &&
    createOpen &&
    createPortal(
      <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
        <button
          type="button"
          className="absolute inset-0 bg-black/70"
          aria-label="關閉"
          onClick={() => setCreateOpen(false)}
        />
        <div className="relative w-full sm:max-w-xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl border border-white/20">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-primary to-violet-600 text-white">
            <div>
              <p className="text-xs font-medium text-white/80">課程互動 · 點名</p>
              <h3 className="text-lg font-bold">新增點名活動</h3>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/15"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          <div className="p-5 sm:p-6">
            <CreateAttendanceActivityForm
              courseId={courseId}
              defaultCreationMode="instant"
              onClose={() => setCreateOpen(false)}
              onComplete={() => {
                setCreateOpen(false);
                void loadActivities();
              }}
            />
          </div>
        </div>
      </div>,
      document.body
    );

  if (loading && activities.length === 0) {
    return (
      <>
        <PageLoadingArea minHeight="min-h-[40vh]" />
        {createModal}
      </>
    );
  }

  if (error) {
    return (
      <>
        <div className="text-center space-y-4">
          <p className="text-red-300 text-lg">{error}</p>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold"
          >
            <PlusIcon className="w-5 h-5 mr-1.5" />
            新增點名
          </button>
        </div>
        {createModal}
      </>
    );
  }

  if (!active) {
    return (
      <>
        <div className="text-center space-y-5 max-w-lg mx-auto">
          <p className="text-2xl sm:text-3xl font-bold text-white/90">目前沒有進行中的點名</p>
          <p className="text-base sm:text-lg text-white/60">
            可直接在此新增即時點名；有人簽到時右側名單會自動更新。
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-lg shadow-lg shadow-emerald-900/30"
            >
              <PlusIcon className="w-5 h-5 mr-2" />
              新增點名
            </button>
            <button
              type="button"
              onClick={() => void loadActivities()}
              className="inline-flex items-center px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium"
            >
              <ArrowPathIcon className="w-4 h-4 mr-1.5" />
              重新整理
            </button>
          </div>
        </div>
        {createModal}
      </>
    );
  }

  return (
    <>
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch min-h-[60vh]">
        <section className="rounded-3xl bg-white/5 border border-white/15 p-5 sm:p-8 flex flex-col items-center justify-center gap-4">
          <div className="text-center w-full">
            <p className="text-sm uppercase tracking-[0.2em] text-emerald-300/90 font-semibold mb-1">
              {isQr ? 'QR 簽到' : isNumeric ? '簽到碼' : '點名進行中'}
            </p>
            <h2 className="text-lg sm:text-xl font-bold text-white/85 line-clamp-2">{active.title}</h2>
          </div>

          {isQr ? (
            <div className="w-full max-w-sm mx-auto [&_.rounded-2xl]:bg-white [&_.rounded-2xl]:border-0">
              <AttendanceQrDisplay
                courseId={courseId}
                activityId={active.id}
                endTime={active.endTime}
                className="!border-0 !bg-white shadow-xl"
              />
            </div>
          ) : isNumeric && code ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <p className="font-mono text-6xl sm:text-7xl md:text-8xl font-black tracking-[0.18em] text-white drop-shadow-lg">
                {code}
              </p>
              <p className="text-white/50 text-sm">請學生輸入上方六位數簽到</p>
            </div>
          ) : (
            <div className="text-center py-8 space-y-2">
              <p className="text-2xl font-bold text-white/80">手動點名</p>
              <p className="text-white/50 text-sm">右側名單會在狀態變更時更新</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="mt-2 inline-flex items-center text-sm text-white/55 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/10"
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            另開新點名
          </button>
        </section>

        <section className="rounded-3xl bg-white/5 border border-white/15 p-4 sm:p-6 flex flex-col min-h-[50vh] lg:min-h-0">
          <div className="mb-4 shrink-0">
            <p className="text-sm text-white/50 font-medium">簽到狀況</p>
            <p className="text-2xl sm:text-3xl font-black text-white">
              <span className="text-emerald-300">{signedCount}</span>
              <span className="text-white/40 text-xl font-bold"> / {totalCount || '—'}</span>
              <span className="ml-2 text-sm font-medium text-white/45">已簽到</span>
            </p>
            <p className="text-xs text-emerald-300/70 mt-1">
              {listenError || '有人簽到時自動更新（不輪詢）'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
            {roster.length === 0 ? (
              <div className="h-full min-h-[200px] flex items-center justify-center text-white/40 text-sm">
                尚無學生名單
              </div>
            ) : (
              roster.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-black/20 border border-white/10 px-3.5 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{row.name}</p>
                    <p className="font-mono text-xs text-white/45 truncate">{row.studentId}</p>
                  </div>
                  <span
                    className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold border ${statusPillClass(row.status)}`}
                  >
                    {statusLabel(row.status, row.leaveType)}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      {createModal}
    </>
  );
}

function DrawPanel({ courseId }: { courseId: string }) {
  const [loading, setLoading] = useState(true);
  const [students, setStudents] = useState<RosterStudent[]>([]);
  const [drawnIds, setDrawnIds] = useState<string[]>([]);
  const [current, setCurrent] = useState<RosterStudent | null>(null);
  const [excludeDrawn, setExcludeDrawn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [reveal, setReveal] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastShownIdRef = useRef<string>('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/course-student-list/list?courseId=${encodeURIComponent(courseId)}`
        );
        if (!res.ok) throw new Error('載入學生名單失敗');
        const data = await res.json();
        const list = (Array.isArray(data) ? data : []).map(
          (s: { id?: string; studentId?: string; name?: string }) => ({
            id: String(s.id || s.studentId || ''),
            studentId: String(s.studentId || s.id || ''),
            name: String(s.name || '未命名'),
          })
        ).filter((s: RosterStudent) => s.id);
        if (!cancelled) {
          setStudents(list);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '載入失敗');
          setStudents([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const pool = useMemo(() => {
    if (!excludeDrawn) return students;
    const drawn = new Set(drawnIds);
    return students.filter((s) => !drawn.has(s.id));
  }, [students, drawnIds, excludeDrawn]);

  const draw = () => {
    if (pool.length === 0 || spinning || students.length === 0) return;
    const picked = randomPick(pool);
    if (!picked) return;

    setReveal(false);
    setSpinning(true);

    const durationMs = 3200;
    const start = performance.now();
    let lastSwap = 0;
    const rollSource = pool.length > 1 ? pool : students;

    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const ease = 1 - Math.pow(1 - t, 3);
      const interval = 40 + ease * 220;

      if (now - lastSwap >= interval) {
        lastSwap = now;
        if (t < 0.92) {
          let candidates = rollSource;
          if (lastShownIdRef.current && rollSource.length > 1) {
            candidates = rollSource.filter((s) => s.id !== lastShownIdRef.current);
          }
          const next = randomPick(candidates.length > 0 ? candidates : rollSource);
          if (next) {
            lastShownIdRef.current = next.id;
            setCurrent(next);
          }
        } else {
          lastShownIdRef.current = picked.id;
          setCurrent(picked);
        }
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
        return;
      }

      lastShownIdRef.current = picked.id;
      setCurrent(picked);
      setDrawnIds((prev) => (prev.includes(picked.id) ? prev : [...prev, picked.id]));
      setSpinning(false);
      setReveal(true);
      rafRef.current = null;
    };

    rafRef.current = requestAnimationFrame(step);
  };

  if (loading) return <PageLoadingArea minHeight="min-h-[40vh]" />;
  if (error) return <p className="text-center text-red-300 text-lg">{error}</p>;
  if (students.length === 0) {
    return <p className="text-center text-white/70 text-xl">此課程尚無學生名單</p>;
  }

  return (
    <div className="w-full max-w-3xl mx-auto text-center space-y-6 sm:space-y-8">
      <style>{`
        @keyframes interact-draw-flicker {
          0%, 100% { opacity: 0.5; transform: translateY(4px) scale(0.94); filter: blur(1px); }
          50% { opacity: 1; transform: translateY(-4px) scale(1.02); filter: blur(0); }
        }
        @keyframes interact-draw-pop {
          0% { opacity: 0.35; transform: scale(0.78); filter: blur(3px); }
          55% { opacity: 1; transform: scale(1.1); filter: blur(0); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes interact-draw-scan {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(420%); }
        }
        .interact-draw-flicker { animation: interact-draw-flicker 0.11s ease-in-out infinite; }
        .interact-draw-pop { animation: interact-draw-pop 0.6s cubic-bezier(0.22, 1.4, 0.36, 1) both; }
        .interact-draw-scan { animation: interact-draw-scan 0.85s linear infinite; }
      `}</style>
      <div
        className={`relative min-h-[10rem] sm:min-h-[12rem] flex flex-col items-center justify-center rounded-3xl px-6 py-10 overflow-hidden transition-all duration-500 ${
          spinning
            ? 'bg-white/10 border-2 border-amber-300/50 shadow-[0_0_40px_rgba(251,191,36,0.25)]'
            : reveal
              ? 'bg-amber-400/15 border-2 border-amber-300/80 shadow-[0_0_50px_rgba(251,191,36,0.35)]'
              : 'bg-white/10 border border-white/20'
        }`}
      >
        {spinning ? (
          <div className="absolute inset-x-0 top-0 h-1.5 overflow-hidden bg-white/5">
            <div className="h-full w-1/3 bg-amber-300 interact-draw-scan" />
          </div>
        ) : null}
        {current ? (
          <div
            key={`${current.id}-${spinning ? 'spin' : reveal ? 'reveal' : 'idle'}`}
            className={spinning ? 'interact-draw-flicker' : reveal ? 'interact-draw-pop' : ''}
          >
            <p className="text-5xl sm:text-7xl md:text-8xl font-black text-white tracking-wide drop-shadow-lg">
              {current.name}
            </p>
            <p className="mt-3 font-mono text-lg sm:text-2xl text-white/60">{current.studentId}</p>
          </div>
        ) : (
          <p className="text-2xl sm:text-3xl text-white/50">按下下方按鈕開始抽人</p>
        )}
      </div>
      <p className="text-white/60 text-sm">
        名單 {students.length} 人
        {excludeDrawn ? ` · 尚可抽 ${pool.length} 人` : null}
        {drawnIds.length > 0 ? ` · 已抽 ${drawnIds.length} 人` : null}
      </p>
      <label className="inline-flex items-center gap-2 text-white/80 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={excludeDrawn}
          onChange={(e) => setExcludeDrawn(e.target.checked)}
          className="rounded border-white/40"
          disabled={spinning}
        />
        排除已抽過的人
      </label>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={draw}
          disabled={pool.length === 0 || spinning}
          className="px-8 py-3.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-gray-900 font-black text-lg disabled:opacity-40"
        >
          {spinning ? '抽取中…' : current ? '再抽一人' : '抽一人'}
        </button>
        <button
          type="button"
          onClick={() => {
            if (spinning) return;
            setDrawnIds([]);
            setCurrent(null);
            setReveal(false);
          }}
          disabled={spinning}
          className="px-5 py-2.5 rounded-xl bg-white/15 text-white font-medium disabled:opacity-40"
        >
          重設已抽名單
        </button>
      </div>
    </div>
  );
}

export default function TeacherCourseInteract({
  course,
  onClose,
}: {
  course: CourseInfo;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<InteractMode>('draw');

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white">
      <header className="shrink-0 px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-white/50 font-medium tracking-wide">課程互動 · 上課投影</p>
          <h1 className="text-base sm:text-xl font-bold truncate">{course.name}</h1>
          <p className="text-xs text-white/40 font-mono break-all">{course.code}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-sm font-medium"
        >
          <XMarkIcon className="w-4 h-4" />
          關閉
        </button>
      </header>

      <div className="shrink-0 px-4 sm:px-6 py-3 flex flex-wrap gap-2 border-b border-white/10 bg-black/10">
        {MODES.map(({ id, label, Icon }) => {
          const active = mode === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm sm:text-base font-bold transition-colors ${
                active
                  ? 'bg-white text-primary shadow-lg'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          );
        })}
      </div>

      <main className="flex-1 flex items-stretch justify-center p-4 sm:p-6 md:p-8 w-full min-h-0 overflow-hidden">
        {mode === 'attendance' && <AttendancePanel courseId={course.id} />}
        {mode === 'draw' && (
          <div className="w-full flex items-center justify-center">
            <DrawPanel courseId={course.id} />
          </div>
        )}
      </main>
    </div>
  );
}
