'use client';

import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import AlertDialog from './AlertDialog';
import { deleteExam } from '@/services/examService';
import { confirm } from '@/utils/alerts';

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
  const [alert, setAlert] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' | null }>({ message: '', type: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (alert.message) {
      const timer = setTimeout(() => {
        setAlert({ message: '', type: null });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  async function fetchExams() {
    try {
      setLoading(true);
      const response = await fetch('/api/exam-dates/list');
      if (!response.ok) {
        throw new Error('Failed to fetch exam dates');
      }
      const data = await response.json();
      const examMap = data.reduce((acc: { [key: string]: { name: string; startDate: string; endDate: string } }, exam: { id: string; name: string; startDate: string; endDate: string }) => {
        acc[exam.id] = { name: exam.name, startDate: exam.startDate, endDate: exam.endDate };
        return acc;
      }, {} as { [key: string]: { name: string; startDate: string; endDate: string } });
      setExams(examMap);
    } catch (error) {
      console.error('Error fetching exam dates:', error);
      setAlert({ message: '載入考試日期失敗，請稍後再試', type: 'error' });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchExams().catch(error => {
      console.error('Unhandled error in fetchExams:', error);
    });
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
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save exam date');
      }
      await fetchExams();
      setEditingId(null);
      setForm({ name: '', startDate: '', endDate: '' });
      setAlert({ message: '更新成功！', type: 'success' });
    } catch (e) {
      console.error('儲存考試日期失敗:', e);
      setAlert({ message: e instanceof Error ? e.message : '儲存失敗！', type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(examId: string) {
    const examName = exams[examId]?.name || MAIN_EXAMS.find(e => e.id === examId)?.name;
    const isConfirmed = await confirm(`確定要刪除 ${examName} 嗎？`);

    if (isConfirmed) {
      setSaving(true);
      try {
        await deleteExam(examId);
        await fetchExams();
        setAlert({ message: '刪除成功！', type: 'success' });
      } catch (e) {
        console.error('刪除考試日期失敗:', e);
        let msg = '刪除失敗！';
        if (e instanceof Error) {
          msg = e.message;
        }
        setAlert({ message: msg, type: 'error' });
      } finally {
        setSaving(false);
      }
    }
  }

  const isMainExam = (examId: string) => MAIN_EXAMS.some(exam => exam.id === examId);

  function handleAddNew() {
    setEditingId('new');
    setForm({ name: '', startDate: '', endDate: '' });
  }

  const displayExams = editingId === 'new' ? [...MAIN_EXAMS, { id: 'new', name: '新考試' }] : MAIN_EXAMS;

  return (
    <div className="max-w-4xl mx-auto w-full p-4 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold flex-shrink-0">考試日期管理</h2>
        <button onClick={handleAddNew} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">新增考試</button>
      </div>
      {alert.message && (
        <AlertDialog
          message={alert.message}
          type={alert.type}
          onClose={() => setAlert({ message: '', type: null })}
        />
      )}

      {editingId && (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4 p-4">
          <h3 className="text-lg font-bold mb-4">{editingId === 'new' ? '新增考試' : '編輯考試'}</h3>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="examName" className="block text-sm font-medium text-gray-700 mb-1">考試名稱</label>
              <input
                id="examName"
                type="text"
                className="border border-gray-300 p-2 rounded-lg w-full"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="考試名稱"
              />
            </div>
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">開始日期</label>
              <input
                id="startDate"
                type="date"
                className="border border-gray-300 p-2 rounded-lg w-full"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                placeholder="開始日期"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">結束日期</label>
              <input
                id="endDate"
                type="date"
                className="border border-gray-300 p-2 rounded-lg w-full"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                placeholder="結束日期"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={handleCancel} className="text-gray-600 hover:text-gray-800 font-medium" disabled={saving}>取消</button>
              <button onClick={handleSave} className="text-blue-600 hover:text-blue-800 font-medium" disabled={saving}>{saving ? '儲存中...' : '儲存'}</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <span>載入中...</span>
        </div>
      ) : (
        <>
          {/* Card view for mobile */}
          <div className="md:hidden">
            {displayExams.map(exam => (
              <div key={exam.id} className="bg-white border border-gray-200 rounded-lg shadow-sm mb-4 p-4">
                <div className="font-medium text-gray-900 mb-2">{exam.name}</div>
                <div className="text-sm text-gray-500 mb-1">開始日期: {exams[exam.id]?.startDate || '尚未設定'}</div>
                <div className="text-sm text-gray-500 mb-4">結束日期: {exams[exam.id]?.endDate || '尚未設定'}</div>
                <div className="flex justify-end gap-3">
                  <button onClick={() => handleEdit(exam.id)} className="text-blue-600 hover:text-blue-800 font-medium">設定</button>
                  {!isMainExam(exam.id) && (
                    <button
                      onClick={() => handleDelete(exam.id)}
                      className="text-red-600 hover:text-red-800 font-medium"
                      disabled={saving}
                    >
                      刪除
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Table view for desktop */}
          <div className="hidden md:block bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
            <table className="w-full text-sm text-left text-gray-500">
              <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3">考試名稱</th>
                  <th scope="col" className="px-6 py-3">開始日期</th>
                  <th scope="col" className="px-6 py-3">結束日期</th>
                  <th scope="col" className="px-6 py-3">操作</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10">
                      <div className="flex flex-col items-center gap-2">
                        <LoadingSpinner size={8} />
                        <span className="mt-2 text-gray-500">讀取中...</span>
                      </div>
                    </td>
                  </tr>
                ) : displayExams.map(exam => (
                  <tr key={exam.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{exam.name}</td>
                    <td className="px-6 py-4">{exams[exam.id]?.startDate || '尚未設定'}</td>
                    <td className="px-6 py-4">{exams[exam.id]?.endDate || '尚未設定'}</td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        <button onClick={() => handleEdit(exam.id)} className="text-blue-600 hover:text-blue-800 font-medium">設定</button>
                        {!isMainExam(exam.id) && (
                          <button
                            onClick={() => handleDelete(exam.id)}
                            className="text-red-600 hover:text-red-800 font-medium"
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