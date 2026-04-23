'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import "react-datepicker/dist/react-datepicker.css";
import Swal from 'sweetalert2';
import { LoadingSpinner } from './ui'; 
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided } from '@hello-pangea/dnd';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  BookOpenIcon,
  ArrowLeftIcon,
  CloudArrowUpIcon,
  Bars3Icon,
  XMarkIcon,
  PaperClipIcon,
  LinkIcon,
  VideoCameraIcon,
  ClockIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import CourseFilter from './CourseFilter';

// --- 1. 共用 Modal 元件 (給 LessonManager 使用) ---
const Modal = ({ open, onClose, title, size = 'md', children }: { open: boolean; onClose: () => void; title: string; size?: 'md' | 'lg' | 'xl'; children: React.ReactNode }) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

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

// --- 2. 型別定義 ---
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

interface LessonAttachment {
  name: string;
  url: string;
  visibleToStudents?: boolean;
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

interface TeacherCourseManagerProps {
  userInfo: UserInfo | null;
  courses?: Course[];
}

interface LessonData {
  id: string;
  title: string;
  date: string;
  visibleToStudents?: boolean;
  progress: string;
  attachments?: LessonAttachment[];
  noAttachment?: boolean;
  videos?: string[];
  homework?: string;
  noHomework?: boolean;
  onlineExam?: string;
  noOnlineExam?: boolean;
  examScope?: string;
  noExamScope?: boolean;
  notes?: string;
  noNotes?: boolean;
  order?: number;
  createdAt?: { seconds: number };
  updatedAt?: { seconds: number };
}

interface Student {
  id: string; 
  studentId: string; 
  name: string; 
  grade: string;
}

interface ClassTime {
  day: string;
  startTime: string;
  endTime: string;
}

// 課堂管理元件
function LessonManager({ courseId, courseName, courseCode, onClose }: { courseId: string, courseName: string, courseCode: string, onClose: () => void }) {
  const [lessons, setLessons] = useState<LessonData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonData | null>(null);

  const [form, setForm] = useState<Omit<LessonData, 'id' | 'order' | 'createdAt' | 'updatedAt'>>({
    title: '', date: '', visibleToStudents: true, progress: '', attachments: [{ name: '', url: '', visibleToStudents: true }], noAttachment: false, videos: [''], homework: '', noHomework: false, onlineExam: '', noOnlineExam: false, examScope: '', noExamScope: false, notes: '', noNotes: false,
  });

  const [isOrderDirty, setIsOrderDirty] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchLessons = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/lessons/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId })
      });
      const lessons = await res.json();
      const sortedLessons = Array.isArray(lessons)
        ? lessons.sort((a, b) => {
            const aOrder = typeof a.order === 'number' ? a.order : 9999;
            const bOrder = typeof b.order === 'number' ? b.order : 9999;
            if (aOrder === 9999 && bOrder === 9999) return (a.date ? new Date(a.date).getTime() : 0) - (b.date ? new Date(b.date).getTime() : 0);
            return aOrder - bOrder;
          })
        : [];
      setLessons(sortedLessons);
    } catch {
      Swal.fire('錯誤', '讀取課堂失敗', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) fetchLessons();
  }, [courseId, fetchLessons]);

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result;
    if (!destination) return;
    const items = Array.from(lessons);
    const [reorderedItem] = items.splice(source.index, 1);
    items.splice(destination.index, 0, reorderedItem);
    setLessons(items.map((item, index) => ({ ...item, order: index })));
    setIsOrderDirty(true);
  };

  const handleSaveChanges = async () => {
    setIsSubmitting(true);
    try {
      if (isOrderDirty) {
        await fetch('/api/lessons/reorder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId, order: lessons.map(l => l.id) })
        });
      }
      Swal.fire('成功', '變更已儲存', 'success');
      setIsOrderDirty(false);
    } catch {
      Swal.fire('錯誤', '儲存變更失敗', 'error');
    } finally {
      await fetchLessons();
      setIsSubmitting(false);
    }
  };

  const openAddModal = () => {
    setEditingLesson(null);
    setForm({ title: '', date: '', visibleToStudents: true, progress: '', attachments: [{ name: '', url: '', visibleToStudents: true }], noAttachment: false, videos: [''], homework: '', noHomework: false, onlineExam: '', noOnlineExam: false, examScope: '', noExamScope: false, notes: '', noNotes: false });
    setIsModalOpen(true);
  };

  const handleEditClick = (lesson: LessonData) => {
    const normalizedAttachments = (lesson.attachments || [{ name: '', url: '', visibleToStudents: true }]).map((att, idx) => {
      if (typeof att === 'string') {
        return { name: `附件${idx + 1}`, url: att, visibleToStudents: true };
      }
      return {
        name: att?.name || `附件${idx + 1}`,
        url: att?.url || '',
        visibleToStudents: att?.visibleToStudents !== false,
      };
    });
    setEditingLesson(lesson);
    setForm({
      title: lesson.title, date: lesson.date, visibleToStudents: lesson.visibleToStudents !== false, progress: lesson.progress, attachments: normalizedAttachments, noAttachment: lesson.noAttachment || false, videos: lesson.videos || [''], homework: lesson.homework || '', noHomework: lesson.noHomework || false, onlineExam: lesson.onlineExam || '', noOnlineExam: lesson.noOnlineExam || false, examScope: lesson.examScope || '', noExamScope: lesson.noExamScope || false, notes: lesson.notes || '', noNotes: lesson.noNotes || false,
    });
    setIsModalOpen(true);
  };

  const handleFormSubmit = async () => {
    setIsSubmitting(true);
    try {
      const lessonData = {
        ...form,
        attachments: (form.attachments || [])
          .filter((a) => a.url && a.url.trim() !== '')
          .map((a, idx) => ({
            name: a.name?.trim() ? a.name.trim() : `附件${idx + 1}`,
            url: a.url.trim(),
            visibleToStudents: a.visibleToStudents !== false,
          })),
        updatedAt: new Date().toISOString(),
      };

      if (editingLesson) {
        await fetch('/api/lessons/update', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, lessonId: editingLesson.id, ...lessonData }) });
      } else {
        await fetch('/api/lessons/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, ...lessonData, createdAt: new Date().toISOString() }) });
      }
      setIsModalOpen(false); setEditingLesson(null); await fetchLessons();
      Swal.fire('成功', editingLesson ? '課堂已更新' : '課堂已新增', 'success');
    } catch { Swal.fire('錯誤', '操作失敗', 'error'); } finally { setIsSubmitting(false); }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    const result = await Swal.fire({ title: '請確認', text: '確定要刪除此課堂嗎？', icon: 'warning', showCancelButton: true, confirmButtonColor: '#ef4444', confirmButtonText: '刪除', cancelButtonText: '取消', customClass: { popup: 'rounded-2xl' } });
    if (!result.isConfirmed) return;
    try {
      await fetch('/api/lessons/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseId, lessonId }) });
      setLessons(lessons.filter(l => l.id !== lessonId));
      Swal.fire('已刪除', '課堂已移除', 'success');
    } catch { Swal.fire('錯誤', '刪除失敗', 'error'); }
  };

  const handleToggleLessonVisibility = async (lesson: LessonData) => {
    const nextVisible = !(lesson.visibleToStudents !== false);
    try {
      setIsSubmitting(true);
      const res = await fetch('/api/lessons/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          lessonId: lesson.id,
          visibleToStudents: nextVisible,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setLessons((prev) => prev.map((l) => (l.id === lesson.id ? { ...l, visibleToStudents: nextVisible } : l)));
      Swal.fire('成功', `已${nextVisible ? '開放' : '隱藏'}此課堂給學生查看。`, 'success');
    } catch (error) {
      console.error('更新課堂可見性失敗:', error);
      Swal.fire('錯誤', '更新課堂可見性失敗', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAttachmentChange = (idx: number, key: 'name' | 'url', value: string) => setForm((f) => { const att = [...(f.attachments || [])]; att[idx] = { ...att[idx], [key]: value }; return { ...f, attachments: att }; });
  const handleAttachmentVisibilityChange = (idx: number, visible: boolean) => setForm((f) => {
    const att = [...(f.attachments || [])];
    att[idx] = { ...att[idx], visibleToStudents: visible };
    return { ...f, attachments: att };
  });
  const handleVideoChange = (idx: number, value: string) => setForm((f) => { const v = [...(f.videos || [])]; v[idx] = value; return { ...f, videos: v }; });

  if (isLoading) return <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center"><LoadingSpinner size={60} text="課堂資料載入中..." /></div>;

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pb-10 flex flex-col h-full animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <BookOpenIcon className="h-8 w-8 text-indigo-600" />
            {courseName}
          </h1>
          <p className="text-gray-500 text-sm mt-1">{courseCode}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors shadow-sm font-medium flex items-center" onClick={onClose}>
            <ArrowLeftIcon className="w-4 h-4 mr-2" /> 返回列表
          </button>
          <button className="btn-secondary flex items-center" onClick={openAddModal}>
            <PlusIcon className="w-4 h-4 mr-2" /> 新增課堂
          </button>
          {isOrderDirty && (
            <button className="btn-primary flex items-center ml-auto" onClick={handleSaveChanges} disabled={isSubmitting}>
              {isSubmitting ? <LoadingSpinner size={16} color="white" /> : <><CloudArrowUpIcon className="w-4 h-4 mr-2" /> 儲存排序</>}
            </button>
          )}
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="hidden md:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto">
             <table className="w-full text-sm text-left text-gray-500">
                <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                    <tr>
                        <th className="px-4 py-4 w-[60px]"></th>
                        <th className="px-6 py-4 font-bold w-[100px]">堂數</th>
                        <th className="px-6 py-4 font-bold min-w-[200px]">課堂標題</th>
                        <th className="px-6 py-4 font-bold w-[140px]">日期</th>
                        <th className="px-6 py-4 font-bold text-center w-[140px]">學生可見</th>
                        <th className="px-6 py-4 font-bold text-right w-[160px]">操作</th>
                    </tr>
                </thead>
                <Droppable droppableId="lesson-list">
                    {(provided: DroppableProvided) => (
                        <tbody className="divide-y divide-gray-100" ref={provided.innerRef} {...provided.droppableProps}>
                            {lessons.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-8 text-gray-400">目前沒有課堂資料</td></tr>
                            ) : (
                                lessons.map((lesson, idx) => (
                                    <Draggable key={lesson.id} draggableId={lesson.id} index={idx}>
                                        {(provided: DraggableProvided) => (
                                            <tr ref={provided.innerRef} {...provided.draggableProps} className="hover:bg-indigo-50/30 transition-colors group bg-white">
                                                <td className="px-4 py-4 cursor-move text-gray-400 hover:text-gray-600" {...provided.dragHandleProps}>
                                                    <Bars3Icon className="w-5 h-5" />
                                                </td>
                                                <td className="px-6 py-4 font-medium text-indigo-600 whitespace-nowrap">
                                                    第 {idx + 1} 堂
                                                </td>
                                                <td className="px-6 py-4 font-medium text-gray-900">
                                                    <div className="line-clamp-2">{lesson.title}</div>
                                                </td>
                                                <td className="px-6 py-4 font-mono whitespace-nowrap">
                                                    {lesson.date}
                                                </td>
                                                <td className="px-6 py-4 text-center whitespace-nowrap">
                                                    <button
                                                      onClick={() => handleToggleLessonVisibility(lesson)}
                                                      className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1 ${
                                                        lesson.visibleToStudents !== false
                                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                          : 'bg-gray-100 text-gray-600 border-gray-200'
                                                      }`}
                                                    >
                                                      {lesson.visibleToStudents !== false ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeSlashIcon className="w-3.5 h-3.5" />}
                                                      {lesson.visibleToStudents !== false ? '開放' : '隱藏'}
                                                    </button>
                                                </td>
                                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => handleEditClick(lesson)} className="text-indigo-600 hover:text-indigo-800 p-1 rounded-md hover:bg-indigo-50" title="編輯">
                                                            <PencilIcon className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleDeleteLesson(lesson.id)} className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50" title="刪除">
                                                            <TrashIcon className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Draggable>
                                ))
                            )}
                            {provided.placeholder}
                        </tbody>
                    )}
                </Droppable>
             </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden space-y-3">
             <Droppable droppableId="lesson-list-mobile">
                {(provided: DroppableProvided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                        {lessons.map((lesson, idx) => (
                            <Draggable key={lesson.id} draggableId={lesson.id} index={idx}>
                                {(provided: DraggableProvided) => (
                                    <div ref={provided.innerRef} {...provided.draggableProps} className="bg-white border border-gray-200 rounded-xl p-4 mb-3 shadow-sm flex flex-col gap-3">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                 <div className="cursor-move text-gray-300" {...provided.dragHandleProps}>
                                                    <Bars3Icon className="w-6 h-6" />
                                                 </div>
                                                 <div>
                                                     <span className="text-xs font-bold text-indigo-600 block">第 {idx + 1} 堂</span>
                                                     <h4 className="font-bold text-gray-800">{lesson.title}</h4>
                                                 </div>
                                            </div>
                                            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 font-mono">{lesson.date}</span>
                                        </div>
                                        <div>
                                          <button
                                            onClick={() => handleToggleLessonVisibility(lesson)}
                                            className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1 ${
                                              lesson.visibleToStudents !== false
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                : 'bg-gray-100 text-gray-600 border-gray-200'
                                            }`}
                                          >
                                            {lesson.visibleToStudents !== false ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeSlashIcon className="w-3.5 h-3.5" />}
                                            學生端{lesson.visibleToStudents !== false ? '開放' : '隱藏'}
                                          </button>
                                        </div>
                                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                                            <button onClick={() => handleEditClick(lesson)} className="flex items-center text-sm text-indigo-600 font-medium">
                                                <PencilIcon className="w-4 h-4 mr-1" /> 編輯
                                            </button>
                                            <button onClick={() => handleDeleteLesson(lesson.id)} className="flex items-center text-sm text-red-500 font-medium">
                                                <TrashIcon className="w-4 h-4 mr-1" /> 刪除
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </Draggable>
                        ))}
                        {provided.placeholder}
                    </div>
                )}
             </Droppable>
        </div>
      </DragDropContext>

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingLesson ? '編輯課堂' : '新增課堂'} size="lg">
         <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">課堂標題 <span className="text-red-500">*</span></label>
                    <input type="text" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all outline-none" value={form.title} onChange={e => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="例如：第一章 數列與級數" />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">課程日期 <span className="text-red-500">*</span></label>
                    <input type="date" className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all outline-none" value={form.date} onChange={e => setForm((f) => ({ ...f, date: e.target.value }))} />
                 </div>
                 <div className="flex items-end">
                    <label className="inline-flex items-center text-sm font-medium text-gray-700">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-indigo-600 rounded mr-2"
                        checked={form.visibleToStudents !== false}
                        onChange={(e) => setForm((f) => ({ ...f, visibleToStudents: e.target.checked }))}
                      />
                      此課堂開放學生查看
                    </label>
                 </div>
                 <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">課程進度</label>
                    <textarea className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all outline-none" value={form.progress} onChange={e => setForm((f) => ({ ...f, progress: e.target.value }))} rows={3} placeholder="本堂課的教學重點..." />
                 </div>
            </div>
            
            {/* Attachments & Videos ... (簡化，保持功能) */}
            <div className="border-t border-gray-100 pt-4">
                 <label className="flex items-center justify-between text-sm font-bold text-gray-700 mb-3">
                    <span className="flex items-center"><PaperClipIcon className="w-4 h-4 mr-1"/> 附件資源</span>
                    <div className="flex items-center font-normal">
                       <input type="checkbox" id="noAttachment" className="w-4 h-4 text-indigo-600 rounded mr-2" checked={form.noAttachment} onChange={e => setForm((f) => ({ ...f, noAttachment: e.target.checked }))} />
                       <label htmlFor="noAttachment" className="text-gray-500 text-xs">無附件</label>
                    </div>
                 </label>
                 {!form.noAttachment && (
                    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        {(form.attachments || []).map((att, idx) => (
                           <div key={idx} className="flex gap-2 items-center">
                              <input type="text" className="border border-gray-300 rounded-lg px-3 py-2 w-1/3 text-sm focus:ring-indigo-500" placeholder="檔案名稱" value={att.name} onChange={e => handleAttachmentChange(idx, 'name', e.target.value)} />
                              <input type="url" className="border border-gray-300 rounded-lg px-3 py-2 flex-1 text-sm focus:ring-indigo-500" placeholder="檔案連結 (URL)" value={att.url} onChange={e => handleAttachmentChange(idx, 'url', e.target.value)} />
                              <label className="flex items-center text-xs text-gray-600 whitespace-nowrap px-2">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 text-indigo-600 rounded mr-1.5"
                                  checked={att.visibleToStudents !== false}
                                  onChange={(e) => handleAttachmentVisibilityChange(idx, e.target.checked)}
                                />
                                學生可見
                              </label>
                              {(form.attachments || []).length > 1 && (
                                <button type="button" className="text-red-400 hover:text-red-600 p-1" onClick={() => setForm(f => ({...f, attachments: f.attachments?.filter((_, i) => i !== idx)}))}>
                                   <XMarkIcon className="w-5 h-5"/>
                                </button>
                              )}
                           </div>
                        ))}
                        <button type="button" className="text-indigo-600 text-xs font-bold hover:text-indigo-800 flex items-center" onClick={() => setForm(f => ({...f, attachments: [...(f.attachments || []), {name:'', url:'', visibleToStudents: true}]}))}>
                           <PlusIcon className="w-3 h-3 mr-1" /> 新增附件欄位
                        </button>
                    </div>
                 )}
            </div>

            <div className="border-t border-gray-100 pt-4">
                 <label className="text-sm font-bold text-gray-700 mb-3 flex items-center"><VideoCameraIcon className="w-4 h-4 mr-1"/> 影片連結</label>
                 <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {(form.videos || []).map((video, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                           <LinkIcon className="w-4 h-4 text-gray-400" />
                           <input type="url" className="border border-gray-300 rounded-lg px-3 py-2 flex-1 text-sm focus:ring-indigo-500 outline-none" placeholder="YouTube 或其他影片連結" value={video} onChange={e => handleVideoChange(idx, e.target.value)} />
                           {(form.videos || []).length > 1 && (
                             <button type="button" className="text-red-400 hover:text-red-600 p-1" onClick={() => setForm(f => ({...f, videos: f.videos?.filter((_, i) => i !== idx)}))}>
                                <XMarkIcon className="w-5 h-5"/>
                             </button>
                           )}
                        </div>
                    ))}
                    <button type="button" className="text-indigo-600 text-xs font-bold hover:text-indigo-800 flex items-center" onClick={() => setForm(f => ({...f, videos: [...(f.videos || []), '']}))}>
                        <PlusIcon className="w-3 h-3 mr-1" /> 新增影片欄位
                    </button>
                 </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-100 pt-4">
                <div>
                    <div className="flex justify-between mb-1">
                        <label className="text-sm font-bold text-gray-700">作業說明</label>
                        <div className="flex items-center"><input type="checkbox" className="w-3 h-3 mr-1" checked={form.noHomework} onChange={e => setForm(f => ({...f, noHomework: e.target.checked}))} /><span className="text-xs text-gray-500">無作業</span></div>
                    </div>
                    {!form.noHomework && <textarea className="w-full border rounded-lg p-2 text-sm focus:ring-indigo-500" rows={2} value={form.homework} onChange={e => setForm(f => ({...f, homework: e.target.value}))} />}
                </div>
                <div>
                     <div className="flex justify-between mb-1">
                        <label className="text-sm font-bold text-gray-700">線上測驗</label>
                        <div className="flex items-center"><input type="checkbox" className="w-3 h-3 mr-1" checked={form.noOnlineExam} onChange={e => setForm(f => ({...f, noOnlineExam: e.target.checked}))} /><span className="text-xs text-gray-500">無測驗</span></div>
                    </div>
                    {!form.noOnlineExam && <textarea className="w-full border rounded-lg p-2 text-sm focus:ring-indigo-500" rows={2} value={form.onlineExam} onChange={e => setForm(f => ({...f, onlineExam: e.target.value}))} />}
                </div>
                <div>
                     <div className="flex justify-between mb-1">
                        <label className="text-sm font-bold text-gray-700">考試範圍</label>
                        <div className="flex items-center"><input type="checkbox" className="w-3 h-3 mr-1" checked={form.noExamScope} onChange={e => setForm(f => ({...f, noExamScope: e.target.checked}))} /><span className="text-xs text-gray-500">無範圍</span></div>
                    </div>
                    {!form.noExamScope && <textarea className="w-full border rounded-lg p-2 text-sm focus:ring-indigo-500" rows={2} value={form.examScope} onChange={e => setForm(f => ({...f, examScope: e.target.value}))} />}
                </div>
                 <div>
                     <div className="flex justify-between mb-1">
                        <label className="text-sm font-bold text-gray-700">注意事項</label>
                        <div className="flex items-center"><input type="checkbox" className="w-3 h-3 mr-1" checked={form.noNotes} onChange={e => setForm(f => ({...f, noNotes: e.target.checked}))} /><span className="text-xs text-gray-500">無事項</span></div>
                    </div>
                    {!form.noNotes && <textarea className="w-full border rounded-lg p-2 text-sm focus:ring-indigo-500" rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} />}
                </div>
            </div>

            <div className="flex justify-end pt-4 gap-3 border-t border-gray-100">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-gray-500 hover:text-gray-700">取消</button>
                <button onClick={handleFormSubmit} disabled={isSubmitting || !form.title || !form.date} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">
                    {isSubmitting ? '處理中...' : '確認儲存'}
                </button>
            </div>
         </div>
      </Modal>
    </div>
  );
}

export default function TeacherCourseManager({ userInfo, courses: propCourses }: TeacherCourseManagerProps) {
  const [coursesState, setCourses] = useState<Course[]>([]);
  const courses = propCourses ?? coursesState;
  const [loading, setLoading] = useState(true);
  const [_error, _setError] = useState<string | null>(null);
  const [showCourseDetail, setShowCourseDetail] = useState<Course | null>(null);
  const [showLessonManager, setShowLessonManager] = useState<Course | null>(null);
  const [teacherNamesMap, setTeacherNamesMap] = useState<{ [courseId: string]: string[] }>({});
  const [studentCounts, setStudentCounts] = useState<{ [courseId: string]: number }>({});
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedNature, setSelectedNature] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const fetchTeacherNamesCallback = useCallback(async (teacherIds: string[]): Promise<{ [id: string]: string }> => {
    if (!teacherIds.length) return {};
    try {
      const res = await fetch('/api/teacher/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: teacherIds })
      });
      if (!res.ok) return {};
      const teachers = await res.json();
      const map: { [id: string]: string } = {};
      teachers.forEach((t: { id: string, name: string }) => { map[t.id] = t.name; });
      return map;
    } catch { return {}; }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await fetch('/api/teacher/list');
      if (res.ok) { const teachersData = await res.json(); setTeachers(teachersData); }
    } catch {}
  }, []);

  const fetchCourses = useCallback(async () => {
    if (!userInfo?.id) { setCourses([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/courses/list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId: userInfo.id }) });
      if (res.ok) {
        const allCourses = await res.json();
        setCourses(allCourses);
        const allTeacherIds = Array.from(new Set((allCourses.flatMap((c: Course) => (c.teachers || [])).filter((id: unknown): id is string => typeof id === 'string')) as string[]));
        const teacherNameMap = await fetchTeacherNamesCallback(allTeacherIds);
        const newTeacherNamesMap: { [courseId: string]: string[] } = {};
        allCourses.forEach((course: Course) => { newTeacherNamesMap[course.id] = (course.teachers || []).map((id: string) => teacherNameMap[id] || '未知老師'); });
        setTeacherNamesMap(newTeacherNamesMap);

        const studentCountsPromises = allCourses.map(async (course: Course) => {
             try {
               const r = await fetch('/api/course-student-list/list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courseName: course.name, courseCode: course.code }) });
               if (r.ok) { const s = await r.json(); return { courseId: course.id, count: s.length }; }
             } catch {}
             return { courseId: course.id, count: 0 };
        });
        const scResults = await Promise.all(studentCountsPromises);
        const newSC: { [courseId: string]: number } = {};
        scResults.forEach(r => { if(r) newSC[r.courseId] = r.count; });
        setStudentCounts(newSC);
        _setError(null);
      } else { setCourses([]); }
    } catch { setCourses([]); } finally { setLoading(false); }
  }, [userInfo?.id, fetchTeacherNamesCallback]);

  useEffect(() => { fetchCourses(); }, [userInfo?.id, fetchCourses]);
  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const handleShowCourseDetail = async (course: Course) => {
    let fullCourse = course;
    if (!course.description || !course.courseNature || !course.classTimes || !course.teachingMethod) {
      const found = coursesState.find(c => c.id === course.id);
      if (found) fullCourse = found;
    }
    
    setShowCourseDetail(fullCourse);
    
    try {
      const classDataRes = await fetch(`/api/courses/classdata?courseId=${course.id}`);
      if (classDataRes.ok) {
        const classData = await classDataRes.json();
        fullCourse.location = classData.location || fullCourse.location;
        fullCourse.description = classData.description || fullCourse.description;
        fullCourse.liveStreamURL = classData.liveStreamURL || fullCourse.liveStreamURL;
        setShowCourseDetail({ ...fullCourse });
      }
    } catch (e) {
      console.log('無法獲取課程額外資料:', e);
    }
  };
  
  const formatDate = (dateString: string) => {
    if (!dateString) return '未設定';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-TW', {
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
  };

  const getTeacherNames = (teacherIds: string[] | undefined | null) => {
    if (!teacherIds || !Array.isArray(teacherIds)) return '未指定';
    return teacherIds
      .map(id => teachers.find(t => t.id === id || t.account === id || t.uid === id)?.name)
      .filter(name => name)
      .join(', ') || '未指定';
  };

  const getGradeTags = (gradeTags: string[] | undefined | null) => {
    if (!gradeTags || !Array.isArray(gradeTags)) return '未指定';
    return gradeTags.join(', ');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case '報名中': return 'bg-emerald-100 text-emerald-800 border border-emerald-200';
      case '開課中': return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
      case '已額滿': return 'bg-rose-100 text-rose-800 border border-rose-200';
      case '未開課': return 'bg-amber-100 text-amber-800 border border-amber-200';
      case '已結束': return 'bg-gray-100 text-gray-600 border border-gray-200';
      case '已封存': return 'bg-red-50 text-red-700 border border-red-200';
      default: return 'bg-gray-50 text-gray-600 border border-gray-200';
    }
  };

  const filteredCourses = courses.filter(course => {
    const statusMatch = selectedStatus === 'all' ? !(course.status && course.status.includes('已封存')) && !(course.name && course.name.includes('已封存')) : course.status === selectedStatus;
    const natureMatch = selectedNature === 'all' || course.courseNature === selectedNature;

    return (course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           course.code.toLowerCase().includes(searchTerm.toLowerCase())) && 
           (selectedGrade === 'all' || (course.gradeTags && course.gradeTags.includes(selectedGrade))) && 
           (selectedSubject === 'all' || course.subjectTag === selectedSubject) &&
           natureMatch &&
           statusMatch;
  });

  if (showLessonManager) {
    return <LessonManager courseId={showLessonManager.id} courseName={showLessonManager.name} courseCode={showLessonManager.code} onClose={() => setShowLessonManager(null)} />;
  }

  if (loading) return <div className="fixed inset-0 bg-white z-[9999] flex items-center justify-center"><LoadingSpinner size={60} /></div>;

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 flex flex-col h-full animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <BookOpenIcon className="h-8 w-8 text-indigo-600" />
            授課管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">查看您的授課清單並管理各課堂教學進度。</p>
        </div>
      </div>

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

       {!loading && filteredCourses.length === 0 ? (
           <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
               <h3 className="mt-2 text-xl font-bold text-gray-900">尚無授課課程</h3>
           </div>
       ) : (
           <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto hidden md:block">
              <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                      <tr>
                          <th className="px-6 py-4 font-bold min-w-[200px] w-[250px]">課程名稱</th>
                          <th className="px-6 py-4 font-bold min-w-[150px] w-[200px]">授課老師</th>
                          <th className="px-6 py-4 font-bold text-center w-[120px]">學生人數</th>
                          <th className="px-6 py-4 font-bold min-w-[220px]">上課時間</th>
                          <th className="px-6 py-4 font-bold text-center min-w-[120px]">會議室</th>
                          <th className="px-6 py-4 font-bold text-center w-[100px]">狀態</th>
                          <th className="px-6 py-4 font-bold text-right w-[180px]">操作</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {filteredCourses.map(course => (
                          <tr key={course.id} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="px-6 py-4">
                                  <div className="font-bold text-gray-900 whitespace-nowrap overflow-hidden text-ellipsis">{course.name}</div>
                                  <div className="text-xs font-mono text-gray-500 mt-1">{course.code}</div>
                              </td>
                              <td className="px-6 py-4">
                                  <div className="flex items-center">
                                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mr-3 text-xs font-bold shrink-0">{teacherNamesMap[course.id]?.[0]?.[0] || '師'}</div>
                                      <span className="truncate max-w-[150px] whitespace-nowrap">{teacherNamesMap[course.id]?.join('、') || '載入中...'}</span>
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{studentCounts[course.id] ?? 0} 人</span>
                              </td>
                              <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                                  {(course.classTimes || []).map((ct, i) => <div key={i}>{`${(ct as unknown as ClassTime).day} ${(ct as unknown as ClassTime).startTime}-${(ct as unknown as ClassTime).endTime}`}</div>)}
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                  {course.liveStreamURL ? (
                                      <a href={course.liveStreamURL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-md text-xs font-bold">
                                          <VideoCameraIcon className="w-3.5 h-3.5 mr-1" /> 進入會議室
                                      </a>
                                  ) : <span className="text-gray-400 text-xs">無</span>}
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getStatusColor(course.status)}`}>{course.status}</span>
                              </td>
                              <td className="px-6 py-4 text-right whitespace-nowrap">
                                  <div className="flex justify-end gap-2">
                                      <button className="btn-primary px-3 py-1.5 text-sm" onClick={() => setShowLessonManager(course)}>管理</button>
                                      <button className="btn-secondary px-3 py-1.5 text-sm" onClick={() => handleShowCourseDetail(course)}>詳情</button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
           </div>
       )}
       
       <div className="md:hidden space-y-4">
          {filteredCourses.map(course => (
              <div key={course.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
                  <div className="flex justify-between mb-2">
                      <div className="font-bold text-gray-900">{course.name}</div>
                      <span className={`px-2 py-1 rounded text-xs ${getStatusColor(course.status)}`}>{course.status}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-4">{course.code}</div>
                  {course.liveStreamURL && (
                      <div className="mb-4">
                          <a href={course.liveStreamURL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-full py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-bold transition-colors">
                              <VideoCameraIcon className="w-5 h-5 mr-2" />
                              進入線上會議室
                          </a>
                      </div>
                  )}
                  <div className="flex justify-end gap-2">
                      <button className="btn-primary w-full py-2 text-sm" onClick={() => setShowLessonManager(course)}>管理課程</button>
                      <button className="btn-secondary w-full py-2 text-sm" onClick={() => handleShowCourseDetail(course)}>詳情</button>
                  </div>
              </div>
          ))}
       </div>

       {showCourseDetail && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCourseDetail(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[90vh] overflow-hidden flex flex-col animate-bounce-in">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold text-gray-800 pr-8 line-clamp-1">
                {showCourseDetail.name}
              </h2>
              <button 
                onClick={() => setShowCourseDetail(null)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700 flex items-center justify-center transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              
              {/* Status Badge Row */}
              <div className="flex flex-wrap gap-3 mb-6">
                 <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(showCourseDetail.status)}`}>
                   {showCourseDetail.status}
                 </span>
                 <span className="px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600 font-medium">
                   {showCourseDetail.courseNature}
                 </span>
                 <span className="px-3 py-1 rounded-full text-sm bg-indigo-50 text-indigo-600 font-medium">
                   {showCourseDetail.teachingMethod}
                 </span>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 bg-gray-50 p-5 rounded-xl border border-gray-100">
                <div>
                   <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">授課老師</label>
                   <p className="text-gray-800 font-medium">{getTeacherNames(showCourseDetail.teachers)}</p>
                </div>
                <div>
                   <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">適用對象</label>
                   <p className="text-gray-800 font-medium">{getGradeTags(showCourseDetail.gradeTags)} ({showCourseDetail.subjectTag})</p>
                </div>
                <div>
                   <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">課程期間</label>
                   <p className="text-gray-800 font-medium">
                     {formatDate(showCourseDetail.startDate)} ~ {formatDate(showCourseDetail.endDate)}
                   </p>
                </div>
                <div>
                   <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">上課地點</label>
                   <p className="text-gray-800 font-medium">{showCourseDetail.location || '未指定'}</p>
                </div>
              </div>

              {/* Class Times */}
              <div className="mb-8">
                 <h4 className="text-lg font-bold text-gray-800 mb-3 border-l-4 border-emerald-400 pl-3">上課時間</h4>
                 {Array.isArray(showCourseDetail.classTimes) && showCourseDetail.classTimes.length > 0 ? (
                    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden"> 
                       {showCourseDetail.classTimes.map((time: unknown, idx: number) => (
                         <div key={idx} className="px-4 py-3 border-b border-gray-100 last:border-0 flex items-center text-gray-700 text-sm">
                            <ClockIcon className="w-4 h-4 mr-3 text-gray-400" />
                            {typeof time === 'object' && time !== null
                              ? `${(time as ClassTime).day} ${(time as ClassTime).startTime} ~ ${(time as ClassTime).endTime}`
                              : String(time)}
                         </div>
                       ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic text-sm">暫無時間表</p>
                  )}
              </div>

              {/* Description */}
              {showCourseDetail.description && (
                <div className="mb-6">
                  <h4 className="text-lg font-bold text-gray-800 mb-3 border-l-4 border-indigo-400 pl-3">課程介紹</h4>
                  <div className="prose prose-sm md:prose-base max-w-none text-gray-600 bg-white p-1 rounded-lg">
                    <p className="whitespace-pre-line leading-relaxed">{showCourseDetail.description}</p>
                  </div>
                </div>
              )}
              
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50/50">
              <button
                onClick={() => setShowCourseDetail(null)}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-medium transition-colors shadow-sm"
              >
                關閉視窗
              </button>
            </div>
          </div>
        </div>, document.body
       )}
    </div>
  );
}