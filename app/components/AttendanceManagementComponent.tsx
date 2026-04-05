'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Swal from 'sweetalert2';
import LoadingSpinner from './LoadingSpinner'; 
// 引入您的外部表單元件
import CreateAttendanceActivityForm from './CreateAttendanceActivityForm';
import CourseFilter from './CourseFilter';
import { 
  CalendarDaysIcon, ArrowLeftIcon, PlusIcon, TrashIcon, 
  XMarkIcon, ClipboardDocumentCheckIcon, CheckCircleIcon, 
  CloudArrowUpIcon, FunnelIcon, 
  QrCodeIcon, ChevronDownIcon, UserGroupIcon, ChevronRightIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

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
  mode: 'manual' | 'digital';
  checkInCode?: string;
}

interface AttendanceRecord {
  studentId: string;
  status: string; 
  note?: string;
}

// 假別細項
const LEAVE_OPTIONS = [
  { value: '病假', label: '病假', color: 'text-blue-600' },
  { value: '事假', label: '事假', color: 'text-purple-600' },
  { value: '公假', label: '公假', color: 'text-indigo-600' },
  { value: '喪假', label: '喪假', color: 'text-gray-600' },
  { value: '生理假', label: '生理假', color: 'text-pink-600' },
  { value: '心理假', label: '心理假', color: 'text-rose-600' },
];

const ALL_LEAVE_VALUES = LEAVE_OPTIONS.map(l => l.value);

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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidthClass} max-h-[90vh] flex flex-col animate-bounce-in border border-gray-100`}>
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex-shrink-0 rounded-t-2xl">
          <h3 className="text-xl font-bold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-200">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>,
    document.body
  );
};

// --- [關鍵修正] 全局懸浮下拉選單 (避免撐開表格) ---
interface FixedDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  options: { value: string; label: string; color?: string }[];
  onSelect: (val: string) => void;
  triggerRef: React.RefObject<HTMLButtonElement>;
}

const FixedDropdownPortal = ({ isOpen, onClose, options, onSelect, triggerRef }: FixedDropdownProps) => {
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX,
        width: Math.max(rect.width, 100)
      });
    }
  }, [isOpen, triggerRef]);

  // 點擊外部關閉
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current && triggerRef.current.contains(target)) return; // 點擊觸發按鈕不處理(由按鈕自己toggle)
      const menu = document.getElementById('fixed-portal-menu');
      if (menu && !menu.contains(target)) onClose();
    };
    if (isOpen) window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      id="fixed-portal-menu"
      className="fixed z-[99999] bg-white rounded-lg shadow-xl border border-gray-200 py-1 animate-fade-in-down"
      style={{ top: coords.top, left: coords.left, minWidth: coords.width }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => { onSelect(opt.value); onClose(); }}
          className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 font-medium ${opt.color || 'text-gray-700'}`}
        >
          {opt.label}
        </button>
      ))}
    </div>,
    document.body
  );
};

