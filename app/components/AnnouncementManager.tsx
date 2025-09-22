'use client';

import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import alerts from '../utils/alerts';
import Dropdown from './ui/Dropdown';

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
  grade?: '國一' | '國二' | '國三' | '高一' | '高二' | '高三' | '職一' | '職二' | '職三' | '大一' | '進修';
  links?: Link[];
  createdAt?: Date | { toDate: () => Date } | string | number | undefined;
  updatedAt?: Date | { toDate: () => Date } | string | number | undefined;
}

const contentTypeOptions = [
  { value: '公告事項', label: '公告事項' },
  { value: '課程資訊', label: '課程資訊' },
];

const subjectOptions = [
  { value: '', label: '全部科目' },
  { value: '數學', label: '數學' },
  { value: '理化', label: '理化' },
  { value: '物理', label: '物理' },
  { value: '化學', label: '化學' },
  { value: '生物', label: '生物' },
];

const gradeOptions = [
  { value: '', label: '全部年級' },
  { value: '國一', label: '國一' },
  { value: '國二', label: '國二' },
  { value: '國三', label: '國三' },
  { value: '高一', label: '高一' },
  { value: '高二', label: '高二' },
  { value: '高三', label: '高三' },
  { value: '職一', label: '職一' },
  { value: '職二', label: '職二' },
  { value: '職三', label: '職三' },
  { value: '大一', label: '大一' },
  { value: '進修', label: '進修' },
];

