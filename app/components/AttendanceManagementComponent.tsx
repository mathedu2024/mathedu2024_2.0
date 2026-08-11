'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import LoadingSpinner from './LoadingSpinner';
import PageHeader from './ui/PageHeader';
import PageLoadingArea from './ui/PageLoadingArea'; 
import CreateAttendanceActivityForm from './CreateAttendanceActivityForm';
import AttendanceQrDisplay from './AttendanceQrDisplay';
import CourseFilter from './CourseFilter';
import TeacherAttendanceList from './TeacherAttendanceList';
import { 
  CalendarDaysIcon, ArrowLeftIcon, 
  XMarkIcon, CheckCircleIcon, 
  CloudArrowUpIcon, 
  QrCodeIcon, UserGroupIcon, ChevronRightIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { getSession } from '@/utils/session';
import { teacherCourseHubPath, withReturnTo } from '@/utils/teacherCourseHub';
import { isStudentVisible } from './StudentVisibilityToggle';

// ==========================================
// 1. 型別定義
// ==========================================

interface Course {
  id: string;
  name: string;
  code: string;
  gradeTags?: string[];
  subjectTag?: string;
  courseNature?: string;
  status?: string;
  teachers?: string[];
  teacherUids?: string[];
}

interface Student {
  id: string;
  name: string;
  studentId: string;
}

interface AttendanceActivity {
  id: string;
  name: string;
  date: string;
  type: string;
  mode: 'manual' | 'digital' | 'qr';
  checkInCode?: string;
  status?: string;
  endTime?: string;
  gracePeriodMinutes?: number;
  checkInMethod?: 'manual' | 'numeric' | 'qr';
  /** 開放＝學生可見；隱藏＝學生端不顯示 */
  visibleToStudents?: boolean;
  present?: number;
  expected?: number;
  absent?: number;
  leave?: number;
}

interface AttendanceRecord {
  studentId: string;
  status: string;
  leaveType?: string;
  note?: string;
}

function serializeAttendanceState(
  students: Student[],
  records: Record<string, { status: string; leaveType?: string }>,
  notes: Record<string, string>
): string {
  const payload = students.map((student) => {
    const data = records[student.studentId] || (student.id ? records[student.id] : undefined);
    return {
      studentId: student.studentId,
      status: data?.status || '',
      leaveType: data?.leaveType || '',
      note: notes[student.studentId] || (student.id ? notes[student.id] : '') || '',
    };
  });
  return JSON.stringify(payload);
}

async function confirmDiscardAttendanceChanges(): Promise<boolean> {
  const result = await Swal.fire({
    icon: 'warning',
    title: '尚未儲存點名紀錄',
    text: '您有尚未儲存的修改，確定要離開嗎？離開後變更將會遺失。',
    showCancelButton: true,
    confirmButtonText: '離開',
    cancelButtonText: '繼續編輯',
    confirmButtonColor: '#ef4444',
    cancelButtonColor: '#6b7280',
    customClass: { popup: 'rounded-2xl' },
  });
  return result.isConfirmed;
}

// 假別細項
const LEAVE_OPTIONS = [
  { value: '病假', label: '病假', color: 'text-blue-600' },
  { value: '事假', label: '事假', color: 'text-purple-600' },
  { value: '公假', label: '公假', color: 'text-primary' },
  { value: '喪假', label: '喪假', color: 'text-gray-600' },
  { value: '生理假', label: '生理假', color: 'text-pink-600' },
  { value: '心理假', label: '心理假', color: 'text-rose-600' },
];

function buildAttendanceUrl(courseCode?: string, attendanceCode?: string) {
  if (!courseCode) return '/back-panel/teacher-courses';
  if (!attendanceCode) {
    return teacherCourseHubPath(courseCode, 'attendance');
  }
  return `/back-panel/teacher-attendance/${encodeURIComponent(courseCode)}/${encodeURIComponent(attendanceCode)}`;
}

function shouldDisplayCheckInCode(activity: AttendanceActivity): boolean {
  // 僅進行中的數字點名顯示簽到碼
  if (activity.status && activity.status !== 'active') return false;
  return activity.mode === 'digital' && !!activity.checkInCode && /^\d{6}$/.test(activity.checkInCode);
}

function modeLabel(activity: AttendanceActivity): string {
  const method = activity.checkInMethod;
  if (method === 'qr' || activity.mode === 'qr') return 'QR點名';
  if (method === 'numeric' || activity.mode === 'digital') return '數字點名';
  return '手動點名';
}

function activityRouteKey(activity: AttendanceActivity): string {
  return activity.checkInCode || activity.id;
}

type AttendanceRouteLayer = 'list' | 'course' | 'activity';

const PENDING_ATTENDANCE_COURSE_KEY = 'teacher-attendance-pending-course';
const PENDING_ATTENDANCE_ACTIVITY_KEY = 'teacher-attendance-pending-activity';

function getAttendanceRouteLayer(courseCodeFromUrl: string, attendanceCodeFromUrl: string): AttendanceRouteLayer {
  if (attendanceCodeFromUrl) return 'activity';
  if (courseCodeFromUrl) return 'course';
  return 'list';
}

function filterCoursesForUser(
  courseList: Course[],
  userInfo?: { id: string; name?: string; role?: string | string[] } | null
): Course[] {
  let currentUserId = userInfo?.id;
  if (!currentUserId) {
    const session = getSession() as { user?: { id?: string; userId?: string; uid?: string }; id?: string; userId?: string; uid?: string } | null;
    if (!session) return [];
    const user = session.user || session;
    currentUserId = user.id || user.userId || user.uid;
  }
  if (!currentUserId) return [];

  return courseList.filter((c) => {
    if (!c.teachers || !Array.isArray(c.teachers)) return false;
    return c.teachers.includes(currentUserId);
  });
}

function getPendingAttendanceCourse(courseCode: string): Course | null {
  if (typeof window === 'undefined' || !courseCode) return null;
  try {
    const raw = sessionStorage.getItem(PENDING_ATTENDANCE_COURSE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { code?: string; id?: string; name?: string };
    if (parsed.code !== courseCode || !parsed.id) return null;
    return { id: parsed.id, name: parsed.name || courseCode, code: parsed.code };
  } catch {
    return null;
  }
}

function setPendingAttendanceCourse(course: Course) {
  if (typeof window === 'undefined' || !course.code || !course.id) return;
  try {
    sessionStorage.setItem(
      PENDING_ATTENDANCE_COURSE_KEY,
      JSON.stringify({ id: course.id, name: course.name, code: course.code })
    );
  } catch {
    // ignore storage errors
  }
}

function clearPendingAttendanceCourse() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_ATTENDANCE_COURSE_KEY);
  } catch {
    // ignore storage errors
  }
}

function getPendingAttendanceActivity(courseCode: string, attendanceCode: string): AttendanceActivity | null {
  if (typeof window === 'undefined' || !courseCode || !attendanceCode) return null;
  try {
    const raw = sessionStorage.getItem(PENDING_ATTENDANCE_ACTIVITY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      courseCode?: string;
      attendanceCode?: string;
      id?: string;
      name?: string;
      date?: string;
      type?: string;
      mode?: 'manual' | 'digital';
      checkInCode?: string;
    };
    if (parsed.courseCode !== courseCode || parsed.attendanceCode !== attendanceCode || !parsed.id) return null;
    return {
      id: parsed.id,
      name: parsed.name || '點名活動',
      date: parsed.date || new Date().toISOString(),
      type: parsed.type || '一般課程',
      mode: parsed.mode || 'manual',
      checkInCode: parsed.checkInCode || attendanceCode,
    };
  } catch {
    return null;
  }
}

