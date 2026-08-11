'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import LoadingSpinner from './LoadingSpinner';
import PageLoadingArea from './ui/PageLoadingArea';
import { tableActionStyles, tableActionRow } from './ui';
import { courseListTableStyles } from './studentCourseListShared';
import Swal from 'sweetalert2';
import { 
  CalendarDaysIcon, 
  CheckIcon, 
  XMarkIcon 
} from '@heroicons/react/24/outline';
import { fetchExamDatesList, invalidateExamDatesList } from '@/utils/teacherClientApi';

const MAIN_EXAMS = [
  { id: 'gsat', name: '學測' },
  { id: 'tcat', name: '統測' },
  { id: 'bcat', name: '會考' },
  { id: 'ast', name: '分科測驗' }
];

export default function ExamDateManager() {
  const [exams, setExams] = useState<{[key: string]: { name: string; startDate: string; endDate: string; }} >({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchExams = async (isMounted: boolean = true) => {
    try {
      setLoading(true);
      const data = await fetchExamDatesList<{ id: string; name: string; startDate: string; endDate: string }>();

      const examMap = data.filter(e => e && e.id).reduce((acc: Record<string, { name: string; startDate: string; endDate: string; }>, exam) => {
        acc[exam.id] = { name: exam.name, startDate: exam.startDate, endDate: exam.endDate };
        return acc;
      }, {});
      if (isMounted) setExams(examMap);
    } catch (error) {
      console.error('Error fetching exam dates:', error);
      Swal.fire({ 
        icon: 'error',
        title: '錯誤',
        text: '載入考試日期失敗',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' }
      });
    } finally {
      if (isMounted) setLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetchExams(isMounted);
    return () => { isMounted = false; };
  }, []);

  function handleEdit(examId: string) {
    setEditingId(examId);
    setForm({
      name: exams[examId]?.name || MAIN_EXAMS.find(e => e.id === examId)?.name || '',
      startDate: exams[examId]?.startDate || '',
      endDate: exams[examId]?.endDate || ''
    });
  }

  function handleCancel() {
    setEditingId(null);
    setForm({ name: '', startDate: '', endDate: '' });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const idToSave = editingId === 'new' ? `custom-${Date.now()}` : editingId;
      const response = await fetch('/api/exam-dates/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: idToSave, name: form.name, startDate: form.startDate, endDate: form.endDate })
      });
      if (!response.ok) throw new Error('Failed to save exam date');
      
      invalidateExamDatesList();
      await fetchExams();
      setEditingId(null);
      setForm({ name: '', startDate: '', endDate: '' });
      Swal.fire({
        icon: 'success',
        title: '儲存成功',
        confirmButtonColor: '#2D6DF6',
        customClass: { popup: 'rounded-2xl' }
      });
    } catch (e) {
      console.error('儲存失敗:', e);
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
  }

  async function handleDelete(examId: string) {
    const examName = exams[examId]?.name || MAIN_EXAMS.find(e => e.id === examId)?.name;
    const result = await Swal.fire({
      title: '確定要刪除嗎？',
      text: `確定要刪除 ${examName} 的考試日期資訊嗎？`,
      icon: 'warning',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: '確定刪除',
      cancelButtonText: '取消',
      customClass: { popup: 'rounded-2xl' }
    });

    if (result.isConfirmed) {
      setSaving(true);
      try {
        const response = await fetch('/api/exam-dates/delete', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: examId }),
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to delete exam date');
        }
        invalidateExamDatesList();
        await fetchExams();

        Swal.fire({
          icon: 'success',
          title: '已刪除',
          text: '考試日期資訊已成功移除',
          confirmButtonColor: '#2D6DF6',
          customClass: { popup: 'rounded-2xl' }
        });
      } catch {
        Swal.fire({
          icon: 'error',
          title: '刪除失敗',
          text: '請稍後再試',
          confirmButtonColor: '#ef4444',
          customClass: { popup: 'rounded-2xl' }
        });
        setSaving(false);
      }
    }
  }

  const isMainExam = (examId: string) => MAIN_EXAMS.some(exam => exam.id === examId);
  const displayExams = MAIN_EXAMS;

  return (
    <div className="page-shell max-w-7xl mx-auto w-full min-w-0 flex flex-col h-full animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
        <div className="border-l-4 border-primary pl-4">
          <h1 className="font-display text-2xl font-bold text-on-surface flex items-center gap-3">
            <CalendarDaysIcon className="h-8 w-8 text-primary" />
            考試日期管理
          </h1>
          <p className="text-on-surfaceVariant text-sm mt-1">管理考試時程與重要日期</p>
        </div>
      </div>

      {/* 編輯考試彈出視窗 — ui-sample Modal Style */}
      {editingId && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden transform scale-100 flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary to-tertiary p-4 flex justify-between items-center text-white shrink-0">
              <h3 className="font-bold flex items-center gap-2">
                <CalendarDaysIcon className="w-5 h-5" />
                編輯考試資訊
              </h3>
              <button
                type="button"
                onClick={handleCancel}
                className="text-white/80 hover:text-white"
                aria-label="關閉"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-5">
              <div>
                <label htmlFor="examName" className="block text-sm font-bold text-gray-700 mb-2">考試名稱</label>
                <input
                  id="examName"
                  type="text"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例如：第一次段考"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-bold text-gray-700 mb-2">開始日期</label>
                  <input
                    id="startDate"
                    type="date"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    value={form.startDate}
                    onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="endDate" className="block text-sm font-bold text-gray-700 mb-2">結束日期</label>
                  <input
                    id="endDate"
                    type="date"
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    value={form.endDate}
                    onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 bg-surface-containerLow border-t border-outline-variant/40 flex gap-2 shrink-0">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 bg-white border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
                disabled={saving}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 bg-primary text-white py-2 rounded-lg text-sm font-medium hover:bg-primary-hover shadow-sm flex items-center justify-center disabled:opacity-70"
                disabled={saving}
              >
                {saving ? <LoadingSpinner size={16} color="white" className="mr-2" /> : <CheckIcon className="w-5 h-5 mr-2" />}
                {saving ? '儲存中...' : '儲存變更'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {loading ? (
        <PageLoadingArea />
      ) : (
        <>
          {/* Mobile Card View */}
          <div className={courseListTableStyles.mobile.wrapper}>
            {displayExams.map(exam => (
              <div key={exam.id} className={courseListTableStyles.mobile.card}>
                <div className="flex justify-between items-start mb-3">
                    <div className={courseListTableStyles.mobile.courseName}>{exam.name}</div>
                    {isMainExam(exam.id) && (
                      <span className={`${courseListTableStyles.mobile.statusBadge} bg-gray-100 text-gray-600`}>系統預設</span>
                    )}
                </div>
                
                <div className="space-y-2 text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between"><span>開始:</span> <span className="font-mono text-primary">{exams[exam.id]?.startDate || '-'}</span></div>
                    <div className="flex justify-between"><span>結束:</span> <span className="font-mono text-primary">{exams[exam.id]?.endDate || '-'}</span></div>
                </div>

                <div className={`${tableActionRow} border-t border-gray-100 pt-3`}>
                  <button onClick={() => handleEdit(exam.id)} className={tableActionStyles.primary}>
                    編輯
                  </button>
                  {!isMainExam(exam.id) && (
                    <button
                      onClick={() => handleDelete(exam.id)}
                      className={tableActionStyles.danger}
                      disabled={saving}
                    >
                      刪除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className={courseListTableStyles.desktop.wrapper}>
            <table className={courseListTableStyles.desktop.table}>
              <thead className={courseListTableStyles.desktop.thead}>
                <tr>
                  <th scope="col" className={courseListTableStyles.desktop.th}>考試名稱</th>
                  <th scope="col" className={courseListTableStyles.desktop.th}>開始日期</th>
                  <th scope="col" className={courseListTableStyles.desktop.th}>結束日期</th>
                  <th scope="col" className={`${courseListTableStyles.desktop.th} text-right min-w-[180px]`}>操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayExams.map(exam => (
                  <tr key={exam.id} className={courseListTableStyles.desktop.row}>
                    <td className="px-6 py-4">
                        <div className={courseListTableStyles.desktop.courseName}>
                          {exam.name}
                          {isMainExam(exam.id) && (
                            <span className="ml-2 inline-block align-middle text-xs font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">預設</span>
                          )}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">{exams[exam.id]?.startDate || <span className="text-gray-300">-</span>}</td>
                    <td className="px-6 py-4 text-sm font-mono text-gray-600">{exams[exam.id]?.endDate || <span className="text-gray-300">-</span>}</td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className={courseListTableStyles.desktop.actionRow}>
                        <button onClick={() => handleEdit(exam.id)} className={courseListTableStyles.desktop.actionPrimary}>
                          編輯
                        </button>
                        {!isMainExam(exam.id) && (
                          <button
                            onClick={() => handleDelete(exam.id)}
                            className={courseListTableStyles.desktop.actionDanger}
                            disabled={saving}
                          >
                            刪除
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}