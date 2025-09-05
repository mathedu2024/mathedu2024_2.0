'use client';

import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import AlertDialog from './AlertDialog';
import alerts from '../utils/alerts';
import { Listbox } from '@headlessui/react';
import { ChevronUpDownIcon } from '@heroicons/react/20/solid';

interface Link {
  name: string;
  url: string;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  contentType?: '公告事項' | '課程資訊';
  subject?: '數學' | '理化' | '物理' | '化學' | '生物';
  department?: '高中部' | '國中部';
  links?: Link[];
  createdAt?: Date | { toDate: () => Date } | string | number | undefined;
  updatedAt?: Date | { toDate: () => Date } | string | number | undefined;
}

export default function AnnouncementManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [form, setForm] = useState<Partial<Announcement>>({
    title: '',
    content: '',
    contentType: '公告事項',
    subject: undefined,
    department: undefined,
    links: []
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [alert, setAlert] = useState({ open: false, message: '' });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // 暫停自動重新載入功能
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     fetchAnnouncements();
  //   }, 60000); // 60秒

  //   return () => clearInterval(interval);
  // }, []);

  async function fetchAnnouncements() {
    setLoading(true);
    try {
      const res = await fetch('/api/announcement/list');
      const data = await res.json();
      setAnnouncements(data as Announcement[]);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      setAlert({ open: true, message: '載入公告失敗' });
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.content) {
      setAlert({ open: true, message: '標題和內容為必填項目' });
      return;
    }

    setLoading(true);
    try {
      const announcementData = {
        title: form.title,
        content: form.content,
        contentType: form.contentType,
        subject: form.subject,
        department: form.department,
        links: form.links || []
      };

      let response;
      if (editingId) {
        response = await fetch('/api/announcement/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingId, ...announcementData }),
        });
        
        if (response.ok) {
          setAlert({ open: true, message: '公告更新成功' });
          // 立即更新本地狀態以確保同步
          setAnnouncements(prev => prev.map(ann => 
            ann.id === editingId 
              ? { ...ann, ...announcementData, updatedAt: new Date() }
              : ann
          ));
        } else {
          const errorData = await response.json();
          setAlert({ open: true, message: `更新失敗: ${errorData.error || '未知錯誤'}` });
          return;
        }
      } else {
        response = await fetch('/api/announcement/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(announcementData),
        });
        
        if (response.ok) {
          const result = await response.json();
          setAlert({ open: true, message: '公告建立成功' });
          // 立即添加新公告到本地狀態
          const newAnnouncement = {
            id: result.id,
            ...announcementData,
            createdAt: new Date(),
            updatedAt: new Date()
          };
          setAnnouncements(prev => [newAnnouncement, ...prev]);
        } else {
          const errorData = await response.json();
          setAlert({ open: true, message: `建立失敗: ${errorData.error || '未知錯誤'}` });
          return;
        }
      }

      resetForm();
      // 延遲重新載入以確保資料庫更新完成
      setTimeout(() => {
        fetchAnnouncements();
      }, 500);
    } catch (error) {
      console.error('Error submitting form:', error);
      setAlert({ open: true, message: '操作失敗，請檢查網路連線' });
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!(await alerts.confirm('確定要刪除這則公告嗎？'))) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/announcement/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        setAlert({ open: true, message: '公告刪除成功' });
        // 立即從本地狀態移除以確保同步
        setAnnouncements(prev => prev.filter(ann => ann.id !== id));
        // 延遲重新載入以確保資料庫更新完成
        setTimeout(() => {
          fetchAnnouncements();
        }, 500);
      } else {
        const errorData = await res.json();
        setAlert({ open: true, message: `刪除失敗: ${errorData.error || '未知錯誤'}` });
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
      setAlert({ open: true, message: '刪除失敗，請檢查網路連線' });
    }
    setLoading(false);
  }

  function handleEdit(announcement: Announcement) {
    setForm({
      title: announcement.title,
      content: announcement.content,
      contentType: announcement.contentType,
      subject: announcement.subject,
      department: announcement.department,
      links: announcement.links || []
    });
    setEditingId(announcement.id);
    setIsEditing(true);
  }

  function handleCancel() {
    resetForm();
  }

  function resetForm() {
    setForm({
      title: '',
      content: '',
      contentType: '公告事項',
      subject: undefined,
      department: undefined,
      links: []
    });
    setEditingId(null);
    setIsEditing(false);
  }

  function addLink() {
    setForm(prev => ({
      ...prev,
      links: [...(prev.links || []), { name: '', url: '' }]
    }));
  }

  function removeLink(index: number) {
    setForm(prev => ({
      ...prev,
      links: prev.links?.filter((_, i) => i !== index) || []
    }));
  }

  function updateLink(index: number, field: 'name' | 'url', value: string) {
    setForm(prev => ({
      ...prev,
      links: prev.links?.map((link, i) => 
        i === index ? { ...link, [field]: value } : link
      ) || []
    }));
  }

  function getCreatedAt(item: Announcement) {
    const { createdAt } = item;
    if (!createdAt) return '';
    if (
      typeof createdAt === 'object' &&
      createdAt !== null &&
      'toDate' in createdAt &&
      typeof (createdAt as { toDate?: unknown }).toDate === 'function'
    ) {
      return (createdAt as { toDate: () => Date }).toDate().toLocaleString();
    }
    if (typeof createdAt === 'string' || typeof createdAt === 'number') {
      return new Date(createdAt).toLocaleString();
    }
    if (createdAt instanceof Date) {
      return createdAt.toLocaleString();
    }
    return '';
  }

  return (
    <div className="max-w-6xl mx-auto w-full p-4 h-full flex flex-col">
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 flex flex-col md:flex-row gap-2 md:gap-4 items-start md:items-center justify-between mb-6 min-w-0 flex-shrink-0">
        <h2 className="text-2xl font-bold">公告管理</h2>
        {!isEditing && (
          <button
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            onClick={() => setIsEditing(true)}
          >
            建立公告
          </button>
        )}
      </div>

      {/* 表單區域 */}
      {isEditing && (
        <div className="bg-white border border-gray-200 p-6 rounded-lg mb-6">
          <h3 className="text-lg font-semibold mb-4">
            {editingId ? '編輯公告' : '建立公告'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 標題 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">標題 *</label>
              <input
                className="w-full border border-gray-300 p-3 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.title}
                onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="公告標題"
                required
              />
            </div>

            {/* 標籤選擇 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">公告內容</label>
                <Listbox value={form.contentType} onChange={val => setForm(prev => ({ ...prev, contentType: val }))}>
                  <div className="relative">
                    <Listbox.Button className="select-unified min-w-[240px] md:min-w-[300px] max-w-full pr-12 flex items-center justify-between">
                      <span className="truncate">{form.contentType || '全部類別'}</span>
                      <ChevronUpDownIcon className="w-5 h-5 text-gray-400 absolute right-3 pointer-events-none" />
                    </Listbox.Button>
                    <Listbox.Options className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                      <Listbox.Option value="公告事項" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>公告事項</Listbox.Option>
                      <Listbox.Option value="課程資訊" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>課程資訊</Listbox.Option>
                    </Listbox.Options>
                  </div>
                </Listbox>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">科目</label>
                <Listbox value={form.subject ?? ''} onChange={val => setForm(prev => ({ ...prev, subject: val === '' ? undefined : val as '數學' | '理化' | '物理' | '化學' | '生物' }))}>
                  <div className="relative">
                    <Listbox.Button className="select-unified min-w-[240px] md:min-w-[300px] max-w-full pr-12 flex items-center justify-between">
                      <span className="truncate">{form.subject || '全部科目'}</span>
                      <ChevronUpDownIcon className="w-5 h-5 text-gray-400 absolute right-3 pointer-events-none" />
                    </Listbox.Button>
                    <Listbox.Options className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                      <Listbox.Option value="" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>全部科目</Listbox.Option>
                      <Listbox.Option value="數學" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>數學</Listbox.Option>
                      <Listbox.Option value="理化" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>理化</Listbox.Option>
                      <Listbox.Option value="物理" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>物理</Listbox.Option>
                      <Listbox.Option value="化學" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>化學</Listbox.Option>
                      <Listbox.Option value="生物" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>生物</Listbox.Option>
                    </Listbox.Options>
                  </div>
                </Listbox>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">部門</label>
                <Listbox value={form.department ?? ''} onChange={val => setForm(prev => ({ ...prev, department: val === '' ? undefined : val as '高中部' | '國中部' }))}>
                  <div className="relative">
                    <Listbox.Button className="select-unified min-w-[240px] md:min-w-[300px] max-w-full pr-12 flex items-center justify-between">
                      <span className="truncate">{form.department || '全部部門'}</span>
                      <ChevronUpDownIcon className="w-5 h-5 text-gray-400 absolute right-3 pointer-events-none" />
                    </Listbox.Button>
                    <Listbox.Options className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto focus:outline-none">
                      <Listbox.Option value="" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>全部部門</Listbox.Option>
                      <Listbox.Option value="高中部" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>高中部</Listbox.Option>
                      <Listbox.Option value="國中部" className={({ active }) => `cursor-pointer select-none relative py-2 pl-4 pr-10 ${active ? 'bg-blue-100 text-blue-900' : 'text-gray-900'}`}>國中部</Listbox.Option>
                    </Listbox.Options>
                  </div>
                </Listbox>
              </div>
            </div>

            {/* 內容 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">內容 *</label>
              <textarea
                className="input-unified resize-none"
                rows={6}
                value={form.content}
                onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                placeholder="公告內容"
                required
              />
            </div>

            {/* 連結管理 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-medium text-gray-700">連結</label>
                <button
                  type="button"
                  onClick={addLink}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  + 新增連結
                </button>
              </div>
              {form.links?.map((link, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="連結名稱"
                    value={link.name}
                    onChange={e => updateLink(index, 'name', e.target.value)}
                    className="flex-1 input-unified p-2"
                  />
                  <input
                    type="url"
                    placeholder="連結網址"
                    value={link.url}
                    onChange={e => updateLink(index, 'url', e.target.value)}
                    className="flex-1 input-unified p-2"
                  />
                  <button
                    type="button"
                    onClick={() => removeLink(index)}
                    className="text-red-600 hover:text-red-800 px-3 py-2"
                  >
                    刪除
                  </button>
                </div>
              ))}
            </div>

            {/* 按鈕 */}
            <div className="flex gap-3">
              <button
                type="submit"
                className="btn-primary px-6 py-2"
                disabled={loading}
              >
                {loading ? <LoadingSpinner size={5} className="mr-2" /> : (editingId ? '更新' : '新增')}
              </button>
              <button
                type="button"
                className="btn-secondary px-6 py-2"
                onClick={handleCancel}
                disabled={loading}
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 列表區域 */}
      {!isEditing && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner size={12} />
              <p className="text-gray-600 ml-4">載入中...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {announcements.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>尚無公告</p>
                </div>
              ) : (
                announcements.map(announcement => (
                  <div key={announcement.id} className="bg-white border border-gray-200 p-6 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <div className="font-semibold text-lg text-gray-900 mb-2">{announcement.title}</div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {announcement.contentType && (
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                              {announcement.contentType}
                            </span>
                          )}
                          {announcement.subject && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                              {announcement.subject}
                            </span>
                          )}
                          {announcement.department && (
                            <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded-full">
                              {announcement.department}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 ml-4">
                        {getCreatedAt(announcement)}
                      </div>
                    </div>
                    
                    <div className="text-gray-700 whitespace-pre-line mb-4">
                      {announcement.content}
                    </div>

                    {/* 連結顯示 */}
                    {announcement.links && announcement.links.length > 0 && (
                      <div className="mb-4">
                        <div className="text-sm font-medium text-gray-700 mb-2">相關連結：</div>
                        <div className="flex flex-wrap gap-2">
                          {announcement.links.map((link, index) => (
                            <a
                              key={index}
                              href={link.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-block bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                            >
                              {link.name}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3">
                      <button
                        className="text-blue-600 hover:text-blue-800 font-medium"
                        onClick={() => handleEdit(announcement)}
                      >
                        編輯
                      </button>
                      <button
                        className="text-red-600 hover:text-red-800 font-medium"
                        onClick={() => handleDelete(announcement.id)}
                      >
                        刪除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      <AlertDialog 
        open={alert.open} 
        message={alert.message} 
        onClose={() => setAlert({ open: false, message: '' })} 
      />
    </div>
  );
} 