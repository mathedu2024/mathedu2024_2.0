'use client';

import React, { useState, useEffect, useCallback } from 'react';
import "react-datepicker/dist/react-datepicker.css";
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided } from '@hello-pangea/dnd';
import AlertDialog from './AlertDialog';
import DetailModal from './DetailModal';
import LoadingSpinner from './LoadingSpinner';

interface UserInfo {
  id: string;
  name: string;
  account: string;
  role: '管理員' | '老師' | '學生';
}

interface TeacherCourseManagerProps {
  userInfo: UserInfo | null;
  courses?: Course[];
}

export interface Course {
  id: string;
  name: string;
  code: string;
  status: '未開課' | '報名中' | '開課中' | '已額滿' | '已結束' | '已封存' | '資料建置中...';
  gradeTags: string[];
  subjectTag: string;
  startDate: string; 
  endDate: string;
  teachers: string[];
  description: string;
  classTimes: Record<string, unknown>[];
  teachingMethod: string;
  courseNature: string;
  location: string;
  liveStreamURL: string;
  students: Student[];
  showInIntroduction: boolean;
  archived: boolean;
  coverImageURL?: string;
}

interface LessonData {
  id: string;
  title: string;
  date: string;
  progress: string;
  attachments?: { name: string, url: string }[];
  noAttachment?: boolean;
  videos?: string[];
  homework?: string;
  noHomework?: boolean;
  onlineExam?: string;
  noOnlineExam?: boolean;
  examScope?: string;
  noExamScope?: boolean;
  notes?: string;
  order?: number;
  createdAt?: { seconds: number };
  updatedAt?: { seconds: number };
}

interface Student {
  id: string; // Document ID
  studentId: string; // 學號
  name: string;
  grade: string;
}

// getTeacherNames 改為 fetch('/api/teacher/list')，回傳 Map<string, string>
const getTeacherNames = async (teacherIds: string[]): Promise<Map<string, string>> => {
  if (!teacherIds || teacherIds.length === 0) return new Map();
  try {
    const res = await fetch('/api/teacher/list');
    const teachers: { id: string; name: string; account: string; uid?: string }[] = await res.json();
    // 建立 id->name 對照表，支援 id、account、uid
    const map = new Map<string, string>();
    teacherIds.forEach(id => {
      const t = teachers.find((t) => t.id === id || t.account === id || t.uid === id);
      if (t) map.set(id, t.name);
    });
    return map;
  } catch (error) {
    console.error('獲取老師名字時發生錯誤:', error);
    return new Map();
  }
};

