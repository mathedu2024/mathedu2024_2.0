'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import "react-datepicker/dist/react-datepicker.css";
import Swal from 'sweetalert2';
import { LoadingSpinner, PageLoadingArea } from './ui'; 
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
  MegaphoneIcon,
  DocumentTextIcon,
  FolderIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/outline';
import CourseFilter from './CourseFilter';
import Dropdown from './ui/Dropdown';
import { formatCourseDateForDisplay } from '@/services/courseDate';

const customLinkIconOptions = [
  { value: 'LinkIcon', label: '預設連結' },
  { value: 'VideoCameraIcon', label: '視訊會議' },
  { value: 'DocumentTextIcon', label: '文件' },
  { value: 'FolderIcon', label: '資料夾' },
  { value: 'ChatBubbleLeftRightIcon', label: '討論區' },
];

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
      <div className={`relative bg-white rounded-2xl shadow-2xl w-full ${maxWidthClass} max-h-[90vh] flex flex-col overflow-hidden animate-bounce-in border border-gray-100`}>
        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 flex justify-between items-center text-white flex-shrink-0">
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

interface CustomLink {
  name: string;
  url: string;
  icon: string;
}

interface CourseAnnouncement {
  id: string;
  title: string;
  content: string;
  links: { name: string; url: string }[];
  createdAt: string;
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
  customLinks?: CustomLink[];
  announcements?: CourseAnnouncement[];
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
function LessonManager({ courseId, courseName, courseCode, onClose, isArchived = false }: { courseId: string, courseName: string, courseCode: string, onClose: () => void, isArchived?: boolean }) {
  const [lessons, setLessons] = useState<LessonData[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonData | null>(null);

  const [form, setForm] = useState<Omit<LessonData, 'id' | 'order' | 'createdAt' | 'updatedAt'>>({
    title: '', date: '', visibleToStudents: true, progress: '', attachments: [{ name: '', url: '', visibleToStudents: true }], noAttachment: false, videos: [''], homework: '', noHomework: false, onlineExam: '', noOnlineExam: false, examScope: '', noExamScope: false, notes: '', noNotes: false,
  });

  const [isOrderDirty, setIsOrderDirty] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 768px)').matches : true
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

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

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 pb-10 flex flex-col animate-fade-in">
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
          {!isArchived && (
            <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center" onClick={openAddModal}>
              <PlusIcon className="w-4 h-4 mr-2" /> 新增課堂
            </button>
          )}
          {!isArchived && isOrderDirty && (
            <button className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center ml-auto" onClick={handleSaveChanges} disabled={isSubmitting}>
              {isSubmitting ? <LoadingSpinner size={16} color="white" /> : <><CloudArrowUpIcon className="w-4 h-4 mr-2" /> 儲存排序</>}
            </button>
          )}
        </div>
      </div>

      {isArchived && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm mb-6">
          <span className="font-bold mr-2">提示：</span>
          此課程已封存，您只能查看課堂資料，無法新增或修改。
        </div>
      )}

