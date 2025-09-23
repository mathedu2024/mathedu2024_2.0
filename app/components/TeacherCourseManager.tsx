'use client';

import React, { useState, useEffect, useCallback } from 'react';

import "react-datepicker/dist/react-datepicker.css";
import Swal from 'sweetalert2';
// import DetailModal from './DetailModal'; // 移除未使用的 import
import LoadingSpinner from './LoadingSpinner';
import CourseDetailModal from './CourseDetailModal';
import AlertDialog from './AlertDialog';

import alerts from '../utils/alerts';

import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided } from '@hello-pangea/dnd';

interface UserInfo {
  id: string;
  name: string;
  account: string;
  role: '管理員' | '老師' | '學生';
}

interface Teacher {
  id: string;
  name: string;
  account: string;
  uid?: string;
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

interface ClassTime {
  day: string;
  startTime: string;
  endTime: string;
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
  const [alertState, setAlertState] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
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
      const sortedLessons = Array.isArray(lessons)
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
        : [];
      setLessons(sortedLessons);
    } catch {
      Swal.fire('錯誤', '讀取課堂失敗', 'error');
    } finally {
    }
  }, [courseId]);

  // 新增：每次 courseId 變動或元件 mount 時自動 fetch 最新課堂
  useEffect(() => {
    if (courseId) fetchLessons();
  }, [courseId, fetchLessons]);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) {
      return;
    }
    const items = Array.from(lessons);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);

    setLessons(items.map((item, index) => ({ ...item, order: index })));
    setIsOrderDirty(true);
  };

  // 儲存變更
  const handleSaveChanges = async () => {
    setIsSubmitting(true);
    try {
      const promises = [];
      if (isOrderDirty) {
        promises.push(fetch('/api/lessons/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, order: lessons.map(l => l.id) })
        }));
      }

      const results = await Promise.all(promises);
      const hasError = results.some(res => !res.ok);

      if (hasError) {
        Swal.fire('錯誤', '部分變更儲存失敗，請重試', 'error');
      } else {
        Swal.fire('成功', '變更已儲存', 'success');
        setIsOrderDirty(false);
      }
    } catch {
      Swal.fire('錯誤', '儲存變更失敗，請檢查網路或稍後再試', 'error');
    } finally {
      await fetchLessons();
      setIsSubmitting(false);
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
      Swal.fire('錯誤', '新增課堂失敗', 'error');
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
      Swal.fire('錯誤', '更新課堂失敗', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 刪除功能
  const handleDeleteLesson = async (lessonId: string) => {
    const result = await Swal.fire({ title: '請確認', text: '確定要刪除此課堂嗎？', icon: 'warning', showCancelButton: true });
    if (!result.isConfirmed) return;
    try {
      await fetch('/api/lessons/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, lessonId })
      });
      setLessons(lessons.filter(l => l.id !== lessonId));
    } catch {
      Swal.fire('錯誤', '刪除課堂失敗', 'error');
    }
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);

  return (
    <DragDropContext onDragEnd={onDragEnd}>
    <div className="fixed inset-0 bg-white z-50">
      <div className="bg-white w-full h-full p-2 md:p-8 overflow-auto">
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
              onClick={handleSaveChanges}
              disabled={isSubmitting}
            >
              {isSubmitting ? '儲存中...' : '儲存變更'}
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">堂數</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">課堂標題</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">日期</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                </tr>
              </thead>
              <Droppable droppableId="lesson-list">
                {(provided: DroppableProvided) => (
                  <tbody className="bg-white divide-y divide-gray-200" ref={provided.innerRef} {...provided.droppableProps}>
                    {lessons.map((lesson, idx) => (
                      <Draggable key={lesson.id} draggableId={lesson.id} index={idx}>
                        {(provided: DraggableProvided) => (
                          <tr
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              第 {idx + 1} 堂
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {lesson.title}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {lesson.date}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                              <button className="text-blue-600 hover:underline px-2" onClick={() => handleEditClick(lesson)}>修改</button>
                              <button className="text-red-600 hover:underline px-2" onClick={() => handleDeleteLesson(lesson.id)}>刪除</button>
                            </td>
                          </tr>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </tbody>
                )}
              </Droppable>
            </table>
          </div>
        )}
      </div>
      {/* 漢堡按鈕（手機顯示，sidebar 關閉時顯示） */}
      {!sidebarOpen && (
        <button className="fixed top-4 left-4 z-50 md:hidden bg-white p-2 rounded-full shadow" onClick={() => setSidebarOpen(true)}>
          <svg className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}
      <AlertDialog open={alertState.open} message={alertState.message} onClose={() => setAlertState({ open: false, message: '' })} />
    </div>
    </DragDropContext>
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
  const [teacherNamesMap, setTeacherNamesMap] = useState<{ [courseId: string]: string[] }>({});
  const [studentCounts, setStudentCounts] = useState<{ [courseId: string]: number }>({});
  const [newCourse, setNewCourse] = useState<Partial<Course>>({});
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [showNewCourse, setShowNewCourse] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isSubmitting, setIsSubmitting] = useState(false);
  // 2. DropResult, DraggableProvided, DroppableProvided 已正確型別
  // 3. useCallback、useEffect 依賴已補齊
  // 4. 無 any 型別
  // 恢復 search/filter 狀態
  const [searchTerm] = useState('');
  const [selectedGrade] = useState('all');
  const [selectedSubject] = useState('all');

  // const subjects = ['數學', '理化', '物理', '化學', '生物'];

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

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/teacher/list');
      if (res.ok) {
        const teachersData = await res.json();
        setTeachers(teachersData);
      }
    } catch (error) {
      console.error('獲取老師資料時發生錯誤:', error);
    }
  }, []);

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

        // 獲取每個課程的學生人數
        const studentCountsPromises = allCourses.map(async (course: Course) => {
          try {
            const res = await fetch('/api/course-student-list/list', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ courseName: course.name, courseCode: course.code }),
            });
            if (res.ok) {
              const students = await res.json();
              return { courseId: course.id, count: students.length };
            }
          } catch (error) {
            console.error(`獲取課程 ${course.name} 學生人數時發生錯誤:`, error);
          }
          return { courseId: course.id, count: 0 };
        });

        const studentCountsResults = await Promise.all(studentCountsPromises);
        const newStudentCounts: { [courseId: string]: number } = {};
        studentCountsResults.forEach(result => {
          if (result) {
            newStudentCounts[result.courseId] = result.count;
          }
        });
        setStudentCounts(newStudentCounts);

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

  // 獲取老師資料
  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

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
    
    // 設定課程詳情
    setShowCourseDetail(fullCourse);
    
    try {
      // 嘗試獲取課程額外資料（如果存在）
      const classDataRes = await fetch(`/api/courses/classdata?courseId=${course.id}`);
      if (classDataRes.ok) {
        const classData = await classDataRes.json();
        fullCourse.location = classData.location || fullCourse.location;
        fullCourse.description = classData.description || fullCourse.description;
        fullCourse.liveStreamURL = classData.liveStreamURL || fullCourse.liveStreamURL;
        // 更新顯示的課程資料
        setShowCourseDetail({ ...fullCourse });
      }
    } catch (e: unknown) {
      console.log('無法獲取課程額外資料:', (e as Error).message);
      // 不顯示錯誤，因為這不是必要的
    }
  };

  // 3. handleAddCourse 新增成功後呼叫 fetchCourses，並移除 setCourses(prev => ...)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      alerts.showSuccess('課程建立成功！');
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
      alerts.showError(`新增課程失敗：${err instanceof Error ? err.message : '請稍後再試'}`);
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
    <div className="max-w-6xl mx-auto w-full p-4 h-full flex flex-col min-h-0">
      <div className="flex justify-between items-center mb-6 flex-shrink-0">
        <h2 className="text-2xl font-bold">我的授課課程</h2>
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
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3">課程名稱</th>
                  <th scope="col" className="px-6 py-3">授課老師</th>
                  <th scope="col" className="px-6 py-3">學生人數</th>
                  <th scope="col" className="px-6 py-3">上課時間</th>
                  <th scope="col" className="px-6 py-3">會議室</th>
                  <th scope="col" className="px-6 py-3">狀態</th>
                  <th scope="col" className="px-6 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-10">
                      <div className="flex flex-col items-center gap-2">
                        <LoadingSpinner size={8} />
                        <span className="mt-2 text-gray-500">讀取中...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredCourses.length > 0 ? filteredCourses.map(course => (
                  <tr key={course.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                      <div>{course.name}</div>
                      <div className="text-sm text-gray-500">{course.code}</div>
                    </td>
                    <td className="px-6 py-4">{teacherNamesMap[course.id]?.join('、') || '載入中...'}</td>
                    <td className="px-6 py-4">{studentCounts[course.id] ?? 0}</td>
                    <td className="px-6 py-4">
                      {(course.classTimes || []).map((ct, index) => (
                        <div key={index}>{`${(ct as unknown as ClassTime).day} ${(ct as unknown as ClassTime).startTime}-${(ct as unknown as ClassTime).endTime}`}</div>
                      ))}
                    </td>
                    <td className="px-6 py-4">
                      {(course.teachingMethod === '線上上課' || course.teachingMethod === '實體與線上同步上課') && course.liveStreamURL ? (
                        <a href={course.liveStreamURL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                          會議連結
                        </a>
                      ) : (
                        <span>-</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          course.status === '未開課' ? 'bg-gray-100 text-gray-800' :
                          course.status === '報名中' ? 'bg-green-100 text-green-800' :
                          course.status === '開課中' ? 'bg-blue-100 text-blue-800' :
                          course.status === '已額滿' ? 'bg-red-100 text-red-800' :
                          course.status === '已封存' ? 'bg-gray-200 text-gray-600' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                        {course.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        <button className="btn-primary" onClick={() => setShowLessonManager(course)}>管理課程</button>
                        <button className="btn-secondary" onClick={() => handleShowCourseDetail(course)}>課程資料</button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-gray-500">
                      尚無授課課程
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* 課程詳細資料模態框 */}
      <CourseDetailModal
        course={showCourseDetail}
        teachers={teachers}
        open={!!showCourseDetail}
        onClose={() => setShowCourseDetail(null)}
        showDescription={false}
        showStudents={true}
      />
      {/* 滿版課堂管理 */}
      {showLessonManager && (
          <LessonManager 
            courseId={showLessonManager.id} 
            courseName={showLessonManager.name}
            courseCode={showLessonManager.code}
            onClose={() => setShowLessonManager(null)} 
          />
      )}
      

    </div>
  );
}

 