export default function AnnouncementManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [form, setForm] = useState<Partial<Announcement>>({
    title: '',
    content: '',
    contentType: '公告事項',
    subject: undefined,
    grade: undefined,
    links: []
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedContentType, setSelectedContentType] = useState<string>('全部');
  const [selectedSubject, setSelectedSubject] = useState<string>('全部');
  const [selectedGrade, setSelectedGrade] = useState<string>('全部');
  const [searchTerm, setSearchTerm] = useState('');

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
      alerts.showError('載入公告失敗');
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.content) {
      alerts.showWarning('標題和內容為必填項目');
      return;
    }

    setLoading(true);
    try {
      const announcementData = {
        title: form.title,
        content: form.content,
        contentType: form.contentType,
        subject: form.subject,
        grade: form.grade,
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
          alerts.showSuccess('公告更新成功');
          // 立即更新本地狀態以確保同步
          setAnnouncements(prev => prev.map(ann => 
            ann.id === editingId 
              ? { ...ann, ...announcementData, updatedAt: new Date() }
              : ann
          ));
        } else {
          const errorData = await response.json();
          alerts.showError(`更新失敗: ${errorData.error || '未知錯誤'}`);
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
          alerts.showSuccess('公告建立成功');
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
          alerts.showError(`建立失敗: ${errorData.error || '未知錯誤'}`);
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
      alerts.showError('操作失敗，請檢查網路連線');
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
        alerts.showSuccess('公告刪除成功');
        // 立即從本地狀態移除以確保同步
        setAnnouncements(prev => prev.filter(ann => ann.id !== id));
        // 延遲重新載入以確保資料庫更新完成
        setTimeout(() => {
          fetchAnnouncements();
        }, 500);
      } else {
        const errorData = await res.json();
        alerts.showError(`刪除失敗: ${errorData.error || '未知錯誤'}`);
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
      alerts.showError('刪除失敗，請檢查網路連線');
    }
    setLoading(false);
  }

  function handleEdit(announcement: Announcement) {
    setForm({
      title: announcement.title,
      content: announcement.content,
      contentType: announcement.contentType,
      subject: announcement.subject,
      grade: announcement.grade,
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
      grade: undefined,
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

  const filteredAnnouncements = announcements.filter(announcement => {
    const contentTypeMatch = selectedContentType === '全部' || announcement.contentType === selectedContentType;
    const subjectMatch = selectedSubject === '全部' || announcement.subject === selectedSubject;
    const gradeMatch = selectedGrade === '全部' || announcement.grade === selectedGrade;
    const searchTermMatch = !searchTerm ||
      announcement.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      announcement.content.toLowerCase().includes(searchTerm.toLowerCase());
    return contentTypeMatch && subjectMatch && gradeMatch && searchTermMatch;
  });

  function formatDate(dateValue: Date | { toDate: () => Date } | string | number | undefined) {
    if (!dateValue) return '';
    
    let date: Date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'object' && dateValue !== null && 'toDate' in dateValue && typeof (dateValue as { toDate: () => Date }).toDate === 'function') {
      // This path is for actual Firestore Timestamp objects with a toDate method
      date = (dateValue as { toDate: () => Date }).toDate();
    } else if (typeof dateValue === 'object' && dateValue !== null && '_seconds' in dateValue && '_nanoseconds' in dateValue) {
      // This path is for plain objects that represent Firestore Timestamps after JSON serialization/deserialization
      date = new Date((dateValue as { _seconds: number, _nanoseconds: number })._seconds * 1000 + (dateValue as { _seconds: number, _nanoseconds: number })._nanoseconds / 1_000_000);
    }
    else {
      date = new Date(dateValue as string | number);
    }

    if (isNaN(date.getTime())) {
      return ''; // Invalid date
    }

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  return (
    <div className="max-w-6xl mx-auto w-full p-4 h-full flex flex-col min-h-0">
      <h2 className="text-2xl font-bold mb-6 flex-shrink-0">公告管理</h2>
      <div className="bg-white border border-gray-200 p-6 rounded-lg shadow-sm mb-6 flex-shrink-0">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <Dropdown
            value={selectedContentType}
            onChange={setSelectedContentType}
            options={[{ value: '全部', label: '全部類型' }, ...contentTypeOptions]}
            placeholder="全部類型"
            className="w-full md:w-48"
          />
          <Dropdown
            value={selectedSubject}
            onChange={setSelectedSubject}
            options={[{ value: '全部', label: '全部科目' }, ...subjectOptions.filter(o => o.value !== '')]}
            placeholder="全部科目"
            className="w-full md:w-48"
          />
          <Dropdown
            value={selectedGrade}
            onChange={setSelectedGrade}
            options={[{ value: '全部', label: '全部年級' }, ...gradeOptions.filter(o => o.value !== '')]}
            placeholder="全部年級"
            className="w-full md:w-48"
          />
          <input
            type="text"
            placeholder="搜尋公告標題或內容..."
            className="w-full md:w-64 p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {!isEditing && (
            <button
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 whitespace-nowrap"
              onClick={() => {
                setEditingId(null);
                setForm({
                  title: '',
                  content: '',
                  contentType: '公告事項',
                  subject: undefined,
                  grade: undefined,
                  links: []
                });
                setIsEditing(true);
              }}
            >
              建立公告
            </button>
          )}
        </div>
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
                <Dropdown
                  value={form.contentType || ''}
                  onChange={val => setForm(prev => ({ ...prev, contentType: val as '公告事項' | '課程資訊' }))}
                  options={contentTypeOptions}
                  placeholder="全部類別"
                  className="min-w-[240px] md:min-w-[300px] max-w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">科目</label>
                <Dropdown
                  value={form.subject || ''}
                  onChange={val => setForm(prev => ({ ...prev, subject: val === '' ? undefined : val as '數學' | '理化' | '物理' | '化學' | '生物' }))}
                  options={subjectOptions}
                  placeholder="全部科目"
                  className="min-w-[240px] md:min-w-[300px] max-w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">年級</label>
                <Dropdown
                  value={form.grade || ''}
                  onChange={val => setForm(prev => ({ ...prev, grade: val === '' ? undefined : val as '國一' | '國二' | '國三' | '高一' | '高二' | '高三' | '職一' | '職二' | '職三' | '大一' | '進修' }))}
                  options={gradeOptions}
                  placeholder="全部年級"
                  className="min-w-[240px] md:min-w-[300px] max-w-full"
                />
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
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left text-gray-500">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3">標題</th>
                <th scope="col" className="px-6 py-3">類型</th>
                <th scope="col" className="px-6 py-3">科目</th>
                <th scope="col" className="px-6 py-3">年級</th>
                <th scope="col" className="px-6 py-3">最後更新時間</th>
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
              ) : filteredAnnouncements.length > 0 ? filteredAnnouncements.map(announcement => (
                <tr key={announcement.id} className="bg-white border-b hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">{announcement.title}</td>
                  <td className="px-6 py-4">{announcement.contentType}</td>
                  <td className="px-6 py-4">{announcement.subject}</td>
                  <td className="px-6 py-4">{announcement.grade}</td>
                  <td className="px-6 py-4">{formatDate(announcement.updatedAt)}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-3 w-full">
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
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-gray-500">
                    尚無公告
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      
    </div>
  );
} 