      {isLoading ? (
        <PageLoadingArea />
      ) : (
      <DragDropContext onDragEnd={onDragEnd}>
        {isDesktop ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden text-sm text-left text-gray-500">
             <div className="grid grid-cols-[3rem_5rem_minmax(0,1fr)_7rem_7rem_8rem] bg-gray-50 text-xs text-gray-700 uppercase border-b border-gray-100">
                <div className="px-4 py-4" />
                <div className="px-6 py-4 font-bold">堂數</div>
                <div className="px-6 py-4 font-bold">課堂標題</div>
                <div className="px-6 py-4 font-bold">日期</div>
                <div className="px-6 py-4 font-bold text-center">學生可見</div>
                <div className="px-6 py-4 font-bold text-right">{isArchived ? '詳情' : '操作'}</div>
             </div>
                <Droppable droppableId="lesson-list">
                    {(provided: DroppableProvided) => (
                        <div className="divide-y divide-gray-100" ref={provided.innerRef} {...provided.droppableProps}>
                            {lessons.length === 0 ? (
                                <div className="text-center py-8 text-gray-400">目前沒有課堂資料</div>
                            ) : (
                                lessons.map((lesson, idx) => (
                                    <Draggable key={lesson.id} draggableId={lesson.id} index={idx} isDragDisabled={isArchived}>
                                        {(provided: DraggableProvided) => (
                                            <div ref={provided.innerRef} {...provided.draggableProps} className="grid grid-cols-[3rem_5rem_minmax(0,1fr)_7rem_7rem_8rem] items-center hover:bg-indigo-50/30 transition-colors group bg-white">
                                                <div className="px-4 py-4 cursor-move text-gray-400 hover:text-gray-600" {...provided.dragHandleProps}>
                                                    {!isArchived && <Bars3Icon className="w-5 h-5" />}
                                                </div>
                                                <div className="px-6 py-4 font-medium text-indigo-600 whitespace-nowrap">
                                                    第 {idx + 1} 堂
                                                </div>
                                                <div className="px-6 py-4 font-medium text-gray-900">
                                                    <div className="line-clamp-2">{lesson.title}</div>
                                                </div>
                                                <div className="px-6 py-4 font-mono whitespace-nowrap">
                                                    {lesson.date}
                                                </div>
                                                <div className="px-6 py-4 text-center whitespace-nowrap">
                                                    <button
                                                      onClick={() => !isArchived && handleToggleLessonVisibility(lesson)}
                                                      className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1 ${
                                                        lesson.visibleToStudents !== false
                                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                          : 'bg-gray-100 text-gray-600 border-gray-200'
                                                      } ${isArchived ? 'cursor-default opacity-80' : ''}`}
                                                      disabled={isArchived}
                                                    >
                                                      {lesson.visibleToStudents !== false ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeSlashIcon className="w-3.5 h-3.5" />}
                                                      {lesson.visibleToStudents !== false ? '開放' : '隱藏'}
                                                    </button>
                                                </div>
                                                <div className="px-6 py-4 text-right whitespace-nowrap">
                                                    <div className="flex justify-end gap-2">
                                                        <button onClick={() => handleEditClick(lesson)} className="text-indigo-600 hover:text-indigo-800 p-1 rounded-md hover:bg-indigo-50" title={isArchived ? "查看" : "編輯"}>
                                                            {isArchived ? <EyeIcon className="w-4 h-4" /> : <PencilIcon className="w-4 h-4" />}
                                                        </button>
                                                        {!isArchived && (
                                                          <button onClick={() => handleDeleteLesson(lesson.id)} className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50" title="刪除">
                                                              <TrashIcon className="w-4 h-4" />
                                                          </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </Draggable>
                                ))
                            )}
                            {provided.placeholder}
                        </div>
                    )}
                </Droppable>
        </div>
        ) : (
        /* Mobile View */
        <div className="space-y-3">
             <Droppable droppableId="lesson-list-mobile">
                {(provided: DroppableProvided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps}>
                        {lessons.map((lesson, idx) => (
                            <Draggable key={lesson.id} draggableId={lesson.id} index={idx} isDragDisabled={isArchived}>
                                {(provided: DraggableProvided) => (
                                    <div ref={provided.innerRef} {...provided.draggableProps} className="bg-white border border-gray-200 rounded-xl p-4 mb-3 shadow-sm flex flex-col gap-3">
                                        <div className="flex items-start gap-2">
                                             <div className={`cursor-move text-gray-300 mt-0.5 ${isArchived ? 'hidden' : ''}`} {...provided.dragHandleProps}>
                                                <Bars3Icon className="w-6 h-6" />
                                             </div>
                                             <div className="flex-1">
                                                 <span className="text-xs font-bold text-indigo-600 block mb-0.5">第 {idx + 1} 堂</span>
                                                 <h4 className="font-bold text-gray-800 mb-1.5">{lesson.title}</h4>
                                                 <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 font-mono inline-block">{lesson.date}</span>
                                             </div>
                                        </div>
                                        <div className="flex justify-between items-center pt-1 border-t border-gray-100 mt-1">
                                            <div>
                                              <button
                                                onClick={() => !isArchived && handleToggleLessonVisibility(lesson)}
                                                className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1 ${
                                                  lesson.visibleToStudents !== false
                                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                    : 'bg-gray-100 text-gray-600 border-gray-200'
                                                } ${isArchived ? 'cursor-default opacity-80' : ''}`}
                                                disabled={isArchived}
                                              >
                                                {lesson.visibleToStudents !== false ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeSlashIcon className="w-3.5 h-3.5" />}
                                                學生端{lesson.visibleToStudents !== false ? '開放' : '隱藏'}
                                              </button>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => handleEditClick(lesson)} className="flex items-center text-sm text-indigo-600 font-medium">
                                                    {isArchived ? <EyeIcon className="w-4 h-4 mr-1" /> : <PencilIcon className="w-4 h-4 mr-1" />} {isArchived ? '查看' : '編輯'}
                                                </button>
                                                {!isArchived && (
                                                  <button onClick={() => handleDeleteLesson(lesson.id)} className="flex items-center text-sm text-red-500 font-medium">
                                                      <TrashIcon className="w-4 h-4 mr-1" /> 刪除
                                                  </button>
                                                )}
                                            </div>
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
        )}
      </DragDropContext>
      )}

      <Modal open={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingLesson ? (isArchived ? '查看課堂' : '編輯課堂') : '新增課堂'} size="lg">
         <div className="space-y-6">
            {isArchived && (
              <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-xl flex items-center shadow-sm">
                <span className="font-bold mr-2">提示：</span>
                此為封存課程，僅供檢視。
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">課堂標題 <span className="text-red-500">*</span></label>
                    <input type="text" className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all outline-none ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} value={form.title} onChange={e => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="例如：第一章 數列與級數" disabled={isArchived} />
                 </div>
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">課程日期 <span className="text-red-500">*</span></label>
                    <input type="date" className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all outline-none ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} value={form.date} onChange={e => setForm((f) => ({ ...f, date: e.target.value }))} disabled={isArchived} />
                 </div>
                 <div className="flex items-end">
                    <label className={`inline-flex items-center text-sm font-medium text-gray-700 ${isArchived ? 'opacity-60 cursor-default' : ''}`}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-indigo-600 rounded mr-2 accent-indigo-600 cursor-pointer disabled:opacity-50"
                        checked={form.visibleToStudents !== false}
                        onChange={(e) => setForm((f) => ({ ...f, visibleToStudents: e.target.checked }))}
                        disabled={isArchived}
                      />
                      此課堂開放學生查看
                    </label>
                 </div>
                 <div className="md:col-span-2">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">課程進度</label>
                    <textarea className={`w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 transition-all outline-none resize-none ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} value={form.progress} onChange={e => setForm((f) => ({ ...f, progress: e.target.value }))} rows={3} placeholder="本堂課的教學重點..." disabled={isArchived} />
                 </div>
            </div>
            
            {/* Attachments & Videos ... (簡化，保持功能) */}
            <div className="border-t border-gray-100 pt-4">
                 <label className="flex items-center justify-between text-sm font-bold text-gray-700 mb-3">
                    <span className="flex items-center"><PaperClipIcon className="w-4 h-4 mr-1"/> 附件資源</span>
                    <div className={`flex items-center font-normal ${isArchived ? 'opacity-60' : ''}`}>
                       <input type="checkbox" id="noAttachment" className="w-4 h-4 text-indigo-600 rounded mr-2 accent-indigo-600 cursor-pointer disabled:opacity-50" checked={form.noAttachment} onChange={e => setForm((f) => ({ ...f, noAttachment: e.target.checked }))} disabled={isArchived} />
                       <label htmlFor="noAttachment" className="text-gray-500 text-xs">無附件</label>
                    </div>
                 </label>
                 {!form.noAttachment && (
                    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                        {(form.attachments || []).map((att, idx) => (
                           <div key={idx} className="flex flex-col sm:flex-row gap-2 sm:items-center">
                              <input type="text" className={`border border-gray-300 rounded-lg px-3 py-2 w-full sm:w-1/3 text-sm focus:ring-indigo-500 ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} placeholder="檔案名稱" value={att.name} onChange={e => handleAttachmentChange(idx, 'name', e.target.value)} disabled={isArchived} />
                              <div className="flex gap-2 items-center w-full sm:w-auto sm:flex-1">
                                <input type="url" className={`border border-gray-300 rounded-lg px-3 py-2 flex-1 text-sm focus:ring-indigo-500 ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} placeholder="檔案連結 (URL)" value={att.url} onChange={e => handleAttachmentChange(idx, 'url', e.target.value)} disabled={isArchived} />
                                <label className={`flex items-center text-xs text-gray-600 whitespace-nowrap px-2 ${isArchived ? 'opacity-60' : ''}`}>
                                  <input
                                    type="checkbox"
                                    className="w-4 h-4 text-indigo-600 rounded mr-1.5 accent-indigo-600 cursor-pointer disabled:opacity-50"
                                    checked={att.visibleToStudents !== false}
                                    onChange={(e) => handleAttachmentVisibilityChange(idx, e.target.checked)}
                                    disabled={isArchived}
                                  />
                                  學生可見
                                </label>
                                {!isArchived && (form.attachments || []).length > 1 && (
                                  <button type="button" className="text-red-400 hover:text-red-600 p-1" onClick={() => setForm(f => ({...f, attachments: f.attachments?.filter((_, i) => i !== idx)}))}>
                                     <XMarkIcon className="w-5 h-5"/>
                                  </button>
                                )}
                              </div>
                           </div>
                        ))}
                        {!isArchived && (
                          <button type="button" className="text-indigo-600 text-xs font-bold hover:text-indigo-800 flex items-center" onClick={() => setForm(f => ({...f, attachments: [...(f.attachments || []), {name:'', url:'', visibleToStudents: true}]}))}>
                             <PlusIcon className="w-3 h-3 mr-1" /> 新增附件欄位
                          </button>
                        )}
                    </div>
                 )}
            </div>

            <div className="border-t border-gray-100 pt-4">
                 <label className="text-sm font-bold text-gray-700 mb-3 flex items-center"><VideoCameraIcon className="w-4 h-4 mr-1"/> 影片連結</label>
                 <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                    {(form.videos || []).map((video, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                           <LinkIcon className="w-4 h-4 text-gray-400" />
                           <input type="url" className={`border border-gray-300 rounded-lg px-3 py-2 flex-1 text-sm focus:ring-indigo-500 outline-none ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} placeholder="YouTube 或其他影片連結" value={video} onChange={e => handleVideoChange(idx, e.target.value)} disabled={isArchived} />
                           {!isArchived && (form.videos || []).length > 1 && (
                             <button type="button" className="text-red-400 hover:text-red-600 p-1" onClick={() => setForm(f => ({...f, videos: f.videos?.filter((_, i) => i !== idx)}))}>
                                <XMarkIcon className="w-5 h-5"/>
                             </button>
                           )}
                        </div>
                    ))}
                    {!isArchived && (
                      <button type="button" className="text-indigo-600 text-xs font-bold hover:text-indigo-800 flex items-center" onClick={() => setForm(f => ({...f, videos: [...(f.videos || []), '']}))}>
                          <PlusIcon className="w-3 h-3 mr-1" /> 新增影片欄位
                      </button>
                    )}
                 </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-gray-100 pt-4">
                <div>
                    <div className="flex justify-between mb-1">
                        <label className="text-sm font-bold text-gray-700">作業說明</label>
                        <div className={`flex items-center ${isArchived ? 'opacity-60' : ''}`}><input type="checkbox" className="w-4 h-4 text-indigo-600 rounded mr-1.5 accent-indigo-600 cursor-pointer disabled:opacity-50" checked={form.noHomework} onChange={e => setForm(f => ({...f, noHomework: e.target.checked}))} disabled={isArchived} /><span className="text-xs text-gray-500">無作業</span></div>
                    </div>
                    {!form.noHomework && <textarea className={`w-full border rounded-lg p-2 text-sm focus:ring-indigo-500 resize-none ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} rows={2} value={form.homework} onChange={e => setForm(f => ({...f, homework: e.target.value}))} disabled={isArchived} />}
                </div>
                <div>
                     <div className="flex justify-between mb-1">
                        <label className="text-sm font-bold text-gray-700">線上測驗</label>
                        <div className={`flex items-center ${isArchived ? 'opacity-60' : ''}`}><input type="checkbox" className="w-4 h-4 text-indigo-600 rounded mr-1.5 accent-indigo-600 cursor-pointer disabled:opacity-50" checked={form.noOnlineExam} onChange={e => setForm(f => ({...f, noOnlineExam: e.target.checked}))} disabled={isArchived} /><span className="text-xs text-gray-500">無測驗</span></div>
                    </div>
                    {!form.noOnlineExam && <textarea className={`w-full border rounded-lg p-2 text-sm focus:ring-indigo-500 resize-none ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} rows={2} value={form.onlineExam} onChange={e => setForm(f => ({...f, onlineExam: e.target.value}))} disabled={isArchived} />}
                </div>
                <div>
                     <div className="flex justify-between mb-1">
                        <label className="text-sm font-bold text-gray-700">考試範圍</label>
                        <div className={`flex items-center ${isArchived ? 'opacity-60' : ''}`}><input type="checkbox" className="w-4 h-4 text-indigo-600 rounded mr-1.5 accent-indigo-600 cursor-pointer disabled:opacity-50" checked={form.noExamScope} onChange={e => setForm(f => ({...f, noExamScope: e.target.checked}))} disabled={isArchived} /><span className="text-xs text-gray-500">無範圍</span></div>
                    </div>
                    {!form.noExamScope && <textarea className={`w-full border rounded-lg p-2 text-sm focus:ring-indigo-500 resize-none ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} rows={2} value={form.examScope} onChange={e => setForm(f => ({...f, examScope: e.target.value}))} disabled={isArchived} />}
                </div>
                 <div>
                     <div className="flex justify-between mb-1">
                        <label className="text-sm font-bold text-gray-700">注意事項</label>
                        <div className={`flex items-center ${isArchived ? 'opacity-60' : ''}`}><input type="checkbox" className="w-4 h-4 text-indigo-600 rounded mr-1.5 accent-indigo-600 cursor-pointer disabled:opacity-50" checked={form.noNotes} onChange={e => setForm(f => ({...f, noNotes: e.target.checked}))} disabled={isArchived} /><span className="text-xs text-gray-500">無事項</span></div>
                    </div>
                    {!form.noNotes && <textarea className={`w-full border rounded-lg p-2 text-sm focus:ring-indigo-500 resize-none ${isArchived ? 'bg-gray-100 text-gray-500' : ''}`} rows={2} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} disabled={isArchived} />}
                </div>
            </div>

            <div className="flex justify-end pt-4 gap-3 border-t border-gray-100">
                <button onClick={() => setIsModalOpen(false)} className={`px-4 py-2 ${isArchived ? 'bg-indigo-600 text-white rounded-lg hover:bg-indigo-700' : 'text-gray-500 hover:text-gray-700'}`}>{isArchived ? '關閉' : '取消'}</button>
                {!isArchived && (
                  <button onClick={handleFormSubmit} disabled={isSubmitting || !form.title || !form.date} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400">
                      {isSubmitting ? '處理中...' : '確認儲存'}
                  </button>
                )}
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
  const [isSavingCourse, setIsSavingCourse] = useState(false);
  const [showAnnouncementManager, setShowAnnouncementManager] = useState<Course | null>(null);
  const [editingAnnouncement, setEditingAnnouncement] = useState<CourseAnnouncement | null>(null);
  const [annIsSubmitting, setAnnIsSubmitting] = useState(false);

  const handleShowAnnouncementManager = async (course: Course) => {
      // 先立刻開啟視窗 (使用目前已有的資料)
      setShowAnnouncementManager({ ...course });
      try {
          const res = await fetch(`/api/courses/classdata?courseId=${course.id}`);
          if (res.ok) {
              const data = await res.json();
              // 在背景取得最新資料後，無縫更新視窗內的公告清單
              setShowAnnouncementManager(prev => {
                  if (prev && prev.id === course.id) {
                      return { ...prev, announcements: data.announcements ?? prev.announcements ?? [] };
                  }
                  return prev;
              });
          }
      } catch (e) {}
  };

  const handleUpdateCourseDescription = async () => {
    if (!showCourseDetail) return;
    setIsSavingCourse(true);
    try {
        const res = await fetch('/api/courses/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: showCourseDetail.id,
                description: showCourseDetail.description,
                customLinks: showCourseDetail.customLinks
            })
        });
        if (res.ok) {
            Swal.fire({
                icon: 'success',
                title: '儲存成功',
                text: '課程資訊已更新',
                confirmButtonColor: '#4f46e5',
                customClass: { popup: 'rounded-2xl' }
            });
            setCourses(prev => prev.map(c => c.id === showCourseDetail.id ? { 
                ...c, 
                description: showCourseDetail.description || '',
                customLinks: showCourseDetail.customLinks || []
            } : c));
            setShowCourseDetail(null);
        } else {
            Swal.fire('錯誤', '更新失敗', 'error');
        }
    } catch (e) {
        Swal.fire('錯誤', '更新失敗', 'error');
    } finally {
        setIsSavingCourse(false);
    }
  };

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
    if (!userInfo?.id) { 
      setLoading(true); 
      return; 
    }
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

        // 提早解除載入狀態，讓課程列表能先顯示
        setLoading(false);
        _setError(null);

        // 在背景非同步獲取學生人數，不阻塞主畫面渲染
        fetch('/api/student/list')
          .then(res => res.ok ? res.json() : [])
          .then(allStudents => {
            const newSC: { [courseId: string]: number } = {};
            allCourses.forEach((course: Course) => {
              const courseKey = `${course.name}(${course.code})`;
              newSC[course.id] = allStudents.filter((s: any) => s.enrolledCourses && (s.enrolledCourses.includes(course.id) || s.enrolledCourses.includes(courseKey))).length;
            });
            setStudentCounts(newSC);
          }).catch(() => {});
      } else { setCourses([]); }
    } catch { setCourses([]); setLoading(false); }
  }, [userInfo?.id, fetchTeacherNamesCallback]);

  useEffect(() => { fetchCourses(); }, [userInfo?.id, fetchCourses]);
  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  const handleShowCourseDetail = async (course: Course) => {
    let fullCourse = courses.find((c) => c.id === course.id) ?? course;
    setShowCourseDetail(fullCourse);

    try {
      const classDataRes = await fetch(`/api/courses/classdata?courseId=${course.id}`);
      if (classDataRes.ok) {
        const classData = await classDataRes.json();
        setShowCourseDetail({
          ...fullCourse,
          location: classData.location || fullCourse.location,
          description: classData.description || fullCourse.description,
          liveStreamURL: classData.liveStreamURL || fullCourse.liveStreamURL,
          customLinks: classData.customLinks || fullCourse.customLinks || [],
          startDate: classData.startDate || fullCourse.startDate,
          endDate: classData.endDate || fullCourse.endDate,
        });
      }
    } catch (e) {
      console.log('無法獲取課程額外資料:', e);
    }
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
  }).sort((a, b) => {
      const statuses = ['報名中', '開課中', '未開課', '已額滿', '已結束', '已封存', '資料建置中...'];
      const statusA = statuses.indexOf(a.status);
      const statusB = statuses.indexOf(b.status);
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

  if (showLessonManager) {
    return <LessonManager courseId={showLessonManager.id} courseName={showLessonManager.name} courseCode={showLessonManager.code} isArchived={showLessonManager.status === '已封存'} onClose={() => setShowLessonManager(null)} />;
  }

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

       {loading ? (
           <PageLoadingArea />
       ) : filteredCourses.length === 0 ? (
           <div className="text-center py-16 px-6 bg-white rounded-2xl border border-dashed border-gray-300">
               <h3 className="mt-2 text-xl font-bold text-gray-900">尚無授課課程</h3>
           </div>
       ) : (
           <>
             <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-x-auto hidden md:block">
              <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                      <tr>
                          <th className="px-6 py-4 font-bold min-w-[200px]">課程名稱</th>
                          <th className="px-6 py-4 font-bold min-w-[150px]">授課老師</th>
                          <th className="px-6 py-4 font-bold text-center whitespace-nowrap">學生數</th>
                          <th className="px-6 py-4 font-bold min-w-[180px]">上課時間</th>
                          <th className="px-6 py-4 font-bold text-center whitespace-nowrap">會議室</th>
                          <th className="px-6 py-4 font-bold text-center whitespace-nowrap">狀態</th>
                          <th className="px-6 py-4 font-bold text-right min-w-[180px]">操作</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {filteredCourses.map(course => (
                          <tr key={course.id} className="hover:bg-indigo-50/30 transition-colors">
                              <td className="px-6 py-4">
                                  <div className="font-bold text-gray-900 text-base whitespace-nowrap overflow-hidden text-ellipsis">{course.name}</div>
                                  <div className="text-sm font-mono text-gray-500 mt-1">{course.code}</div>
                              </td>
                              <td className="px-6 py-4">
                                  <div className="flex items-center">
                                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mr-3 text-sm font-bold shrink-0">{teacherNamesMap[course.id]?.[0]?.[0] || '師'}</div>
                                      <span className="truncate max-w-[150px] whitespace-nowrap text-sm">{teacherNamesMap[course.id]?.join('、') || '載入中...'}</span>
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-gray-100 text-gray-800">{studentCounts[course.id] ?? 0} 人</span>
                              </td>
                              <td className="px-6 py-4 text-gray-600">
                                  <div className="line-clamp-2 text-sm leading-relaxed">
                                      {(course.classTimes || []).map((ct, i) => <div key={i}>{`${(ct as unknown as ClassTime).day} ${(ct as unknown as ClassTime).startTime}-${(ct as unknown as ClassTime).endTime}`}</div>)}
                                  </div>
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                  {course.liveStreamURL ? (
                                      <a href={course.liveStreamURL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 hover:bg-indigo-100 p-2 rounded-lg text-sm font-bold" title="進入會議室">
                                          <VideoCameraIcon className="w-5 h-5" />
                                      </a>
                                  ) : <span className="text-gray-400 text-sm">無</span>}
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                  <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(course.status)}`}>{course.status}</span>
                              </td>
                              <td className="px-6 py-4 text-right whitespace-nowrap">
                                  <div className="flex justify-end gap-2">
                                      <button className="px-3 py-1.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm" onClick={() => setShowLessonManager(course)}>管理</button>
                                      <button className="px-3 py-1.5 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors shadow-sm flex justify-center items-center" onClick={() => handleShowAnnouncementManager(course)}>公告</button>
                                      <button className="px-3 py-1.5 bg-white text-indigo-600 border border-indigo-200 text-sm font-medium rounded-lg hover:bg-indigo-50 transition-colors shadow-sm" onClick={() => handleShowCourseDetail(course)}>詳情</button>
                                  </div>
                              </td>
                          </tr>
                      ))}
                  </tbody>
              </table>
             </div>
             
             <div className="md:hidden space-y-4">
                {filteredCourses.map(course => (
                    <div key={course.id} className="bg-white border border-gray-100 rounded-xl shadow-sm p-5">
                        <div className="mb-2">
                            <div className="font-bold text-gray-900 text-lg">{course.name}</div>
                        </div>
                        <div className="text-sm font-mono text-gray-500 mb-2">{course.code}</div>
                        <div className="mb-4">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(course.status)}`}>{course.status}</span>
                        </div>
                        {course.liveStreamURL && (
                            <div className="mb-4">
                                <a href={course.liveStreamURL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center w-full py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-bold transition-colors">
                                    <VideoCameraIcon className="w-5 h-5 mr-2" />
                                    進入線上會議室
                                </a>
                            </div>
                        )}
                        <div className="flex justify-end gap-2 mt-2">
                            <button className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors shadow-sm" onClick={() => setShowLessonManager(course)}>管理</button>
                            <button className="flex-1 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors shadow-sm flex justify-center items-center" onClick={() => handleShowAnnouncementManager(course)}>公告</button>
                            <button className="flex-1 py-2 bg-white text-indigo-600 border border-indigo-200 text-sm font-medium rounded-lg hover:bg-indigo-50 transition-colors shadow-sm" onClick={() => handleShowCourseDetail(course)}>詳情</button>
                        </div>
                    </div>
                ))}
             </div>
           </>
       )}

       {showCourseDetail && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowCourseDetail(null)}></div>
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-bounce-in">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 p-4 flex justify-between items-center text-white flex-shrink-0">
              <h2 className="text-xl font-bold pr-8 line-clamp-1 flex items-center">
                編輯課程資訊
              </h2>
              <button 
                onClick={() => setShowCourseDetail(null)}
                className="text-white/80 hover:text-white transition-colors p-1 rounded-full hover:bg-white/20"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content - Form Layout */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
              
              {/* Section 1: Basic Info (Read-only) */}
              <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                  <span className="w-1 h-4 bg-indigo-500 rounded-full mr-2"></span>
                  基本資訊 (僅供檢視)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">課程名稱</label>
                    <input type="text" value={showCourseDetail.name} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">課程代碼</label>
                    <input type="text" value={showCourseDetail.code} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">授課老師</label>
                    <input type="text" value={getTeacherNames(showCourseDetail.teachers)} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                </div>
              </div>

              {/* Section 2: Content & Categorization (Partially Editable) */}
              <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                  <span className="w-1 h-4 bg-purple-500 rounded-full mr-2"></span>
                  內容與分類
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">課程性質</label>
                    <input type="text" value={showCourseDetail.courseNature || '未指定'} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">科目</label>
                    <input type="text" value={showCourseDetail.subjectTag || '未指定'} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">適用年級</label>
                    <input type="text" value={getGradeTags(showCourseDetail.gradeTags)} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">課程描述 <span className="text-indigo-500 text-xs ml-2 font-normal">(可編輯)</span></label>
                    <textarea 
                      value={showCourseDetail.description || ''} 
                      onChange={e => setShowCourseDetail(prev => prev ? { ...prev, description: e.target.value } : null)} 
                      className="w-full p-3 border border-gray-300 rounded-lg h-48 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all resize-none" 
                      placeholder="請描述課程內容、目標等..."
                    ></textarea>
                  </div>
                  <div className="md:col-span-2 mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center justify-between">
                      <span>自訂連結按鈕 <span className="text-indigo-500 text-xs ml-2 font-normal">(可編輯)</span></span>
                      <button type="button" onClick={() => setShowCourseDetail(prev => prev ? { ...prev, customLinks: [...(prev.customLinks || []), { name: '', url: '', icon: 'LinkIcon' }] } : null)} className="text-indigo-600 text-xs hover:text-indigo-800 flex items-center">
                        <PlusIcon className="w-4 h-4 mr-1" /> 新增連結
                      </button>
                    </label>
                    <div className="space-y-3 bg-white p-3 rounded-xl border border-gray-200">
                      {(showCourseDetail.customLinks || []).map((link, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <div className="w-full sm:w-36">
                            <Dropdown
                              value={link.icon}
                              onChange={(icon) => {
                                const newLinks = [...(showCourseDetail.customLinks || [])];
                                newLinks[idx] = { ...newLinks[idx], icon };
                                setShowCourseDetail(prev => prev ? { ...prev, customLinks: newLinks } : null);
                              }}
                              options={customLinkIconOptions}
                              placeholder="圖示"
                              buttonClassName="py-2 text-sm h-10"
                            />
                          </div>
                          <input 
                            type="text" 
                            placeholder="按鈕名稱" 
                            value={link.name} 
                            onChange={(e) => {
                              const newLinks = [...(showCourseDetail.customLinks || [])];
                              newLinks[idx] = { ...newLinks[idx], name: e.target.value };
                              setShowCourseDetail(prev => prev ? { ...prev, customLinks: newLinks } : null);
                            }}
                            className="w-full sm:w-1/4 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 outline-none h-10"
                          />
                          <input 
                            type="url" 
                            placeholder="網址 (URL)" 
                            value={link.url} 
                            onChange={(e) => {
                              const newLinks = [...(showCourseDetail.customLinks || [])];
                              newLinks[idx] = { ...newLinks[idx], url: e.target.value };
                              setShowCourseDetail(prev => prev ? { ...prev, customLinks: newLinks } : null);
                            }}
                            className="w-full sm:flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-indigo-500 outline-none h-10"
                          />
                          <button type="button" onClick={() => {
                              const newLinks = [...(showCourseDetail.customLinks || [])];
                              newLinks.splice(idx, 1);
                              setShowCourseDetail(prev => prev ? { ...prev, customLinks: newLinks } : null);
                          }} className="text-red-500 hover:bg-red-50 p-2 rounded-lg shrink-0">
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      ))}
                      {!(showCourseDetail.customLinks && showCourseDetail.customLinks.length > 0) && (
                        <div className="text-sm text-gray-400 italic py-1">尚無自訂連結</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Time & Location (Read-only) */}
              <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                  <span className="w-1 h-4 bg-green-500 rounded-full mr-2"></span>
                  時間與地點 (僅供檢視)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
                    <input type="text" value={formatCourseDateForDisplay(showCourseDetail.startDate)} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
                    <input type="text" value={formatCourseDateForDisplay(showCourseDetail.endDate)} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">授課方式</label>
                    <input type="text" value={showCourseDetail.teachingMethod || '未指定'} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">上課地點 / 直播網址</label>
                    <input type="text" value={showCourseDetail.location || showCourseDetail.liveStreamURL || '未指定'} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                  <div className="md:col-span-2">
                     <label className="block text-sm font-medium text-gray-700 mb-2">上課時段</label>
                     {Array.isArray(showCourseDetail.classTimes) && showCourseDetail.classTimes.length > 0 ? (
                        <div className="bg-gray-100 border border-gray-200 rounded-lg overflow-hidden"> 
                           {showCourseDetail.classTimes.map((time: unknown, idx: number) => (
                             <div key={idx} className="px-4 py-3 border-b border-gray-200 last:border-0 flex items-center text-gray-500 text-sm">
                                <ClockIcon className="w-4 h-4 mr-3 text-gray-400" />
                                {typeof time === 'object' && time !== null
                                  ? `${(time as ClassTime).day} ${(time as ClassTime).startTime} ~ ${(time as ClassTime).endTime}`
                                  : String(time)}
                             </div>
                           ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm p-2.5 bg-gray-100 rounded-lg border border-gray-200">未設定上課時段</p>
                      )}
                  </div>
                </div>
              </div>

              {/* Section 4: Status (Read-only) */}
              <div className="bg-gray-50/50 p-5 rounded-xl border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                  <span className="w-1 h-4 bg-yellow-500 rounded-full mr-2"></span>
                  狀態 (僅供檢視)
                </h3>
                <div className="grid grid-cols-1 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">課程狀態</label>
                    <input type="text" value={showCourseDetail.status || '未指定'} disabled className="w-full p-2.5 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed" />
                  </div>
                </div>
              </div>
              
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2 bg-gray-50/50">
              <button
                onClick={() => setShowCourseDetail(null)}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 font-medium transition-colors shadow-sm"
                disabled={isSavingCourse}
              >
                取消
              </button>
              <button
                onClick={handleUpdateCourseDescription}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium shadow-sm transition-colors flex items-center justify-center disabled:opacity-50"
                disabled={isSavingCourse}
              >
                {isSavingCourse && <LoadingSpinner size={16} color="white" className="mr-2" />}
                儲存變更
              </button>
            </div>
          </div>
        </div>, document.body
       )}

       {/* Announcement Manager Modal */}
       {showAnnouncementManager && (
        <Modal open={true} onClose={() => { setShowAnnouncementManager(null); setEditingAnnouncement(null); }} title={`「${showAnnouncementManager.name}」公告管理`} size="lg">
          {editingAnnouncement ? (
            <div className="p-6 flex flex-col h-full bg-white">
               <div className="mb-4">
                 <label className="block text-sm font-bold text-gray-700 mb-1">公告標題 <span className="text-red-500">*</span></label>
                 <input type="text" value={editingAnnouncement.title} onChange={e => setEditingAnnouncement(prev => ({...prev!, title: e.target.value}))} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="輸入標題..." />
               </div>
               <div className="mb-4">
                 <label className="block text-sm font-bold text-gray-700 mb-1">公告內容 <span className="text-red-500">*</span></label>
                 <textarea rows={6} value={editingAnnouncement.content} onChange={e => setEditingAnnouncement(prev => ({...prev!, content: e.target.value}))} className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none" placeholder="輸入內容..."></textarea>
               </div>
               <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                 <div className="flex justify-between items-center mb-3">
                    <label className="block text-sm font-bold text-gray-700">相關連結</label>
                    <button type="button" onClick={() => setEditingAnnouncement(prev => ({...prev!, links: [...(prev!.links || []), {name:'', url:''}]}))} className="text-indigo-600 text-xs font-bold hover:text-indigo-800 flex items-center"><PlusIcon className="w-4 h-4 mr-1"/>新增連結</button>
                 </div>
                 <div className="space-y-2">
                   {(editingAnnouncement.links || []).map((link, idx) => (
                     <div key={idx} className="flex gap-2 items-center">
                       <input type="text" placeholder="連結名稱" value={link.name} onChange={e => {
                         const newLinks = [...editingAnnouncement.links];
                         newLinks[idx].name = e.target.value;
                         setEditingAnnouncement(prev => ({...prev!, links: newLinks}));
                             }} className="w-1/3 border border-gray-300 rounded-lg px-3 py-2 h-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                       <input type="url" placeholder="網址 (URL)" value={link.url} onChange={e => {
                         const newLinks = [...editingAnnouncement.links];
                         newLinks[idx].url = e.target.value;
                         setEditingAnnouncement(prev => ({...prev!, links: newLinks}));
                             }} className="flex-1 border border-gray-300 rounded-lg px-3 py-2 h-10 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
                       <button type="button" onClick={() => {
                         const newLinks = editingAnnouncement.links.filter((_, i) => i !== idx);
                         setEditingAnnouncement(prev => ({...prev!, links: newLinks}));
                             }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="移除連結"><TrashIcon className="w-4 h-4" /></button>
                     </div>
                   ))}
                 </div>
               </div>
               <div className="flex justify-end gap-2 border-t border-gray-100 pt-4 mt-auto">
                  <button type="button" onClick={() => setEditingAnnouncement(null)} className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">取消</button>
                  <button type="button" onClick={async () => {
                    if (!editingAnnouncement.title || !editingAnnouncement.content) {
                      Swal.fire('警告', '標題與內容為必填', 'warning');
                      return;
                    }
                    setAnnIsSubmitting(true);
                    try {
                      const currentAnns = showAnnouncementManager.announcements || [];
                      let newAnns;
                      if (editingAnnouncement.id === 'new') {
                        newAnns = [{ ...editingAnnouncement, id: Date.now().toString(), createdAt: new Date().toISOString() }, ...currentAnns];
                      } else {
                        newAnns = currentAnns.map(a => a.id === editingAnnouncement.id ? editingAnnouncement : a);
                      }
                      const res = await fetch('/api/courses/update', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: showAnnouncementManager.id, announcements: newAnns })
                      });
                      if (res.ok) {
                        const updatedCourse = { ...showAnnouncementManager, announcements: newAnns };
                        setShowAnnouncementManager(updatedCourse);
                        setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
                        setEditingAnnouncement(null);
                        Swal.fire({icon: 'success', title: '儲存成功', customClass: { popup: 'rounded-2xl' }});
                      } else {
                        throw new Error('Update failed');
                      }
                    } catch (e) {
                      Swal.fire('錯誤', '儲存失敗', 'error');
                    } finally {
                      setAnnIsSubmitting(false);
                    }
                  }} disabled={annIsSubmitting} className="px-5 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 flex items-center shadow-sm">
                    {annIsSubmitting ? <LoadingSpinner size={16} color="white" className="mr-2" /> : null}儲存
                  </button>
               </div>
            </div>
          ) : (
            <div className="p-6 flex flex-col h-full bg-white">
               <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-gray-800">公告列表</h4>
                  <button onClick={() => setEditingAnnouncement({ id: 'new', title: '', content: '', links: [], createdAt: '' })} className="text-sm bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-100 flex items-center shadow-sm"><PlusIcon className="w-4 h-4 mr-1"/>新增公告</button>
               </div>
               <div className="space-y-3 overflow-y-auto custom-scrollbar flex-1 mb-4 min-h-[200px] border border-gray-100 p-3 rounded-xl bg-gray-50/50">
                 {(showAnnouncementManager.announcements || []).length === 0 ? (
                   <div className="text-center text-gray-400 py-10 flex flex-col items-center">
                       <MegaphoneIcon className="w-10 h-10 mb-2 opacity-50"/>
                       尚無公告
                   </div>
                 ) : (
                   (showAnnouncementManager.announcements || []).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(ann => (
                     <div key={ann.id} className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center hover:border-indigo-200 transition-colors shadow-sm">
                       <div>
                         <h5 className="font-bold text-gray-900">{ann.title}</h5>
                         <div className="text-xs text-gray-500 mt-1">{new Date(ann.createdAt).toLocaleDateString()}</div>
                       </div>
                       <div className="flex gap-2">
                         <button onClick={() => setEditingAnnouncement(ann)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg"><PencilIcon className="w-5 h-5"/></button>
                         <button onClick={async () => {
                           const result = await Swal.fire({ title: '確定刪除？', text: '刪除後無法復原', icon: 'warning', showCancelButton: true, confirmButtonText: '確定', cancelButtonText: '取消', confirmButtonColor: '#ef4444' });
                           if (result.isConfirmed) {
                             const newAnns = showAnnouncementManager.announcements!.filter(a => a.id !== ann.id);
                             const res = await fetch('/api/courses/update', {
                               method: 'POST',
                               headers: { 'Content-Type': 'application/json' },
                               body: JSON.stringify({ id: showAnnouncementManager.id, announcements: newAnns })
                             });
                             if (res.ok) {
                               const updatedCourse = { ...showAnnouncementManager, announcements: newAnns };
                               setShowAnnouncementManager(updatedCourse);
                               setCourses(prev => prev.map(c => c.id === updatedCourse.id ? updatedCourse : c));
                             }
                           }
                         }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"><TrashIcon className="w-5 h-5"/></button>
                       </div>
                     </div>
                   ))
                 )}
               </div>
               <div className="flex justify-end border-t border-gray-100 pt-4">
                 <button onClick={() => setShowAnnouncementManager(null)} className="px-5 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium">關閉</button>
               </div>
            </div>
          )}
        </Modal>
       )}
    </div>
  );
}