function setPendingAttendanceActivity(courseCode: string, attendanceCode: string, activity: AttendanceActivity) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      PENDING_ATTENDANCE_ACTIVITY_KEY,
      JSON.stringify({
        courseCode,
        attendanceCode,
        id: activity.id,
        name: activity.name,
        date: activity.date,
        type: activity.type,
        mode: activity.mode,
        checkInCode: activity.checkInCode || attendanceCode,
      })
    );
  } catch {
    // ignore storage errors
  }
}

function clearPendingAttendanceActivity() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PENDING_ATTENDANCE_ACTIVITY_KEY);
  } catch {
    // ignore storage errors
  }
}

function mapActivityFromApi(item: {
  id: string;
  name?: string;
  title?: string;
  date?: unknown;
  startTime?: unknown;
  endTime?: unknown;
  mode?: 'manual' | 'digital' | 'qr';
  checkInMethod?: string;
  type?: string;
  checkInCode?: string;
  status?: string;
  gracePeriodMinutes?: number;
  visibleToStudents?: boolean;
  present?: number;
  expected?: number;
  absent?: number;
  leave?: number;
}): AttendanceActivity {
  const toISO = (d: unknown) => {
    if (!d) return undefined;
    if (typeof d === 'string') return d;
    if (typeof d === 'object' && d !== null && '_seconds' in d && '_nanoseconds' in d) {
      return new Date((d as { _seconds: number })._seconds * 1000 + (d as { _nanoseconds: number })._nanoseconds / 1000000).toISOString();
    }
    if (d instanceof Date) return d.toISOString();
    try { return new Date(d as string | number).toISOString(); } catch { return String(d); }
  };

  const dateISO = toISO(item.date);
  const startTimeISO = toISO(item.startTime);
  const endTimeISO = toISO(item.endTime);
  const rawDate = dateISO || startTimeISO || new Date().toISOString();
  const method = item.checkInMethod;
  const mode: AttendanceActivity['mode'] =
    item.mode ||
    (method === 'numeric' ? 'digital' : method === 'qr' ? 'qr' : 'manual');
  const checkInMethod: AttendanceActivity['checkInMethod'] =
    method === 'numeric' || method === 'manual' || method === 'qr'
      ? method
      : mode === 'digital'
        ? 'numeric'
        : mode === 'qr'
          ? 'qr'
          : 'manual';

  return {
    id: item.id,
    name: item.name || item.title || '未命名活動',
    date: rawDate,
    type: item.type || '一般課程',
    mode,
    checkInCode: item.checkInCode,
    status: item.status,
    endTime: endTimeISO,
    gracePeriodMinutes: item.gracePeriodMinutes,
    checkInMethod,
    visibleToStudents: item.visibleToStudents !== false,
    present: typeof item.present === 'number' ? item.present : undefined,
    expected: typeof item.expected === 'number' ? item.expected : undefined,
    absent: typeof item.absent === 'number' ? item.absent : undefined,
    leave: typeof item.leave === 'number' ? item.leave : undefined,
  };
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function quickStatusKey(status?: string, leaveType?: string): 'present' | 'late' | 'excused' | 'absent' | '' {
  if (!status) return '';
  if (status === 'present') return 'present';
  if (status === 'late' || status === 'early_leave' || status === 'late_and_early_leave') return 'late';
  if (status === 'leave' || leaveType) return 'excused';
  if (status === 'absent') return 'absent';
  return '';
}

// ==========================================
// 2. 共用 UI 元件 (Modal & Portal Dropdown)
// ==========================================

const Modal = ({ open, onClose, title, size = 'md', children }: { open: boolean; onClose: () => void; title: string; size?: 'md' | 'lg' | 'xl'; children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); return () => setMounted(false); }, []);
  if (!open || !mounted) return null;
  const maxWidthClass = { md: 'max-w-lg', lg: 'max-w-4xl', xl: 'max-w-6xl' }[size];
  
  return createPortal(
    <div className="fixed inset-0 z-[99999] flex justify-center items-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/60" onClick={onClose}></div>
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidthClass} max-h-full sm:max-h-[90vh] flex flex-col overflow-hidden animate-bounce-in border border-gray-100`}>
        <div className="bg-gradient-to-r from-primary to-tertiary p-4 flex justify-between items-center text-white flex-shrink-0">
          <h3 className="text-xl font-bold flex items-center">{title}</h3>
          <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-white">{children}</div>
      </div>
    </div>,
    document.body
  );
};

// ==========================================
  // 3. 第三層：點名執行 (AttendanceRosterManager)
  // ==========================================

  function AttendanceActivityPageHeader({
    activityName,
    courseName,
    studentCount,
    activityInfo,
    onBack,
    actions,
    countdownLabel,
  }: {
    activityName: string;
    courseName: string;
    studentCount?: number;
    activityInfo?: AttendanceActivity | null;
    onBack: () => void;
    actions?: React.ReactNode;
    countdownLabel?: string | null;
  }) {
    const datePart = activityInfo?.date
      ? (() => {
          const d = new Date(activityInfo.date);
          if (Number.isNaN(d.getTime())) return '';
          return ` · ${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
        })()
      : '';

    return (
      <div className="mb-6 bg-surface-containerLowest rounded-xl border border-outline-variant/40 shadow-sm px-4 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="text-on-surfaceVariant hover:bg-surface-containerHigh transition-colors p-2 rounded-full shrink-0"
            aria-label="返回"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-on-surface truncate">
              {activityName}
              {datePart ? <span className="font-semibold text-on-surfaceVariant">{datePart} 點名</span> : null}
            </h1>
            <p className="text-sm text-on-surfaceVariant mt-0.5 truncate">
              {courseName}
              {studentCount !== undefined ? ` · 共 ${studentCount} 人` : ''}
              {activityInfo && shouldDisplayCheckInCode(activityInfo) ? (
                <span className="ml-2 inline-flex items-center text-primary font-mono font-bold">
                  <QrCodeIcon className="w-4 h-4 mr-1" />
                  {activityInfo.checkInCode}
                </span>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-end">
          {countdownLabel ? (
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold uppercase tracking-wider text-on-surfaceVariant">剩餘時間</span>
              <span className="font-mono text-3xl font-bold text-tertiary leading-none">{countdownLabel}</span>
            </div>
          ) : null}
          {actions}
        </div>
      </div>
    );
  }

  function AttendanceActivityRouteShell({
    activityName,
    courseName,
    activityInfo,
    onBack,
  }: {
    activityName: string;
    courseName: string;
    activityInfo?: AttendanceActivity | null;
    onBack: () => void;
  }) {
    return (
      <div className="page-shell w-full min-w-0 pb-20 flex flex-col h-full animate-fade-in">
        <AttendanceActivityPageHeader
          activityName={activityName}
          courseName={courseName}
          activityInfo={activityInfo}
          onBack={onBack}
        />
        <PageLoadingArea />
      </div>
    );
  }
  
  interface AttendanceRosterManagerProps {
    activityId: string;
    courseId: string;
    courseName: string;
    students: Student[];
    onClose: () => void;
    initialActivityData?: AttendanceActivity | null;
    isArchived?: boolean;
    studentsLoading?: boolean;
  }
  
  function AttendanceRosterManager({ activityId, courseId, courseName, students = [], onClose, initialActivityData, isArchived = false, studentsLoading = false }: AttendanceRosterManagerProps) {
    const safeStudents = useMemo(() => (Array.isArray(students) ? students : []), [students]);
    
    const [records, setRecords] = useState<Record<string, { status: string; leaveType?: string }>>({});
    const [notes, setNotes] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activityInfo, setActivityInfo] = useState<AttendanceActivity | null>(initialActivityData || null);
    const [savedSnapshot, setSavedSnapshot] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [nowMs, setNowMs] = useState(() => Date.now());
    const baselineReadyRef = useRef(false);
    const allowLeaveRef = useRef(false);

    const currentSnapshot = useMemo(
      () => serializeAttendanceState(safeStudents, records, notes),
      [safeStudents, records, notes]
    );

    const isDirty = useMemo(() => {
      if (loading || studentsLoading || isArchived || !savedSnapshot) {
        return false;
      }
      return currentSnapshot !== savedSnapshot;
    }, [loading, studentsLoading, isArchived, savedSnapshot, currentSnapshot]);

    const confirmLeaveIfDirty = useCallback(async () => {
      if (isArchived || !isDirty) return true;
      return confirmDiscardAttendanceChanges();
    }, [isArchived, isDirty]);

    const handleRequestClose = useCallback(async () => {
      if (await confirmLeaveIfDirty()) {
        allowLeaveRef.current = true;
        onClose();
      }
    }, [confirmLeaveIfDirty, onClose]);

    useEffect(() => {
      baselineReadyRef.current = false;
      allowLeaveRef.current = false;
      setSavedSnapshot('');
    }, [activityId]);

    useEffect(() => {
      if (loading || studentsLoading) return;
      if (!baselineReadyRef.current) {
        setSavedSnapshot(currentSnapshot);
        baselineReadyRef.current = true;
      }
    }, [loading, studentsLoading, currentSnapshot]);

    useEffect(() => {
      if (!isDirty || isArchived || loading || studentsLoading) return;

      const handleBeforeUnload = (event: BeforeUnloadEvent) => {
        event.preventDefault();
        event.returnValue = '';
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty, isArchived, loading, studentsLoading]);

    useEffect(() => {
      if (!isDirty || isArchived || loading || studentsLoading) return;

      window.history.pushState({ attendanceUnsavedGuard: true }, '');

      const handlePopState = () => {
        if (allowLeaveRef.current) return;

        window.history.pushState({ attendanceUnsavedGuard: true }, '');

        void confirmLeaveIfDirty().then((shouldLeave) => {
          if (shouldLeave) {
            allowLeaveRef.current = true;
            onClose();
          }
        });
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }, [isDirty, isArchived, loading, studentsLoading, confirmLeaveIfDirty, onClose]);

    useEffect(() => {
      if (!activityInfo?.endTime) return;
      const id = window.setInterval(() => setNowMs(Date.now()), 1000);
      return () => window.clearInterval(id);
    }, [activityInfo?.endTime]);

    const countdownLabel = useMemo(() => {
      if (!activityInfo?.endTime) return null;
      if (activityInfo.status && activityInfo.status !== 'active') return null;
      const end = Date.parse(activityInfo.endTime);
      if (Number.isNaN(end)) return null;
      return formatCountdown(end - nowMs);
    }, [activityInfo?.endTime, activityInfo?.status, nowMs]);
  
    const fetchRecords = useCallback(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/attendance/records/get', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, activityId })
        });
  
        if (res.ok) {
          const data = await res.json();
          const recordMap: Record<string, { status: string; leaveType?: string }> = {};
          const noteMap: Record<string, string> = {};
          if (data.records && Array.isArray(data.records)) {
              data.records.forEach((r: AttendanceRecord) => {
                  recordMap[r.studentId] = { status: r.status, leaveType: r.leaveType };
                  if (r.note) noteMap[r.studentId] = r.note;
              });
          }
          setRecords(recordMap);
          setNotes(noteMap);
          if (data.activity) {
            setActivityInfo(mapActivityFromApi(data.activity as Parameters<typeof mapActivityFromApi>[0]));
          }
        }
      } catch (error) {
        console.error(error);
        Swal.fire({
          icon: 'error',
          title: '錯誤',
          text: '無法載入點名紀錄',
          confirmButtonColor: '#ef4444',
          customClass: { popup: 'rounded-2xl' }
        });
      } finally {
        setLoading(false);
      }
    }, [courseId, activityId]);
  
    useEffect(() => { fetchRecords(); }, [fetchRecords]);
  
    // Handlers
    const handleSetStatus = (studentId: string, status: string) => {
      setRecords(prev => ({ ...prev, [studentId]: { status, leaveType: prev[studentId]?.leaveType } }));
    };
  
    const handleSetLeave = (studentId: string, leaveType: string) => {
      setRecords(prev => ({ ...prev, [studentId]: { status: 'leave', leaveType } }));
    };

    const handleQuickStatus = (studentId: string, key: 'present' | 'late' | 'excused' | 'absent') => {
      if (isArchived) return;
      if (key === 'present') handleSetStatus(studentId, 'present');
      else if (key === 'late') handleSetStatus(studentId, 'late');
      else if (key === 'absent') handleSetStatus(studentId, 'absent');
      else {
        const prev = records[studentId];
        handleSetLeave(studentId, prev?.leaveType || '事假');
      }
    };
  
    const handleNoteChange = (studentId: string, note: string) => {
      setNotes(prev => ({ ...prev, [studentId]: note }));
    };
  
    const handleSave = async () => {
      setSaving(true);
      try {
        const recordsArray = safeStudents.map((student) => {
          const data = getRecordForStudent(student);
          return {
            studentId: student.studentId,
            status: data?.status || '',
            leaveType: data?.leaveType || '',
            note: notes[student.studentId] || (student.id ? notes[student.id] : '') || '',
          };
        });
  
        const res = await fetch('/api/attendance/records/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, activityId, records: recordsArray })
        });
  
        if (!res.ok) throw new Error('Save failed');
        setSavedSnapshot(serializeAttendanceState(safeStudents, records, notes));
        Swal.fire({
          icon: 'success',
          title: '儲存成功',
          text: '點名紀錄已成功儲存',
          confirmButtonColor: '#2D6DF6',
          customClass: { popup: 'rounded-2xl' }
        });
      } catch (error) {
        console.error('Save records error:', error);
        Swal.fire({
          icon: 'error',
          title: '儲存失敗',
          text: '請稍後再試',
          confirmButtonColor: '#ef4444',
          customClass: { popup: 'rounded-2xl' }
        });
      } finally {
        setSaving(false);
      }
    };
  
    const markAllPresent = () => {
      setRecords(() => {
        const newRecords: Record<string, { status: string; leaveType?: string }> = {};
        safeStudents.forEach((s) => {
          newRecords[s.studentId] = { status: 'present' };
        });
        return newRecords;
      });
      Swal.fire({
        icon: 'success',
        title: '已全部設為出席',
        confirmButtonText: '太棒了',
        confirmButtonColor: '#2D6DF6',
        timer: 1500,
        timerProgressBar: true,
        customClass: { popup: 'rounded-2xl' }
      });
    };
  
    const getRecordForStudent = useCallback((student: Student) => {
      return records[student.studentId] || (student.id ? records[student.id] : undefined);
    }, [records]);

    const filteredStudents = useMemo(() => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return safeStudents;
      return safeStudents.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.studentId.toLowerCase().includes(q)
      );
    }, [safeStudents, searchQuery]);
  
    // 統計僅計算目前課程名單內的學生
    const stats = useMemo(() => {
      let present = 0;
      let late = 0;
      let early_leave = 0;
      let late_and_early_leave = 0;
      let leave = 0;
      let absent = 0;
      let recorded = 0;
  
      safeStudents.forEach((student) => {
        const rec = getRecordForStudent(student);
        if (!rec?.status) return;
        recorded++;
        if (rec.status === 'present') present++;
        else if (rec.status === 'late') late++;
        else if (rec.status === 'early_leave') early_leave++;
        else if (rec.status === 'late_and_early_leave') late_and_early_leave++;
        else if (rec.status === 'leave') leave++;
        else if (rec.status === 'absent') absent++;
      });
  
      return {
        present,
        late,
        early_leave,
        late_and_early_leave,
        leave,
        absent,
        total: safeStudents.length,
        unrecorded: safeStudents.length - recorded,
      };
    }, [safeStudents, getRecordForStudent]);

    const statusBtnClass = (active: boolean, tone: 'present' | 'late' | 'excused' | 'absent') => {
      const base = 'border rounded-lg py-1.5 px-1 text-xs sm:text-sm font-bold flex justify-center items-center transition-colors whitespace-nowrap';
      if (!active) return `${base} border-outline-variant text-on-surfaceVariant hover:bg-surface-containerLow`;
      if (tone === 'present') return `${base} bg-secondary text-white border-secondary`;
      if (tone === 'late') return `${base} bg-amber-500 text-white border-amber-500`;
      if (tone === 'excused') return `${base} bg-primary text-white border-primary`;
      return `${base} bg-error text-white border-error`;
    };
  
    return (
      <div className="page-shell w-full min-w-0 pb-20 flex flex-col h-full animate-fade-in">
        <AttendanceActivityPageHeader
          activityName={activityInfo?.name || '點名活動'}
          courseName={courseName}
          studentCount={safeStudents.length}
          activityInfo={activityInfo}
          onBack={handleRequestClose}
          countdownLabel={countdownLabel}
          actions={
            !isArchived ? (
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-3 bg-primary-container text-on-primary text-sm font-bold rounded-lg hover:bg-primary transition-colors shadow-sm flex items-center gap-2 active:scale-95"
              >
                {saving ? <LoadingSpinner size={16} color="white" /> : <><CloudArrowUpIcon className="w-5 h-5" /> 儲存出勤</>}
              </button>
            ) : undefined
          }
        />
  
        {loading || studentsLoading ? (
          <PageLoadingArea />
        ) : (
        <>
        {isArchived && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-4">
            <span className="font-bold mr-2">提示：</span>
            此課程已封存，您只能查看點名紀錄，無法進行修改。
          </div>
        )}

        {(activityInfo?.checkInMethod === 'qr' || activityInfo?.mode === 'qr') &&
          activityInfo?.status !== 'ended' && (
          <div className="mb-4 max-w-md">
            <AttendanceQrDisplay
              courseId={courseId}
              activityId={activityId}
              endTime={activityInfo.endTime}
            />
          </div>
        )}

        <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 mb-6 bg-surface-containerLow p-4 rounded-xl border border-outline-variant/50">
          <div className="relative w-full lg:w-96">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-on-surfaceVariant" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋姓名或學號…"
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-outline-variant bg-surface-containerLowest focus:border-primary focus:ring-1 focus:ring-primary outline-none text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 justify-between lg:justify-end">
            <div className="flex flex-wrap items-center gap-3 px-2 lg:px-4 lg:border-r border-outline-variant text-sm font-bold">
              <span className="text-on-surfaceVariant text-xs font-semibold">統計</span>
              <span className="text-secondary">出席 {stats.present}</span>
              <span className="text-amber-600">遲到 {stats.late + stats.early_leave + stats.late_and_early_leave}</span>
              <span className="text-primary">請假 {stats.leave}</span>
              <span className="text-error">曠課 {stats.absent}</span>
              {stats.unrecorded > 0 ? (
                <span className="text-on-surfaceVariant font-medium">未點 {stats.unrecorded}</span>
              ) : null}
            </div>
            {!isArchived ? (
              <button
                type="button"
                onClick={markAllPresent}
                className="border border-outline-variant text-on-surfaceVariant px-4 py-2 rounded-lg font-bold hover:bg-surface-containerHigh transition-colors active:scale-95 flex items-center gap-2 text-sm"
              >
                <CheckCircleIcon className="w-5 h-5" />
                全部設為出席
              </button>
            ) : null}
          </div>
        </div>
  
        {filteredStudents.length === 0 ? (
          <div className="text-center py-12 text-on-surfaceVariant bg-surface-containerLowest rounded-xl border border-outline-variant/40">
            {safeStudents.length === 0 ? '沒有學生名單' : '沒有符合搜尋條件的學生'}
          </div>
        ) : (
          <div className="bg-surface-containerLowest rounded-xl border border-outline-variant/40 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[720px]">
                <thead className="bg-surface-containerHigh/80 text-on-surfaceVariant sticky top-0 z-10">
                  <tr>
                    <th className="px-4 py-3 font-bold w-[18%]">學號</th>
                    <th className="px-4 py-3 font-bold w-[16%]">姓名</th>
                    <th className="px-4 py-3 font-bold w-[42%]">點名狀態</th>
                    <th className="px-4 py-3 font-bold w-[24%]">備註</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60">
                  {filteredStudents.map((student) => {
                    const currentRecord = getRecordForStudent(student) || { status: '' };
                    const currentStatus = currentRecord.status;
                    const currentLeaveType = currentRecord.leaveType;
                    const activeKey = quickStatusKey(currentStatus, currentLeaveType);

                    return (
                      <tr
                        key={student.studentId}
                        className={`hover:bg-surface-containerLow/80 transition-colors ${
                          !currentStatus ? 'bg-amber-50/40' : 'bg-surface-containerLowest'
                        }`}
                      >
                        <td className="px-4 py-3 font-mono text-on-surface whitespace-nowrap">
                          {student.studentId}
                        </td>
                        <td className="px-4 py-3 font-bold text-on-surface whitespace-nowrap">
                          {student.name}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-4 gap-1.5 max-w-md">
                              <button
                                type="button"
                                disabled={isArchived}
                                onClick={() => handleQuickStatus(student.studentId, 'present')}
                                className={statusBtnClass(activeKey === 'present', 'present')}
                              >
                                出席
                              </button>
                              <button
                                type="button"
                                disabled={isArchived}
                                onClick={() => handleQuickStatus(student.studentId, 'late')}
                                className={statusBtnClass(activeKey === 'late', 'late')}
                              >
                                遲到
                              </button>
                              <button
                                type="button"
                                disabled={isArchived}
                                onClick={() => handleQuickStatus(student.studentId, 'excused')}
                                className={statusBtnClass(activeKey === 'excused', 'excused')}
                              >
                                請假
                              </button>
                              <button
                                type="button"
                                disabled={isArchived}
                                onClick={() => handleQuickStatus(student.studentId, 'absent')}
                                className={statusBtnClass(activeKey === 'absent', 'absent')}
                              >
                                曠課
                              </button>
                            </div>
                            {!isArchived && activeKey === 'excused' ? (
                              <div className="flex flex-wrap gap-1.5">
                                {LEAVE_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleSetLeave(student.studentId, opt.value)}
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold border transition-colors ${
                                      currentLeaveType === opt.value
                                        ? 'bg-primary text-white border-primary'
                                        : 'border-outline-variant text-on-surfaceVariant hover:bg-surface-container'
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            placeholder="備註…"
                            className={`w-full border border-outline-variant rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none ${
                              isArchived
                                ? 'bg-surface-container text-on-surfaceVariant cursor-not-allowed'
                                : 'bg-surface'
                            }`}
                            disabled={isArchived}
                            readOnly={isArchived}
                            value={notes[student.studentId] || ''}
                            onChange={(e) => handleNoteChange(student.studentId, e.target.value)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </>
        )}
        
      </div>
    );
  }
  
  // ==========================================
  // 4. 第二層：活動列表 (AttendanceActivityList)
  // ==========================================
  
  interface AttendanceActivityListProps {
    courseId: string;
    courseName: string;
    courseCode: string;
    onBack: () => void;
    isArchived?: boolean;
    onSelectActivity: (activity: AttendanceActivity) => void;
    /** 嵌入課程詳情分頁時隱藏標題與返回列 */
    embedded?: boolean;
  }
  
  function AttendanceActivityList({ courseId, courseName, courseCode: _courseCode, onBack, onSelectActivity, isArchived = false, embedded = false }: AttendanceActivityListProps) {
    const [activities, setActivities] = useState<AttendanceActivity[]>([]);
    const [loading, setLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [studentCount, setStudentCount] = useState(0);
    const [absenceAlertCount, setAbsenceAlertCount] = useState(0);
  
    const formatDate = (isoString: string) => {
      if (!isoString) return '';
      try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString; // Return original if invalid
  
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
  
        return `${year}/${month}/${day} ${hours}:${minutes}`;
      } catch {
        return isoString; // Return original on error
      }
    };
  
    // 載入資料 (強化欄位讀取邏輯 & 解決第二層空白問題)
    const fetchActivities = useCallback(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/attendance/activities/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId })
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            const mappedData = data.map((item: {
              id: string;
              name?: string;
              title?: string;
              date?: unknown;
              startTime?: unknown;
              endTime?: unknown;
              mode?: 'manual' | 'digital' | 'qr';
              checkInMethod?: string;
              type?: string;
              checkInCode?: string;
              status?: string;
              present?: number;
              expected?: number;
              absent?: number;
              leave?: number;
              visibleToStudents?: boolean;
            }) => mapActivityFromApi(item));
  
            const sorted = mappedData.sort(
              (a, b) =>
                new Date(b.date).getTime() - new Date(a.date).getTime()
            );
            setActivities(sorted);
          } else {
            setActivities([]);
          }
        } else {
          setActivities([]);
        }
      } catch { Swal.fire('錯誤', '無法載入點名活動', 'error'); } finally { setLoading(false); }
    }, [courseId]);

    const computeAbsenceAlerts = useCallback(async (list: AttendanceActivity[]) => {
      const recent = list
        .filter((a) => a.status !== 'scheduled')
        .slice(0, 5);
      if (recent.length < 2) {
        setAbsenceAlertCount(0);
        return;
      }
      try {
        const results = await Promise.all(
          recent.map(async (a) => {
            const res = await fetch('/api/attendance/records/get', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ courseId, activityId: a.id }),
            });
            if (!res.ok) return [] as AttendanceRecord[];
            const data = await res.json();
            return (Array.isArray(data.records) ? data.records : []) as AttendanceRecord[];
          })
        );

        const studentIds = new Set<string>();
        results.forEach((records) => {
          records.forEach((r) => studentIds.add(r.studentId));
        });

        let alertCount = 0;
        studentIds.forEach((sid) => {
          let streak = 0;
          for (const records of results) {
            const rec = records.find((r) => r.studentId === sid);
            if (rec?.status === 'absent') streak += 1;
            else break;
          }
          if (streak >= 2) alertCount += 1;
        });
        setAbsenceAlertCount(alertCount);
      } catch {
        setAbsenceAlertCount(0);
      }
    }, [courseId]);
  
    useEffect(() => { fetchActivities(); }, [fetchActivities]);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        try {
          const stuRes = await fetch(`/api/course-student-list/list?courseId=${encodeURIComponent(courseId)}`);
          if (!stuRes.ok || cancelled) return;
          const roster = await stuRes.json();
          if (!cancelled) setStudentCount(Array.isArray(roster) ? roster.length : 0);
        } catch {
          if (!cancelled) setStudentCount(0);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [courseId]);

    useEffect(() => {
      if (activities.length === 0) {
        setAbsenceAlertCount(0);
        return;
      }
      void computeAbsenceAlerts(activities);
    }, [activities, computeAbsenceAlerts]);
  
    // 匯出紀錄
    const handleExport = async () => {
      if (activities.length === 0) return Swal.fire('提示', '無資料可匯出', 'info');
      
      Swal.fire({
        title: '正在準備匯出資料',
        text: '請稍候...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
      });
  
      try {
        // 動態載入 ExcelJS，避免拖慢系統初始載入速度
        const ExcelJS = (await import('exceljs')).default;
        // 1. 建立 Excel 活頁簿
        const workbook = new ExcelJS.Workbook();
        
        // --- 第一個工作表：活動摘要 ---
        const worksheet = workbook.addWorksheet('點名活動摘要');
  
        // 定義摘要表欄位
        worksheet.columns = [
          { header: '日期 / 開始時間', key: 'date', width: 22 },
          { header: '類型', key: 'type', width: 16 },
          { header: '活動名稱', key: 'name', width: 32 },
          { header: '點名方式', key: 'mode', width: 16 },
          { header: '點名代碼', key: 'checkInCode', width: 16 },
        ];
  
        // 填入點名活動資料
        activities.forEach((a) => {
          worksheet.addRow({
            date: formatDate(a.date),
            type: a.type,
            name: a.name,
            mode: modeLabel(a),
            checkInCode: shouldDisplayCheckInCode(a) ? a.checkInCode || '' : '',
          });
        });
  
        // 設定摘要表標題樣式 (藍色背景、白色文字)
        worksheet.getRow(1).eachCell((cell) => {
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
        });
  
        // --- 第二個工作表：學生出缺席總表 ---
        const worksheet2 = workbook.addWorksheet('學生出缺席詳細名單');
        
        // 優化：直接抓取該課程學生名單，避免抓取全校學生資料浪費資源
        const stuRes = await fetch(`/api/course-student-list/list?courseId=${encodeURIComponent(courseId)}`);
        let students: Student[] = [];
        if (stuRes.ok) {
          const roster = await stuRes.json();
          students = (Array.isArray(roster) ? roster : []).map((s: { id?: string; studentId?: string; name?: string }) => ({
            id: String(s.id || s.studentId || ''),
            studentId: String(s.studentId || s.id || ''),
            name: String(s.name || ''),
          }));
  
          students.sort((a, b) => {
            const idA = a.studentId;
            const idB = b.studentId;
            const aIsAlpha = /^[A-Za-z]/.test(idA);
            const bIsAlpha = /^[A-Za-z]/.test(idB);
            
            if (aIsAlpha && !bIsAlpha) return 1;
            if (!aIsAlpha && bIsAlpha) return -1;
            
            return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
          });
        }
  
        // 抓取所有點名活動的詳細紀錄 (併行處理以提升效能)
        const allRecordsPromises = activities.map(async (a) => {
          const res = await fetch('/api/attendance/records/get', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId, activityId: a.id })
          });
          if (res.ok) {
            const data = await res.json();
            return { activityId: a.id, records: data.records || [] };
          }
          return { activityId: a.id, records: [] };
        });
        const allRecordsData = await Promise.all(allRecordsPromises);
  
        // 設定總表欄位 (基礎欄位：學號、姓名)
        const columns = [
          { header: '學號', key: 'studentId', width: 15 },
          { header: '姓名', key: 'name', width: 15 },
        ];
  
        // 動態增加點名日期欄位 (每個活動一欄)
        activities.forEach(a => {
          const headerDate = formatDate(a.date).split(' ')[0];
          columns.push({ header: `${headerDate}\n${a.name}`, key: a.id, width: 20 });
        });
        worksheet2.columns = columns;
  
        // 填充學生資料列
        students.forEach(student => {
          const rowData: Record<string, string> = {
            studentId: student.studentId,
            name: student.name
          };
          
          activities.forEach(activity => {
            const activityData = allRecordsData.find(d => d.activityId === activity.id);
            const record = activityData?.records.find((r: AttendanceRecord) => r.studentId === student.studentId);
            let displayStatus = '未點名';
            if (record) {
              if (record.status === 'present') displayStatus = '出席';
              else if (record.status === 'late') displayStatus = '遲到';
              else if (record.status === 'early_leave') displayStatus = '早退';
              else if (record.status === 'late_and_early_leave') displayStatus = '遲到、早退';
              else if (record.status === 'absent') displayStatus = '曠課';
              else if (record.status === 'leave') displayStatus = record.leaveType || '請假';
              else displayStatus = record.status;
            }
            rowData[activity.id] = displayStatus;
          });
          
          const row = worksheet2.addRow(rowData);
          
          // 針對不同狀態標記顏色 (選擇性功能)
          row.eachCell((cell, colNumber) => {
            if (colNumber > 2) { // 狀態欄位
              if (cell.value === '出席') cell.font = { color: { argb: 'FF10B981' } }; // 綠色
              if (cell.value === '曠課') cell.font = { color: { argb: 'FFEF4444' } }; // 紅色
              if (cell.value === '遲到' || cell.value === '早退' || cell.value === '遲到、早退') cell.font = { color: { argb: 'FFF59E0B' } }; // 橘色
            }
          });
        });
  
        // 標題列美化 (自動換行、置中)
        const headerRow2 = worksheet2.getRow(1);
        headerRow2.height = 40;
        headerRow2.eachCell((cell) => {
          cell.font = { bold: true };
          cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
        });
  
        // 2. 生成 Buffer 並觸發下載
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], {
          type:
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${courseName}_點名紀錄.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
  
        Swal.close();
        Swal.fire('成功', '已匯出點名紀錄 Excel 檔案', 'success');
      } catch (e) {
        console.error('Export attendance error:', e);
        Swal.fire('錯誤', '匯出失敗，請稍後再試。', 'error');
      }
    };
  
    const handleDelete = async (activityId: string) => {
      const result = await Swal.fire({
        title: '確定刪除?', text: "刪除後資料無法復原！", icon: 'warning',
        showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: '刪除', cancelButtonText: '取消', customClass: { popup: 'rounded-2xl' }
      });
      if (result.isConfirmed) {
        try {
          await fetch('/api/attendance/activities/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, activityId }) });
          setActivities(prev => prev.filter(a => a.id !== activityId));
          Swal.fire('已刪除', '活動已移除', 'success');
        } catch { Swal.fire('錯誤', '刪除失敗', 'error'); }
      }
    };

    const handleToggleVisibility = async (activity: AttendanceActivity) => {
      if (isArchived) return;
      const nextVisible = !isStudentVisible(activity.visibleToStudents);
      try {
        const res = await fetch('/api/attendance/activities/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courseId,
            activityId: activity.id,
            visibleToStudents: nextVisible,
          }),
        });
        if (!res.ok) throw new Error('更新失敗');
        setActivities((prev) =>
          prev.map((a) =>
            a.id === activity.id ? { ...a, visibleToStudents: nextVisible } : a
          )
        );
        Swal.fire({
          icon: 'success',
          title: nextVisible ? '已開放' : '已隱藏',
          text: nextVisible ? '學生端現在可以看到此點名。' : '學生端將無法看到此點名。',
          confirmButtonColor: '#2D6DF6',
        });
      } catch {
        Swal.fire('錯誤', '更新可見性失敗', 'error');
      }
    };
  
    return (
      <>
        {isCreateModalOpen && (
          <Modal
            open={true}
            onClose={() => setIsCreateModalOpen(false)}
            title="新增點名活動"
          >
            <CreateAttendanceActivityForm
              courseId={courseId}
              onClose={() => setIsCreateModalOpen(false)}
              onComplete={() => {
                setIsCreateModalOpen(false);
                fetchActivities();
              }}
            />
          </Modal>
        )}
        <TeacherAttendanceList
          courseName={courseName}
          activities={activities}
          loading={loading}
          isArchived={isArchived}
          studentCount={studentCount}
          absenceAlertCount={absenceAlertCount}
          embedded={embedded}
          onBack={onBack}
          onCreate={() => setIsCreateModalOpen(true)}
          onExport={() => void handleExport()}
          onSelect={onSelectActivity}
          onDelete={(id) => void handleDelete(id)}
          onToggleVisibility={(item) => void handleToggleVisibility(item)}
          shouldShowCheckInCode={shouldDisplayCheckInCode}
        />
      </>
    );
  }
  
  // ==========================================
  // 5. 第一層：主入口 (AttendanceManagementComponent)
  // ==========================================
  
  interface AttendanceManagementComponentProps {
    courses?: Course[];
    userInfo?: { id: string; name?: string; role?: string | string[] } | null;
    courseCodeFromUrl?: string;
    attendanceCodeFromUrl?: string;
    /** 嵌入課程詳情分頁時隱藏標題與返回列 */
    embedded?: boolean;
    /** 從課程整合頁進入時，返回應回到此路徑（如 ?tab=attendance） */
    returnTo?: string;
  }
  
  export default function AttendanceManagementComponent({
    courses: externalCourses,
    userInfo,
    courseCodeFromUrl = '',
    attendanceCodeFromUrl = '',
    embedded = false,
    returnTo = '',
  }: AttendanceManagementComponentProps = {}) {
    const router = useRouter();
    const [courses, setCourses] = useState<Course[]>([]);
    const [loading, setLoading] = useState(true);
    const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
    const [students, setStudents] = useState<Student[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [activityCache, setActivityCache] = useState<AttendanceActivity | null>(null);
    const prevAttendanceCodeRef = useRef('');
  
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGrade, setSelectedGrade] = useState('all');
    const [selectedSubject, setSelectedSubject] = useState('all');
    const [selectedNature, setSelectedNature] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');

    const decodedCourseCode = useMemo(
      () => (courseCodeFromUrl ? decodeURIComponent(courseCodeFromUrl) : ''),
      [courseCodeFromUrl]
    );

    const routeLayer = useMemo(
      () => getAttendanceRouteLayer(courseCodeFromUrl, attendanceCodeFromUrl),
      [courseCodeFromUrl, attendanceCodeFromUrl]
    );

    const decodedAttendanceCode = useMemo(
      () => (attendanceCodeFromUrl ? decodeURIComponent(attendanceCodeFromUrl) : ''),
      [attendanceCodeFromUrl]
    );

    const filterCourses = useCallback(
      (courseList: Course[]) => filterCoursesForUser(courseList, userInfo),
      // filterCoursesForUser only reads userInfo.id; avoid re-filtering on unrelated userInfo field changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [userInfo?.id]
    );

    const effectiveCourses = useMemo(() => {
      if (courses.length > 0) return courses;
      if (externalCourses && externalCourses.length > 0) return filterCourses(externalCourses);
      return [];
    }, [courses, externalCourses, filterCourses]);

    const selectedCourse = useMemo(() => {
      if (!decodedCourseCode) return null;
      const fromList = effectiveCourses.find((c) => c.code === decodedCourseCode);
      if (fromList) return fromList;
      return getPendingAttendanceCourse(decodedCourseCode);
    }, [decodedCourseCode, effectiveCourses]);

    const pendingActivity = useMemo(() => {
      if (!decodedCourseCode || !decodedAttendanceCode) return null;
      return getPendingAttendanceActivity(decodedCourseCode, decodedAttendanceCode);
    }, [decodedCourseCode, decodedAttendanceCode]);

    const resolvedActivity = activityCache ?? pendingActivity;

    const resolvedCourseName =
      selectedCourse?.name ||
      getPendingAttendanceCourse(decodedCourseCode)?.name ||
      decodedCourseCode ||
      '載入中';

    const selectCourse = useCallback(
      (course: Course | null) => {
        setActivityCache(null);
        clearPendingAttendanceActivity();
        if (course) {
          setPendingAttendanceCourse(course);
        } else {
          clearPendingAttendanceCourse();
        }
        if (!course && returnTo) {
          router.push(returnTo);
          return;
        }
        router.push(buildAttendanceUrl(course?.code));
      },
      [router, returnTo]
    );

    const selectActivity = useCallback(
      (activity: AttendanceActivity | null, course?: Course | null) => {
        const targetCourse = course ?? selectedCourse;
        const routeKey = activity ? activityRouteKey(activity) : '';
        if (activity && targetCourse?.code && routeKey) {
          setPendingAttendanceCourse(targetCourse);
          setPendingAttendanceActivity(targetCourse.code, routeKey, activity);
          setActivityCache(activity);
          const hubReturn =
            returnTo ||
            (embedded ? teacherCourseHubPath(targetCourse.code, 'attendance') : '');
          router.push(
            withReturnTo(buildAttendanceUrl(targetCourse.code, routeKey), hubReturn || null)
          );
          return;
        }

        setActivityCache(null);
        clearPendingAttendanceActivity();
        if (returnTo && !activity) {
          router.push(returnTo);
          return;
        }
        if (targetCourse?.code) {
          router.push(buildAttendanceUrl(targetCourse.code));
        } else {
          clearPendingAttendanceCourse();
          router.push(buildAttendanceUrl());
        }
      },
      [router, selectedCourse, returnTo, embedded]
    );
  
    useEffect(() => {
      if (externalCourses && externalCourses.length > 0) {
        setCourses(filterCourses(externalCourses));
        setLoading(false);
        return;
      }
      const fetchCourses = async () => {
        try {
          const response = await fetch('/api/courses/list', { method: 'POST' });
          if (response.ok) {
            const coursesData: Course[] = await response.json();
            setCourses(filterCourses(coursesData));
            setLoading(false); // 提早解除載入狀態，優先顯示課程列表
            
            // 背景抓取學生名單以計算人數
            fetch('/api/student/list')
              .then(resStudents => resStudents.ok ? resStudents.json() : [])
              .then(allStudents => {
                const newCounts: Record<string, number> = {};
                coursesData.forEach(course => {
                  const courseKey = `${course.name}(${course.code})`;
                  const count = allStudents.filter((s: { enrolledCourses?: string[] }) => s.enrolledCourses && (s.enrolledCourses.includes(course.id) || s.enrolledCourses.includes(courseKey))).length;
                  newCounts[course.id] = count;
                });
                setStudentCounts(newCounts);
              }).catch(console.error);
          }
        } catch (error) { console.error(error); setLoading(false); }
      };
      fetchCourses();
    }, [externalCourses, filterCourses]);

    // 僅在「離開活動 URL」時清除快取，避免 router.push 過渡期誤清快取造成標題跳動
    useEffect(() => {
      const prevCode = prevAttendanceCodeRef.current;
      prevAttendanceCodeRef.current = decodedAttendanceCode;
      if (prevCode && !decodedAttendanceCode) {
        setActivityCache(null);
        clearPendingAttendanceActivity();
      }
      if (!decodedCourseCode) {
        clearPendingAttendanceCourse();
        clearPendingAttendanceActivity();
      }
    }, [decodedAttendanceCode, decodedCourseCode]);

    useEffect(() => {
      if (!decodedAttendanceCode || !selectedCourse) return;

      if (
        (activityCache?.checkInCode === decodedAttendanceCode ||
          activityCache?.id === decodedAttendanceCode) &&
        activityCache.id
      ) {
        return;
      }

      let cancelled = false;
      const resolveActivity = async () => {
        try {
          const res = await fetch('/api/attendance/activities/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseId: selectedCourse.id }),
          });
          if (!res.ok || cancelled) return;

          const data = await res.json();
          if (!Array.isArray(data) || cancelled) return;

          const activity = data
            .map((item: Parameters<typeof mapActivityFromApi>[0]) => mapActivityFromApi(item))
            .find(
              (a: AttendanceActivity) =>
                a.checkInCode === decodedAttendanceCode || a.id === decodedAttendanceCode
            );

          if (activity && !cancelled) {
            setActivityCache(activity);
          }
        } catch {
          // ignore URL resolve errors; user stays on activity list
        }
      };

      void resolveActivity();
      return () => {
        cancelled = true;
      };
      // Depend on selectedCourse.id only — full selectedCourse would re-fetch on object identity changes
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [decodedAttendanceCode, selectedCourse?.id, activityCache?.checkInCode, activityCache?.id]);
  
    useEffect(() => {
      if (!resolvedActivity?.id || !selectedCourse?.id) {
        setStudents([]);
        setLoadingStudents(false);
        return;
      }

      const fetchStudents = async () => {
        setLoadingStudents(true);
        try {
          const res = await fetch(`/api/course-student-list/list?courseId=${encodeURIComponent(selectedCourse.id)}`);
          if (res.ok) {
            const roster = await res.json();
            const enrolledStudents: Student[] = (Array.isArray(roster) ? roster : []).map((s: { id?: string; studentId?: string; name?: string }) => ({
              id: String(s.id || s.studentId || ''),
              studentId: String(s.studentId || s.id || ''),
              name: String(s.name || ''),
            }));

            enrolledStudents.sort((a, b) => {
              const idA = a.studentId;
              const idB = b.studentId;
              const aIsAlpha = /^[A-Za-z]/.test(idA);
              const bIsAlpha = /^[A-Za-z]/.test(idB);
              
              if (aIsAlpha && !bIsAlpha) return 1;
              if (!aIsAlpha && bIsAlpha) return -1;
              
              return idA.localeCompare(idB, undefined, { numeric: true, sensitivity: 'base' });
            });
            setStudents(enrolledStudents);
          } else {
            setStudents([]);
          }
        } catch { setStudents([]); } finally { setLoadingStudents(false); }
      };
      fetchStudents();
    }, [resolvedActivity?.id, selectedCourse?.id]);
  
    const filteredCourses = useMemo(() => {
      return courses.filter((course: Course) => {
        const statusMatch = selectedStatus === 'all' ? !(course.status && course.status.includes('已封存')) && !(course.name && course.name.includes('已封存')) : course.status === selectedStatus;
        const natureMatch = selectedNature === 'all' || course.courseNature === selectedNature;
  
        return ((course.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
               (course.code?.toLowerCase() || '').includes(searchTerm.toLowerCase())) && 
               (selectedGrade === 'all' || (course.gradeTags && Array.isArray(course.gradeTags) && course.gradeTags.includes(selectedGrade))) && 
               (selectedSubject === 'all' || course.subjectTag === selectedSubject) &&
               natureMatch &&
               statusMatch;
      }).sort((a, b) => {
          const statuses = ['報名中', '開課中', '未開課', '已額滿', '已結束', '已封存', '資料建置中...'];
          const statusA = statuses.indexOf(a.status || '');
          const statusB = statuses.indexOf(b.status || '');
          const priorityA = statusA !== -1 ? statusA : 999;
          const priorityB = statusB !== -1 ? statusB : 999;
  
          if (priorityA !== priorityB) {
              return priorityA - priorityB;
          }
  
          const codeA = a.code || '';
          const codeB = b.code || '';
  
          const codeCompare = codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
          
          if (codeCompare !== 0) return codeCompare;
          
          const nameA = a.name || '';
          const nameB = b.name || '';
          return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
      });
    }, [courses, searchTerm, selectedGrade, selectedSubject, selectedNature, selectedStatus]);
  
    const canRenderActivityRoster = Boolean(
      routeLayer === 'activity' &&
      selectedCourse?.id &&
      resolvedActivity?.id
    );

    // 依 URL 深度直接進入對應層，避免載入時依序閃過外層標題
    if (routeLayer === 'activity') {
      if (!canRenderActivityRoster) {
        return (
          <AttendanceActivityRouteShell
            activityName={resolvedActivity?.name || '點名活動'}
            courseName={resolvedCourseName}
            activityInfo={resolvedActivity}
            onBack={() => selectActivity(null)}
          />
        );
      }

      return (
        <AttendanceRosterManager
          activityId={resolvedActivity!.id}
          courseId={selectedCourse!.id}
          courseName={selectedCourse!.name}
          students={students}
          studentsLoading={loadingStudents}
          onClose={() => selectActivity(null)}
          initialActivityData={resolvedActivity}
          isArchived={selectedCourse!.status === '已封存'}
        />
      );
    }

    if (routeLayer === 'course') {
      if (!selectedCourse?.id) {
        return (
          <div className={embedded ? 'w-full min-w-0 flex flex-col animate-fade-in' : 'page-shell w-full min-w-0 pb-10 flex flex-col h-full animate-fade-in'}>
            {!embedded && (
              <PageHeader
                title={resolvedCourseName}
                description="點名活動列表 • 載入中"
                icon={<CalendarDaysIcon className="h-8 w-8 text-primary" />}
              />
            )}
            <PageLoadingArea />
          </div>
        );
      }

      return (
        <AttendanceActivityList 
          courseId={selectedCourse.id} 
          courseName={selectedCourse.name} 
          courseCode={selectedCourse.code}
          onBack={() => selectCourse(null)} 
          isArchived={selectedCourse.status === '已封存'}
          onSelectActivity={(activity) => selectActivity(activity)}
          embedded={embedded}
        />
      );
    }

    if (loading && effectiveCourses.length === 0) {
      return (
        <div className="page-shell w-full min-w-0 pb-10 flex flex-col h-full animate-fade-in">
          <PageHeader
            title="點名管理"
            description="記錄學生的出缺席狀況，包含手動點名與數字簽到。"
            icon={<CalendarDaysIcon className="h-8 w-8 text-primary" />}
          />
          <PageLoadingArea />
        </div>
      );
    }

    // Layer 1
    return (
      <div className="page-shell w-full min-w-0 pb-10 flex flex-col h-full animate-fade-in">
        <PageHeader
          title="點名管理"
          description="記錄學生的出缺席狀況，包含手動點名與數字簽到。"
          icon={<CalendarDaysIcon className="h-8 w-8 text-primary" />}
        />
  
        {loading ? (
          <PageLoadingArea />
        ) : courses.length === 0 ? (
             <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
                 <h3 className="mt-2 text-xl font-bold text-gray-900">尚無可管理的課程</h3>
             </div>
         ) : (
            <>
              {/* 篩選器 */}
              {!loading && courses.length > 0 && (
                <CourseFilter
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  selectedGrade={selectedGrade}
                  onGradeChange={setSelectedGrade}
                  selectedSubject={selectedSubject}
                  onSubjectChange={setSelectedSubject}
                  selectedNature={selectedNature}
                  onNatureChange={setSelectedNature}
                  selectedStatus={selectedStatus}
                  onStatusChange={setSelectedStatus}
                  onReset={() => {
                    setSearchTerm('');
                    setSelectedGrade('all');
                    setSelectedSubject('all');
                    setSelectedNature('all');
                    setSelectedStatus('all');
                  }}
                />
              )}
  
              {filteredCourses.length === 0 ? (
                  <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
                      <h3 className="mt-2 text-xl font-bold text-gray-900">尚無符合的課程</h3>
                  </div>
              ) : (
                <>
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden hidden md:block">
                      <table className="w-full text-sm text-left text-gray-500">
                          <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                              <tr>
                                  <th className="px-6 py-4 font-bold min-w-[250px]">課程名稱</th>
                                  <th className="px-6 py-4 font-bold text-center w-[150px]">學生人數</th>
                                  <th className="px-6 py-4 font-bold text-right w-[150px]">操作</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                              {filteredCourses.map((course) => (
                              <tr key={course.id} className="hover:bg-primary/5 transition-colors group">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="font-bold text-gray-900 text-base">{course.name}</div>
                                      <div className="text-xs font-mono text-gray-500 mt-1">{course.code}</div>
                                  </td>
                                  <td className="px-6 py-4 text-center whitespace-nowrap">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                         <UserGroupIcon className="w-3 h-3 mr-1"/>{studentCounts[course.id] ?? '-'} 人
                                      </span>
                                  </td>
                                  <td className="px-6 py-4 text-right whitespace-nowrap">
                                      <button onClick={() => selectCourse(course)} className="inline-flex items-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors shadow-sm">管理</button>
                                  </td>
                              </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>
                  <div className="md:hidden space-y-4">
                      {filteredCourses.map((course) => (
                          <div key={course.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 flex flex-col gap-3 active:scale-[0.99] transition-transform" onClick={() => selectCourse(course)}>
                              <div className="flex justify-between items-start">
                                   <div><h3 className="font-bold text-gray-900 text-lg">{course.name}</h3><p className="text-xs font-mono text-gray-500">{course.code}</p></div>
                                   <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 shrink-0"><UserGroupIcon className="w-3 h-3 mr-1"/>{studentCounts[course.id] ?? '-'} 人</span>
                              </div>
                              <div className="border-t border-gray-100 pt-3 flex justify-end">
                                   <button onClick={(e) => { e.stopPropagation(); selectCourse(course); }} className="w-full flex items-center justify-center px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors">管理點名 <ChevronRightIcon className="w-4 h-4 ml-1" /></button>
                              </div>
                          </div>
                      ))}
                  </div>
                </>
              )}
            </>
         )}
      </div>
    );
  }
  