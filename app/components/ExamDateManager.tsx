'use client';

import React, { useState, useEffect } from 'react';
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
    <div className="max-w-4xl mx-auto w-full p-4">
      <h2 className="text-2xl font-bold mb-6">考試日期管理</h2>
      <AlertDialog open={alertOpen} message="更新成功！" onClose={() => setAlertOpen(false)} />
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <span>載入中...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {editingId
            ? MAIN_EXAMS.filter(exam => exam.id === editingId).map(exam => {
                const examData = exams[exam.id] || { name: exam.name, startDate: '', endDate: '' };
                return (
                  <div key={exam.id} className="bg-white border border-gray-200 p-6 rounded-lg">
                    <div className="mb-4">
                      <input
                        type="text"
                        className="border border-gray-300 p-3 rounded-lg w-full mb-2"
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="考試名稱"
                      />
                      <input
                        type="date"
                        className="border border-gray-300 p-3 rounded-lg w-full mb-2"
                        value={form.startDate}
                        onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                        placeholder="開始日期"
                      />
                      <input
                        type="date"
                        className="border border-gray-300 p-3 rounded-lg w-full"
                        value={form.endDate}
                        onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                        placeholder="結束日期"
                      />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button onClick={handleCancel} className="bg-gray-500 text-white px-6 py-2 rounded-lg" disabled={saving}>取消</button>
                      <button onClick={handleSave} className="bg-blue-600 text-white px-6 py-2 rounded-lg" disabled={saving}>{saving ? '儲存中...' : '儲存'}</button>
                    </div>
                  </div>
                );
              })
            : MAIN_EXAMS.map(exam => {
                const examData = exams[exam.id] || { name: exam.name, startDate: '', endDate: '' };
                return (
                  <div key={exam.id} className="bg-white border border-gray-200 p-6 rounded-lg">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">{examData.name}</h3>
                    <p className="text-gray-600 mb-2">{examData.startDate ? `開始：${examData.startDate}` : '尚未設定日期'}</p>
                    <p className="text-gray-600 mb-4">{examData.endDate ? `結束：${examData.endDate}` : ''}</p>
                    <button onClick={() => handleEdit(exam.id)} className="bg-blue-500 text-white px-4 py-2 rounded">設定</button>
                  </div>
                );
              })}
        </div>
      )}
    </div>
  );
} 