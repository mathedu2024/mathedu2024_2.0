'use client';

import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Swal from 'sweetalert2';
import { 
  CalendarDaysIcon, 
  PencilIcon, 
  TrashIcon, 
  CheckIcon, 
  XMarkIcon 
} from '@heroicons/react/24/outline';

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
      const response = await fetch('/api/exam-dates/list');
      if (!response.ok) throw new Error('Failed to fetch exam dates');
      const data = await response.json();

      // 安全檢查：確保 data 為陣列，避免在生產環境 API 異常時導致 reduce 崩潰
      if (!Array.isArray(data)) {
        console.warn('考試日期 API 回傳格式異常:', data);
        if (isMounted) setExams({});
        return;
      }

      const examMap = data.filter(e => e && e.id).reduce((acc: Record<string, { name: string; startDate: string; endDate: string; }>, exam: { id: string; name: string; startDate: string; endDate: string; }) => {
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
      
      await fetchExams();
      setEditingId(null);
      setForm({ name: '', startDate: '', endDate: '' });
      Swal.fire({
        icon: 'success',
        title: '儲存成功',
        confirmButtonColor: '#4f46e5',
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
        await fetchExams();

        Swal.fire({
          icon: 'success',
          title: '已刪除',
          text: '考試日期資訊已成功移除',
          confirmButtonColor: '#4f46e5',
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
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 flex flex-col h-full animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <CalendarDaysIcon className="h-8 w-8 text-indigo-600" />
            考試日期管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">管理重要考試日期，供首頁倒數計時參考。</p>
        </div>
      </div>

      {/* Editing Form Card */}
      {editingId && (
        <div className="bg-white border border-indigo-100 rounded-2xl shadow-lg mb-8 p-6 animate-fade-in ring-1 ring-indigo-50">
          <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
             <h3 className="text-lg font-bold text-indigo-900">編輯考試資訊</h3>
             <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-6 h-6" /></button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label htmlFor="examName" className="block text-sm font-bold text-gray-700 mb-2">考試名稱</label>
              <input
                id="examName"
                type="text"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例如：第一次段考"
              />
            </div>
            <div>
              <label htmlFor="startDate" className="block text-sm font-bold text-gray-700 mb-2">開始日期</label>
              <input
                id="startDate"
                type="date"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-bold text-gray-700 mb-2">結束日期</label>
              <input
                id="endDate"
                type="date"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-50">
            <button 
                onClick={handleCancel} 
                className="px-5 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors" 
                disabled={saving}
            >
                取消
            </button>
            <button 
                onClick={handleSave} 
                className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium shadow-sm transition-all flex items-center" 
                disabled={saving}
            >
                {saving ? <LoadingSpinner size={16} color="white" className="mr-2" /> : <CheckIcon className="w-5 h-5 mr-2" />}
                {saving ? '儲存中...' : '儲存變更'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
           <LoadingSpinner size={50} />
           <p className="text-gray-500 mt-4 font-medium">資料載入中...</p>
        </div>
      ) : (
        <>
          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {displayExams.map(exam => (
              <div key={exam.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-lg text-gray-900">{exam.name}</h3>
                    {isMainExam(exam.id) && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded font-medium">系統預設</span>}
                </div>
                
                <div className="space-y-2 text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg">
                    <div className="flex justify-between"><span>開始:</span> <span className="font-mono text-indigo-700">{exams[exam.id]?.startDate || '-'}</span></div>
                    <div className="flex justify-between"><span>結束:</span> <span className="font-mono text-indigo-700">{exams[exam.id]?.endDate || '-'}</span></div>
                </div>

                <div className="flex justify-end gap-3 border-t border-gray-100 pt-3">
                  <button onClick={() => handleEdit(exam.id)} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center">
                    <PencilIcon className="w-4 h-4 mr-1" /> 編輯
                  </button>
                  {!isMainExam(exam.id) && (
                    <button
                      onClick={() => handleDelete(exam.id)}
                      className="text-red-500 hover:text-red-700 font-medium text-sm flex items-center"
                      disabled={saving}
                    >
                      <TrashIcon className="w-4 h-4 mr-1" /> 刪除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="bg-gray-50 text-xs text-gray-700 uppercase">
                <tr>
                  <th scope="col" className="px-6 py-4 font-bold">考試名稱</th>
                  <th scope="col" className="px-6 py-4 font-bold">開始日期</th>
                  <th scope="col" className="px-6 py-4 font-bold">結束日期</th>
                  <th scope="col" className="px-6 py-4 font-bold text-right w-40">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayExams.map(exam => (
                  <tr key={exam.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-gray-900">
                        {exam.name}
                        {isMainExam(exam.id) && <span className="ml-2 inline-block bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded">預設</span>}
                    </td>
                    <td className="px-6 py-4 font-mono">{exams[exam.id]?.startDate || <span className="text-gray-300">-</span>}</td>
                    <td className="px-6 py-4 font-mono">{exams[exam.id]?.endDate || <span className="text-gray-300">-</span>}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleEdit(exam.id)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="編輯">
                            <PencilIcon className="w-5 h-5" />
                        </button>
                        {!isMainExam(exam.id) && (
                          <button
                            onClick={() => handleDelete(exam.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="刪除"
                            disabled={saving}
                          >
                            <TrashIcon className="w-5 h-5" />
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