// 課堂管理元件（簡易版，僅供新增/顯示課堂資料）
function LessonManager({ courseId, courseName, courseCode, onClose }: { courseId: string, courseName: string, courseCode: string, onClose: () => void }) {
  const [lessons, setLessons] = useState<LessonData[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonData | null>(null);
  // 修改 form 結構
  const [form, setForm] = useState<Omit<LessonData, 'id' | 'order' | 'createdAt' | 'updatedAt'>>({
    title: '',
    date: '',
    progress: '',
    attachments: [{ name: '', url: '' }],
    noAttachment: false,
    videos: [''],
    homework: '',
    noHomework: false,
    onlineExam: '',
    noOnlineExam: false,
    examScope: '',
    noExamScope: false,
    notes: '',
  });
  // 明確型別、移除 any、補齊 hooks 依賴
  // 1. useState 明確型別
  const [alert, setAlert] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [isOrderDirty, setIsOrderDirty] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // 2. DropResult, DraggableProvided, DroppableProvided 已正確型別
  // 3. useCallback、useEffect 依賴已補齊
  // 4. 無 any 型別
  // 工具函數：依全形1、半形0.5計算字數，超過35字元截斷加省略號
  // 處理舊資料格式
  const fetchLessons = useCallback(async () => {
    try {
      const res = await fetch('/api/lessons/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId })
      });
      const lessons = await res.json();
      // 前端保險：依 order 欄位排序，若無 order 則用 date
      setLessons(Array.isArray(lessons)
        ? lessons.sort((a, b) => {
            const aOrder = typeof a.order === 'number' ? a.order : 9999;
            const bOrder = typeof b.order === 'number' ? b.order : 9999;
            if (aOrder === 9999 && bOrder === 9999) {
              // 都沒 order，用 date
              const aDate = a.date ? new Date(a.date).getTime() : 0;
              const bDate = b.date ? new Date(b.date).getTime() : 0;
              return aDate - bDate;
            }
            return aOrder - bOrder;
          })
        : []);
    } catch {
      setAlert({ open: true, message: '讀取課堂失敗' });
    } finally {
    }
  }, [courseId]);

  // 新增：每次 courseId 變動或元件 mount 時自動 fetch 最新課堂
  useEffect(() => {
    if (courseId) fetchLessons();
  }, [courseId, fetchLessons]);

  // 拖曳排序
  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const reordered = Array.from(lessons);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);
    setLessons(reordered);
    setIsOrderDirty(true);
  };

  // 儲存課堂順序
  const handleSaveOrder = async () => {
    try {
      const res = await fetch('/api/lessons/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, order: lessons.map(l => l.id) })
    });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAlert({ open: true, message: data.error || '課堂順序儲存失敗，請重試' });
        await fetchLessons();
      } else {
        setAlert({ open: true, message: '課堂順序已儲存' });
        setIsOrderDirty(false);
      }
    } catch {
      setAlert({ open: true, message: '課堂順序儲存失敗，請檢查網路或稍後再試' });
      await fetchLessons();
    }
  };

  // 新增課堂
  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const lessonData = {
        ...form,
        attachments: (form.attachments || [])
          .filter((a: { name: string; url: string } | string) => (typeof a === 'string' ? a.trim() !== '' : a.url && a.url.trim() !== ''))
          .map((a: { name: string; url: string } | string, idx: number) => {
            if (typeof a === 'string') return { name: `附件${idx + 1}`, url: a };
            return a;
          }),
        createdAt: new Date().toISOString(),
      };
      await fetch('/api/lessons/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, ...lessonData })
      });
      setForm({ title: '', date: '', progress: '', attachments: [{ name: '', url: '' }], noAttachment: false, videos: [''], homework: '', noHomework: false, onlineExam: '', noOnlineExam: false, examScope: '', noExamScope: false, notes: '' });
      setShowForm(false);
      await fetchLessons();
    } catch {
      setAlert({ open: true, message: '新增課堂失敗' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 動態附件欄位
  const handleAttachmentChange = (idx: number, key: 'name' | 'url', value: string) => {
    setForm((f) => {
      const attachments = [...(f.attachments || [])];
      attachments[idx] = { ...attachments[idx], [key]: value };
      return { ...f, attachments };
    });
  };
  const addAttachmentField = () => setForm((f) => ({ ...f, attachments: [...(f.attachments || []), { name: '', url: '' }] }));
  const removeAttachmentField = (idx: number) => setForm((f) => ({ ...f, attachments: (f.attachments || []).filter((_: unknown, i: number) => i !== idx) }));

  // 動態影片欄位
  const handleVideoChange = (idx: number, value: string) => {
    setForm((f) => {
      const videos = [...(f.videos || [])];
      videos[idx] = value;
      return { ...f, videos };
    });
  };
  const addVideoField = () => setForm((f) => ({ ...f, videos: [...(f.videos || []), ''] }));
  const removeVideoField = (idx: number) => setForm((f) => ({ ...f, videos: (f.videos || []).filter((_: unknown, i: number) => i !== idx) }));

  // 編輯功能
  const handleEditClick = (lesson: LessonData) => {
    setEditingLesson(lesson);
    setForm({
      title: lesson.title,
      date: lesson.date,
      progress: lesson.progress,
      attachments: lesson.attachments || [{ name: '', url: '' }],
      noAttachment: lesson.noAttachment || false,
      videos: lesson.videos || [''],
      homework: lesson.homework || '',
      noHomework: lesson.noHomework || false,
      onlineExam: lesson.onlineExam || '',
      noOnlineExam: lesson.noOnlineExam || false,
      examScope: lesson.examScope || '',
      noExamScope: lesson.noExamScope || false,
      notes: lesson.notes || '',
    });
    setShowForm(false);
  };
  const handleEditLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLesson) return;
    setIsSubmitting(true);
    try {
      const lessonData = {
        ...form,
        attachments: (form.attachments || [])
          .filter((a: { name: string; url: string } | string) => (typeof a === 'string' ? a.trim() !== '' : a.url && a.url.trim() !== ''))
          .map((a: { name: string; url: string } | string, idx: number) => {
            if (typeof a === 'string') return { name: `附件${idx + 1}`, url: a };
            return a;
          }),
        updatedAt: new Date().toISOString(),
      };
      await fetch('/api/lessons/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, lessonId: editingLesson.id, ...lessonData })
      });
      setEditingLesson(null);
      setForm({ title: '', date: '', progress: '', attachments: [{ name: '', url: '' }], noAttachment: false, videos: [''], homework: '', noHomework: false, onlineExam: '', noOnlineExam: false, examScope: '', noExamScope: false, notes: '' });
      await fetchLessons();
    } catch {
      setAlert({ open: true, message: '更新課堂失敗' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 刪除功能
  const handleDeleteLesson = async (lessonId: string) => {
    if (!window.confirm('確定要刪除此課堂嗎？')) return;
    try {
      await fetch('/api/lessons/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, lessonId })
      });
      setLessons(lessons.filter(l => l.id !== lessonId));
    } catch {
      setAlert({ open: true, message: '刪除課堂失敗' });
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex flex-col md:flex-row items-center justify-center pt-16 md:pt-0">
      <div className="bg-white w-full md:max-w-3xl h-full md:h-[90vh] rounded-xl p-2 md:p-8 overflow-auto relative flex flex-col">
        {/* 桌面右上角 X 按鈕 */}
        <div className="hidden md:block absolute top-4 right-4">
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700"
            aria-label="關閉"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* 漢堡選單（手機顯示） */}
        <div className="md:hidden flex items-center justify-between p-2 border-b">
          <span className="font-bold text-lg">課堂管理</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 ml-2"
            aria-label="關閉"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* 移除原本右上角浮動的 X 按鈕 */}
        <div className="mb-4">
          <h3 className="text-2xl font-bold">{courseName}</h3>
          <div className="text-gray-500 text-sm">{courseCode}</div>
        </div>
        <h3 className="text-2xl font-bold mb-4">課堂管理</h3>
        {/* 新增：儲存課堂順序按鈕 */}
        <div className="mb-6 flex gap-2 items-center">
          {!showForm && (
            <button className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700" onClick={() => setShowForm(true)}>
              新增課堂
          </button>
          )}
          {isOrderDirty && (
            <button
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              onClick={handleSaveOrder}
            >
              儲存課堂順序
            </button>
          )}
        </div>
        {(showForm || editingLesson) && (
          <form onSubmit={editingLesson ? handleEditLesson : handleAddLesson} className="space-y-4 mb-8 bg-gray-50 p-4 rounded-lg">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">課堂標題</label>
                <input type="text" className="border rounded px-3 py-2 w-full" value={form.title} onChange={e => setForm((f) => ({ ...f, title: e.target.value }))} required />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium mb-1">課程日期</label>
                <input type="date" className="border rounded px-3 py-2 w-full" value={form.date} onChange={e => setForm((f) => ({ ...f, date: e.target.value }))} required />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">課程進度</label>
              <textarea className="border rounded px-3 py-2 w-full" value={form.progress} onChange={e => setForm((f) => ({ ...f, progress: e.target.value }))} rows={2} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">附件</label>
              <div className="flex items-center mb-2">
                <input type="checkbox" checked={form.noAttachment} onChange={e => setForm((f) => ({ ...f, noAttachment: e.target.checked, attachments: e.target.checked ? [{ name: '', url: '' }] : f.attachments }))} />
                <span className="ml-2 text-sm">暫無資料</span>
              </div>
              {!form.noAttachment && (form.attachments || []).map((att: { name: string; url: string } | string, idx: number) => (
                <div key={typeof att === 'object' && att !== null && 'url' in att ? att.url + idx : idx} className="flex gap-2 mb-2">
                  <input type="text" className="border rounded px-3 py-2 w-32" placeholder="名稱" value={typeof att === 'object' && att !== null && 'name' in att ? att.name : ''} onChange={e => handleAttachmentChange(idx, 'name', e.target.value)} />
                  <input type="url" className="border rounded px-3 py-2 flex-1" placeholder="連結" value={typeof att === 'object' && att !== null && 'url' in att ? att.url : ''} onChange={e => handleAttachmentChange(idx, 'url', e.target.value)} />
                  {(form.attachments || []).length > 1 && (
                    <button type="button" className="text-red-500 px-2" onClick={() => removeAttachmentField(idx)}>移除</button>
                  )}
                </div>
              ))}
              {!form.noAttachment && <button type="button" className="text-blue-600 underline text-sm" onClick={addAttachmentField}>+ 新增附件</button>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">課程影片連結</label>
              {(form.videos || []).map((video: string, idx: number) => (
                <div key={video ? video + idx : idx} className="flex gap-2 mb-2">
                  <input type="url" className="border rounded px-3 py-2 flex-1" value={video} onChange={e => handleVideoChange(idx, e.target.value)} />
                  {(form.videos || []).length > 1 && (
                    <button type="button" className="text-red-500 px-2" onClick={() => removeVideoField(idx)}>移除</button>
                  )}
                </div>
              ))}
              <button type="button" className="text-blue-600 underline text-sm" onClick={addVideoField}>+ 新增影片連結</button>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">課程作業</label>
              <div className="flex items-center mb-2">
                <input type="checkbox" checked={form.noHomework} onChange={e => setForm((f) => ({ ...f, noHomework: e.target.checked, homework: e.target.checked ? '' : f.homework }))} />
                <span className="ml-2 text-sm">無</span>
              </div>
              {!form.noHomework && <textarea className="border rounded px-3 py-2 w-full" value={form.homework} onChange={e => setForm((f) => ({ ...f, homework: e.target.value }))} rows={2} />}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">線上測驗</label>
              <div className="flex items-center mb-2">
                <input type="checkbox" checked={form.noOnlineExam} onChange={e => setForm((f) => ({ ...f, noOnlineExam: e.target.checked, onlineExam: e.target.checked ? '' : f.onlineExam }))} />
                <span className="ml-2 text-sm">無</span>
              </div>
              {!form.noOnlineExam && <textarea className="border rounded px-3 py-2 w-full" value={form.onlineExam} onChange={e => setForm((f) => ({ ...f, onlineExam: e.target.value }))} rows={2} />}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">考試範圍</label>
              <div className="flex items-center mb-2">
                <span className="ml-2 text-sm">無</span>
              </div>
              {!form.noExamScope && <textarea className="border rounded px-3 py-2 w-full" value={form.examScope} onChange={e => setForm((f) => ({ ...f, examScope: e.target.value }))} rows={2} />}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">注意事項</label>
              <textarea className="border rounded px-3 py-2 w-full" value={form.notes} onChange={e => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button type="button" className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300" onClick={() => { setShowForm(false); setEditingLesson(null); }}>取消</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" disabled={isSubmitting}>{isSubmitting ? '儲存中...' : '儲存課堂'}</button>
            </div>
          </form>
        )}
        {!(showForm || editingLesson) && (
          <h4 className="text-lg font-bold mb-2">課堂清單</h4>
        )}
        {!showForm && !editingLesson && (
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="lesson-list">
              {(provided: DroppableProvided) => (
                <ul className="divide-y" ref={provided.innerRef} {...provided.droppableProps}>
                  {lessons.map((lesson, idx) => (
                    <Draggable key={lesson.id} draggableId={lesson.id} index={idx}>
                      {(provided: DraggableProvided) => (
                        <li key={lesson.id} className="py-2 bg-white flex items-center justify-between" ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                          <div className="flex flex-col w-full">
                            <div className="flex items-center w-full">
                              <div className="font-semibold" title={lesson.title} style={{ flex: 1, minWidth: 0 }}>
                                第 {idx + 1} 堂：{lesson.title}
                              </div>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              編輯日期：{formatDateTime(lesson.updatedAt || lesson.createdAt)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-2 whitespace-nowrap">
                            <span className="text-gray-500 text-sm min-w-[90px] text-right mr-2">{lesson.date}</span>
                            {/* 附件按鈕：只顯示純附件（不含影片），點擊彈出 modal */}
                            {/* 刪除附件按鈕區塊 */}
                            <button className="text-blue-600 hover:underline px-2" onClick={() => handleEditClick(lesson)}>修改</button>
                            <button className="text-red-600 hover:underline px-2" onClick={() => handleDeleteLesson(lesson.id)}>刪除</button>
                          </div>
                        </li>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </ul>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
      {/* 漢堡按鈕（手機顯示，sidebar 關閉時顯示） */}
      {!sidebarOpen && (
        <button className="fixed top-4 left-4 z-50 md:hidden bg-white p-2 rounded-full shadow" onClick={() => setSidebarOpen(true)}>
          <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}
      <AlertDialog open={alert.open} message={alert.message} onClose={() => setAlert({ open: false, message: '' })} />
    </div>
  );
}

export default function TeacherCourseManager({ userInfo, courses: propCourses }: TeacherCourseManagerProps) {
  console.log('TeacherCourseManager - Received props:', { userInfo, propCourses });
  const [coursesState, setCourses] = useState<Course[]>([]);
  const courses = propCourses ?? coursesState;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCourseDetail, setShowCourseDetail] = useState<Course | null>(null);
  const [showLessonManager, setShowLessonManager] = useState<Course | null>(null);
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [teacherNamesMap, setTeacherNamesMap] = useState<{ [courseId: string]: string[] }>({});
  const [newCourse, setNewCourse] = useState<Partial<Course>>({});
  const [detailedStudents, setDetailedStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  // 明確型別、移除 any、補齊 hooks 依賴
  // 1. useState 明確型別
  const [alert, setAlert] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // 2. DropResult, DraggableProvided, DroppableProvided 已正確型別
  // 3. useCallback、useEffect 依賴已補齊
  // 4. 無 any 型別
  // 恢復 search/filter 狀態
  const [searchTerm] = useState('');
  const [selectedGrade] = useState('all');
  const [selectedSubject] = useState('all');

  const subjects = ['數學', '理化', '物理', '化學', '生物'];

  // 工具函數：依全形1、半形0.5計算字數，超過35字元截斷加省略號
  // 處理舊資料格式
  // 新增：只查有用到的老師
  const fetchTeacherNames = async (teacherIds: string[]): Promise<{ [id: string]: string }> => {
    if (!teacherIds.length) return {};
    const res = await fetch('/api/teacher/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: teacherIds })
    });
    if (!res.ok) return {};
    const teachers = await res.json();
    console.log('查詢老師ID:', teacherIds);
    console.log('API回傳:', teachers);
    const map: { [id: string]: string } = {};
    teachers.forEach((t: { id: string, name: string }) => { map[t.id] = t.name; });
    return map;
  };

  const fetchCourses = useCallback(async () => {
    if (!userInfo?.id) {
      setCourses([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/courses/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: userInfo.id })
      });
      if (res.ok) {
        const allCourses = await res.json();
        setCourses(allCourses);
        // 只查有用到的老師
        const allTeacherIds = Array.from(new Set(
          (allCourses.flatMap((c: Course) => (c.teachers || [])).filter((id: unknown): id is string => typeof id === 'string')) as string[]
        ));
        const teacherNameMap = await fetchTeacherNames(allTeacherIds);
        // 組合課程 id -> 老師名稱陣列
        const newTeacherNamesMap: { [courseId: string]: string[] } = {};
        allCourses.forEach((course: Course) => {
          newTeacherNamesMap[course.id] = (course.teachers || []).map((id: string) => teacherNameMap[id] || '未知老師');
        });
        setTeacherNamesMap(newTeacherNamesMap);
        setError(null);
      } else {
        const errorText = await res.text();
        setCourses([]);
        setError('讀取課程資料時發生錯誤：API 回傳失敗 - ' + errorText);
      }
    } catch (error) {
      setError('讀取課程資料時發生錯誤：' + (error as Error).message);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [userInfo?.id]);

  // 2. useEffect 只呼叫 fetchCourses
  useEffect(() => {
    fetchCourses();
  }, [userInfo?.id, fetchCourses]);

  // handleShowCourseDetail 改為：
  const handleShowCourseDetail = async (course: Course) => {
    // 新增：log course 內容
    console.log('handleShowCourseDetail course:', course);
    // 修正：若 course 欄位不完整，從 coursesState 依 id 找到完整物件
    let fullCourse = course;
    if (!course.description || !course.courseNature || !course.classTimes || !course.teachingMethod) {
      const found = coursesState.find(c => c.id === course.id);
      if (found) {
        fullCourse = found;
        console.log('handleShowCourseDetail 使用完整物件:', found);
      }
    }
    
    // 先設定課程詳情，避免 API 錯誤影響顯示
    setShowCourseDetail(fullCourse);
    setDetailedStudents([]);
    setLoadingStudents(true);
    
    try {
      // 嘗試獲取課程額外資料（如果存在）
      const classDataRes = await fetch(`/api/courses/classdata?courseId=${course.id}`);
      if (classDataRes.ok) {
        const classData = await classDataRes.json();
        fullCourse.location = classData.location || fullCourse.location;
        fullCourse.description = classData.description || fullCourse.description;
        // 更新顯示的課程資料
        setShowCourseDetail({ ...fullCourse });
      }
    } catch (e: unknown) {
      console.log('無法獲取課程額外資料:', (e as Error).message);
      // 不顯示錯誤，因為這不是必要的
    }
    
    try {
      const res = await fetch('/api/course-student-list/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseName: fullCourse.name, courseCode: fullCourse.code })
      });
      if (!res.ok) {
        setAlert({ open: true, message: '讀取學生資料時發生錯誤。' });
        return;
      }
      const students = await res.json();
      setDetailedStudents(students);
    } catch {
      setAlert({ open: true, message: '讀取學生資料時發生錯誤。' });
    } finally {
      setLoadingStudents(false);
    }
  };

  // 3. handleAddCourse 新增成功後呼叫 fetchCourses，並移除 setCourses(prev => ...)
  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      // 驗證必要欄位
      if (!newCourse.name?.trim()) {
        throw new Error('請輸入課程名稱');
      }
      if (!newCourse.code?.trim()) {
        throw new Error('請輸入課程代碼');
      }
      if (!newCourse.subjectTag?.trim()) {
        throw new Error('請選擇科目');
      }
      if (!newCourse.gradeTags?.length) {
        throw new Error('請選擇年級');
      }
      if (!newCourse.courseNature?.trim()) {
        throw new Error('請選擇課程性質');
      }
      if (!newCourse.teachingMethod?.trim()) {
        throw new Error('請選擇授課方式');
      }
      
      const docId = `${newCourse.name}(${newCourse.code})`;
      const courseData = {
        ...newCourse,
        id: docId,
        teachers: [userInfo?.id || ''],
        teacherUids: [userInfo?.id || ''],
        teacherAccounts: [userInfo?.account || ''],
        status: '資料建置中...',
        archived: false,
        showInIntroduction: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // 確保所有必要欄位都有預設值
        description: newCourse.description || '',
        location: newCourse.location || '',
        liveStreamURL: newCourse.liveStreamURL || '',
        classTimes: newCourse.classTimes || [],
        students: newCourse.students || [],
        startDate: newCourse.startDate || '',
        endDate: newCourse.endDate || '',
        coverImageURL: newCourse.coverImageURL || '',
      };
      
      const response = await fetch('/api/courses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(courseData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '新增課程失敗');
      }
      
      if (userInfo?.name) {
        setTeacherNamesMap(prev => ({
          ...prev,
          [docId]: [userInfo.name]
        }));
      }
      setShowNewCourse(false);
      setNewCourse({});
      setAlert({ open: true, message: '課程建立成功！' });
      await fetchCourses(); // 新增後重新載入
      await fetch('/api/courses/classdata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: docId,
          name: courseData.name,
          location: courseData.location,
          description: courseData.description,
          teachers: courseData.teachers,
          // ...可擴充其他欄位
        })
      });
    } catch (err) {
      console.error('新增課程錯誤:', err);
      setAlert({ open: true, message: `新增課程失敗：${err instanceof Error ? err.message : '請稍後再試'}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 篩選後的課程
  const filteredCourses = courses.filter(course => {
    const matchesSearch = course.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGrade = selectedGrade === 'all' || course.gradeTags.includes(selectedGrade);
    const matchesSubject = selectedSubject === 'all' || course.subjectTag === selectedSubject;
    return matchesSearch && matchesGrade && matchesSubject;
  });

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <LoadingSpinner size={12} />
        <p className="ml-4 text-gray-600">正在讀取您的課程資料...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <h2 className="text-3xl font-bold mb-6 text-gray-800">我的授課課程</h2>
        <div className="text-center py-12 px-6 bg-white rounded-lg border border-red-200">
          <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-red-900">讀取課程資料時發生錯誤</h3>
          <p className="mt-1 text-sm text-red-600">{error}</p>
          <button 
            onClick={() => {
              setLoading(true);
              setError(null);
              const fetchCourses = async () => {
                if (!userInfo || !userInfo.id) {
                  setCourses([]);
                  setLoading(false);
                  return;
                }
                try {
                  const res = await fetch('/api/courses/list', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ teacherId: userInfo.id })
                  });
                  if (res.ok) {
                    const allCourses = await res.json();
                    setCourses(allCourses);
                    // 獲取所有課程的老師名字
                    const teacherNamesPromises = allCourses.map(async (course: Course) => {
                      if (course.teachers && course.teachers.length > 0) {
                        const namesMap = await getTeacherNames(course.teachers);
                        const orderedNames = course.teachers
                          .map((id: string) => namesMap.get(id))
                          .filter((name: string | undefined): name is string => !!name);
                        return { courseId: course.id, names: orderedNames };
                      }
                      return { courseId: course.id, names: [] };
                    });
                    const teacherNamesResults = await Promise.all(teacherNamesPromises);
                    const newTeacherNamesMap: { [courseId: string]: string[] } = {};
                    teacherNamesResults.forEach(result => {
                      newTeacherNamesMap[result.courseId] = result.names;
                    });
                    setTeacherNamesMap(newTeacherNamesMap);
                    setError(null);
                  } else {
                    setCourses([]);
                    setError('讀取課程資料時發生錯誤：API 回傳失敗');
                  }
                } catch (error) {
                  setError('讀取課程資料時發生錯誤：' + (error as Error).message);
                  setCourses([]);
                } finally {
                  setLoading(false);
                }
              };
              fetchCourses();
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            重新嘗試
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold" style={{ color: 'rgb(70, 131, 229)' }}>我的授課課程</h2>
        {userInfo?.role === '管理員' && (
          <button 
            onClick={() => setShowNewCourse(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            建立新課程
          </button>
        )}
      </div>
      
      {/* 顯示載入狀態或錯誤 */}
      {loading && (
        <div className="text-center py-12">
          <LoadingSpinner size={12} />
          <p className="mt-4 text-gray-600">正在載入課程資料...</p>
        </div>
      )}
      
      {/* 顯示無課程狀態 */}
      {!loading && filteredCourses.length === 0 && (
        <div className="text-center py-12 px-6 bg-white rounded-lg border border-gray-200">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6l4 2" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">尚無授課課程</h3>
          <p className="mt-1 text-sm text-gray-600">您目前還沒有任何授課課程。</p>
          {userInfo?.role === '管理員' && (
            <button 
              onClick={() => setShowNewCourse(true)}
              className="mt-4 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              建立新課程
            </button>
          )}
          <div className="mt-4 text-sm text-gray-500">
            <p>使用者資訊: {userInfo ? `${userInfo.name} (${userInfo.id})` : '未載入'}</p>
            <p>課程數量: {courses.length}</p>
          </div>
        </div>
      )}
      
      {/* 課程卡片清單 */}
      {!loading && filteredCourses.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filteredCourses.map(course => (
            <div key={course.id} className="bg-white rounded-lg overflow-hidden hover:bg-gray-50 transition-colors duration-300 flex flex-col sm:flex-row shadow p-6 items-start sm:items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">{course.name}</h3>
                <div className="text-sm text-gray-500 mb-2">{course.code}</div>
                <div className="flex items-baseline text-base text-gray-600 mb-2">
                  <span className="font-medium flex-shrink-0">授課老師：</span>
                  <span className="truncate text-lg" title={teacherNamesMap[course.id]?.join('、') || '載入中...'}>
                    {teacherNamesMap[course.id]?.join('、') || '載入中...'}
                  </span>
                </div>
                {course.description && (
                  <div className="text-gray-700 text-sm mt-2 line-clamp-2">{course.description}</div>
                )}
                {/* 手機下方按鈕區塊 */}
                <div className="flex flex-col gap-2 mt-4 sm:hidden w-full">
                  <button className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium w-full" onClick={() => setShowLessonManager(course)}>管理課程</button>
                  <button className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors text-sm font-medium w-full" onClick={() => handleShowCourseDetail(course)}>課程資料</button>
                </div>
              </div>
              {/* 桌面右側按鈕區塊 */}
              <div className="hidden sm:flex gap-2 ml-4">
                <button className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors text-sm font-medium" onClick={() => setShowLessonManager(course)}>管理課程</button>
                <button className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 transition-colors text-sm font-medium" onClick={() => handleShowCourseDetail(course)}>課程資料</button>
              </div>
            </div>
        ))}
        </div>
      )}
      {/* 詳細資料彈窗 */}
      {showCourseDetail && (
        <DetailModal
          open={!!showCourseDetail}
          title={showCourseDetail.name}
          onClose={() => setShowCourseDetail(null)}
        >
          <div className="space-y-4 max-h-[70vh] overflow-auto max-w-3xl mx-auto p-6">
            {/* 課程詳細資料 */}
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">課程資訊</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div><span className="font-medium text-gray-700">課程名稱：</span>{showCourseDetail.name}</div>
                <div><span className="font-medium text-gray-700">課程代碼：</span>{showCourseDetail.code}</div>
                <div><span className="font-medium text-gray-700">課程狀態：</span>{showCourseDetail.status}</div>
                <div><span className="font-medium text-gray-700">科目：</span>{showCourseDetail.subjectTag}</div>
                <div><span className="font-medium text-gray-700">年級：</span>{(showCourseDetail.gradeTags || []).join(', ')}</div>
                <div><span className="font-medium text-gray-700">課程性質：</span>{showCourseDetail.courseNature}</div>
                <div><span className="font-medium text-gray-700">授課方式：</span>{showCourseDetail.teachingMethod}</div>
                <div><span className="font-medium text-gray-700">上課地點：</span>{showCourseDetail.location}</div>
                <div><span className="font-medium text-gray-700">開始日期：</span>{showCourseDetail.startDate}</div>
                <div><span className="font-medium text-gray-700">結束日期：</span>{showCourseDetail.endDate}</div>
              </div>
              {showCourseDetail.description && (
                <div className="mt-4">
                  <span className="font-medium text-gray-700">課程描述：</span>
                  <p className="mt-1 text-sm text-gray-600 bg-white p-3 rounded border">{showCourseDetail.description}</p>
                </div>
              )}
            </div>
            {/* 學生名單表格 */}
            <div>
              <h4 className="font-semibold text-gray-900 mb-2">學生名單</h4>
              {loadingStudents ? (
                <div className="flex items-center justify-center gap-2 text-gray-500 py-8">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent"></div>
                  <span>正在載入學生名單...</span>
                </div>
              ) : detailedStudents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full border border-gray-200 rounded-lg">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">學號</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">姓名</th>
                        <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">年級</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailedStudents.map(stu => (
                        <tr key={stu.id} className="border-t hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-800 font-medium">{stu.studentId}</td>
                          <td className="px-4 py-2 text-sm text-gray-800">{stu.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-800">{stu.grade || '未設定'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">此課程尚無學生選修。</p>
              )}
            </div>
          </div>
        </DetailModal>
      )}
      {/* 滿版課堂管理 */}
      {showLessonManager && (
        <LessonManager 
          courseId={showLessonManager.id} 
          courseName={showLessonManager.name}
          courseCode={showLessonManager.code}
          onClose={() => setShowLessonManager(null)} 
        />
      )}
      
      {/* 新增課程表單 */}
      {showNewCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center">
          <div className="bg-white w-full max-w-4xl h-[90vh] rounded-xl p-8 overflow-auto relative">
            <button className="absolute top-4 right-4 text-gray-500 hover:text-gray-800" onClick={() => setShowNewCourse(false)}>
              <span className="text-2xl">×</span>
            </button>
            <h3 className="text-2xl font-bold mb-6">建立新課程</h3>
            <form onSubmit={handleAddCourse} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">課程名稱 *</label>
                  <input
                    type="text"
                    value={newCourse.name || ''}
                    onChange={(e) => setNewCourse((prev: Partial<Course>) => ({ ...prev, name: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="請輸入課程名稱"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">課程代碼 *</label>
                  <input
                    type="text"
                    value={newCourse.code || ''}
                    onChange={(e) => setNewCourse((prev: Partial<Course>) => ({ ...prev, code: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="請輸入課程代碼"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">科目 *</label>
                  <select
                    value={newCourse.subjectTag || ''}
                    onChange={(e) => setNewCourse((prev: Partial<Course>) => ({ ...prev, subjectTag: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">請選擇科目</option>
                    {subjects.map(subject => (
                      <option key={subject} value={subject}>{subject}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">課程性質 *</label>
                  <select
                    value={newCourse.courseNature || ''}
                    onChange={(e) => setNewCourse((prev: Partial<Course>) => ({ ...prev, courseNature: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">請選擇課程性質</option>
                    <option value="進度課程">進度課程</option>
                    <option value="升學考試複習">升學考試複習</option>
                    <option value="檢定/考試訓練班">檢定/考試訓練班</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">授課方式 *</label>
                  <select
                    value={newCourse.teachingMethod || ''}
                    onChange={(e) => setNewCourse((prev: Partial<Course>) => ({ ...prev, teachingMethod: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">請選擇授課方式</option>
                    <option value="實體上課">實體上課</option>
                    <option value="線上上課">線上上課</option>
                    <option value="非同步線上上課">非同步線上上課</option>
                    <option value="實體與線上同步上課">實體與線上同步上課</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">上課地點</label>
                  <input
                    type="text"
                    value={newCourse.location || ''}
                    onChange={(e) => setNewCourse((prev: Partial<Course>) => ({ ...prev, location: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="請輸入上課地點"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">年級 *</label>
                <div className="flex flex-wrap gap-3">
                  {['國一', '國二', '國三', '高一', '高二', '高三'].map(grade => (
                    <label key={grade} className="inline-flex items-center">
                      <input
                        type="checkbox"
                        checked={newCourse.gradeTags?.includes(grade) || false}
                        onChange={(e) => {
                          const currentGrades = newCourse.gradeTags || [];
                          const newGrades = e.target.checked
                            ? [...currentGrades, grade]
                            : currentGrades.filter((g: string) => g !== grade);
                          setNewCourse((prev: Partial<Course>) => ({ ...prev, gradeTags: newGrades }));
                        }}
                        className="mr-2"
                      />
                      {grade}
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">課程描述</label>
                                  <textarea
                    value={newCourse.description || ''}
                    onChange={(e) => setNewCourse((prev: Partial<Course>) => ({ ...prev, description: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 h-32"
                    placeholder="請描述課程內容、目標等..."
                  />
              </div>
              
              <div className="flex justify-end gap-4 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewCourse(false)}
                  className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  disabled={isSubmitting}
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? '建立中...' : '建立課程'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      <AlertDialog open={alert.open} message={alert.message} onClose={() => setAlert({ open: false, message: '' })} />
    </div>
  );
}

function formatDateTime(ts?: { seconds: number } | string) {
  if (!ts) return '';
  if (typeof ts === 'string') {
    // ISO string
    const d = new Date(ts);
    return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  }
  if ('seconds' in ts) {
    const d = new Date(ts.seconds * 1000);
    return `${d.getFullYear()}/${(d.getMonth()+1).toString().padStart(2,'0')}/${d.getDate().toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
  }
  return '';
} 