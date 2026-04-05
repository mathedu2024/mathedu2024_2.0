'use client';

import React, { useState, useEffect } from 'react';
import LoadingSpinner from './LoadingSpinner';
import Swal from 'sweetalert2';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  KeyIcon, 
  MagnifyingGlassIcon,
  UserIcon,
  ShieldCheckIcon,
  AcademicCapIcon
} from '@heroicons/react/24/outline';

interface AdminTeacher {
  id: string;
  name: string;
  account: string;
  password: string;
  roles: ('admin' | 'teacher')[];
  note?: string;
}

const DEFAULT_PASSWORD = 'abcd1234';

function generateRandomId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString() + Math.floor(Math.random() * 100000).toString();
}

export default function TeacherAdminManager() {
  const [teachers, setTeachers] = useState<AdminTeacher[]>([]);
  const [editingTeacher, setEditingTeacher] = useState<AdminTeacher | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [loading, setLoading] = useState(false);

  // 取得管理員/老師列表
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/admin/list');
        const adminList: AdminTeacher[] = await res.json();
        setTeachers(adminList);
      } catch (error) {
        console.error('Error fetching data', error);
        Swal.fire('錯誤', '讀取資料失敗，請稍後再試。', 'error');
      }
      setLoading(false);
    };
    fetchData();
  }, []);

  // 新增或更新
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;

    // Trim whitespace from account and create a clean data object for submission
    const teacherData = { ...editingTeacher, account: editingTeacher.account.trim() };

    if (!teacherData.account) {
      Swal.fire({ icon: 'warning', title: '警告', text: '帳號不能為空' });
      return;
    }

    // 帳號格式檢查
    if (!/^[A-Za-z0-9]+$/.test(teacherData.account)) {
      Swal.fire({ icon: 'warning', title: '警告', text: '帳號僅能包含英文字母(區分大小寫)和數字，不能有空白、標點或其他字元' });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const isUpdating = !!teacherData.id;

      // 檢查帳號是否重複
      const res = await fetch('/api/admin/list');
      const adminList: AdminTeacher[] = await res.json();
      const isDuplicate = adminList.some((item: AdminTeacher) => {
        if (isUpdating && item.id === teacherData.id) {
          return false;
        }
        return item.account === teacherData.account;
      });

      if (isDuplicate) {
        Swal.fire({ icon: 'warning', title: '警告', text: '此帳號已被使用，請更換帳號' });
        setIsSubmitting(false);
        return;
      }

      const data = {
        ...teacherData,
        id: isUpdating ? teacherData.id : generateRandomId(),
        password: isUpdating ? teacherData.password : DEFAULT_PASSWORD,
      };

      await fetch('/api/admin/create-user', { method: 'POST', body: JSON.stringify(data) });

      setTeachers(prevTeachers => {
        if (isUpdating) {
          return prevTeachers.map(item => item.id === teacherData.id ? data : item);
        } else {
          return [...prevTeachers, data];
        }
      });
      
      Swal.fire('成功', `帳號 ${data.account} 已成功${isUpdating ? '更新' : '建立'}。`, 'success');
      setEditingTeacher(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Submit error:', error);
      Swal.fire('錯誤', '儲存失敗，請稍後再試。', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 刪除
  const handleDelete = async (account: string) => {
    if (account === 'test') return;

    const result = await Swal.fire({
      title: '請確認',
      text: '確定要刪除此帳號嗎？此操作無法復原！',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: '確定刪除',
      cancelButtonText: '取消',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#9ca3af',
    });

    if (!result.isConfirmed) return;

    setIsSubmitting(true);
    try {
      await fetch('/api/admin/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account }),
      });
      setTeachers(teachers => teachers.filter(item => item.account !== account));
      Swal.fire('已刪除!', '帳號已成功刪除。', 'success');
    } catch {
      Swal.fire('錯誤', '刪除失敗，請稍後再試。', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 密碼復原
  const handleResetPassword = async (account: string) => {
    const result = await Swal.fire({
      title: '請確認',
      text: `確定要將帳號 ${account} 的密碼復原為預設密碼 (${DEFAULT_PASSWORD})？`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: '確定',
      cancelButtonText: '取消',
      confirmButtonColor: '#4f46e5',
    });

    if (!result.isConfirmed) return;
    
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/update-password', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account.trim(), password: DEFAULT_PASSWORD }) 
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || '密碼復原失敗');
      }
      
      Swal.fire('成功', '密碼已復原為預設值。', 'success');
    } catch (error) {
      console.error('密碼復原失敗:', error);
      const message = error instanceof Error ? error.message : '未知錯誤';
      Swal.fire('錯誤', `密碼復原失敗: ${message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setEditingTeacher(null);
    setIsEditing(false);
  };

  const handleEdit = (item: AdminTeacher) => {
    setEditingTeacher(item);
    setIsEditing(true);
  };

  const handleAdd = () => {
    setEditingTeacher({ id: '', name: '', account: '', password: DEFAULT_PASSWORD, roles: [], note: '' });
    setIsEditing(true);
  };

  const filteredTeachers = teachers.filter(teacher => {
    const name = teacher.name || '';
    const account = teacher.account || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           account.toLowerCase().includes(searchTerm.toLowerCase());
  });

  return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col h-full">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center">
        <ShieldCheckIcon className="w-8 h-8 mr-3 text-indigo-600" />
        老師/管理員管理
      </h2>
      
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
        <div className="text-sm text-gray-500">
          管理系統後台的使用者帳號、權限與基本資料。
        </div>
      </div>

      {!isEditing && (
        <div className="bg-white border border-gray-200 p-4 rounded-xl shadow-sm mb-6 flex-shrink-0">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1 w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                </div>
                <input
                    type="text"
                    placeholder="搜尋姓名或帳號..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                />
            </div>
            <button
              onClick={handleAdd}
              className="w-full md:w-auto inline-flex items-center justify-center px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-sm font-medium"
            >
              <PlusIcon className="w-5 h-5 mr-2" /> 新增帳號
            </button>
          </div>
        </div>
      )}

      {/* 新增/編輯表單 */}
      {isEditing && editingTeacher && (
        <div className="bg-white border border-gray-200 p-6 rounded-2xl shadow-sm mb-6 animate-fade-in">
          <div className="flex justify-between items-center mb-6 border-b border-gray-100 pb-4">
            <h3 className="text-xl font-bold text-gray-800">
                {editingTeacher.id ? '編輯帳號資料' : '建立新帳號'}
            </h3>
            <button onClick={handleCancel} className="text-gray-400 hover:text-gray-600">
                <span className="sr-only">關閉</span>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
            </button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">姓名 <span className="text-red-500">*</span></label>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <UserIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input 
                        type="text" 
                        value={editingTeacher?.name || ''} 
                        onChange={e => setEditingTeacher(prev => prev ? { ...prev, name: e.target.value } : { id: '', name: e.target.value, account: '', password: DEFAULT_PASSWORD, roles: [], note: '' })} 
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent" 
                        required 
                        placeholder="請輸入姓名"
                    />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">帳號 <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={editingTeacher?.account || ''} 
                  onChange={e => setEditingTeacher(prev => prev ? { ...prev, account: e.target.value } : { id: '', name: '', account: e.target.value, password: DEFAULT_PASSWORD, roles: [], note: '' })} 
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono" 
                  required 
                  placeholder="請輸入登入帳號 (英數組合)"
                />
                <p className="text-xs text-gray-500 mt-1">僅限英文字母與數字，不可包含空白。</p>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-3">系統權限 <span className="text-red-500">*</span></label>
                <div className="flex flex-wrap gap-4">
                  <label className={`flex items-center px-4 py-3 border rounded-xl cursor-pointer transition-all ${editingTeacher?.roles?.includes('admin') ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input 
                      type="checkbox" 
                      checked={editingTeacher?.roles?.includes('admin') || false} 
                      onChange={e => setEditingTeacher(prev => prev ? { ...prev, roles: e.target.checked ? [...(prev.roles || []), 'admin'] : (prev.roles || []).filter(r => r !== 'admin') } : null)} 
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-3"
                    />
                    <ShieldCheckIcon className="w-5 h-5 mr-2" />
                    <span className="font-medium">系統管理員</span>
                  </label>
                  
                  <label className={`flex items-center px-4 py-3 border rounded-xl cursor-pointer transition-all ${editingTeacher?.roles?.includes('teacher') ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50'}`}>
                    <input 
                      type="checkbox" 
                      checked={editingTeacher?.roles?.includes('teacher') || false} 
                      onChange={e => setEditingTeacher(prev => prev ? { ...prev, roles: e.target.checked ? [...(prev.roles || []), 'teacher'] : (prev.roles || []).filter(r => r !== 'teacher') } : null)} 
                      className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-3"
                    />
                    <AcademicCapIcon className="w-5 h-5 mr-2" />
                    <span className="font-medium">授課老師</span>
                  </label>
                </div>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">備註說明</label>
                <textarea 
                  value={editingTeacher?.note || ''} 
                  onChange={e => setEditingTeacher(prev => prev ? { ...prev, note: e.target.value } : null)} 
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none" 
                  rows={3}
                  placeholder="可選填相關備註..."
                />
              </div>
            </div>
            
            <div className="flex gap-3 justify-end pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                disabled={isSubmitting}
              >
                取消
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium shadow-sm transition-colors disabled:opacity-70 flex items-center"
                disabled={isSubmitting}
              >
                {isSubmitting && <LoadingSpinner size={16} color="white" className="mr-2" />}
                {editingTeacher.id ? '儲存變更' : '建立帳號'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 列表區域 - 編輯時隱藏 */}
      {!isEditing && (
        <div className="flex-1 min-h-0 flex flex-col">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <LoadingSpinner size={40} />
              <p className="text-gray-500 ml-4 font-medium">資料讀取中...</p>
            </div>
          ) : (
            <>
              {/* Mobile View: Modular Cards */}
              <div className="block md:hidden space-y-4 pb-20">
                {filteredTeachers.length > 0 ? (
                  filteredTeachers.map(item => (
                    <div key={item.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-5 relative overflow-hidden">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                            <h3 className="font-bold text-lg text-gray-900">{item.name}</h3>
                            <p className="text-sm font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded mt-1 inline-block">{item.account}</p>
                        </div>
                        <div className="flex gap-1">
                            {item.roles.map(role => (
                                <span key={role} className={`px-2 py-1 rounded text-xs font-bold ${
                                    role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                }`}>
                                    {role === 'admin' ? '管理員' : '老師'}
                                </span>
                            ))}
                        </div>
                      </div>
                      
                      {item.note && (
                          <div className="text-sm text-gray-600 mb-4 bg-gray-50 p-2 rounded-lg border border-gray-100">
                              <span className="font-bold text-gray-400 text-xs uppercase block mb-1">備註</span>
                              {item.note}
                          </div>
                      )}
                      
                      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                        <button 
                          onClick={() => handleResetPassword(item.account)} 
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
                          title="重設密碼"
                          disabled={isSubmitting}
                        >
                          <KeyIcon className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleEdit(item)} 
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="編輯"
                        >
                          <PencilIcon className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item.account)} 
                          className={`p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors ${item.account === 'test' ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="刪除"
                          disabled={item.account === 'test'}
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center bg-white rounded-xl border border-dashed border-gray-300">
                      <p className="text-gray-500">沒有找到符合條件的資料</p>
                  </div>
                )}
              </div>

              {/* Desktop View: Table */}
              <div className="hidden md:block bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left text-gray-500">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th scope="col" className="px-6 py-4 font-bold w-1/4">姓名</th>
                      <th scope="col" className="px-6 py-4 font-bold w-1/4">帳號</th>
                      <th scope="col" className="px-6 py-4 font-bold w-1/6">權限</th>
                      <th scope="col" className="px-6 py-4 font-bold">備註</th>
                      <th scope="col" className="px-6 py-4 font-bold text-right w-48">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTeachers.length > 0 ? filteredTeachers.map(item => (
                      <tr key={item.id} className="bg-white hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4 font-bold text-gray-900">
                            {item.name}
                        </td>
                        <td className="px-6 py-4">
                            <span className="font-mono bg-gray-100 px-2 py-1 rounded text-gray-700">{item.account}</span>
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex gap-2">
                                {item.roles.map(role => (
                                    <span key={role} className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                                        role === 'admin' 
                                        ? 'bg-purple-50 text-purple-700 border-purple-200' 
                                        : 'bg-blue-50 text-blue-700 border-blue-200'
                                    }`}>
                                        {role === 'admin' ? '管理員' : '老師'}
                                    </span>
                                ))}
                            </div>
                        </td>
                        <td className="px-6 py-4 text-gray-500 truncate max-w-xs" title={item.note}>
                            {item.note || '-'}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleResetPassword(item.account)} 
                              className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors border border-transparent hover:border-yellow-200"
                              title="重設密碼"
                              disabled={isSubmitting}
                            >
                              <KeyIcon className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleEdit(item)} 
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-200"
                              title="編輯"
                            >
                              <PencilIcon className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(item.account)} 
                              className={`p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 ${item.account === 'test' ? 'opacity-50 cursor-not-allowed' : ''}`}
                              title="刪除"
                              disabled={item.account === 'test'}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )) : (
                        <tr>
                            <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                無符合資料
                            </td>
                        </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}