'use client';

import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Swal from 'sweetalert2';
import Dropdown from './ui/Dropdown';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  MagnifyingGlassIcon, 
  MegaphoneIcon, 
  FunnelIcon, 
  LinkIcon,
  ChevronDownIcon,
  XMarkIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

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
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [selectedGrade, setSelectedGrade] = useState<string>('全部');
  const [searchTerm, setSearchTerm] = useState('');
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  async function fetchAnnouncements() {
    setLoading(true);
    try {
      const res = await fetch('/api/announcement/list');
      const data = await res.json();
      setAnnouncements(data as Announcement[]);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      Swal.fire({
        icon: 'error',
        title: '錯誤',
        text: '載入公告失敗',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' }
      });
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title || !form.content) {
      Swal.fire({
        icon: 'warning',
        title: '提醒',
        text: '標題和內容為必填項目',
        confirmButtonColor: '#4f46e5',
        customClass: { popup: 'rounded-2xl' }
      });
      return;
    }

    setLoading(true);
    try {
      const announcementData = {
        title: form.title,
        content: form.content,
        contentType: form.contentType || '公告事項',
        subject: form.subject || '',
        grade: form.grade || '',
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
          Swal.fire({
            icon: 'success',
            title: '更新成功',
            text: '公告已成功更新',
            confirmButtonColor: '#4f46e5',
            customClass: { popup: 'rounded-2xl' }
          });
          setAnnouncements(prev => prev.map(ann => 
            ann.id === editingId 
              ? { 
                  ...ann, 
                  ...announcementData, 
                  subject: (announcementData.subject || undefined) as Announcement['subject'],
                  grade: (announcementData.grade || undefined) as Announcement['grade'],
                  updatedAt: new Date() 
                } as Announcement
              : ann
          ));
        } else {
          const errorData = await response.json();
          Swal.fire({
            icon: 'error',
            title: '更新失敗',
            text: errorData.error || '未知錯誤',
            confirmButtonColor: '#ef4444',
            customClass: { popup: 'rounded-2xl' }
          });
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
          Swal.fire({
            icon: 'success',
            title: '建立成功',
            text: '新公告已成功建立',
            confirmButtonColor: '#4f46e5',
            customClass: { popup: 'rounded-2xl' }
          });
          const newAnnouncement: Announcement = {
            id: result.id,
            ...announcementData,
            subject: (announcementData.subject || undefined) as Announcement['subject'],
            grade: (announcementData.grade || undefined) as Announcement['grade'],
            createdAt: new Date(),
            updatedAt: new Date()
          };
          setAnnouncements(prev => [newAnnouncement, ...prev]);
        } else {
          const errorData = await response.json();
          Swal.fire({
            icon: 'error',
            title: '建立失敗',
            text: errorData.error || '未知錯誤',
            confirmButtonColor: '#ef4444',
            customClass: { popup: 'rounded-2xl' }
          });
          return;
        }
      }

      resetForm();
      setTimeout(() => {
        fetchAnnouncements();
      }, 500);
    } catch (error) {
      console.error('Error submitting form:', error);
      Swal.fire({
        icon: 'error',
        title: '操作失敗',
        text: '請檢查網路連線',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' }
      });
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    const result = await Swal.fire({
      title: '確定要刪除這則公告嗎？',
      text: "刪除後將無法復原。",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
      confirmButtonText: '確定刪除',
      cancelButtonText: '取消',
      customClass: { popup: 'rounded-2xl' }
    });

    if (!result.isConfirmed) return;
    
    setLoading(true);
    try {
      const res = await fetch('/api/announcement/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });

      if (res.ok) {
        Swal.fire({
          icon: 'success',
          title: '刪除成功',
          text: '公告已成功移除',
          confirmButtonColor: '#4f46e5',
          customClass: { popup: 'rounded-2xl' }
        });
        setAnnouncements(prev => prev.filter(ann => ann.id !== id));
        setTimeout(() => {
          fetchAnnouncements();
        }, 500);
      } else {
        const errorData = await res.json();
        Swal.fire({
          icon: 'error',
          title: '刪除失敗',
          text: errorData.error || '未知錯誤',
          confirmButtonColor: '#ef4444',
          customClass: { popup: 'rounded-2xl' }
        });
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
      Swal.fire({
        icon: 'error',
        title: '刪除失敗',
        text: '請檢查網路連線',
        confirmButtonColor: '#ef4444',
        customClass: { popup: 'rounded-2xl' }
      });
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
    // Scroll to top when editing
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
    const subjectMatch = selectedSubject === '' || announcement.subject === selectedSubject;
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
      date = (dateValue as { toDate: () => Date }).toDate();
    } else if (typeof dateValue === 'object' && dateValue !== null && '_seconds' in dateValue && '_nanoseconds' in dateValue) {
      date = new Date((dateValue as { _seconds: number, _nanoseconds: number })._seconds * 1000 + (dateValue as { _seconds: number, _nanoseconds: number })._nanoseconds / 1_000_000);
    }
    else {
      date = new Date(dateValue as string | number);
    }

    if (isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }

  return (
    <div className="max-w-7xl mx-auto w-full px-4 md:px-6 flex flex-col h-full overflow-y-auto animate-fade-in">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-0 mb-8">
        <div className="border-l-4 border-indigo-500 pl-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <MegaphoneIcon className="h-8 w-8 text-indigo-600" />
            公告管理
          </h1>
          <p className="text-gray-500 text-sm mt-1">發佈與管理網站公告、課程資訊與相關連結。</p>
        </div>
        {!isEditing && (
          <button
            onClick={() => {
              setEditingId(null);
              setForm({ title: '', content: '', contentType: '公告事項', links: [] });
              setIsEditing(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
            建立公告
          </button>
        )}
      </div>

      {/* 篩選器 */}
      {!isEditing && (
        <>
          {/* 手機版：展開/收合觸發按鈕 */}
          <div className="md:hidden mb-4">
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="w-full flex items-center justify-between bg-white px-5 py-4 rounded-xl shadow-sm border border-gray-100 transition-all active:scale-[0.99]"
            >
              <span className="font-bold text-gray-700 flex items-center text-sm">
                <FunnelIcon className="w-5 h-5 mr-2 text-indigo-500" />
                條件篩選與搜尋
              </span>
              <ChevronDownIcon 
                className={`w-5 h-5 text-gray-400 transform transition-transform duration-300 ${isFilterOpen ? 'rotate-180' : ''}`} 
              />
            </button>
          </div>

          <div className={`
            md:block mb-8 transition-all duration-300 ease-in-out
            ${isFilterOpen ? 'max-h-[1000px] opacity-100 overflow-visible' : 'max-h-0 md:max-h-none opacity-0 md:opacity-100 overflow-hidden md:overflow-visible'}
          `}>
            <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm flex-shrink-0">
              <div className="flex items-center gap-2 mb-4 text-gray-600 font-semibold">
                <FunnelIcon className="w-5 h-5" /> 篩選條件
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Dropdown
                      value={selectedContentType}
                      onChange={setSelectedContentType}
                      options={[{ value: '全部', label: '全部類型' }, ...contentTypeOptions]}
                      placeholder="全部類型"
                      className="w-full"
                  />
                  <Dropdown
                      value={selectedSubject}
                      onChange={setSelectedSubject}
                      options={subjectOptions}
                      className="w-full"
                  />
                  <Dropdown
                      value={selectedGrade}
                      onChange={setSelectedGrade}
                      options={[{ value: '全部', label: '全部年級' }, ...gradeOptions.filter(o => o.value !== '')]}
                      placeholder="全部年級"
                      className="w-full"
                  />
                  <div className="relative">
                      <input
                          type="text"
                          placeholder="搜尋公告..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                      <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* 表單區域 */}
      {isEditing && (
        <div className="bg-white border border-indigo-100 p-6 rounded-2xl shadow-lg mb-8 animate-fade-in ring-1 ring-indigo-50">
          <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
             <h3 className="text-xl font-bold text-indigo-900">
               {editingId ? '編輯公告' : '建立新公告'}
             </h3>
             <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
                <XMarkIcon className="w-6 h-6" />
             </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 gap-6">
                {/* 標題 */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">標題 <span className="text-red-500">*</span></label>
                    <input
                        className="w-full px-4 py-2.5 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm"
                        value={form.title}
                        onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="請輸入公告標題"
                        required
                    />
                </div>

                {/* 標籤選擇 */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">公告類型</label>
                        <Dropdown
                            value={form.contentType || ''}
                            onChange={val => setForm(prev => ({ ...prev, contentType: val as '公告事項' | '課程資訊' }))}
                            options={contentTypeOptions}
                            placeholder="全部類別"
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">科目</label>
                        <Dropdown
                            value={form.subject || ''}
                            onChange={val => setForm(prev => ({ ...prev, subject: val === '' ? undefined : val as '數學' | '理化' | '物理' | '化學' | '生物' }))}
                            options={subjectOptions}
                            placeholder="全部科目"
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-1.5">年級</label>
                        <Dropdown
                            value={form.grade || ''}
                            onChange={val => setForm(prev => ({ ...prev, grade: val === '' ? undefined : val as '國一' | '國二' | '國三' | '高一' | '高二' | '高三' | '職一' | '職二' | '職三' | '大一' | '進修' }))}
                            options={gradeOptions}
                            placeholder="全部年級"
                            className="w-full"
                        />
                    </div>
                </div>

                {/* 內容 */}
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">內容 <span className="text-red-500">*</span></label>
                    <textarea
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all shadow-sm resize-none"
                        rows={8}
                        value={form.content}
                        onChange={e => setForm(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="請輸入公告詳細內容..."
                        required
                    />
                </div>

                {/* 連結管理 */}
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                    <div className="flex justify-between items-center mb-3">
                        <label className="block text-sm font-bold text-gray-700 flex items-center">
                            <LinkIcon className="w-4 h-4 mr-2" /> 相關連結
                        </label>
                        <button
                            type="button"
                            onClick={addLink}
                            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center transition-colors"
                        >
                            <PlusIcon className="w-4 h-4 mr-1" /> 新增連結
                        </button>
                    </div>
                    
                    <div className="space-y-3">
                        {form.links && form.links.length > 0 ? (
                            form.links.map((link, index) => (
                                <div key={index} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                                    <input
                                        type="text"
                                        placeholder="連結名稱"
                                        value={link.name}
                                        onChange={e => updateLink(index, 'name', e.target.value)}
                                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                    <input
                                        type="url"
                                        placeholder="連結網址 (URL)"
                                        value={link.url}
                                        onChange={e => updateLink(index, 'url', e.target.value)}
                                        className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeLink(index)}
                                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                        title="移除連結"
                                    >
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-500 italic text-center py-2">尚無相關連結</p>
                        )}
                    </div>
                </div>
            </div>

            {/* 按鈕 */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                    type="button"
                    className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                    onClick={handleCancel}
                    disabled={loading}
                >
                    取消
                </button>
                <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium shadow-sm transition-all flex items-center"
                    disabled={loading}
                >
                    {loading ? <LoadingSpinner size={16} color="white" className="mr-2" /> : <CheckIcon className="w-5 h-5 mr-2" />}
                    {editingId ? '更新公告' : '發佈公告'}
                </button>
            </div>
          </form>
        </div>
      )}

      {/* 列表區域 */}
      {!isEditing && (
        <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20">
                <LoadingSpinner size={50} />
                <p className="text-gray-500 mt-4 font-medium">載入公告中...</p>
              </div>
            ) : filteredAnnouncements.length > 0 ? (
                <>
                  {/* Mobile Card View */}
                  <div className="md:hidden space-y-4">
                    {filteredAnnouncements.map(announcement => (
                      <div key={announcement.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-2">
                           <h3 className="font-bold text-lg text-gray-900 line-clamp-2">{announcement.title}</h3>
                           <span className={`px-2 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ml-2 ${announcement.contentType === '公告事項' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                               {announcement.contentType}
                           </span>
                        </div>
                        
                        <div className="space-y-1 text-sm text-gray-600 mb-4 bg-gray-50 p-3 rounded-lg">
                           <div className="flex justify-between">
                                <span className="text-gray-500">科目:</span>
                                <span className="font-medium">{announcement.subject || '-'}</span>
                           </div>
                           <div className="flex justify-between">
                                <span className="text-gray-500">年級:</span>
                                <span className="font-medium">{announcement.grade || '-'}</span>
                           </div>
                           <div className="flex justify-between">
                                <span className="text-gray-500">更新:</span>
                                <span className="font-mono">{formatDate(announcement.updatedAt)}</span>
                           </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
                          <button
                            onClick={() => handleEdit(announcement)}
                            className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center"
                          >
                            <PencilIcon className="w-4 h-4 mr-1" /> 編輯
                          </button>
                          <button
                            onClick={() => handleDelete(announcement.id)}
                            className="text-red-500 hover:text-red-700 font-medium text-sm flex items-center"
                          >
                            <TrashIcon className="w-4 h-4 mr-1" /> 刪除
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop Table View */}
                  <div className="hidden md:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                    <table className="w-full text-sm text-left text-gray-500">
                      <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-4 font-bold">標題</th>
                          <th scope="col" className="px-6 py-4 font-bold text-center w-28">類型</th>
                          <th scope="col" className="px-6 py-4 font-bold text-center w-24">科目</th>
                          <th scope="col" className="px-6 py-4 font-bold text-center w-24">年級</th>
                          <th scope="col" className="px-6 py-4 font-bold w-32">最後更新</th>
                          <th scope="col" className="px-6 py-4 font-bold text-right w-32">操作</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredAnnouncements.map(announcement => (
                          <tr key={announcement.id} className="bg-white hover:bg-gray-50 transition-colors group">
                            <td className="px-6 py-4 font-medium text-gray-900">
                                {announcement.title}
                            </td>
                            <td className="px-6 py-4 text-center">
                                <span className={`px-2 py-1 text-xs rounded-full font-medium ${announcement.contentType === '公告事項' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'}`}>
                                    {announcement.contentType}
                                </span>
                            </td>
                            <td className="px-6 py-4 text-center">{announcement.subject || '-'}</td>
                            <td className="px-6 py-4 text-center">{announcement.grade || '-'}</td>
                            <td className="px-6 py-4 font-mono text-xs">{formatDate(announcement.updatedAt)}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-3 opacity-80 group-hover:opacity-100 transition-opacity">
                                <button
                                  className="text-indigo-600 hover:text-indigo-900 transition-colors p-1.5 hover:bg-indigo-50 rounded-lg"
                                  onClick={() => handleEdit(announcement)}
                                  title="編輯"
                                >
                                  <PencilIcon className="w-4 h-4" />
                                </button>
                                <button
                                  className="text-red-500 hover:text-red-700 transition-colors p-1.5 hover:bg-red-50 rounded-lg"
                                  onClick={() => handleDelete(announcement.id)}
                                  title="刪除"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
            ) : (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                    <MegaphoneIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900">尚無公告</h3>
                    <p className="text-gray-500 mt-1">目前沒有符合條件的公告。</p>
                </div>
            )}
        </div>
      )}
    </div>
  );
}