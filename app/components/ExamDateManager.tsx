'use client';

import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import AlertDialog from './AlertDialog';

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
  const [alertOpen, setAlertOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  async function fetchExams() {
    setLoading(true);
    const response = await fetch('/api/exam-dates/list');
    const data = await response.json();
    const examMap = data.reduce((acc: { [key: string]: { name: string; startDate: string; endDate: string } }, exam: { id: string; name: string; startDate: string; endDate: string }) => {
      acc[exam.id] = { name: exam.name, startDate: exam.startDate, endDate: exam.endDate };
      return acc;
    }, {} as { [key: string]: { name: string; startDate: string; endDate: string } });
    setExams(examMap);
    setLoading(false);
  }

  useEffect(() => {
    fetchExams();
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
      await fetch('/api/exam-dates/create', { method: 'POST', body: JSON.stringify({ id: editingId, name: form.name, startDate: form.startDate, endDate: form.endDate }) });
      await fetchExams();
      setEditingId(null);
      setForm({ name: '', startDate: '', endDate: '' });
      setAlertOpen(true);
    } catch (e) {
      console.error('儲存考試日期失敗:', e);
    }
    setSaving(false);
  }

  return (
    <div className="max-w-4xl mx-auto w-full p-4 h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-6 flex-shrink-0">考試日期管理</h2>
      <AlertDialog open={alertOpen} message="更新成功！" onClose={() => setAlertOpen(false)} />
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <span>載入中...</span>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
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
              ) : MAIN_EXAMS.map(exam => (
                editingId === exam.id ? (
                  <tr key={exam.id} className="bg-white border-b">
                    <td className="px-6 py-4">
                      <input
                        type="text"
                        className="border border-gray-300 p-2 rounded-lg w-full"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="考試名稱"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="date"
                        className="border border-gray-300 p-2 rounded-lg w-full"
                        value={form.startDate}
                        onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                        placeholder="開始日期"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <input
                        type="date"
                        className="border border-gray-300 p-2 rounded-lg w-full"
                        value={form.endDate}
                        onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                        placeholder="結束日期"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        <button onClick={handleCancel} className="text-gray-600 hover:text-gray-800 font-medium" disabled={saving}>取消</button>
                        <button onClick={handleSave} className="text-blue-600 hover:text-blue-800 font-medium" disabled={saving}>{saving ? '儲存中...' : '儲存'}</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={exam.id} className="bg-white border-b hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{exam.name}</td>
                    <td className="px-6 py-4">{exams[exam.id]?.startDate || '尚未設定'}</td>
                    <td className="px-6 py-4">{exams[exam.id]?.endDate || '尚未設定'}</td>
                    <td className="px-6 py-4">
                      <button onClick={() => handleEdit(exam.id)} className="text-blue-600 hover:text-blue-800 font-medium">設定</button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 