// --- 請假按鈕組件 (整合懸浮選單) ---
const LeaveButton = ({ currentStatus, onSetStatus }: { currentStatus: string, onSetStatus: (val: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const isLeave = ALL_LEAVE_VALUES.includes(currentStatus);
  const displayLabel = isLeave ? currentStatus : '請假'; // 顯示目前假別

  return (
    <>
      <div className="relative inline-flex items-center">
        {/* 左側：主按鈕 (點擊切換為預設請假或保持當前假別) */}
        <button
          onClick={() => onSetStatus(isLeave ? currentStatus : '病假')}
          className={`px-3 py-1.5 rounded-l-lg border text-xs font-bold transition-all border-r-0 ${
            isLeave 
              ? 'bg-blue-500 text-white border-blue-500 shadow-md ring-2 ring-blue-200' 
              : 'bg-white text-gray-500 hover:bg-blue-50 hover:text-blue-600 border-gray-200'
          }`}
        >
          {displayLabel}
        </button>
        
        {/* 右側：下拉觸發 (僅在已是請假狀態或想要選擇假別時使用) */}
        <button
          ref={buttonRef}
          onClick={() => setIsOpen(!isOpen)}
          className={`px-1.5 py-1.5 rounded-r-lg border text-xs font-bold transition-all flex items-center justify-center ${
            isLeave 
              ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200' 
              : 'bg-white text-gray-500 hover:bg-blue-50 hover:text-blue-600 border-gray-200'
          }`}
        >
          <ChevronDownIcon className="w-3 h-3" />
        </button>
      </div>

      <FixedDropdownPortal 
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={buttonRef}
        options={LEAVE_OPTIONS}
        onSelect={onSetStatus}
      />
    </>
  );
};

// ==========================================
// 3. 第三層：點名執行 (AttendanceRosterManager)
// ==========================================

interface AttendanceRosterManagerProps {
  activityId: string;
  courseId: string;
  courseName: string;
  students: Student[];
  onClose: () => void;
  initialActivityData?: AttendanceActivity | null;
}

function AttendanceRosterManager({ activityId, courseId, courseName, students = [], onClose, initialActivityData }: AttendanceRosterManagerProps) {
  const safeStudents = Array.isArray(students) ? students : [];
  
  const [records, setRecords] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activityInfo, setActivityInfo] = useState<AttendanceActivity | null>(initialActivityData || null);
  const [filterStatus, setFilterStatus] = useState<string>('全部');

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
        const recordMap: Record<string, string> = {};
        const noteMap: Record<string, string> = {};
        if (data.records && Array.isArray(data.records)) {
            data.records.forEach((r: AttendanceRecord) => {
                recordMap[r.studentId] = r.status;
                if (r.note) noteMap[r.studentId] = r.note;
            });
        }
        setRecords(recordMap);
        setNotes(noteMap);
        if (data.activity) setActivityInfo(data.activity);
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
    setRecords(prev => ({ ...prev, [studentId]: status }));
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setNotes(prev => ({ ...prev, [studentId]: note }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const recordsArray = Object.entries(records).map(([studentId, status]) => ({
        studentId,
        status,
        note: notes[studentId] || ''
      }));

      const res = await fetch('/api/attendance/records/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, activityId, records: recordsArray })
      });

      if (!res.ok) throw new Error('Save failed');
      Swal.fire({
        icon: 'success',
        title: '儲存成功',
        text: '點名紀錄已成功儲存',
        confirmButtonColor: '#4f46e5',
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
    setRecords(prev => {
      const newRecords = { ...prev };
      safeStudents.forEach(s => {
        if (!newRecords[s.studentId]) {
          newRecords[s.studentId] = '出席';
        }
      });
      return newRecords;
    });
    Swal.fire({
      icon: 'success',
      title: '已將未點名學生設為出席',
      confirmButtonText: '太棒了',
      confirmButtonColor: '#4f46e5',
      timer: 1500,
      timerProgressBar: true,
      customClass: { popup: 'rounded-2xl' }
    });
  };

  // 統計 (增加 '曠課' 欄位)
  const stats = {
    present: Object.values(records).filter(s => s === '出席').length,
    late: Object.values(records).filter(s => s === '遲到').length,
    leave: Object.values(records).filter(s => ALL_LEAVE_VALUES.includes(s)).length,
    absent: Object.values(records).filter(s => s === '曠課').length, 
    total: safeStudents.length
  };
  const unrecorded = stats.total - Object.keys(records).length;

  const filteredStudents = safeStudents.filter(s => {
      const status = records[s.studentId];
      if (filterStatus === '全部') return true;
      if (filterStatus === '未點') return !status;
      if (filterStatus === '請假') return ALL_LEAVE_VALUES.includes(status);
      return status === filterStatus;
  });

  if (loading) return <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center"><LoadingSpinner size={60} text="載入名單中..." /></div>;

  return (
    <div className="max-w-7xl mx-auto w-full flex flex-col h-full animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center">
                <button onClick={onClose} className="mr-3 p-2 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                    <ArrowLeftIcon className="w-6 h-6" />
                </button>
                <div>
                    <div className="flex items-center gap-2">
                        <h2 className="text-2xl font-bold text-gray-800">{activityInfo?.name || '點名活動'}</h2>
                        {activityInfo?.mode === 'digital' && (
                            <span className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold flex items-center shadow-sm border border-indigo-200">
                                <QrCodeIcon className="w-3 h-3 mr-1"/>
                                簽到碼: <span className="text-lg ml-1 font-mono">{activityInfo.checkInCode}</span>
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-500 font-mono mt-1">{courseName} • 共 {safeStudents.length} 人</p>
                </div>
              </div>
              
              <div className="flex gap-2 self-end md:self-auto">
                  <button onClick={markAllPresent} className="btn-secondary text-sm flex items-center">
                     <CheckCircleIcon className="w-4 h-4 mr-1" /> 一鍵全到
                  </button>
                  <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center shadow-lg transform active:scale-95 transition-all">
                     {saving ? <LoadingSpinner size={16} color="white" /> : <><CloudArrowUpIcon className="w-5 h-5 mr-1" /> 儲存紀錄</>}
                  </button>
              </div>
          </div>

          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4">
              <div className="bg-emerald-50 border border-emerald-100 p-2 rounded-lg text-center"><div className="text-xs text-emerald-600 font-bold">出席</div><div className="text-lg font-bold text-emerald-700">{stats.present}</div></div>
              <div className="bg-rose-50 border border-rose-100 p-2 rounded-lg text-center"><div className="text-xs text-rose-600 font-bold">曠課</div><div className="text-lg font-bold text-rose-700">{stats.absent}</div></div>
              <div className="bg-blue-50 border border-blue-100 p-2 rounded-lg text-center"><div className="text-xs text-blue-600 font-bold">請假</div><div className="text-lg font-bold text-blue-700">{stats.leave}</div></div>
              <div className="bg-amber-50 border border-amber-100 p-2 rounded-lg text-center"><div className="text-xs text-amber-600 font-bold">遲到</div><div className="text-lg font-bold text-amber-700">{stats.late}</div></div>
              <div className="bg-gray-50 border border-gray-100 p-2 rounded-lg text-center col-span-2 md:col-span-1"><div className="text-xs text-gray-500 font-bold">未點</div><div className="text-lg font-bold text-gray-600">{unrecorded}</div></div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <FunnelIcon className="w-4 h-4 text-gray-400 shrink-0" />
              {['全部', '未點', '出席', '曠課', '請假', '遲到'].map((status) => (
                  <button key={status} onClick={() => setFilterStatus(status)} className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${filterStatus === status ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>{status}</button>
              ))}
          </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex-1 flex flex-col">
          {filteredStudents.length === 0 ? (
              <div className="text-center py-12 text-gray-400">沒有符合條件的學生</div>
          ) : (
             <>
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-500" style={{ minWidth: '800px' }}>
                        <thead className="bg-gray-50 text-xs text-gray-700 uppercase sticky top-0 z-10">
                            <tr>
                                <th className="px-6 py-4 font-bold w-[120px]">學號</th>
                                <th className="px-6 py-4 font-bold w-[120px]">姓名</th>
                                <th className="px-6 py-4 font-bold w-[380px]">點名狀態</th>
                                <th className="px-6 py-4 font-bold">備註</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredStudents.map((student) => {
                                const currentStatus = records[student.studentId] || '';
                                
                                return (
                                    <tr key={student.studentId} className={`hover:bg-gray-50 transition-colors ${!currentStatus ? 'bg-orange-50/10' : ''}`}>
                                        <td className="px-6 py-4 font-mono text-gray-900">{student.studentId}</td>
                                        <td className="px-6 py-4 font-bold text-gray-900">{student.name}</td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2 items-center">
                                                {/* 出席 */}
                                                <button onClick={() => handleSetStatus(student.studentId, '出席')} className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${currentStatus === '出席' ? 'bg-emerald-500 text-white border-emerald-500 shadow-md ring-2 ring-emerald-200' : 'bg-white text-gray-500 hover:bg-emerald-50 hover:text-emerald-600'}`}>出席</button>
                                                
                                                {/* 遲到 */}
                                                <button onClick={() => handleSetStatus(student.studentId, '遲到')} className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${currentStatus === '遲到' ? 'bg-amber-500 text-white border-amber-500 shadow-md ring-2 ring-amber-200' : 'bg-white text-gray-500 hover:bg-amber-50 hover:text-amber-600'}`}>遲到</button>

                                                {/* 曠課 */}
                                                <button onClick={() => handleSetStatus(student.studentId, '曠課')} className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${currentStatus === '曠課' ? 'bg-rose-500 text-white border-rose-500 shadow-md ring-2 ring-rose-200' : 'bg-white text-gray-500 hover:bg-rose-50 hover:text-rose-600'}`}>曠課</button>
                                                
                                                {/* 請假 (特殊處理：帶有懸浮選單的按鈕) */}
                                                <div className="relative">
                                                    <LeaveButton 
                                                        currentStatus={currentStatus}
                                                        onSetStatus={(val) => handleSetStatus(student.studentId, val)}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <input type="text" placeholder="備註..." className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 outline-none bg-white" value={notes[student.studentId] || ''} onChange={(e) => handleNoteChange(student.studentId, e.target.value)} />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View */}
                <div className="md:hidden p-4 space-y-4 bg-gray-50/50">
                     {filteredStudents.map((student) => {
                         const currentStatus = records[student.studentId] || '';
                         
                         return (
                            <div key={student.studentId} className={`bg-white border rounded-xl p-4 shadow-sm ${!currentStatus ? 'border-orange-200 bg-orange-50/30' : 'border-gray-200'}`}>
                                <div className="flex justify-between items-center mb-3">
                                    <div><div className="font-bold text-gray-900 text-lg">{student.name}</div><div className="text-xs font-mono text-gray-500">{student.studentId}</div></div>
                                    {currentStatus && <span className="px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-700">{currentStatus}</span>}
                                </div>
                                
                                <div className="flex flex-wrap gap-2 mb-3">
                                    <button onClick={() => handleSetStatus(student.studentId, '出席')} className={`px-4 py-2 flex-1 rounded border text-xs font-bold ${currentStatus==='出席'?'bg-emerald-100 text-emerald-700 border-emerald-300':'bg-white text-gray-500'}`}>出席</button>
                                    <button onClick={() => handleSetStatus(student.studentId, '遲到')} className={`px-4 py-2 flex-1 rounded border text-xs font-bold ${currentStatus==='遲到'?'bg-amber-100 text-amber-700 border-amber-300':'bg-white text-gray-500'}`}>遲到</button>
                                    <button onClick={() => handleSetStatus(student.studentId, '曠課')} className={`px-4 py-2 flex-1 rounded border text-xs font-bold ${currentStatus==='曠課'?'bg-rose-100 text-rose-700 border-rose-300':'bg-white text-gray-500'}`}>曠課</button>
                                    <div className="flex-1">
                                        <LeaveButton 
                                            currentStatus={currentStatus}
                                            onSetStatus={(val) => handleSetStatus(student.studentId, val)}
                                        />
                                    </div>
                                </div>

                                <input type="text" placeholder="新增備註..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none bg-gray-50" value={notes[student.studentId] || ''} onChange={(e) => handleNoteChange(student.studentId, e.target.value)} />
                            </div>
                         );
                     })}
                </div>
             </>
          )}
      </div>
      
      <div className="md:hidden fixed bottom-6 right-6 z-40">
          <button onClick={handleSave} disabled={saving} className="w-14 h-14 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 transition-all disabled:bg-gray-400">
              {saving ? <LoadingSpinner size={24} color="white" /> : <CloudArrowUpIcon className="w-7 h-7" />}
          </button>
      </div>
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
  onSelectActivity: (activity: AttendanceActivity) => void;
}

function AttendanceActivityList({ courseId, courseName, courseCode, onBack, onSelectActivity }: AttendanceActivityListProps) {
  const [activities, setActivities] = useState<AttendanceActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
            mode?: 'manual' | 'digital';
            checkInMethod?: string;
            type?: string;
            checkInCode?: string;
          }) => {
            const toISO = (d: unknown) => {
              if (!d) return undefined;
              if (typeof d === 'string') return d;
              if (typeof d === 'object' && d !== null && '_seconds' in d && '_nanoseconds' in d) {
                return new Date((d as { _seconds: number })._seconds * 1000 + (d as { _nanoseconds: number })._nanoseconds / 1000000).toISOString();
              }
              try { return new Date(d as string | number).toISOString(); } catch { return String(d); }
            };

            const dateISO = toISO(item.date);
            const startTimeISO = toISO(item.startTime);

            const rawDate =
              dateISO ||
              startTimeISO ||
              new Date().toISOString();

            const mode: 'manual' | 'digital' =
              item.mode ||
              (item.checkInMethod === 'numeric' ? 'digital' : 'manual');

            return {
              id: item.id,
              name: item.name || item.title || '未命名活動',
              date: rawDate,
              type: item.type || '一般課程',
              mode,
              checkInCode: item.checkInCode,
            };
          });

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

  useEffect(() => { fetchActivities(); }, [fetchActivities]);

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
      const { Workbook } = await import('exceljs');
      const workbook = new Workbook();
      
      // --- 第一個工作表：活動摘要 ---
      const worksheet = workbook.addWorksheet('點名活動摘要');

      worksheet.columns = [
        { header: '日期 / 開始時間', key: 'date', width: 22 },
        { header: '類型', key: 'type', width: 16 },
        { header: '活動名稱', key: 'name', width: 32 },
        { header: '點名方式', key: 'mode', width: 16 },
        { header: '點名代碼', key: 'checkInCode', width: 16 },
      ];

      activities.forEach((a) => {
        worksheet.addRow({
          date: formatDate(a.date),
          type: a.type,
          name: a.name,
          mode: a.mode === 'digital' ? '數字點名' : '手動點名',
          checkInCode: a.mode === 'digital' ? a.checkInCode || '' : '',
        });
      });

      // --- 第二個工作表：學生出缺席總表 ---
      const worksheet2 = workbook.addWorksheet('學生出缺席詳細名單');
      
      // 1. 抓取學生名單
      const stuRes = await fetch('/api/course-student-list/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseName, courseCode })
      });
      const students: Student[] = await stuRes.json();

      // 2. 抓取所有活動的紀錄資料
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

      // 3. 設定欄位 (學號, 姓名, 然後是各個點名日期)
      const columns = [
        { header: '學號', key: 'studentId', width: 15 },
        { header: '姓名', key: 'name', width: 15 },
      ];

      activities.forEach(a => {
        columns.push({ header: `${formatDate(a.date).split(' ')[0]}\n${a.name}`, key: a.id, width: 20 });
      });
      worksheet2.columns = columns;

      // 4. 填充學生資料列
      students.forEach(student => {
        const rowData: Record<string, string> = {
          studentId: student.studentId,
          name: student.name
        };
        
        activities.forEach(activity => {
          const activityData = allRecordsData.find(d => d.activityId === activity.id);
          const record = activityData?.records.find((r: AttendanceRecord) => r.studentId === student.studentId);
          rowData[activity.id] = record ? record.status : '未點名';
        });
        
        worksheet2.addRow(rowData);
      });

      // 美化標題列 (自動換行)
      worksheet2.getRow(1).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };

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
      showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: '刪除', cancelButtonText: '取消'
    });
    if (result.isConfirmed) {
      try {
        await fetch('/api/attendance/activities/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, activityId }) });
        setActivities(prev => prev.filter(a => a.id !== activityId));
        Swal.fire('已刪除', '活動已移除', 'success');
      } catch { Swal.fire('錯誤', '刪除失敗', 'error'); }
    }
  };

  if (loading) return <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center"><LoadingSpinner size={60} /></div>;

  return (
    <div className="max-w-7xl mx-auto w-full flex flex-col h-full animate-fade-in pb-10">
      <div className="flex items-center mb-6">
        <CalendarDaysIcon className="w-8 h-8 mr-3 text-indigo-600" />
        <div><h2 className="text-2xl font-bold text-gray-800">{courseName}</h2><p className="text-sm text-gray-500 font-mono">點名活動列表</p></div>
      </div>

      <div className="flex flex-wrap justify-between items-center mb-4">
        <div className="flex gap-3">
            <button className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm font-medium flex items-center" onClick={onBack}>
            <ArrowLeftIcon className="w-4 h-4 mr-2" /> 返回課程
            </button>
            {/* 彈出視窗觸發 */}
            <button className="btn-secondary flex items-center" onClick={() => setIsCreateModalOpen(true)}>
                <PlusIcon className="w-4 h-4 mr-2" /> 新增點名
            </button>
        </div>
        <button onClick={handleExport} className="btn-secondary flex items-center text-emerald-700 border-emerald-200 hover:bg-emerald-50">
            <ArrowDownTrayIcon className="w-4 h-4 mr-2" /> 匯出紀錄
        </button>
      </div>

      {/* 外部表單 Modal Wrapper */}
      {isCreateModalOpen && (
          <Modal open={true} onClose={() => setIsCreateModalOpen(false)} title="新增點名活動">
              <CreateAttendanceActivityForm 
                courseId={courseId}
                onClose={() => setIsCreateModalOpen(false)}
                onComplete={() => { setIsCreateModalOpen(false); fetchActivities(); }}
              />
          </Modal>
      )}

      {activities.length === 0 ? (
           <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
               <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400"><ClipboardDocumentCheckIcon className="w-8 h-8" /></div>
               <h3 className="mt-2 text-xl font-bold text-gray-900">尚無點名紀錄</h3>
               <button className="btn-primary mt-4" onClick={() => setIsCreateModalOpen(true)}>新增點名活動</button>
           </div>
       ) : (
           <>
              <div className="hidden md:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                 <table className="w-full text-sm text-left text-gray-500">
                    <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                        <tr>
                            <th className="px-6 py-4 font-bold w-[160px]">日期</th>
                            <th className="px-6 py-4 font-bold w-[120px]">類型</th>
                            <th className="px-6 py-4 font-bold min-w-[200px]">活動名稱</th>
                            <th className="px-6 py-4 font-bold w-[150px]">點名代碼</th>
                            <th className="px-6 py-4 font-bold text-right w-[150px]">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {activities.map((activity) => (
                            <tr key={activity.id} className="hover:bg-indigo-50/30 transition-colors group">
                                <td className="px-6 py-4 font-mono text-gray-900 font-bold whitespace-nowrap">{formatDate(activity.date)}</td>
                                <td className="px-6 py-4 font-bold whitespace-nowrap text-gray-700">
                                    {activity.mode === 'digital' ? '數字點名' : '手動點名'}
                                </td>
                                <td className="px-6 py-4 font-bold text-gray-900">{activity.name}</td>
                                <td className="px-6 py-4 font-mono text-gray-700 font-bold">
                                    {activity.mode === 'digital' ? (
                                        <span className="bg-gray-100 px-2 py-1 rounded text-indigo-600">{activity.checkInCode || '-'}</span>
                                    ) : (
                                        <span className="text-xs text-gray-400"> - </span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => onSelectActivity(activity)} className="btn-primary px-3 py-1.5 text-xs flex items-center">進入點名</button>
                                        <button onClick={() => handleDelete(activity.id)} className="text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50"><TrashIcon className="w-4 h-4" /></button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
              </div>
              
              {/* Mobile View */}
              <div className="md:hidden space-y-4">
                  {activities.map((activity) => (
                      <div key={activity.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 flex flex-col gap-3 active:scale-[0.99] transition-transform" onClick={() => onSelectActivity(activity)}>
                          <div className="flex justify-between items-start">
                               <div><span className="text-xs font-mono text-gray-500 block mb-1">{formatDate(activity.date)}</span><h4 className="font-bold text-gray-800 text-lg">{activity.name}</h4></div>
                               <span className={`px-2 py-1 rounded text-xs border bg-gray-50 text-gray-700`}>
                                   {activity.mode === 'digital' ? '數字點名' : '手動點名'}
                               </span>
                          </div>
                          {activity.mode === 'digital' && (
                              <div className="bg-gray-50 px-3 py-2 rounded text-indigo-700 text-sm font-bold flex items-center border border-gray-200">
                                  <QrCodeIcon className="w-4 h-4 mr-2"/> 代碼: {activity.checkInCode}
                              </div>
                          )}
                          <div className="flex justify-end gap-3 pt-3 border-t border-gray-50 mt-1">
                               <button onClick={(e) => { e.stopPropagation(); handleDelete(activity.id); }} className="flex items-center text-sm text-gray-500 hover:text-red-600 font-medium px-2 py-1"><TrashIcon className="w-4 h-4 mr-1" /> 刪除</button>
                               <button className="flex items-center text-sm text-indigo-600 font-bold ml-auto">點名 <ChevronRightIcon className="w-4 h-4 ml-1" /></button>
                          </div>
                      </div>
                  ))}
              </div>
           </>
       )}
    </div>
  );
}

// ==========================================
// 5. 第一層：主入口 (AttendanceManagementComponent)
// ==========================================

interface AttendanceManagementComponentProps {
  courses?: Course[];
}

export default function AttendanceManagementComponent({ courses: externalCourses }: AttendanceManagementComponentProps = {}) {
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<AttendanceActivity | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentCounts, setStudentCounts] = useState<Record<string, number>>({});
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedNature, setSelectedNature] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  useEffect(() => {
    if (externalCourses && externalCourses.length > 0) {
      setCourses(externalCourses);
      setLoading(false);
      return;
    }
    const fetchCourses = async () => {
      try {
        const response = await fetch('/api/courses/list', { method: 'POST' });
        if (response.ok) {
          const coursesData: Course[] = await response.json();
          setCourses(coursesData);
          const studentCountsPromises = coursesData.map(async (course) => {
            try {
              const res = await fetch('/api/course-student-list/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseName: course.name, courseCode: course.code }),
              });
              if (res.ok) {
                const s = await res.json();
                return { courseId: course.id, count: s.length };
              }
            } catch (error) { console.error(error); }
            return { courseId: course.id, count: 0 };
          });
          const results = await Promise.all(studentCountsPromises);
          const newCounts: Record<string, number> = {};
          results.forEach(r => { if (r) newCounts[r.courseId] = r.count; });
          setStudentCounts(newCounts);
        }
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchCourses();
  }, [externalCourses]);

  useEffect(() => {
    if (selectedActivity && selectedCourse) {
      const fetchStudents = async () => {
        setLoadingStudents(true);
        try {
          const res = await fetch('/api/course-student-list/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseName: selectedCourse.name, courseCode: selectedCourse.code }),
          });
          if (res.ok) {
            setStudents(await res.json());
          } else {
            setStudents([]);
          }
        } catch { setStudents([]); } finally { setLoadingStudents(false); }
      };
      fetchStudents();
    }
  }, [selectedActivity, selectedCourse]);

  const filteredCourses = useMemo(() => {
    return courses.filter((course: Course) => {
      const statusMatch = selectedStatus === 'all' ? course.status !== '已封存' : course.status === selectedStatus;
      const natureMatch = selectedNature === 'all' || course.courseNature === selectedNature;

      return ((course.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
             (course.code?.toLowerCase() || '').includes(searchTerm.toLowerCase())) && 
             (selectedGrade === 'all' || (course.gradeTags && Array.isArray(course.gradeTags) && course.gradeTags.includes(selectedGrade))) && 
             (selectedSubject === 'all' || course.subjectTag === selectedSubject) &&
             natureMatch &&
             statusMatch;
    });
  }, [courses, searchTerm, selectedGrade, selectedSubject, selectedNature, selectedStatus]);

  // Layer 3
  if (selectedActivity && selectedCourse) {
    if (loadingStudents) return <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center"><LoadingSpinner size={60} text="正在載入學生名單..." /></div>;
    return <AttendanceRosterManager activityId={selectedActivity.id} courseId={selectedCourse.id} courseName={selectedCourse.name} students={students} onClose={() => setSelectedActivity(null)} initialActivityData={selectedActivity} />;
  }

  // Layer 2
  if (selectedCourse) {
    return (
      <AttendanceActivityList 
        courseId={selectedCourse.id} 
        courseName={selectedCourse.name} 
        courseCode={selectedCourse.code} // 傳遞課程代碼
        onBack={() => setSelectedCourse(null)} 
        onSelectActivity={(activity) => setSelectedActivity(activity)} 
      />
    );
  }

  // Layer 1
  if (loading) return <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center"><LoadingSpinner size={60} text="資料載入中..." /></div>;

  return (
    <div className="max-w-7xl mx-auto w-full flex flex-col h-full animate-fade-in pb-10">
      <div className="flex items-center mb-6">
        <CalendarDaysIcon className="w-8 h-8 mr-3 text-indigo-600" />
        <h2 className="text-2xl font-bold text-gray-800">點名管理</h2>
      </div>

      {!loading && courses.length === 0 ? (
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
                            <tr key={course.id} className="hover:bg-indigo-50/30 transition-colors group">
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
                                    <button onClick={() => setSelectedCourse(course)} className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm">管理</button>
                                </td>
                            </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="md:hidden space-y-4">
                    {filteredCourses.map((course) => (
                        <div key={course.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5 flex flex-col gap-3 active:scale-[0.99] transition-transform" onClick={() => setSelectedCourse(course)}>
                            <div className="flex justify-between items-start">
                                 <div><h3 className="font-bold text-gray-900 text-lg">{course.name}</h3><p className="text-xs font-mono text-gray-500">{course.code}</p></div>
                                 <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 shrink-0"><UserGroupIcon className="w-3 h-3 mr-1"/>{studentCounts[course.id] ?? '-'} 人</span>
                            </div>
                            <div className="border-t border-gray-100 pt-3 flex justify-end">
                                 <button onClick={(e) => { e.stopPropagation(); setSelectedCourse(course); }} className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">管理點名 <ChevronRightIcon className="w-4 h-4 ml-1" /></button>
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